import ee
import joblib
import pandas as pd
import numpy as np
import sqlite3
from datetime import datetime

DB_NAME = "urban_growth.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS city_stats 
                      (city TEXT PRIMARY KEY, avg_radiance REAL, growth_rate REAL, 
                       status TEXT, confidence TEXT, last_updated DATE)''')
    conn.commit()
    conn.close()

def get_cached_data(city):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM city_stats WHERE city=?", (city,))
    row = cursor.fetchone()
    conn.close()
    if row: return {"city": row[0], "avg_radiance": row[1], "growth_rate": row[2], "status": row[3], "confidence": row[4], "source": "Database"}
    return None

def save_to_db(data):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''INSERT OR REPLACE INTO city_stats 
                      (city, avg_radiance, growth_rate, status, confidence, last_updated)
                      VALUES (?, ?, ?, ?, ?, ?)''', 
                   (data['city'], data['avg_radiance'], data['growth_rate'], data['status'], data['confidence'], datetime.now()))
    conn.commit()
    conn.close()

def initialize_gee():
    init_db()
    try:
        service_account = 'fyp-bot@project1-473514.iam.gserviceaccount.com' 
        credentials = ee.ServiceAccountCredentials(service_account, 'ee-key.json')
        ee.Initialize(credentials)
        print("✅ GEE Connected Successfully")
    except Exception as e: print(f"❌ GEE Connection Failed: {e}")

try:
    model = joblib.load('model_v3.pkl')
    scaler = joblib.load('scaler_v3.pkl')
except:
    model = None; scaler = None

def analyze_city(city_name, lat, lon):
    if not city_name.startswith("COORD_"):
        cached = get_cached_data(city_name)
        if cached and 'heatmap_urls' in cached: return cached

    print(f"🌍 FETCHING SATELLITE DATA FOR: {city_name}...")
    point = ee.Geometry.Point(lon, lat)
    outer_circle = point.buffer(15000)
    inner_circle = point.buffer(5000)
    donut_ring = outer_circle.difference(inner_circle)

    def mask_clouds(image): return image.updateMask(image.select('cf_cvg').gt(0))
    collection = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG").map(mask_clouds)
    
    img_old = collection.filterDate('2023-01-01', '2024-01-01').select('avg_rad').mean()
    img_new = collection.filterDate('2024-01-01', '2025-01-01').select('avg_rad').mean()

    try:
        combined_reducer = ee.Reducer.mean().combine(reducer2=ee.Reducer.stdDev(), sharedInputs=True)
        old_stats = img_old.reduceRegion(combined_reducer, donut_ring, 500).getInfo()
        new_stats = img_new.reduceRegion(combined_reducer, donut_ring, 500).getInfo()
        
        prev_rad = old_stats.get('avg_rad_mean', 0) or 0
        curr_rad = new_stats.get('avg_rad_mean', 0) or 0
        patchiness = new_stats.get('avg_rad_stdDev', 0) or 0
    except Exception as e: return {"error": str(e)}

    radiance_growth = (curr_rad - prev_rad) / prev_rad if prev_rad > 0 else 0
    poi_density = {"Mumbai": 45.0, "Pune": 30.0}.get(city_name, 25.0)

    features = np.array([[curr_rad, poi_density, radiance_growth, (poi_density * curr_rad) / 100, patchiness]])
    scaled_features = scaler.transform(features) if scaler else features 
    
    if model:
        pred_class = model.predict(scaled_features)[0]
        status = "High Growth 🟢" if pred_class == 1 else "Stagnant 🔴"
        confidence = f"{round(np.max(model.predict_proba(scaled_features)) * 100, 1)}%"
    else: status = "Unknown"; confidence = "0%"

    # ==========================================
    # QUARTERLY 20-FRAME TIME-LAPSE
    # ==========================================
    vis_params = {'min': 0.5, 'max': 30.0, 'palette': ['4B0082', '0000FF', '00FF00', 'FFFF00', 'FF0000']}
    timeline_labels = []
    timeline_radiance = []
    heatmap_urls = {}

    for year in range(2021, 2026):
        for q in range(1, 5):
            start_month = (q - 1) * 3 + 1
            start_date = f"{year}-{start_month:02d}-01"
            end_date = f"{year+1}-01-01" if start_month + 3 == 13 else f"{year}-{(start_month+3):02d}-01"
            label = f"Q{q} {year}"
            timeline_labels.append(label)
            
            try:
                h_img = collection.filterDate(start_date, end_date).select('avg_rad').mean()
                h_rad = h_img.reduceRegion(ee.Reducer.mean(), donut_ring, 500).getInfo().get('avg_rad', 0)
                timeline_radiance.append(round(h_rad if h_rad else 0, 2))
                
                masked_h = h_img.updateMask(h_img.gt(0.5))
                heatmap_urls[label] = masked_h.clip(outer_circle).getMapId(vis_params)['tile_fetcher'].url_format
            except: 
                timeline_radiance.append(0)
                heatmap_urls[label] = None

    gdp_data = np.linspace(7.1, 9.5, 20).round(2).tolist() if city_name == "Pune" else np.linspace(5.0, 7.0, 20).round(2).tolist()

    result = {
        "city": city_name, "avg_radiance": round(curr_rad, 2), "growth_rate": round(radiance_growth * 100, 2),
        "patchiness": round(patchiness, 2), "status": status, "confidence": confidence,
        "heatmap_urls": heatmap_urls, "heatmap_url": heatmap_urls.get('Q4 2025'),
        "timeline_years": timeline_labels, "timeline_radiance": timeline_radiance, "timeline_gdp": gdp_data
    }
    
    if not city_name.startswith("COORD_"): save_to_db(result)
    return result