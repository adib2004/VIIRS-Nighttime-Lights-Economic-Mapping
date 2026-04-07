// ==========================================
// 0. TACTICAL AUDIO SYNTHESIZER (CLEAN CLICK)
// ==========================================
let audioCtx = null; 

function playTechClick() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Triangle wave + flat frequency = clean mechanical tick
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(600, audioCtx.currentTime); 
        
        // Ultra-short 15 millisecond duration
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.015); 
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.015);
    } catch(e) {
        console.log("Audio not supported or blocked.");
    }
}

// ==========================================
// 1. INITIALIZE MAP & BASE LAYERS
// ==========================================
var map = L.map('map').setView([20.5937, 78.9629], 5);
var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
var esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });

var cityLayer = null, donutRing = null, heatmapLayer = null, growthChart = null; 
var poiLayerGroup = L.layerGroup().addTo(map);

var allHeatmapUrls = {}; 
var timelineLabels = []; 
var isEsriActive = false; 
var isTargetingMode = false;
var currentCityData = null;

// ==========================================
// 2. TARGETING MODE TOGGLE
// ==========================================
function toggleTargetMode() {
    playTechClick(); 
    isTargetingMode = !isTargetingMode;
    let btn = document.getElementById("btnTargetMode");
    let mapDiv = document.getElementById("map");

    if (isTargetingMode) {
        btn.classList.replace("btn-outline-info", "btn-info");
        btn.innerHTML = '<i class="fas fa-search-location fa-pulse"></i> ACQUIRING TARGET...';
        mapDiv.classList.add("targeting-active"); 
    } else {
        btn.classList.replace("btn-info", "btn-outline-info");
        btn.innerHTML = '<i class="fas fa-search-location"></i> MANUAL INSPECTION [OFF]';
        mapDiv.classList.remove("targeting-active");
    }
}

