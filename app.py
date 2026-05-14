"""
Earth Status Monitor - Desktop Art Object
FastAPI backend + PyWebView desktop window
"""
import sys
import threading
import random
import requests
import uvicorn
import webview
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

# При запуске из PyInstaller --onefile ресурсы лежат в sys._MEIPASS,
# а не рядом с app.py.
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
STATIC_DIR = BASE_DIR / "static"

app = FastAPI()

# --- Data Store ---
earth_data = {
    "avg_temp": 0,
    "avg_humidity": 0,
    "avg_wind": 0,
    "locations_scanned": 0,
    "co2_level": 420,  # Simulated baseline
    "air_quality_index": 50,  # Simulated
}

earthquake_events = []

# --- Locations for scanning ---
LOCATIONS = [
    {"name": "Tokyo", "lat": 35.6895, "lon": 139.6917},
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "London", "lat": 51.5074, "lon": -0.1278},
    {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
    {"name": "Moscow", "lat": 55.7558, "lon": 37.6173},
    {"name": "Cairo", "lat": 30.0444, "lon": 31.2357},
    {"name": "Rio de Janeiro", "lat": -22.9068, "lon": -43.1729},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "Beijing", "lat": 39.9042, "lon": 116.4074},
    {"name": "Cape Town", "lat": -33.9249, "lon": 18.4241},
]

USGS_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson"

# --- Background Data Fetchers ---
def fetch_weather_loop():
    global earth_data
    temps, humids, winds = [], [], []
    
    while True:
        try:
            for loc in LOCATIONS:
                url = f"https://api.open-meteo.com/v1/forecast?latitude={loc['lat']}&longitude={loc['lon']}&current=temperature_2m,relative_humidity_2m,wind_speed_10m"
                resp = requests.get(url, timeout=10).json()
                curr = resp.get("current", {})
                
                if curr.get("temperature_2m") is not None:
                    temps.append(curr["temperature_2m"])
                if curr.get("relative_humidity_2m") is not None:
                    humids.append(curr["relative_humidity_2m"])
                if curr.get("wind_speed_10m") is not None:
                    winds.append(curr["wind_speed_10m"])
            
            # Update global averages
            if temps:
                earth_data["avg_temp"] = round(sum(temps) / len(temps), 1)
            if humids:
                earth_data["avg_humidity"] = round(sum(humids) / len(humids), 1)
            if winds:
                earth_data["avg_wind"] = round(sum(winds) / len(winds), 1)
            earth_data["locations_scanned"] = len(LOCATIONS)
            
            # Simulate CO2 and AQI fluctuation
            earth_data["co2_level"] = 420 + random.randint(-5, 10)
            earth_data["air_quality_index"] = 50 + random.randint(-10, 20)
            
        except Exception:
            pass
        
        import time
        time.sleep(120)  # Update every 2 minutes

def fetch_earthquake_loop():
    global earthquake_events
    
    while True:
        try:
            resp = requests.get(USGS_FEED, timeout=10).json()
            features = resp.get("features", [])
            
            new_events = []
            for f in features[:10]:  # Top 10 recent
                props = f["properties"]
                new_events.append({
                    "id": f["id"],
                    "mag": props.get("mag", 0),
                    "place": props.get("place", "Unknown"),
                    "time": props.get("time", 0),
                    "critical": props.get("mag", 0) >= 6.0
                })
            
            earthquake_events = new_events
            
        except Exception:
            pass
        
        import time
        time.sleep(60)  # Check every minute

# --- API Routes ---
@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/stats")
async def get_stats():
    return earth_data

@app.get("/api/events")
async def get_events():
    return earthquake_events

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- Main ---
def start_server():
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="warning")

if __name__ == "__main__":
    # Start background data fetchers
    threading.Thread(target=fetch_weather_loop, daemon=True).start()
    threading.Thread(target=fetch_earthquake_loop, daemon=True).start()
    
    # Start FastAPI server in background
    threading.Thread(target=start_server, daemon=True).start()
    
    # Give server a moment to start
    import time
    time.sleep(1)
    
    # Create desktop window
    webview.create_window(
        "EARTH STATUS MONITOR",
        "http://127.0.0.1:5000",
        width=1200,
        height=800,
        resizable=True,
        background_color="#0a0a0a"
    )
    webview.start()
