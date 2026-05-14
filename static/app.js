// Earth Monitor - Terminal Style

// === State ===
let seenEventIds = new Set();
let populationBase = 8123456789; // Base population (UN estimate ~2024)
let hectaresLostBase = 0;
let startTime = Date.now();

// === Clock ===
function updateClock() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s} UTC`;
}

// === Stats Updates ===
function updateStats() {
    // Ocean Temperature (simulated real-time fluctuation around 17.5°C global avg)
    const oceanTemp = (17.5 + (Math.random() - 0.5) * 0.1).toFixed(2);
    updateValue('ocean-temp', oceanTemp);

    // CO2 Level (simulated around 420+ ppm with slow increase)
    const co2 = (421.5 + (Date.now() - startTime) / 3600000 * 0.0001 + (Math.random() - 0.5) * 0.5).toFixed(1);
    updateValue('co2-level', co2);

    // Deforestation Rate (~1.5 hectares per second globally)
    const deforestRate = (1.5 + (Math.random() - 0.5) * 0.3).toFixed(2);
    updateValue('deforest-rate', deforestRate);
    
    // Population counter (increases by ~2.5 people per second globally)
    const elapsed = (Date.now() - startTime) / 1000;
    const population = Math.floor(populationBase + elapsed * 2.5);
    updateValue('population', formatPopulation(population));
}

function updateValue(id, value) {
    const el = document.getElementById(id);
    if (el.textContent !== value.toString()) {
        el.textContent = value;
        el.classList.add('updating');
        setTimeout(() => el.classList.remove('updating'), 300);
    }
}

function formatPopulation(num) {
    return num.toLocaleString('en-US');
}

// === Seismic Energy ===
const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';

async function fetchSeismicData() {
    try {
        const res = await fetch(USGS_FEED);
        const data = await res.json();
        const features = (data.features || []).slice(0, 10);
        const events = features.map(f => ({
            id: f.id,
            mag: f.properties?.mag ?? 0,
            place: f.properties?.place ?? 'Unknown',
            time: f.properties?.time ?? 0,
        }));

        // Calculate total energy from magnitudes (simplified Gutenberg-Richter)
        let totalEnergy = 0;
        events.forEach(e => {
            // E = 10^(1.5*M + 4.8) in Joules (simplified)
            totalEnergy += Math.pow(10, 1.5 * (e.mag || 0) + 4.8);
        });
        
        // Format as scientific notation
        const energyStr = totalEnergy.toExponential(2);
        updateValue('seismic-energy', energyStr);
        
        // Check for new critical events
        events.forEach(event => {
            if (!seenEventIds.has(event.id)) {
                seenEventIds.add(event.id);
                
                const isCritical = event.mag >= 6.0;
                const type = isCritical ? 'critical' : 'warning';
                const prefix = isCritical ? '!!! CRITICAL' : '>> DETECTED';
                
                addLogEntry(
                    `${prefix}: EARTHQUAKE M${event.mag.toFixed(1)} | ${event.place}`,
                    type
                );
            }
        });
        
    } catch (err) {
        // Silent fail
    }
}

// === Event Log ===
function addLogEntry(message, type = 'info') {
    const log = document.getElementById('event-log');
    const entry = document.createElement('div');
    
    const now = new Date();
    const timestamp = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
    
    entry.className = `log-entry ${type}`;
    
    const fullMessage = `[${timestamp}] ${message}`;
    
    // Create text node and cursor
    const textSpan = document.createElement('span');
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    
    entry.appendChild(textSpan);
    entry.appendChild(cursor);
    log.appendChild(entry);
    
    // Typewriter effect - type out character by character
    let charIndex = 0;
    const typeSpeed = 15; // milliseconds per character
    
    function typeNextChar() {
        if (charIndex < fullMessage.length) {
            textSpan.textContent += fullMessage.charAt(charIndex);
            charIndex++;
            // Auto-scroll as we type
            log.scrollTop = log.scrollHeight;
            setTimeout(typeNextChar, typeSpeed);
        } else {
            // Remove cursor when done typing
            cursor.remove();
        }
    }
    
    typeNextChar();
    
    // Keep log size reasonable
    while (log.children.length > 200) {
        log.removeChild(log.firstChild);
    }
}

// === Simulated Events ===
const criticalEvents = [
    { msg: 'EXTREME HEAT WAVE detected in Southern Europe | +4.2°C above normal', type: 'critical' },
    { msg: 'HURRICANE CATEGORY 4 forming in Atlantic | Wind speed: 250 km/h', type: 'critical' },
    { msg: 'ARCTIC ICE SHELF collapse detected | Area: 12,000 km²', type: 'critical' },
    { msg: 'VOLCANIC ACTIVITY alert: Mt. Etna | Lava flow confirmed', type: 'critical' },
    { msg: 'OCEAN ACIDIFICATION spike in Pacific | pH: 7.95', type: 'critical' },
    { msg: 'FOREST FIRE spreading in Amazon | Area: 45,000 hectares', type: 'critical' },
    { msg: 'CORAL BLEACHING event in Great Barrier Reef | 30% affected', type: 'critical' },
    { msg: 'METHANE LEAK detected in Siberian permafrost', type: 'critical' },
];

const warningEvents = [
    { msg: 'Temperature anomaly detected in Arctic region | +2.1°C', type: 'warning' },
    { msg: 'Tropical storm forming near Philippines', type: 'warning' },
    { msg: 'Air quality index elevated in New Delhi | AQI: 280', type: 'warning' },
    { msg: 'Drought conditions worsening in East Africa', type: 'warning' },
    { msg: 'Glacier retreat accelerating in Alps', type: 'warning' },
    { msg: 'Sea level rise measurement: +3.4mm/year', type: 'warning' },
    { msg: 'Ozone layer thinning detected over Antarctica', type: 'warning' },
];

const infoEvents = [
    { msg: 'Global sensor network sync complete', type: 'info' },
    { msg: 'Satellite telemetry received: NOAA-20', type: 'info' },
    { msg: 'Weather station data updated: 847 stations', type: 'info' },
    { msg: 'Ocean buoy network ping: 234 active', type: 'info' },
    { msg: 'Seismograph array calibration complete', type: 'info' },
    { msg: 'CO2 sensor array sync: Mauna Loa station', type: 'info' },
];

function generateRandomEvent() {
    const rand = Math.random();
    
    if (rand < 0.05) {  // 5% chance of critical event
        const event = criticalEvents[Math.floor(Math.random() * criticalEvents.length)];
        addLogEntry(event.msg, event.type);
    } else if (rand < 0.15) {  // 10% chance of warning
        const event = warningEvents[Math.floor(Math.random() * warningEvents.length)];
        addLogEntry(event.msg, event.type);
    } else if (rand < 0.25) {  // 10% chance of info
        const event = infoEvents[Math.floor(Math.random() * infoEvents.length)];
        addLogEntry(event.msg, event.type);
    }
}

// === Wake Lock (keep screen on, especially on iPad) ===
function setupWakeLock() {
    const NoSleepCtor = window.NoSleep;
    if (typeof NoSleepCtor !== 'function') return;
    const noSleep = new NoSleepCtor();
    let enabled = false;

    const enable = () => {
        if (enabled) return;
        // iOS разрешает включать wake lock только из обработчика user gesture.
        noSleep.enable().then(() => {
            enabled = true;
            addLogEntry('Wake lock engaged. Screen will stay on.', 'system');
        }).catch(() => { /* пользователь ещё не взаимодействовал */ });
    };

    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
        document.addEventListener(evt, enable, { once: false, passive: true });
    });
}

// === Initialize ===
function init() {
    setupWakeLock();
    addLogEntry('System boot sequence initiated...', 'system');
    
    setTimeout(() => addLogEntry('Connecting to NASA EOSDIS...', 'system'), 500);
    setTimeout(() => addLogEntry('Connecting to NOAA satellite network...', 'system'), 1000);
    setTimeout(() => addLogEntry('Connecting to USGS seismic network...', 'system'), 1500);
    setTimeout(() => addLogEntry('Connecting to Global Carbon Project...', 'system'), 2000);
    setTimeout(() => addLogEntry('All systems operational. Monitoring active.', 'info'), 2500);
    
    updateClock();
    updateStats();
    fetchSeismicData();
    
    // Update intervals
    setInterval(updateClock, 1000);
    setInterval(updateStats, 1000);
    setInterval(fetchSeismicData, 30000);
    setInterval(generateRandomEvent, 3000);
}

document.addEventListener('DOMContentLoaded', init);
