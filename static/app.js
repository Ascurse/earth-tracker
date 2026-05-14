// Earth Monitor - Terminal Style

// === Live state ===
// Все значения сюда кладут реальные fetchи. До первого ответа — null.
const live = {
    airTemp: null,        // °C, среднее по 10 городам (Open-Meteo)
    co2: null,            // ppm, Mauna Loa trend (NOAA via global-warming.org)
    populationBase: null, // последнее годовое значение World Bank
    populationGrowthPerSec: null, // прирост/сек, из дельты двух годов
    populationBaseTime: null,     // момент, к которому привязан populationBase
};

let seenEventIds = new Set();
const startTime = Date.now();

// === Cities (для усреднения температуры) ===
const CITIES = [
    { name: 'Tokyo',          lat:  35.6895, lon: 139.6917 },
    { name: 'New York',       lat:  40.7128, lon: -74.0060 },
    { name: 'London',         lat:  51.5074, lon:  -0.1278 },
    { name: 'Sydney',         lat: -33.8688, lon: 151.2093 },
    { name: 'Moscow',         lat:  55.7558, lon:  37.6173 },
    { name: 'Cairo',          lat:  30.0444, lon:  31.2357 },
    { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
    { name: 'Mumbai',         lat:  19.0760, lon:  72.8777 },
    { name: 'Beijing',        lat:  39.9042, lon: 116.4074 },
    { name: 'Cape Town',      lat: -33.9249, lon:  18.4241 },
];

// === Clock ===
function updateClock() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s} UTC`;
}

// === Display tick: пересчитываем только то, что меняется каждую секунду ===
function updateStats() {
    // Температура океана: симуляция вокруг глобального среднего ~17.5°C.
    // Это не сенсор и не fetch — декоративная флуктуация, как было в первой версии.
    const oceanTemp = (17.5 + (Math.random() - 0.5) * 0.1).toFixed(2);
    updateValue('ocean-temp', oceanTemp);

    // Температура воздуха: реальное среднее по 10 городам (Open-Meteo).
    if (live.airTemp !== null) {
        updateValue('air-temp', live.airTemp.toFixed(1));
    }

    // CO2: реальное последнее измерение Mauna Loa (обновляется ежедневно)
    if (live.co2 !== null) {
        updateValue('co2-level', live.co2.toFixed(2));
    }

    // Лесные потери: глобальная оценка FAO ~10 млн га/год ≈ 0.317 га/сек.
    // Источник реальный (FAO Global Forest Resources Assessment), но величина — оценка, не realtime поток.
    const deforestRate = (0.317 + (Math.random() - 0.5) * 0.05).toFixed(2);
    updateValue('deforest-rate', deforestRate);

    // Население: линейная интерполяция от последнего годового значения World Bank
    // с реальным темпом роста, вычисленным по дельте двух последних лет.
    if (live.populationBase !== null && live.populationGrowthPerSec !== null) {
        const elapsed = (Date.now() - live.populationBaseTime) / 1000;
        const population = Math.floor(live.populationBase + elapsed * live.populationGrowthPerSec);
        updateValue('population', formatPopulation(population));
    }
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

// === Temperature (Open-Meteo, 10 cities, multi-coord) ===
async function fetchTemperature() {
    try {
        const lats = CITIES.map(c => c.lat).join(',');
        const lons = CITIES.map(c => c.lon).join(',');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m`;
        const res = await fetch(url);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [data];
        const temps = arr
            .map(r => r?.current?.temperature_2m)
            .filter(v => typeof v === 'number');
        if (temps.length === 0) return;
        live.airTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    } catch (_) {
        // оставляем прошлое значение
    }
}

// === CO2 (Mauna Loa, ежедневный trend) ===
async function fetchCO2() {
    try {
        const res = await fetch('https://global-warming.org/api/co2-api');
        const data = await res.json();
        const arr = data?.co2 || [];
        const last = arr[arr.length - 1];
        const value = parseFloat(last?.trend ?? last?.cycle);
        if (!Number.isNaN(value)) live.co2 = value;
    } catch (_) { /* keep previous */ }
}

