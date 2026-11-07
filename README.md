# Mapping Regional Economic Development in India Using VIIRS Nighttime Lights and Machine Learning

## Overview
An end-to-end geospatial machine learning pipeline that fuses high-resolution VIIRS Nighttime Light (NTL) monthly composites from Google Earth Engine with OpenStreetMap (OSM) Points-of-Interest (POI) data to evaluate and forecast fine-grained sub-district economic momentum across metropolitan regions in India.

## Key Features & Architecture
- **Data Ingestion:** Cloud-native processing of VIIRS DNB monthly composites via Google Earth Engine (GEE).
- **Feature Engineering:** Seasonal-Trend Decomposition using Loess (STL) for noise filtering and anomaly detection.
- **Geospatial Clustering:** Density-Based Spatial Clustering of Applications with Noise (DBSCAN) to isolate commercial/nightlife hotspots.
- **Predictive Modeling:** Trained and evaluated ensemble regression models (Random Forest and XGBoost), with XGBoost achieving an optimal predictive accuracy ($R^2 = 0.6828, \text{RMSE} = 0.0046$).

## Team & Project Context
This research project was developed as part of our Bachelor of Engineering final-year curriculum at AISSMS College of Engineering.
- **Authors:** Aditya Bapat, Hrishikesh Patil, Vishal Gupta, Dr. A. J. Kadam (Guide)
- **Individual Contribution:** ML forecasting pipeline development (XGBoost/Random Forest), temporal feature engineering (STL decomposition), and data ingestion via Google Earth Engine API.
