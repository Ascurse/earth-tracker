import time
import threading
import random
import requests
from datetime import datetime
from rich.console import Console
from rich.style import Style
from rich.text import Text

# --- Configuration ---
# Expanded list for "Global Scanning" effect
LOCATIONS = [
    {"name": "Tokyo, JPN", "lat": 35.6895, "lon": 139.6917},
    {"name": "New York, USA", "lat": 40.7128, "lon": -74.0060},
    {"name": "London, UK", "lat": 51.5074, "lon": -0.1278},
    {"name": "Sydney, AUS", "lat": -33.8688, "lon": 151.2093},
    {"name": "Moscow, RUS", "lat": 55.7558, "lon": 37.6173},
    {"name": "Cairo, EGY", "lat": 30.0444, "lon": 31.2357},
    {"name": "Rio de Janeiro, BRA", "lat": -22.9068, "lon": -43.1729},
    {"name": "Antarctica (Base)", "lat": -82.8628, "lon": 135.0000},
    {"name": "Reykjavik, ISL", "lat": 64.1466, "lon": -21.9426},
    {"name": "Mumbai, IND", "lat": 19.0760, "lon": 72.8777},
    {"name": "Beijing, CHN", "lat": 39.9042, "lon": 116.4074},
    {"name": "Cape Town, ZAF", "lat": -33.9249, "lon": 18.4241},
]

USGS_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson"

console = Console()

class EarthMonitor:
    def __init__(self):
        self.quake_queue = []
        self.running = True
        self.weather_cache = {} # Cache to avoid spamming API too hard

    def start_background_threads(self):
        threading.Thread(target=self._fetch_quakes, daemon=True).start()

    def _fetch_quakes(self):
        """Fetches significant earthquakes periodically."""
        seen_ids = set()
        while self.running:
            try:
                resp = requests.get(USGS_FEED, timeout=10).json()
                features = resp.get("features", [])
                
                # In a real continuous app we'd only show *new* ones. 
                # For this art object, we'll trickle them in randomly to simulate activity
                # if they haven't been shown too recently (or just re-play them for the 'art' feel).
                # To be useful but artsy: let's just queue 'recent' significant ones 
                # and occasionally inject them into the stream.
                
                current_batch = []
                for f in features:
                    props = f["properties"]
                    # Add to potential display queue
                    current_batch.append({
                        "type": "QUAKE",
                        "mag": props.get("mag", 0),
                        "place": props.get("place", "Unknown"),
                        "time": props.get("time")
                    })
                
                # Update our internal "active" list randomly
                if current_batch:
                    self.quake_queue = current_batch
                    
            except Exception:
                pass # Silent fail for art
            time.sleep(300)

    def get_weather_scan(self):
        """Pick a random location and fetch/return formatted Data."""
        loc = random.choice(LOCATIONS)
        
        # Simple caching to respect API limits if we scan same city fast
        # (Though with 12 cities and sleep calls, it's unlikely to rate limit)
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={loc['lat']}&longitude={loc['lon']}&current=temperature_2m,relative_humidity_2m,wind_speed_10m"
            resp = requests.get(url, timeout=5).json()
            curr = resp.get("current", {})
            return {
                "type": "WEATHER",
                "loc": loc["name"],
                "temp": curr.get("temperature_2m", 0),
                "humid": curr.get("relative_humidity_2m", 0),
                "wind": curr.get("wind_speed_10m", 0)
            }
        except:
            return None

    def generate_matrix_noise(self):
        """Generates random sci-fi system text."""
        phrases = [
            "0x892A... PACKET STREAM", "SYNCHRONIZING ORBITAL DATA...", "DECRYPTING BIOSIGNALS...",
            "HANDSHAKE ACCEPTED", "REROUTING...", "BUFFER OVERFLOW PROTECTION", "ESTABLISHING UPLINK...",
            " IONOSPHERE SCAN: STABLE", "Background Radiation: NORMAL", "Ping: 12ms", "Trace complete."
        ]
        return random.choice(phrases)

    def run_stream(self):
        self.start_background_threads()
        
        console.clear()
        console.print("[bold green]INITIALIZING EARTH STATUS MONITOR...[/bold green]")
        time.sleep(1)
        console.print("[bold green]CONNECTING TO GLOBAL SENSOR COMPUTE GRID...[/bold green]")
        time.sleep(1.5)
        
        while True:
            try:
                # 1. Random chance: System Noise
                if random.random() < 0.4:
                    noise = self.generate_matrix_noise()
                    # Dim green fake hex or noise
                    prefix = f"[{random.randint(10,99)}:{random.randint(10,99)}] "
                    console.print(f"[dim green]{prefix}{noise}[/dim green]")
                
                # 2. Random chance: Weather Scan
                elif random.random() < 0.3:
                    data = self.get_weather_scan()
                    if data:
                        # Art Object formatting
                        loc_str = f"SCANNING >>> {data['loc'].upper()}"
                        
                        temp_val = data['temp']
                        temp_str = f"TEMP: {temp_val}°C"
                        
                        # RED ALERT logic
                        if temp_val > 30:
                            style = "bold red"
                            temp_str = f"!! HIGH TEMP ALERT: {temp_val}°C !!"
                        else:
                            style = "green"
                            
                        # Print the scan line
                        console.print(f"[bold green]{loc_str}[/bold green] | [{style}]{temp_str}[/{style}] | HUM: {data['humid']}% | WIND: {data['wind']}km/h")

                # 3. Random chance: Earthquake Injection (from queue)
                elif random.random() < 0.2 and self.quake_queue:
                    q = random.choice(self.quake_queue)
                    mag = q['mag']
                    
                    # Style based on magnitude
                    if mag >= 6.5:
                        style = "bold white on red blink"
                        prefix = "!!! CRITICAL SEISMIC EVENT !!!"
                    elif mag >= 5.0:
                        style = "bold red"
                        prefix = "! SIGNIFICANT TREMOR !"
                    else:
                        style = "bold yellow"
                        prefix = "SEISMIC DETECTED"
                        
                    console.print(f"[{style}]{prefix} Magnitude {mag} -- {q['place']}[/]")

                # Flow speed
                time.sleep(random.uniform(0.1, 0.6))
                
            except KeyboardInterrupt:
                print("\nDisconnection...")
                break

if __name__ == "__main__":
    EarthMonitor().run_stream()