// === Population base (World Bank, годовые значения) ===
async function fetchPopulation() {
    try {
        const url = 'https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL?format=json&per_page=5&date=2020:2030';
        const res = await fetch(url);
        const data = await res.json();
        const rows = (data?.[1] || []).filter(r => typeof r.value === 'number');
        if (rows.length < 2) return;
        // World Bank возвращает по убыванию года
        rows.sort((a, b) => parseInt(b.date) - parseInt(a.date));
        const latest = rows[0];
        const prev   = rows[1];
        const secondsInYear = 365.25 * 24 * 3600;
        live.populationBase = latest.value;
        live.populationGrowthPerSec = (latest.value - prev.value) / secondsInYear;
        // Привяжем базу к середине последнего года, так интерполяция к "сейчас" честнее
        live.populationBaseTime = Date.UTC(parseInt(latest.date), 6, 1); // 1 июля
    } catch (_) { /* keep previous */ }
}

// === Seismic Energy (USGS) ===
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

        // Энергия по формуле Гутенберга-Рихтера; сумма по топ-10 значимых землетрясений за последние 30 дней.
        let totalEnergy = 0;
        events.forEach(e => {
            totalEnergy += Math.pow(10, 1.5 * (e.mag || 0) + 4.8);
        });
        updateValue('seismic-energy', totalEnergy.toExponential(2));

        events.forEach(event => {
            if (!seenEventIds.has(event.id)) {
                seenEventIds.add(event.id);
                const isCritical = event.mag >= 6.0;
                const type = isCritical ? 'critical' : 'warning';
                const prefix = isCritical ? '!!! CRITICAL' : '>> DETECTED';
                addLogEntry(
                    `${prefix}: EARTHQUAKE M${event.mag.toFixed(1)} | ${event.place}`,
                    type,
                    'real'
                );
            }
        });
    } catch (_) { /* keep previous */ }
}

// === Natural events (NASA EONET v3) ===
const EONET_FEED = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30';
const seenEonetIds = new Set();

function classifyEonet(category, mag, unit) {
    const c = (category || '').toLowerCase();
    if (c.includes('volcano')) {
        return { prefix: '!!! CRITICAL: VOLCANIC ACTIVITY', type: 'critical' };
    }
    if (c.includes('severe storm')) {
        // wind in knots; >= 64 kt = ураган
        const isHurricane = (unit && unit.toLowerCase().startsWith('kt') && mag >= 64);
        return isHurricane
            ? { prefix: '!!! CRITICAL: HURRICANE-FORCE STORM', type: 'critical' }
            : { prefix: '>> DETECTED: SEVERE STORM', type: 'warning' };
    }
    if (c.includes('wildfire')) {
        const huge = (unit && unit.toLowerCase().startsWith('acre') && mag >= 50000);
        return huge
            ? { prefix: '!!! CRITICAL: WILDFIRE', type: 'critical' }
            : { prefix: '>> DETECTED: WILDFIRE', type: 'warning' };
    }
    if (c.includes('sea and lake ice')) {
        return { prefix: '>> DETECTED: SEA ICE EVENT', type: 'warning' };
    }
    if (c.includes('flood')) {
        return { prefix: '!!! CRITICAL: FLOOD', type: 'critical' };
    }
    if (c.includes('landslide')) {
        return { prefix: '!!! CRITICAL: LANDSLIDE', type: 'critical' };
    }
    if (c.includes('drought')) {
        return { prefix: '>> DETECTED: DROUGHT', type: 'warning' };
    }
    if (c.includes('temperature extreme')) {
        return { prefix: '>> DETECTED: TEMP EXTREME', type: 'warning' };
    }
    if (c.includes('dust') || c.includes('haze')) {
        return { prefix: '>> DETECTED: DUST EVENT', type: 'warning' };
    }
    if (c.includes('snow')) {
        return { prefix: '>> DETECTED: SNOW EVENT', type: 'warning' };
    }
    return { prefix: '>> NOTED', type: 'info' };
}