// ==========================================
// 3. MAP CLICK & PIN DROP
// ==========================================
var customPin = null;
map.on('click', async function(e) {
    if (!isTargetingMode) return; 
    playTechClick(); 
    toggleTargetMode(); 

    let lat = e.latlng.lat;
    let lng = e.latlng.lng;
    if (customPin) map.removeLayer(customPin);
    
    // Glowing dot pin
    let targetIcon = L.divIcon({ 
        className: 'custom-div-icon', 
        html: "<div style='background-color:#00ffcc;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 15px #00ffcc;'></div>", 
        iconSize: [12, 12] 
    });
    customPin = L.marker([lat, lng], {icon: targetIcon}).addTo(map);

    document.getElementById("cityInput").value = "ACQUIRING TARGET...";
    let locName = `COORD_${lat.toFixed(2)}_${lng.toFixed(2)}`;
    
    try {
        let geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        let geoData = await geoRes.json();
        if (geoData && geoData.address) { locName = geoData.address.city || geoData.address.town || geoData.address.county || geoData.address.state || locName; }
    } catch(err) { console.log("Geocoding failed."); }

    document.getElementById("cityInput").value = `${locName.toUpperCase()} [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    runPrediction(lat, lng, locName); 
});

// ==========================================
// 4. MAIN AI UPLINK & PREDICTION
// ==========================================
async function runPrediction(pinLat = null, pinLng = null, pinName = null) {
    playTechClick();
    let city = pinName || document.getElementById("cityInput").value.trim();
    if (!city) return;

    let btn = document.getElementById("btnAnalyze");
    btn.innerHTML = 'UPLINKING...'; btn.disabled = true;

    try {
        let payload = { city: city };
        if (pinLat !== null && pinLng !== null) { payload.lat = pinLat; payload.lon = pinLng; }

        let response = await fetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        let data = await response.json();
        if (data.error) throw new Error(data.error);

        currentCityData = data;
        document.getElementById("chatWindow").innerHTML = `<div style="color: #00ffcc;">> TARGET ACQUIRED: ${data.city.toUpperCase()}. TERMINAL READY.</div>`;

        document.getElementById("cityNameDisplay").innerText = data.city;
        document.getElementById("valRadiance").innerText = data.avg_radiance;
        document.getElementById("valPatchiness").innerText = data.patchiness || '--'; 
        
        let gVal = document.getElementById("valGrowth");
        gVal.innerText = `${data.growth_rate > 0 ? '+' : ''}${data.growth_rate}%`;
        gVal.style.color = data.growth_rate > 0 ? "#00ffcc" : "#ff4444"; 

        let isGrowth = data.status.includes("High");
        let badge = document.getElementById("aiStatusBadge");
        badge.innerText = `${data.status} (${data.confidence})`;
        badge.style.color = isGrowth ? "#00ffcc" : "#ff4444";

        let lat = data.coords ? data.coords[0] : 18.5204;
        let lng = data.coords ? data.coords[1] : 73.8567;
        
        setTimeout(() => { map.invalidateSize(); map.flyTo([lat, lng], 11); }, 400);

        if (cityLayer) map.removeLayer(cityLayer);
        if (donutRing) map.removeLayer(donutRing);
        if (heatmapLayer) map.removeLayer(heatmapLayer);
        poiLayerGroup.clearLayers();

        cityLayer = L.circle([lat, lng], { color: '#ff0000', fillColor: '#ff0000', fillOpacity: 0.3, radius: 5000 }).addTo(map);
        donutRing = L.circle([lat, lng], { color: '#00ffff', fillOpacity: 0.0, weight: 2, dashArray: '5, 5', radius: 15000 }).addTo(map);
        
        if (data.heatmap_urls && data.timeline_years) {
            allHeatmapUrls = data.heatmap_urls;
            timelineLabels = data.timeline_years; 
            let maxIndex = timelineLabels.length - 1;
            document.getElementById("yearSlider").max = maxIndex;
            document.getElementById("yearSlider").value = maxIndex;
            document.getElementById("yearDisplay").innerText = timelineLabels[maxIndex];
            
            if (allHeatmapUrls[timelineLabels[maxIndex]]) {
                heatmapLayer = L.tileLayer(allHeatmapUrls[timelineLabels[maxIndex]], { opacity: 0.75 }).addTo(map);
            }
        }

        fetchAndPlotPOIs(lat, lng);
        updateChart(data.timeline_years, data.timeline_radiance, data.timeline_gdp);

    } catch (e) { alert("Error: " + e.message); } 
    finally { btn.innerHTML = 'INITIATE SCAN'; btn.disabled = false; }
}

function changeHeatmapYear(sliderIndex) {
    if (!timelineLabels || timelineLabels.length === 0) return;
    let activeLabel = timelineLabels[sliderIndex];
    document.getElementById("yearDisplay").innerText = activeLabel;
    
    if (heatmapLayer) map.removeLayer(heatmapLayer);
    if (allHeatmapUrls && allHeatmapUrls[activeLabel]) {
        heatmapLayer = L.tileLayer(allHeatmapUrls[activeLabel], { opacity: 0.75 }).addTo(map);
        heatmapLayer.bringToFront(); 
        if(donutRing) donutRing.bringToFront();
    }
}

function toggleEsri() {
    playTechClick();
    if (isEsriActive) { map.removeLayer(esriLayer); darkLayer.addTo(map); } 
    else { map.removeLayer(darkLayer); esriLayer.addTo(map); }
    if (heatmapLayer) heatmapLayer.bringToFront();
    if (donutRing) donutRing.bringToFront();
    if (cityLayer) cityLayer.bringToFront();
    isEsriActive = !isEsriActive;
}

async function fetchAndPlotPOIs(lat, lng) {
    let query = `[out:json][timeout:15];(node["amenity"~"pub|bar|nightclub"](around:15000,${lat},${lng});node["shop"~"mall|supermarket"](around:15000,${lat},${lng}););out body limit 300;`;
    let url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);
    try {
        let res = await fetch(url); let data = await res.json();
        data.elements.forEach(poi => {
            let isNightlife = poi.tags.amenity !== undefined;
            let dotColor = isNightlife ? '#ff00ff' : '#00ffff'; 
            L.circleMarker([poi.lat, poi.lon], {radius: 4, fillColor: dotColor, color: '#ffffff', weight: 1, opacity: 1, fillOpacity: 0.9}).addTo(poiLayerGroup);
        });
    } catch(e) {}
}

function updateChart(years, radianceData, gdpData) {
    let ctx = document.getElementById('growthChart').getContext('2d');
    if (growthChart) growthChart.destroy();
    growthChart = new Chart(ctx, {
        type: 'line',
        data: { labels: years, datasets: [
            { label: 'Avg Radiance', data: radianceData, borderColor: '#00ffff', backgroundColor: 'rgba(0, 255, 255, 0.1)', borderWidth: 3, tension: 0.4, yAxisID: 'y' },
            { label: 'GDP Proxy', data: gdpData, borderColor: '#ff00ff', borderDash: [5, 5], borderWidth: 2, tension: 0.4, yAxisID: 'y1' }
        ]},
        options: { responsive: true, scales: { x: { ticks: { color: '#aaa', maxTicksLimit: 5 } }, y: { ticks: { color: '#00ffff' } }, y1: { position: 'right', ticks: { color: '#ff00ff' }, grid: { drawOnChartArea: false } } }, plugins: { legend: { labels: { color: '#fff' } } } }
    });
}

function appendMessage(sender, text, color) {
    let chatWin = document.getElementById("chatWindow");
    chatWin.innerHTML += `<div style="color: ${color};">> ${sender}: ${text}</div>`;
    chatWin.scrollTop = chatWin.scrollHeight;
}

function sendQuickQuery(type) {
    playTechClick();
    if (!currentCityData) { appendMessage("SYS", "ERROR: NO DATA UPLINK. RUN SCAN FIRST.", "#ff4444"); return; }

    if (type === 'max_growth') {
        appendMessage("USR", "CALCULATE PEAK GROWTH PERIOD", "#fff");
        let rads = currentCityData.timeline_radiance; let labels = currentCityData.timeline_years;
        let maxJump = 0; let peakIndex = 0;
        for (let i = 1; i < rads.length; i++) {
            let jump = rads[i] - rads[i-1];
            if (jump > maxJump) { maxJump = jump; peakIndex = i; }
        }
        let response = maxJump > 0 ? `PEAK EXPANSION DETECTED IN ${labels[peakIndex]} (+${maxJump.toFixed(2)}). LIKELY NEW INFRASTRUCTURE DEPLOYMENT.` : `NO SIGNIFICANT GROWTH SPIKES DETECTED.`;
        setTimeout(() => appendMessage("BATRAK", response, "#00ffcc"), 400);

    } else if (type === 'risk_report') {
        appendMessage("USR", "ASSESS SPRAWL RISK", "#fff");
        let patch = currentCityData.patchiness;
        let risk = patch > 15 ? "HIGH (SEVERE FRAGMENTATION)" : (patch > 8 ? "MODERATE (EMERGING SPRAWL)" : "LOW (DENSE CORE)");
        setTimeout(() => appendMessage("BATRAK", `SPATIAL PATCHINESS INDEX: ${patch}. RISK: ${risk}.`, "#ff00ff"), 400);

    } else if (type === 'summary') {
        appendMessage("USR", "GENERATE EXECUTIVE SUMMARY", "#fff");
        setTimeout(() => appendMessage("BATRAK", `TARGET CLASSIFIED AS [${currentCityData.status.toUpperCase()}]. CONFIDENCE: ${currentCityData.confidence}. YOY MOMENTUM: ${currentCityData.growth_rate}%.`, "#00ffcc"), 400);
    }
}

function processChat() {
    playTechClick();
    let input = document.getElementById("chatInput"); let text = input.value.trim().toLowerCase();
    if (!text) return;
    input.value = ""; appendMessage("USR", text.toUpperCase(), "#fff");

    if (!currentCityData) { setTimeout(() => appendMessage("SYS", "ERROR: RUN SCAN TO POPULATE DATABANKS.", "#ff4444"), 300); return; }

    setTimeout(() => {
        if (text.includes("growth") || text.includes("highest") || text.includes("peak")) sendQuickQuery('max_growth');
        else if (text.includes("risk") || text.includes("patchiness") || text.includes("sprawl")) sendQuickQuery('risk_report');
        else if (text.includes("status") || text.includes("summary")) sendQuickQuery('summary');
        else appendMessage("BATRAK", "UNRECOGNIZED COMMAND. USE KEYWORDS (GROWTH, RISK, SUMMARY).", "#ffaa00");
    }, 500);
}