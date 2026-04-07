from flask import Flask, render_template, request, jsonify
import logic  
import os

app = Flask(__name__)

print("🚀 Starting Server...")
logic.initialize_gee()

# ==========================================
# MASTER TIER 1, 2, 3 CITY DATABASE
# ==========================================
INDIAN_CITIES = {
    # TIER 1 (Saturated Megacities)
    "Mumbai": [19.0760, 72.8777], "Delhi": [28.7041, 77.1025],
    "Bangalore": [12.9716, 77.5946], "Hyderabad": [17.3850, 78.4867],
    "Ahmedabad": [23.0225, 72.5714], "Chennai": [13.0827, 80.2707],
    "Kolkata": [22.5726, 88.3639], "Pune": [18.5204, 73.8567],
    
    # TIER 2 (High Growth / Sprawl Targets)
    "Jaipur": [26.9124, 75.7873], "Lucknow": [26.8467, 80.9462],
    "Kanpur": [26.4499, 80.3319], "Nagpur": [21.1458, 79.0882],
    "Indore": [22.7196, 75.8577], "Thane": [19.2183, 72.9781],
    "Bhopal": [23.2599, 77.4126], "Visakhapatnam": [17.6868, 83.2185],
    "Surat": [21.1702, 72.8311], "Vadodara": [22.3072, 73.1812],
    "Ghaziabad": [28.6692, 77.4538], "Ludhiana": [30.9010, 75.8573],
    "Agra": [27.1767, 78.0081], "Nashik": [20.0110, 73.7903],
    "Ranchi": [23.3441, 85.3096], "Meerut": [28.9845, 77.7064],
    
    # TIER 3 (Emerging / Stagnant)
    "Kolhapur": [16.7050, 74.2433], "Udaipur": [24.5854, 73.7125],
    "Mysore": [12.2958, 76.6394], "Dehradun": [30.3165, 78.0322],
    "Kochi": [9.9312, 76.2673], "Bhubaneswar": [20.2961, 85.8245],
    "Guwahati": [26.1445, 91.7362], "Chandigarh": [30.7333, 76.7794],
    "Thiruvananthapuram": [8.5241, 76.9366], "Jodhpur": [26.2389, 73.0243]
}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        city_input = data.get('city', '').strip().title()
        
        pin_lat = data.get('lat')
        pin_lon = data.get('lon') 
        
        if pin_lat is not None and pin_lon is not None:
            final_lat, final_lon = float(pin_lat), float(pin_lon)
            print(f"📍 TACTICAL PIN DROP: {city_input} | {final_lat}, {final_lon}")
        else:
            if city_input not in INDIAN_CITIES:
                return jsonify({"error": f"Target '{city_input}' not in Tier Database. Please click the map to drop a manual pin!"})
            final_lat, final_lon = INDIAN_CITIES[city_input]
            print(f"📥 TEXT SEARCH: {city_input} | {final_lat}, {final_lon}")
        
        result = logic.analyze_city(city_input, final_lat, final_lon)
        result['coords'] = [final_lat, final_lon]
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Cloud Run dynamic port mapping
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)