async function fetchEonetEvents() {
    try {
        const res = await fetch(EONET_FEED);
        const data = await res.json();
        const events = data?.events || [];
        for (const ev of events) {
            if (!ev?.id || seenEonetIds.has(ev.id)) continue;
            seenEonetIds.add(ev.id);

            const cat = ev.categories?.[0]?.title || 'Event';
            const lastGeom = ev.geometry?.[ev.geometry.length - 1];
            const mag = lastGeom?.magnitudeValue;
            const unit = lastGeom?.magnitudeUnit;
            const { prefix, type } = classifyEonet(cat, mag, unit);
            const tail = (mag !== undefined && mag !== null && unit) ? ` | ${mag} ${unit}` : '';
            addLogEntry(`${prefix}: ${ev.title}${tail}`, type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === Decorative scripted events ===
// Эти строки не приходят из API — они художественная декорация ленты, чтобы
// между реальными ивентами было «дыхание». По решению пользователя без [SIM].
const criticalEvents = [
    'EXTREME HEAT WAVE detected in Southern Europe | +4.2°C above normal',
    'HURRICANE CATEGORY 4 forming in Atlantic | Wind speed: 250 km/h',
    'ARCTIC ICE SHELF collapse detected | Area: 12,000 km²',
    'OCEAN ACIDIFICATION spike in Pacific | pH: 7.95',
    'CORAL BLEACHING event in Great Barrier Reef | 30% affected',
    'METHANE LEAK detected in Siberian permafrost',
    'ATMOSPHERIC RIVER landfall on Pacific coast | 400 mm/24h forecast',
];

const warningEvents = [
    'Temperature anomaly detected in Arctic region | +2.1°C',
    'Tropical depression organizing near Philippines',
    'Air quality index elevated in New Delhi | AQI: 280',
    'Drought conditions worsening in East Africa',
    'Glacier retreat accelerating in Alps',
    'Sea level rise measurement: +3.4 mm/year',
    'Ozone column thinning over Antarctica',
    'Phytoplankton bloom detected off Patagonia coast',
];

const infoEvents = [
    'Global sensor network sync complete',
    'Satellite telemetry received: NOAA-20',
    'Weather station data updated: 847 stations',
    'Ocean buoy network ping: 234 active',
    'Seismograph array calibration complete',
    'Aurora oval forecast updated',
    'Argo float profile uploaded: 3924 active drifters',
];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomEvent() {
    const r = Math.random();
    if      (r < 0.03) addLogEntry(pickRandom(criticalEvents), 'critical');
    else if (r < 0.10) addLogEntry(pickRandom(warningEvents),  'warning');
    else if (r < 0.25) addLogEntry(pickRandom(infoEvents),     'info');
}

// === System heartbeat (scripted technical chatter) ===
// Раз в 10 секунд — фоновая телеметрия, чтобы лента всегда дышала.
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const randFloat = (a, b, d) => (a + Math.random() * (b - a)).toFixed(d);
const randHex = (len = 4) =>
    Array.from({ length: len }, () => randInt(0, 15).toString(16).toUpperCase()).join('');

const systemHeartbeat = [
    () => `Uplink: GOES-18 telemetry stream | ${randInt(80, 260)} ms`,
    () => `NOAA HRRR grid polled | ${randInt(8, 22)} MB received`,
    () => `JMA seismic mirror sync | OK`,
    () => `TLE refresh: ISS, Hubble, Aqua, Terra`,
    () => `NASA EOSDIS bandwidth: ${randFloat(20, 80, 1)} Mbps`,
    () => `Tile cache rotated | ${randInt(800, 2400)} entries purged`,
    () => `NTP resync | drift ${randFloat(0.4, 3.2, 2)} ms`,
    () => `Argo float metadata sync | ${randInt(3800, 4100)} drifters active`,
    () => `Sentinel-2 catalog ping | ${randInt(20, 180)} ms`,
    () => `SWPC space weather scale: G${randInt(0, 3)}`,
    () => `DNS prefetch | usgs.gov, eonet.gsfc.nasa.gov, open-meteo.com`,
    () => `Worker thread #${randInt(1, 8)} idle`,
    () => `Snapshot uploaded to archive | ${randFloat(0.3, 4.2, 1)} MB`,
    () => `Anomaly detector | scoring batch 0x${randHex(4)}`,
    () => `Buffer pressure: ${randInt(10, 70)}% / 80%`,
    () => `Auth token rotated`,
    () => `Mission ops heartbeat | seq ${randInt(1000, 9999)}`,
    () => `MODIS Aqua granule ingested | tile h${randInt(0, 35).toString().padStart(2, '0')}v${randInt(0, 17).toString().padStart(2, '0')}`,
    () => `Kafka topic 'telemetry.raw' lag: ${randInt(0, 120)} ms`,
    () => `Cold storage tier replicated | ${randInt(1, 6)} shards`,
    () => `SWPC alert poll | ${randInt(20, 200)} ms`,
    () => `GDACS feed sync | ${randInt(60, 320)} ms`,
    () => `EMSC seismic mirror ping | ${randInt(40, 240)} ms`,
];

function emitSystemHeartbeat() {
    const factory = pickRandom(systemHeartbeat);
    addLogEntry(factory(), 'system');
}

// === SWPC space weather alerts (NOAA) ===
const SWPC_FEED = 'https://services.swpc.noaa.gov/products/alerts.json';
const seenSwpcIds = new Set();

function summarizeSwpcMessage(message) {
    if (!message) return null;
    // Headline вида "WARNING: Geomagnetic K-index of 4 expected"
    const m = message.match(/^(WARNING|WATCH|ALERT|SUMMARY|EXTENDED WARNING):\s*([^\r\n]+)/m);
    return m ? { kind: m[1], headline: m[2].trim() } : null;
}

function classifySwpc(headline) {
    const h = (headline || '').toUpperCase();
    if (/G[45]/.test(h))                       return { type: 'critical', prefix: '!!! CRITICAL: SEVERE GEOMAG STORM' };
    if (/G3/.test(h))                          return { type: 'warning',  prefix: '>> DETECTED: STRONG GEOMAG STORM' };
    if (/G[12]/.test(h))                       return { type: 'warning',  prefix: '>> DETECTED: GEOMAG STORM' };
    if (/S[345]/.test(h))                      return { type: 'critical', prefix: '!!! CRITICAL: RADIATION STORM' };
    if (/S[12]/.test(h))                       return { type: 'warning',  prefix: '>> DETECTED: RADIATION STORM' };
    if (/R[345]/.test(h))                      return { type: 'critical', prefix: '!!! CRITICAL: RADIO BLACKOUT' };
    if (/R[12]/.test(h))                       return { type: 'warning',  prefix: '>> DETECTED: RADIO BLACKOUT' };
    if (/X\d/.test(h) && /FLARE|XRAY/.test(h)) return { type: 'critical', prefix: '!!! CRITICAL: X-CLASS SOLAR FLARE' };
    if (/M\d/.test(h) && /FLARE|XRAY/.test(h)) return { type: 'warning',  prefix: '>> DETECTED: M-CLASS SOLAR FLARE' };
    if (/CORONAL MASS EJECTION|\bCME\b/.test(h)) return { type: 'warning', prefix: '>> DETECTED: CORONAL MASS EJECTION' };
    if (/PROTON|ELECTRON/.test(h))             return { type: 'warning',  prefix: '>> DETECTED: PARTICLE FLUX' };
    return { type: 'info', prefix: '>> NOTED: SPACE WX' };
}

async function fetchSwpcAlerts() {
    try {
        const res = await fetch(SWPC_FEED);
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000; // только за последние 7 дней
        // sort by issue_datetime desc
        const sorted = [...data].sort((a, b) =>
            (b.issue_datetime || '').localeCompare(a.issue_datetime || ''));
        for (const a of sorted) {
            const id = (a.product_id || '') + '|' + (a.issue_datetime || '');
            if (seenSwpcIds.has(id)) continue;
            seenSwpcIds.add(id);
            const ts = Date.parse((a.issue_datetime || '').replace(' ', 'T') + 'Z');
            if (Number.isFinite(ts) && ts < cutoff) continue;
            const sum = summarizeSwpcMessage(a.message);
            if (!sum) continue;
            const { type, prefix } = classifySwpc(sum.headline);
            if (type === 'info') continue; // info-уровень не валим в ленту, слишком шумно
            addLogEntry(`${prefix}: ${sum.headline}`, type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === GDACS global disasters (red/orange only) ===
const GDACS_FEED = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';
const seenGdacsIds = new Set();
const GDACS_TYPE_LABELS = {
    EQ: 'EARTHQUAKE',
    TC: 'TROPICAL CYCLONE',
    FL: 'FLOOD',
    VO: 'VOLCANIC EVENT',
    DR: 'DROUGHT',
    WF: 'WILDFIRE',
    MS: 'LANDSLIDE',
};

async function fetchGdacsEvents() {
    try {
        const res = await fetch(GDACS_FEED);
        const data = await res.json();
        const feats = data?.features || [];
        for (const f of feats) {
            const p = f.properties || {};
            const id = `${p.eventid}-${p.episodeid}`;
            if (seenGdacsIds.has(id)) continue;
            seenGdacsIds.add(id);
            const level = (p.alertlevel || '').toLowerCase();
            if (level !== 'red' && level !== 'orange') continue;
            const label = GDACS_TYPE_LABELS[p.eventtype] || String(p.eventtype || 'EVENT').toUpperCase();
            const type   = (level === 'red') ? 'critical' : 'warning';
            const prefix = (level === 'red') ? `!!! CRITICAL: ${label}` : `>> DETECTED: ${label}`;
            const sev = p.severitydata?.severitytext;
            const tail = sev ? ` | ${sev}` : '';
            addLogEntry(`${prefix}: ${p.name || 'unknown location'}${tail}`, type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === NWS Active Alerts (USA) ===
// Любой статус принимаем, фильтруем по severity. Параметр limit api отвергает.
const NWS_FEED = 'https://api.weather.gov/alerts/active';
const seenNwsIds = new Set();

function classifyNws(event, severity) {
    const sev = (severity || '').toLowerCase();
    const e = (event || '').toUpperCase();
    // Сильные погодные события всегда critical
    if (/TORNADO|HURRICANE|TSUNAMI|EXTREME/.test(e)) {
        return { type: 'critical', prefix: `!!! CRITICAL: ${e}` };
    }
    if (sev === 'extreme') return { type: 'critical', prefix: `!!! CRITICAL: ${e}` };
    if (sev === 'severe')  return { type: 'critical', prefix: `!!! CRITICAL: ${e}` };
    if (sev === 'moderate') return { type: 'warning', prefix: `>> DETECTED: ${e}` };
    return null; // Minor / Unknown — игнорируем, чтобы не топить ленту
}

async function fetchNwsAlerts() {
    try {
        // NWS просит User-Agent — в браузере он подставляется автоматически.
        const res = await fetch(NWS_FEED, { headers: { 'Accept': 'application/geo+json' } });
        const data = await res.json();
        const feats = data?.features || [];
        for (const f of feats) {
            const p = f.properties || {};
            const id = p.id;
            if (!id || seenNwsIds.has(id)) continue;
            seenNwsIds.add(id);
            const cls = classifyNws(p.event, p.severity);
            if (!cls) continue;
            const area = (p.areaDesc || '').split(';')[0].trim();
            const tail = area ? ` | ${area}` : '';
            addLogEntry(`${cls.prefix}${tail}`, cls.type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === NASA FIRMS active fires ===
// MAP_KEY получается бесплатно: https://firms.modaps.eosdis.nasa.gov/api/map_key/
// Держим два ключа: если первый упёрся в rate-limit или Invalid — пробуем второй.
const FIRMS_MAP_KEYS = [
    '4cfcc0800f4bc99685269cbdfb5cf7f7',
    '47f07a1685fa85024a86905e273e4e2f',
];
const FIRMS_SOURCE  = 'VIIRS_SNPP_NRT'; // NRT = near real-time
const seenFirmsIds = new Set();

async function tryFetchFirmsCsv() {
    for (const key of FIRMS_MAP_KEYS) {
        try {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${FIRMS_SOURCE}/world/1`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const text = await res.text();
            const trimmed = text.trim();
            // Ответ начинается с заголовка "latitude,longitude,..." — иначе это ошибка ("Invalid MAP_KEY.")
            if (!trimmed || !trimmed.toLowerCase().startsWith('latitude')) continue;
            return trimmed;
        } catch (_) { /* try next key */ }
    }
    return null;
}

async function fetchFirmsFires() {
    if (FIRMS_MAP_KEYS.length === 0) return;
    try {
        const csv = await tryFetchFirmsCsv();
        if (!csv) return;
        const lines = csv.split('\n');
        if (lines.length < 2) return;
        const header = lines[0].split(',');
        const idxLat   = header.indexOf('latitude');
        const idxLon   = header.indexOf('longitude');
        const idxFrp   = header.indexOf('frp');
        const idxConf  = header.indexOf('confidence');
        const idxDate  = header.indexOf('acq_date');
        const idxTime  = header.indexOf('acq_time');
        // Берём только high-confidence (nominal/high), сортируем по FRP desc, top-15
        const fires = [];
        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',');
            const conf = (c[idxConf] || '').toLowerCase();
            if (conf !== 'h' && conf !== 'high' && conf !== 'n' && conf !== 'nominal') continue;
            const frp = parseFloat(c[idxFrp]) || 0;
            const lat = parseFloat(c[idxLat]);
            const lon = parseFloat(c[idxLon]);
            const id = `${c[idxDate]}T${c[idxTime]}|${lat?.toFixed(2)}|${lon?.toFixed(2)}`;
            fires.push({ id, lat, lon, frp });
        }
        fires.sort((a, b) => b.frp - a.frp);
        for (const f of fires.slice(0, 15)) {
            if (seenFirmsIds.has(f.id)) continue;
            seenFirmsIds.add(f.id);
            const type   = f.frp > 100 ? 'critical' : 'warning';
            const prefix = f.frp > 100 ? '!!! CRITICAL: WILDFIRE HOTSPOT' : '>> DETECTED: WILDFIRE HOTSPOT';
            const coord = `${f.lat.toFixed(1)}°${f.lat >= 0 ? 'N' : 'S'} ${Math.abs(f.lon).toFixed(1)}°${f.lon >= 0 ? 'E' : 'W'}`;
            addLogEntry(`${prefix}: ${coord} | FRP ${f.frp.toFixed(0)} MW`, type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === EMSC seismic feed (M >= 4.5, last 15) ===
const EMSC_FEED = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=4.5&orderby=time&limit=15';
const seenEmscIds = new Set();

async function fetchEmscEvents() {
    try {
        const res = await fetch(EMSC_FEED);
        const data = await res.json();
        const feats = data?.features || [];
        for (const f of feats) {
            const id = f.id;
            if (!id || seenEmscIds.has(id)) continue;
            seenEmscIds.add(id);
            const p = f.properties || {};
            const mag = Number(p.mag) || 0;
            const place = p.flynn_region || 'Unknown';
            const depth = Number(p.depth);
            let type, prefix;
            if      (mag >= 6.0) { type = 'critical'; prefix = '!!! CRITICAL: EARTHQUAKE'; }
            else if (mag >= 5.0) { type = 'warning';  prefix = '>> DETECTED: EARTHQUAKE'; }
            else                 { type = 'info';     prefix = '>> NOTED: SEISMIC EVENT'; }
            const depthTail = Number.isFinite(depth) ? ` | depth ${depth.toFixed(0)} km` : '';
            addLogEntry(`${prefix} M${mag.toFixed(1)} | ${place}${depthTail}`, type, 'real');
        }
    } catch (_) { /* keep previous */ }
}

// === Event Log ===
// Две очереди: реальные ивенты (USGS, EONET) и декорация (boot, scripted, heartbeat).
// Воркер на каждой итерации с шансом 50/50 берёт из одной или другой, поэтому при
// init пачка реальных событий не валится подряд — она «переплетается» с фоном.
const realQueue = [];
const decoQueue = [];
let logWorkerRunning = false;

const TYPE_SPEED_MS = 20;      // мс на символ в typewriter
const INTER_MESSAGE_PAUSE_MS = 120; // пауза между сообщениями
const MAX_LOG_ENTRIES = 200;

function addLogEntry(message, type = 'info', channel = 'deco') {
    const target = channel === 'real' ? realQueue : decoQueue;
    target.push({ message, type });
    if (!logWorkerRunning) {
        logWorkerRunning = true;
        processLogQueue();
    }
}

async function processLogQueue() {
    while (realQueue.length || decoQueue.length) {
        let queue;
        if (realQueue.length && decoQueue.length) {
            queue = Math.random() < 0.5 ? realQueue : decoQueue;
        } else {
            queue = realQueue.length ? realQueue : decoQueue;
        }
        const { message, type } = queue.shift();
        await renderLogEntry(message, type);
        if (realQueue.length || decoQueue.length) {
            await sleep(INTER_MESSAGE_PAUSE_MS);
        }
    }
    logWorkerRunning = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function renderLogEntry(message, type) {
    return new Promise(resolve => {
        const log = document.getElementById('event-log');
        const entry = document.createElement('div');

        const now = new Date();
        const timestamp = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;

        entry.className = `log-entry ${type}`;
        const fullMessage = `[${timestamp}] ${message}`;

        const textSpan = document.createElement('span');
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        entry.appendChild(textSpan);
        entry.appendChild(cursor);
        log.appendChild(entry);

        let charIndex = 0;
        function typeNextChar() {
            if (charIndex < fullMessage.length) {
                textSpan.textContent += fullMessage.charAt(charIndex);
                charIndex++;
                log.scrollTop = log.scrollHeight;
                setTimeout(typeNextChar, TYPE_SPEED_MS);
            } else {
                cursor.remove();
                while (log.children.length > MAX_LOG_ENTRIES) {
                    log.removeChild(log.firstChild);
                }
                resolve();
            }
        }
        typeNextChar();
    });
}

// === Lightning (geographically-weighted simulation) ===
// Реального публичного realtime-фида молний с CORS нет (Blitzortung блокирует
// non-org origin). Поэтому это симуляция: распределение хотспотов грубо
// повторяет реальный мировой климатологический пик грозовой активности
// (Конго, Маракайбо, Флорида, ЮВ Азия). В лог идёт только текстовая запись
// в синем стиле, без overlay/анимаций.

const LIGHTNING_HOTSPOTS = [
    { name: 'Lake Maracaibo',     lat:   9.7, lon:  -71.6, weight: 14 },
    { name: 'Congo Basin',        lat:  -1.0, lon:   23.0, weight: 18 },
    { name: 'Singapore / SE Asia',lat:   1.4, lon:  103.8, weight: 12 },
    { name: 'Northern Australia', lat: -13.0, lon:  132.0, weight: 6  },
    { name: 'Florida, USA',       lat:  27.5, lon:  -82.0, weight: 7  },
    { name: 'Himalayan foothills',lat:  28.0, lon:   84.0, weight: 6  },
    { name: 'Argentine pampas',   lat: -32.0, lon:  -62.0, weight: 5  },
    { name: 'Central African',    lat:   7.0, lon:   20.0, weight: 6  },
    { name: 'Caribbean basin',    lat:  17.0, lon:  -75.0, weight: 4  },
    { name: 'Open ocean (ITCZ)',  lat:   2.0, lon:  -25.0, weight: 3  },
];

function pickHotspot() {
    const total = LIGHTNING_HOTSPOTS.reduce((s, h) => s + h.weight, 0);
    let r = Math.random() * total;
    for (const h of LIGHTNING_HOTSPOTS) {
        r -= h.weight;
        if (r <= 0) return h;
    }
    return LIGHTNING_HOTSPOTS[0];
}

function formatCoord(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function strikeLightning() {
    const spot = pickHotspot();
    const lat = spot.lat + (Math.random() - 0.5) * 8;
    const lon = spot.lon + (Math.random() - 0.5) * 12;
    addLogEntry(`>> STRIKE: ${formatCoord(lat, lon)} | ${spot.name}`, 'lightning', 'deco');
}

function startLightningEngine() {
    // Один удар каждые ~5–12 секунд, рваный темп. ~6-12 строк в минуту в логе.
    function scheduleNext() {
        const delay = 5000 + Math.random() * 7000;
        setTimeout(() => {
            strikeLightning();
            scheduleNext();
        }, delay);
    }
    scheduleNext();
}

// === Wake Lock (keep screen on, especially on iPad) ===
function setupWakeLock() {
    const NoSleepCtor = window['NoSleep'];
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
async function init() {
    setupWakeLock();
    addLogEntry('System boot sequence initiated...', 'system');
    addLogEntry('Connecting to Open-Meteo weather grid...', 'system');
    addLogEntry('Connecting to NOAA Mauna Loa CO2 record...', 'system');
    addLogEntry('Connecting to USGS seismic network...', 'system');
    addLogEntry('Connecting to World Bank population indicator...', 'system');
    addLogEntry('Connecting to NASA EONET natural events...', 'system');
    addLogEntry('Connecting to NOAA SWPC space weather...', 'system');
    addLogEntry('Connecting to GDACS global disaster feed...', 'system');
    addLogEntry('Connecting to EMSC seismic portal...', 'system');
    addLogEntry('Connecting to NWS active alerts (US)...', 'system');
    if (FIRMS_MAP_KEYS.length) {
        addLogEntry('Connecting to NASA FIRMS fire hotspot feed...', 'system');
    }

    updateClock();
    setInterval(updateClock, 1000);
    setInterval(updateStats, 1000);

    // Параллельные первые fetchи. Каждый сам логирует в случае успеха.
    await Promise.allSettled([
        fetchTemperature().then(() => {
            if (live.airTemp !== null) addLogEntry(`Weather grid online. Avg surface air across ${CITIES.length} cities: ${live.airTemp.toFixed(1)}°C`, 'info');
        }),
        fetchCO2().then(() => {
            if (live.co2 !== null) addLogEntry(`Mauna Loa CO2 trend: ${live.co2.toFixed(2)} ppm`, 'info');
        }),
        fetchPopulation().then(() => {
            if (live.populationBase !== null) addLogEntry(`World Bank population baseline: ${formatPopulation(live.populationBase)} (mid-year)`, 'info');
        }),
        fetchSeismicData().then(() => addLogEntry('USGS seismic feed online.', 'info')),
        fetchEonetEvents().then(() => addLogEntry(`EONET tracking ${seenEonetIds.size} open natural events.`, 'info')),
        fetchSwpcAlerts().then(() => addLogEntry('NOAA SWPC space weather feed online.', 'info')),
        fetchGdacsEvents().then(() => addLogEntry('GDACS global disaster feed online.', 'info')),
        fetchEmscEvents().then(() => addLogEntry('EMSC seismic portal online.', 'info')),
        fetchNwsAlerts().then(() => addLogEntry('NWS active alerts feed online.', 'info')),
        fetchFirmsFires().then(() => {
            if (FIRMS_MAP_KEYS.length) addLogEntry('NASA FIRMS fire hotspot feed online.', 'info');
        }),
    ]);

    addLogEntry('All systems operational. Monitoring active.', 'info');

    // Refresh intervals
    setInterval(fetchTemperature,  5 * 60 * 1000);   // 5 минут
    setInterval(fetchCO2,         60 * 60 * 1000);   // 1 час
    setInterval(fetchPopulation,  24 * 60 * 60 * 1000); // раз в сутки
    setInterval(fetchSeismicData, 60 * 1000);        // 1 минута
    setInterval(fetchEonetEvents,  5 * 60 * 1000);   // 5 минут
    setInterval(fetchSwpcAlerts,   5 * 60 * 1000);   // 5 минут
    setInterval(fetchGdacsEvents, 10 * 60 * 1000);   // 10 минут
    setInterval(fetchEmscEvents,   2 * 60 * 1000);   // 2 минуты
    setInterval(fetchNwsAlerts,    3 * 60 * 1000);   // 3 минуты
    setInterval(fetchFirmsFires,  15 * 60 * 1000);   // 15 минут
    setInterval(generateRandomEvent, 30 * 1000);     // декорация: раз в 30 с
    setInterval(emitSystemHeartbeat, 10 * 1000);     // системная телеметрия: раз в 10 с

    // Молнии — отдельный декоративный движок (см. секцию Lightning).
    startLightningEngine();
}

document.addEventListener('DOMContentLoaded', init);
