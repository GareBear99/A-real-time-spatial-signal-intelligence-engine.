(function(){
'use strict';
const $ = (id) => document.getElementById(id);
const STORAGE = {
  theme:'arc.rg.theme', structures:'arc.rg.structures', sessions:'arc.rg.sessions', signals:'arc.rg.signals', flags:'arc.rg.flags', notes:'arc.rg.notes', calibration:'arc.rg.calibration', reports:'arc.rg.reports', incidents:'arc.rg.incidents', operators:'arc.rg.operators', ingest:'arc.rg.ingest'
};
const TILE_SIZE = 256;
const PROVIDERS = {
  topo:{label:'Topo', url:'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'},
  street:{label:'Street', url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'},
  satellite:{label:'Satellite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'},
  dark:{label:'Dark', url:'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'}
};
const CALIBRATION = {
  balanced:{name:'Balanced', noise:3.0, attenuation:1.0, decay:0.82, smooth:0.62},
  urban:{name:'Urban Dense', noise:4.8, attenuation:1.18, decay:0.78, smooth:0.72},
  residential:{name:'Residential', noise:2.0, attenuation:0.92, decay:0.86, smooth:0.56},
  interference:{name:'High Interference', noise:6.5, attenuation:1.28, decay:0.74, smooth:0.78}
};
const FLAGS = {showMarker:true, showRadius:true};
const demoStructures = [
  {id:'s1', address:'100 Pine Ave', name:'Pine House', type:'house', levels:1, polygon:[[52.13188,-122.14235],[52.13188,-122.14203],[52.13168,-122.14203],[52.13168,-122.14235]]},
  {id:'s2', address:'118 Cedar St', name:'Cedar Duplex', type:'duplex', levels:2, polygon:[[52.13156,-122.14174],[52.13156,-122.14137],[52.13132,-122.14137],[52.13132,-122.14174]]},
  {id:'s3', address:'201 Birch Rd', name:'Birch Garage', type:'garage', levels:1, polygon:[[52.13123,-122.14246],[52.13123,-122.14215],[52.13104,-122.14215],[52.13104,-122.14246]]},
  {id:'s4', address:'240 Lakeview Dr', name:'Lakeview Home', type:'house', levels:2, polygon:[[52.13207,-122.14148],[52.13207,-122.14112],[52.13179,-122.14112],[52.13179,-122.14148]]},
  {id:'s5', address:'310 Hillcrest Ln', name:'Hillcrest Bungalow', type:'house', levels:1, polygon:[[52.13154,-122.14287],[52.13154,-122.14257],[52.13130,-122.14257],[52.13130,-122.14287]]}
].map(s => ({...s, center: centroid(s.polygon)}));

const state = {
  boot:'INIT',
  theme: localStorage.getItem(STORAGE.theme) || 'light',
  structures: loadJson(STORAGE.structures, demoStructures),
  selectedStructureId:null,
  selectedStructure:null,
  sensors:[],
  sessions: loadJson(STORAGE.sessions, []),
  signals: loadJson(STORAGE.signals, []),
  notes: loadJson(STORAGE.notes, []),
  reports: loadJson(STORAGE.reports, []),
  incidents: loadJson(STORAGE.incidents, []),
  operators: loadJson(STORAGE.operators, [{id:'op-default', name:'Master Control', role:'Lead', status:'online', createdAt:new Date().toISOString()}]),
  ingest: Object.assign({adapter:'mock', pollMs:1200, timer:null, points:[], cursor:0, status:'idle'}, loadJson(STORAGE.ingest, {})),
  flags: Object.assign({}, FLAGS, loadJson(STORAGE.flags, {})),
  calibrationKey: localStorage.getItem(STORAGE.calibration) || 'balanced',
  blueprint: {imageDataUrl:null, opacity:0.45, scale:1, offsetX:0, offsetY:0},
  estimator: {last:null, confidence:0, zone:'Unknown', clusterSpread:0, calibration:'balanced', floor:1, rmse:null, p95:null, wizard:null},
  advanced: {floor:1, geofenceRadius:38, scenarioPreset:'sweep', cloudDensity:24},
  sim: {running:false, timer:null, tickMs:900, noiseDb:3, step:0, threshold:-58, scenarioLabel:'Default live sweep'},
  replay: {index:0, timer:null},
  map: {root:null, tiles:null, svg:null, rf:null, width:0, height:0, center:{lat:52.13163,lng:-122.14188}, zoom:16.7, provider:'topo', dragging:false, dragStart:null, startCenter:null},
  devices: {},
  ui: {tab:'dashboard'},
  debug: {logs:[]}
};

function loadJson(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; } }
function saveJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setBoot(stage){ state.boot = stage; $('bootPill').textContent = `BOOT · ${stage}`; }
function fatal(error){ $('fatal').style.display='block'; $('fatal').textContent = 'FATAL\n\n' + (error?.stack || String(error)); console.error(error); setBoot('FATAL'); }
function nowIso(){ return new Date().toISOString(); }
function clockTick(){ $('clock').textContent = new Date().toLocaleString(); }
function log(msg, kind='info'){ const entry = {id:'lg'+Date.now()+Math.random().toString(36).slice(2,7), time:new Date().toLocaleTimeString(), msg, kind}; state.debug.logs.unshift(entry); state.debug.logs = state.debug.logs.slice(0,180); $('log').innerHTML = state.debug.logs.map(x => `<div class="log-item mono">${escapeHtml(x.time)} — ${escapeHtml(x.msg)}</div>`).join(''); }

function centroid(poly){ const sum = poly.reduce((acc, p) => ({lat:acc.lat+p[0], lng:acc.lng+p[1]}), {lat:0,lng:0}); return {lat:sum.lat/poly.length, lng:sum.lng/poly.length}; }
function boundsFromPolygon(poly){ const lats = poly.map(p => p[0]), lngs = poly.map(p => p[1]); return {minLat:Math.min(...lats), maxLat:Math.max(...lats), minLng:Math.min(...lngs), maxLng:Math.max(...lngs)}; }
function pointInPolygon(point, polygon){ const x = point.lng, y = point.lat; let inside = false; for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){ const xi=polygon[i][1], yi=polygon[i][0], xj=polygon[j][1], yj=polygon[j][0]; const intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi); if(intersect) inside=!inside; } return inside; }
function seeded(seed){ let t = Math.floor(seed * 1e6) ^ 0x9e3779b9; return function(){ t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function seededPointInPolygon(polygon, seed){ const bounds = boundsFromPolygon(polygon); const rnd = seeded(seed); for(let i=0;i<800;i++){ const p = {lat:bounds.minLat + (bounds.maxLat-bounds.minLat)*rnd(), lng:bounds.minLng + (bounds.maxLng-bounds.minLng)*rnd()}; if(pointInPolygon(p, polygon)) return p; } return centroid(polygon); }
function distanceMeters(a,b){ const R=6371000, tr=Math.PI/180; const dLat=(b.lat-a.lat)*tr, dLng=(b.lng-a.lng)*tr, lat1=a.lat*tr, lat2=b.lat*tr; const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2; return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function lerpPoint(a,b,t){ return {lat:lerp(a.lat,b.lat,t), lng:lerp(a.lng,b.lng,t)}; }
function clampPointToBounds(point, bounds){ return {lat:Math.min(bounds.maxLat, Math.max(bounds.minLat, point.lat)), lng:Math.min(bounds.maxLng, Math.max(bounds.minLng, point.lng))}; }
function mercatorWorld(point, zoom){ const sin = Math.sin(point.lat * Math.PI / 180); const scale = TILE_SIZE * Math.pow(2, zoom); return {x:(point.lng+180)/360*scale, y:(0.5 - Math.log((1+sin)/(1-sin)) / (4*Math.PI))*scale}; }
function unprojectWorld(x,y,zoom){ const scale = TILE_SIZE * Math.pow(2, zoom); const lng = x / scale * 360 - 180; const n = Math.PI - 2 * Math.PI * y / scale; const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); return {lat,lng}; }
function project(point){ const c = mercatorWorld(state.map.center, state.map.zoom); const p = mercatorWorld(point, state.map.zoom); return {x:(p.x-c.x) + state.map.width/2, y:(p.y-c.y) + state.map.height/2}; }
function setCenterZoom(center, zoom){ state.map.center = center; state.map.zoom = Math.max(3, Math.min(20, zoom)); $('zoomLevelInput').value = state.map.zoom.toFixed(1); renderMap(); }
function fitPoints(points, padding=70){ if(!points.length) return; const bounds = {minLat:Math.min(...points.map(p=>p.lat)), maxLat:Math.max(...points.map(p=>p.lat)), minLng:Math.min(...points.map(p=>p.lng)), maxLng:Math.max(...points.map(p=>p.lng))}; const width = Math.max(1, state.map.width - padding*2), height = Math.max(1, state.map.height - padding*2);
  let bestZoom = 20; const target = [{lat:bounds.minLat,lng:bounds.minLng},{lat:bounds.maxLat,lng:bounds.maxLng}];
  for(let z=20;z>=3;z-=0.1){ const a = mercatorWorld(target[0], z), b = mercatorWorld(target[1], z); if(Math.abs(b.x-a.x)<=width && Math.abs(b.y-a.y)<=height){ bestZoom = z; break; } }
  setCenterZoom({lat:(bounds.minLat+bounds.maxLat)/2, lng:(bounds.minLng+bounds.maxLng)/2}, bestZoom);
}

function buildSensorsForStructure(structure){ const c = centroid(structure.polygon); const pts = [seededPointInPolygon(structure.polygon,11), seededPointInPolygon(structure.polygon,27), seededPointInPolygon(structure.polygon,53), seededPointInPolygon(structure.polygon,81), c]; return pts.map((p,i)=>({id:`${structure.id}-sn${i+1}`, lat:p.lat, lng:p.lng, type:i===4?'center-anchor':'anchor', floor:1 + (i % Math.max(1, Number(structure.levels||1))), reliability:0.86 - i*0.04, history:[]})); }
function ensureDevice(id='phone1'){ if(!state.devices[id]) state.devices[id] = {id, truth:null, estimated:null, smoothed:null, truthPath:[], estimatePath:[], observationHistory:[], zone:'Unknown', confidence:0, lastSeen:null, estimatedFloor:1, candidateCloud:[], errors:[]}; return state.devices[id]; }
function activeCalibration(){ return CALIBRATION[state.calibrationKey] || CALIBRATION.balanced; }
function normalizeWeights(items){ const total = items.reduce((a,b)=>a + (b.weight||0), 0) || 1; return items.map(x => ({...x, weight:(x.weight||0)/total})); }
function sensorReliability(sensor){
  const history = sensor.history || [];
  if(!history.length) return sensor.reliability ?? 0.86;
  const avgAbs = history.reduce((a,b)=>a + Math.abs(b.error||0), 0) / history.length;
  return Math.max(0.45, Math.min(0.99, 0.98 - avgAbs/18));
}
function structureFloorCount(){ return Math.max(1, Number(state.selectedStructure?.levels || 1)); }
function floorPenalty(sensorFloor, truthFloor){ return 1 + Math.abs((sensorFloor||1) - (truthFloor||1)) * 0.28; }
function randomSeededInt(seed){ let t = seed >>> 0; return function(){ t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function candidateCloud(point, count, spreadMeters){
  const cloud = []; if(!point || !count) return cloud;
  const latScale = 1 / 111111; const lngScale = 1 / (111111 * Math.cos(point.lat * Math.PI / 180) || 1);
  for(let i=0;i<count;i++){
    const angle = (Math.PI * 2 * i) / count; const radius = (0.35 + (i % 5)/6) * spreadMeters;
    cloud.push({lat:point.lat + Math.sin(angle) * radius * latScale, lng:point.lng + Math.cos(angle) * radius * lngScale});
  }
  return cloud;
}
function scenarioTrack(structure, preset){
  const points = [seededPointInPolygon(structure.polygon,103), seededPointInPolygon(structure.polygon,209), seededPointInPolygon(structure.polygon,307), seededPointInPolygon(structure.polygon,401), seededPointInPolygon(structure.polygon,509)];
  if(preset === 'linger') points.splice(2,0, points[1], points[1], points[3]);
  if(preset === 'intrusion') points.unshift(centroid(structure.polygon));
  if(preset === 'patrol') points.push(points[2], points[0]);
  points.push(points[0]);
  return points;
}
function runCalibrationWizard(){
  const profile = activeCalibration();
  const device = ensureDevice();
  const hist = device.observationHistory || [];
  const conf = hist.length ? hist.reduce((a,b)=>a + (b.confidence||0), 0)/hist.length : state.estimator.confidence || 0.5;
  const avgTop = hist.length ? hist.reduce((a,b)=>a + (b.topRssi||-75), 0)/hist.length : -72;
  const spread = Number(state.estimator.clusterSpread || 12);
  const tunedNoise = Math.max(1.4, Math.min(7.5, profile.noise + (1-conf)*1.6 + Math.max(0, spread-14)/18));
  const tunedAttn = Math.max(0.85, Math.min(1.4, profile.attenuation + (avgTop < -70 ? 0.08 : -0.03) + Math.max(0, state.advanced.floor-1)*0.03));
  const custom = {name:'Wizard-Calibrated', noise:Number(tunedNoise.toFixed(2)), attenuation:Number(tunedAttn.toFixed(2)), decay:Number((profile.decay*0.98).toFixed(2)), smooth:Number(Math.min(0.86, profile.smooth + 0.05).toFixed(2))};
  CALIBRATION.wizard = custom; state.calibrationKey = 'wizard'; localStorage.setItem(STORAGE.calibration, 'wizard');
  state.estimator.wizard = custom; $('calibrationProfile').innerHTML = `<option value="balanced">Balanced</option><option value="urban">Urban Dense</option><option value="residential">Residential</option><option value="interference">High Interference</option><option value="wizard">Wizard-Calibrated</option>`; $('calibrationProfile').value = 'wizard';
  $('calibrationWizardOut').textContent = `Wizard complete · noise ${custom.noise} · attenuation ${custom.attenuation} · smooth ${custom.smooth}`;
  addSignal('info', 'Calibration wizard complete', `noise ${custom.noise} · attenuation ${custom.attenuation} · smooth ${custom.smooth}`, {confidence:conf});
  renderAudit(); updateHud();
}
function manifestSnapshot(){ return {createdAt:nowIso(), version:'arc-rg-v6', theme:state.theme, provider:state.map.provider, selectedStructureId:state.selectedStructureId, calibration:state.calibrationKey, advanced:state.advanced, reports:state.reports.slice(0,5)}; }
function runAccuracyLab(){
  if(!state.selectedStructure) return null;
  const frames = Math.max(20, Math.min(500, Number($('labFrames').value) || 120));
  const seed = Math.max(1, Number($('labSeed').value) || 101);
  const rnd = randomSeededInt(seed);
  const structure = state.selectedStructure;
  let previous = null; const errors = []; const confidences = [];
  for(let i=0;i<frames;i++){
    const truth = seededPointInPolygon(structure.polygon, rnd()*999 + i + 1);
    const truthFloor = 1 + Math.floor(rnd() * structureFloorCount());
    const observations = makeObservations(truth, state.sensors, truthFloor, true, rnd);
    const est = estimateFromObservations(observations, structure, previous, truthFloor, true);
    previous = est?.point || previous;
    const error = est?.point ? distanceMeters(truth, est.point) : 999;
    errors.push(error); confidences.push(est?.confidence || 0);
  }
  const sorted = [...errors].sort((a,b)=>a-b); const rmse = Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length); const p50 = sorted[Math.floor(sorted.length*0.5)]; const p95 = sorted[Math.floor(sorted.length*0.95)] || sorted[sorted.length-1];
  const report = {id:'rpt'+Date.now(), createdAt:nowIso(), structureId:structure.id, structure:structure.address, seed, frames, floor:state.advanced.floor, calibration:state.calibrationKey, rmse:Number(rmse.toFixed(2)), p50:Number(p50.toFixed(2)), p95:Number(p95.toFixed(2)), meanConfidence:Number((confidences.reduce((a,b)=>a+b,0)/confidences.length).toFixed(3))};
  state.reports.unshift(report); state.reports = state.reports.slice(0,20); saveJson(STORAGE.reports, state.reports); state.estimator.rmse = report.rmse; state.estimator.p95 = report.p95;
  $('accuracyReportOut').textContent = `RMSE ${report.rmse}m · P50 ${report.p50}m · P95 ${report.p95}m · mean conf ${Math.round(report.meanConfidence*100)}%`;
  addSignal(report.p95 > 18 ? 'watch':'info', 'Accuracy lab complete', `RMSE ${report.rmse}m · P95 ${report.p95}m`, {confidence:report.meanConfidence});
  renderAudit(); updateHud();
  return report;
}
function inferZone(structure, point){ if(!structure||!point) return 'Unknown'; const b = boundsFromPolygon(structure.polygon); const rx=(point.lng-b.minLng)/((b.maxLng-b.minLng)||1), ry=(point.lat-b.minLat)/((b.maxLat-b.minLat)||1); if(Math.abs(rx-0.5)<0.18 && Math.abs(ry-0.5)<0.18) return 'Center-Core'; if(ry<0.33) return 'North Zone'; if(ry>0.66) return 'South Zone'; return rx<0.5 ? 'West Zone' : 'East Zone'; }
function rssiFromDistanceMeters(meters, noiseDb, attenuation){ const d = Math.max(1, meters * attenuation); const pathLoss = 32 + 20 * Math.log10(d); const tx = -30; const noise = (Math.random()-0.5) * 2 * noiseDb; return tx - pathLoss + noise; }

function makeObservations(truth, sensors, truthFloor=state.advanced.floor, deterministic=false, rnd=Math.random){
  const profile = activeCalibration();
  return sensors.map(sensor => {
    const reliability = sensorReliability(sensor);
    const floorFactor = floorPenalty(sensor.floor, truthFloor);
    const noiseFn = deterministic ? rnd : Math.random;
    const d = distanceMeters(truth, sensor) * floorFactor;
    const rssi = rssiFromDistanceMeters(d, profile.noise * (1.05 - reliability*0.4), profile.attenuation);
    return {sensor, rssi, reliability, floorPenalty:floorFactor};
  });
}
function estimateFromObservations(observations, structure, previous, truthFloor=state.advanced.floor, deterministic=false){
  if(!observations.length) return null;
  const sorted = [...observations].sort((a,b)=>b.rssi-a.rssi);
  const top = sorted.slice(0, Math.min(4, sorted.length));
  const weighted = normalizeWeights(top.map(obs => ({obs, weight:Math.pow(10, (obs.rssi + 100)/12) * (obs.reliability || 0.8) / (obs.floorPenalty || 1)})));
  let lat=0, lng=0, inferredFloor=0, spreadScore=0;
  for(const item of weighted){ lat += item.obs.sensor.lat * item.weight; lng += item.obs.sensor.lng * item.weight; inferredFloor += (item.obs.sensor.floor || 1) * item.weight; spreadScore += (1 - item.weight) * 0.2; }
  let point = {lat, lng};
  let clusterSpread = 0;
  if(top.length>1){ const pairs=[]; for(let i=0;i<top.length;i++){ for(let j=i+1;j<top.length;j++){ pairs.push(distanceMeters(top[i].sensor, top[j].sensor)); } } clusterSpread = pairs.reduce((a,b)=>a+b,0)/pairs.length; }
  const profile = activeCalibration();
  if(previous){ point = lerpPoint(previous, point, 1-profile.smooth); }
  if(structure){ const bounds = boundsFromPolygon(structure.polygon); if(!pointInPolygon(point, structure.polygon)) point = clampPointToBounds(point, bounds); }
  const spread = Math.max(0, (sorted[0]?.rssi||0) - (sorted[1]?.rssi||sorted[0]?.rssi));
  const floorAgreement = Math.max(0, 1 - Math.abs((inferredFloor || 1) - truthFloor) * 0.25);
  const confidence = Math.max(0.12, Math.min(0.995, 0.28 + spread/28 + floorAgreement*0.14 + (clusterSpread ? Math.max(0, 1-(clusterSpread/38))/4 : 0) - spreadScore));
  return {point, confidence, clusterSpread, floor:Math.max(1, Math.min(structureFloorCount(), Math.round(inferredFloor || truthFloor))), cloud:candidateCloud(point, Number(state.advanced.cloudDensity || 0), Math.max(4, clusterSpread*0.18 + (1-confidence)*18))};
}

function buildTrackPath(structure){ return scenarioTrack(structure, state.advanced.scenarioPreset); }
function truthPointForStep(track, step){ if(track.length<2) return track[0] || null; const cycle = (step % ((track.length-1)*20)); const seg = Math.floor(cycle / 20); const t = (cycle % 20) / 20; return lerpPoint(track[seg], track[seg+1], t); }

function renderOperators(){ const rows = state.operators.map(op => `<div class="feed-item"><div class="t">${escapeHtml(op.name)}</div><div class="m">${escapeHtml(op.role)} · ${escapeHtml(op.status||'online')}</div><div class="meta">${escapeHtml(new Date(op.createdAt||Date.now()).toLocaleString())}</div></div>`).join(''); if($('operatorsList')) $('operatorsList').innerHTML = rows || '<div class="small">No operators.</div>'; }
function addOperator(name, role){ const op = {id:'op'+Date.now()+Math.random().toString(36).slice(2,6), name, role, status:'online', createdAt:nowIso()}; state.operators.unshift(op); state.operators = state.operators.slice(0,24); saveJson(STORAGE.operators, state.operators); renderOperators(); addSignal('info', 'Operator added', `${name} · ${role}`, {confidence:0.9}); return op; }
function renderIncidents(){ const rows = state.incidents.map(x => `<div class="feed-item"><div class="t">${escapeHtml(x.title)}</div><div class="m">${escapeHtml(x.severity.toUpperCase())} · ${escapeHtml(x.status)}${x.assignee ? ' · '+escapeHtml(x.assignee) : ''}</div><div class="meta">${escapeHtml(new Date(x.createdAt).toLocaleString())}</div><div class="row" style="margin-top:6px"><button data-incident-status="${x.id}" data-status="open">Open</button><button data-incident-status="${x.id}" data-status="investigating">Investigating</button><button data-incident-status="${x.id}" data-status="closed">Closed</button></div></div>`).join(''); if($('incidentsList')) $('incidentsList').innerHTML = rows || '<div class="small">No incidents.</div>'; }
function createIncident(title, severity='watch', source=null){ const incident = {id:'inc'+Date.now()+Math.random().toString(36).slice(2,6), title, severity, status:'open', source, assignee:state.operators[0]?.name || null, structureId:state.selectedStructureId || null, createdAt:nowIso()}; state.incidents.unshift(incident); state.incidents = state.incidents.slice(0,80); saveJson(STORAGE.incidents, state.incidents); renderIncidents(); renderDashboard(); addSignal(severity === 'alert' ? 'alert' : 'watch', 'Incident created', `${title} · assigned ${incident.assignee || 'unassigned'}`, {confidence:0.92}); return incident; }
function setIncidentStatus(id, status){ const inc = state.incidents.find(x => x.id === id); if(!inc) return; inc.status = status; saveJson(STORAGE.incidents, state.incidents); renderIncidents(); renderDashboard(); }
function parseIngestPayload(raw, adapter){ raw = String(raw || '').trim(); if(!raw) return []; if(adapter === 'json'){ const parsed = JSON.parse(raw); const pts = Array.isArray(parsed) ? parsed : (parsed.points || parsed.track || []); return pts.map((p, i) => ({lat:Number(p.lat), lng:Number(p.lng), floor:Number(p.floor || state.advanced.floor || 1), time:p.time || nowIso(), index:i})).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)); }
  if(adapter === 'csv'){ const lines = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean); const start = /lat/i.test(lines[0]) ? 1 : 0; return lines.slice(start).map((line, i) => { const [lat,lng,floor,time] = line.split(','); return {lat:Number(lat), lng:Number(lng), floor:Number(floor || state.advanced.floor || 1), time:time || nowIso(), index:i}; }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)); }
  if(adapter === 'nmea'){ return raw.split(/\r?\n/).map((line, i) => { const bits = Object.fromEntries(line.split(',').map(part => part.split('=').map(x => x.trim())).filter(part => part.length===2)); return {lat:Number(bits.LAT || bits.lat), lng:Number(bits.LNG || bits.lng), floor:Number(bits.FLOOR || bits.floor || state.advanced.floor || 1), time:bits.TIME || nowIso(), index:i}; }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)); }
  return [];
}
function applyIngestPoints(points, source='payload'){ if(!points.length) return; state.ingest.points = points; state.ingest.cursor = 0; state.ingest.status = `loaded ${points.length} point(s) from ${source}`; saveJson(STORAGE.ingest, {...state.ingest, timer:null}); if($('ingestStatus')) $('ingestStatus').textContent = `Gateway loaded ${points.length} point(s) from ${source}.`; const device = ensureDevice(); if(!state.selectedStructure){ const nearest = state.structures.map(s => ({s, d:distanceMeters(s.center, points[0])})).sort((a,b)=>a.d-b.d)[0]; if(nearest) lockStructure(nearest.s.id, false); }
  device.truthPath = []; device.estimatePath = []; device.observationHistory = []; state.sim.step = 0; stepSimulation(); addSignal('info', 'Ingestion payload applied', `${points.length} point(s) · ${source}`, {confidence:0.88}); }
function ingestTick(){ if(!state.ingest.points.length) return; const device = ensureDevice(); const point = state.ingest.points[Math.min(state.ingest.cursor, state.ingest.points.length-1)]; device.externalTruth = {lat:point.lat, lng:point.lng}; device.externalFloor = Number(point.floor || state.advanced.floor || 1); stepSimulation(); state.ingest.cursor = Math.min(state.ingest.points.length-1, state.ingest.cursor + 1); if(state.ingest.cursor >= state.ingest.points.length-1){ clearInterval(state.ingest.timer); state.ingest.timer = null; state.ingest.status = 'completed'; if($('ingestStatus')) $('ingestStatus').textContent = 'Gateway completed imported track.'; saveJson(STORAGE.ingest, {...state.ingest, timer:null}); } }
function startIngestLoop(){ clearInterval(state.ingest.timer); state.ingest.pollMs = Number($('ingestPollMs')?.value || state.ingest.pollMs || 1200); if(!state.ingest.points.length){ const structure = state.selectedStructure || state.structures[0]; const mock = scenarioTrack(structure, state.advanced.scenarioPreset).map((p,i) => ({...p, floor:1 + (i % Math.max(1, Number(structure.levels||1))), time:nowIso(), index:i})); applyIngestPoints(mock, 'mock-live'); }
  state.ingest.timer = setInterval(ingestTick, state.ingest.pollMs); state.ingest.status = 'running'; if($('ingestStatus')) $('ingestStatus').textContent = `Gateway running · ${state.ingest.points.length} point(s) · ${state.ingest.pollMs}ms`; saveJson(STORAGE.ingest, {...state.ingest, timer:null}); }
function stopIngestLoop(){ clearInterval(state.ingest.timer); state.ingest.timer = null; state.ingest.status = 'stopped'; if($('ingestStatus')) $('ingestStatus').textContent = 'Gateway stopped.'; saveJson(STORAGE.ingest, {...state.ingest, timer:null}); }
function evidencePack(){ return {createdAt:nowIso(), version:'arc-rg-v7-evidence', manifest:manifestSnapshot(), session:currentSessionSnapshot('Evidence Snapshot'), incidents:state.incidents.slice(0,20), operators:state.operators.slice(0,12), reports:state.reports.slice(0,10), notes:state.notes.slice(0,30), signals:state.signals.slice(0,80)}; }

function addSignal(kind, title, detail, extra={}){ const signal = {id:'sg'+Date.now()+Math.random().toString(36).slice(2,8), kind, title, detail, time:nowIso(), ...extra}; state.signals.unshift(signal); state.signals = state.signals.slice(0,200); saveJson(STORAGE.signals, state.signals); renderSignals(); renderDashboard(); return signal; }
function addNote(text){ const note = {id:'nt'+Date.now()+Math.random().toString(36).slice(2,7), time:nowIso(), structureId:state.selectedStructureId || null, text}; state.notes.unshift(note); state.notes = state.notes.slice(0,120); saveJson(STORAGE.notes, state.notes); renderNotes(); return note; }
function maybeCreateAnomaly(device, observations){ const threshold = Number($('signalThreshold').value) || -58; const top = Math.max(...observations.map(o=>o.rssi)); const drift = device.truth && device.estimated ? distanceMeters(device.truth, device.estimated) : 0; const centerDrift = state.selectedStructure && device.estimated ? distanceMeters(state.selectedStructure.center, device.estimated) : 0; if(top > threshold || drift > 10){ addSignal(drift > 10 ? 'alert':'watch', drift > 10 ? 'Estimator drift' : 'Strong signal burst', `Top RSSI ${top.toFixed(1)} dBm · drift ${drift.toFixed(1)}m`, {confidence:device.confidence, zone:device.zone}); } if(centerDrift > Number(state.advanced.geofenceRadius||0)){ addSignal('alert', 'Geofence breach', `Estimate exited ${Math.round(centerDrift)}m ring`, {confidence:device.confidence, zone:device.zone}); } if(Math.abs((device.estimatedFloor||1) - (state.advanced.floor||1)) >= 2){ addSignal('watch', 'Floor ambiguity', `Estimated floor ${device.estimatedFloor||1} vs operator ${state.advanced.floor||1}`, {confidence:device.confidence, zone:device.zone}); }
}

function currentSessionSnapshot(name='Untitled Session'){
  const device = state.devices.phone1 || ensureDevice();
  return {
    id:'sess'+Date.now(), name, createdAt:nowIso(),
    structureId: state.selectedStructureId, structure: state.selectedStructure,
    calibration: state.calibrationKey, provider: state.map.provider,
    timeline: device.estimatePath.map((point, idx) => ({index:idx, estimate:point, truth:device.truthPath[idx] || null, confidence:(device.observationHistory[idx]?.confidence || device.confidence), zone:device.observationHistory[idx]?.zone || device.zone, time:device.observationHistory[idx]?.time || nowIso()})),
    signals: state.signals.slice(0,60), notes: state.notes.filter(n => !state.selectedStructureId || n.structureId === state.selectedStructureId).slice(0,25),
    settings:{tickMs:state.sim.tickMs, threshold:state.sim.threshold, noiseDb:activeCalibration().noise, scenarioLabel:state.sim.scenarioLabel, advanced:state.advanced, ingest:{adapter:state.ingest.adapter, pollMs:state.ingest.pollMs, status:state.ingest.status}},
    reports:state.reports.slice(0,5),
    incidents:state.incidents.slice(0,10),
    operators:state.operators.slice(0,8)
  };
}
function saveSession(name){ const session = currentSessionSnapshot(name); state.sessions.unshift(session); state.sessions = state.sessions.slice(0,40); saveJson(STORAGE.sessions, state.sessions); renderSessions(); log(`SESSION SAVE ${name}`); return session; }
function loadSession(session){ if(!session) return; state.replay.index = 0; if(session.structureId){ const found = state.structures.find(s => s.id === session.structureId); if(found) lockStructure(found.id, false); }
  renderReplay(session, 0); $('timelineRange').max = Math.max(0, session.timeline.length-1); $('timelineRange').value = 0; $('timelineLabel').textContent = `${session.name} · frame 0 / ${Math.max(0, session.timeline.length-1)}`; log(`SESSION LOAD ${session.name}`); }

function renderDashboard(){ const device = state.devices.phone1 || ensureDevice(); const stats = [
  ['Structures', state.structures.length, 'indexed'],
  ['Signals', state.signals.length, 'stored'],
  ['Confidence', `${Math.round((device.confidence||0)*100)}%`, device.zone || 'zone'],
  ['Calibration', activeCalibration().name, state.map.provider],
  ['Incidents', state.incidents.length, 'workflow'],
  ['Operators', state.operators.length, 'team']
]; $('statsGrid').innerHTML = stats.map(([k,v,s]) => `<div class="stat"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div><div class="s">${escapeHtml(s)}</div></div>`).join('');
  $('signalFeed').innerHTML = state.signals.slice(0,8).map(sig => `<div class="feed-item"><div class="t">${escapeHtml(sig.title)}</div><div class="m">${escapeHtml(sig.detail || '')}</div><div class="meta">${escapeHtml(new Date(sig.time).toLocaleString())}</div></div>`).join('') || '<div class="small">No signals yet.</div>';
}
function renderSignals(){ const rows = state.signals.slice(0,50).map(sig => `<tr><td>${escapeHtml(new Date(sig.time).toLocaleTimeString())}</td><td>${escapeHtml(sig.kind)}</td><td>${escapeHtml(sig.title)}</td><td>${escapeHtml(sig.detail||'')}</td></tr>`).join(''); $('signalsTableWrap').innerHTML = `<table class="mini-table"><thead><tr><th>Time</th><th>Level</th><th>Signal</th><th>Detail</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No signals.</td></tr>'}</tbody></table>`;
  $('anomalyFeed').innerHTML = state.signals.filter(s => s.kind !== 'info').slice(0,8).map(sig => `<div class="feed-item"><div class="t">${escapeHtml(sig.title)}</div><div class="m">${escapeHtml(sig.detail||'')}</div><div class="meta">${escapeHtml(sig.kind.toUpperCase())} · ${escapeHtml(new Date(sig.time).toLocaleString())}</div></div>`).join('') || '<div class="small">No queued anomalies.</div>';
}
function renderNotes(){ $('noteFeed').innerHTML = state.notes.filter(n => !state.selectedStructureId || n.structureId === state.selectedStructureId).slice(0,12).map(n => `<div class="feed-item"><div class="t">${escapeHtml(new Date(n.time).toLocaleString())}</div><div class="m">${escapeHtml(n.text)}</div></div>`).join('') || '<div class="small">No notes attached.</div>'; }
function renderSessions(){ $('sessionsList').innerHTML = state.sessions.slice(0,12).map(sess => `<div class="feed-item"><div class="t">${escapeHtml(sess.name)}</div><div class="m">${escapeHtml(sess.structure?.address || 'No structure')} · ${escapeHtml(sess.calibration)}</div><div class="meta">${escapeHtml(new Date(sess.createdAt).toLocaleString())}</div><div class="row" style="margin-top:8px"><button data-session-open="${escapeHtml(sess.id)}" class="primary">Open</button><button data-session-export="${escapeHtml(sess.id)}">Export</button></div></div>`).join('') || '<div class="small">No saved sessions yet.</div>';
}
function renderAudit(){ const device = state.devices.phone1 || ensureDevice(); $('auditSnapshot').innerHTML = `<div class="stack small"><div><b>Runtime</b> ${escapeHtml(state.boot)}</div><div><b>Theme</b> ${escapeHtml(state.theme)}</div><div><b>Calibration</b> ${escapeHtml(activeCalibration().name)}</div><div><b>Provider</b> ${escapeHtml(state.map.provider)}</div><div><b>Track history</b> ${device.estimatePath.length} frames</div><div><b>Cluster spread</b> ${Number(state.estimator.clusterSpread||0).toFixed(1)} m</div><div><b>Fusion floor</b> ${escapeHtml(state.estimator.floor||1)}</div><div><b>Latest RMSE</b> ${state.estimator.rmse ? `${state.estimator.rmse}m` : '-'}</div><div><b>P95</b> ${state.estimator.p95 ? `${state.estimator.p95}m` : '-'}</div><div><b>Reports</b> ${state.reports.length}</div><div><b>Signals</b> ${state.signals.length}</div><div><b>Sessions</b> ${state.sessions.length}</div><div><b>Incidents</b> ${state.incidents.length}</div><div><b>Operators</b> ${state.operators.length}</div><div><b>Ingest</b> ${escapeHtml(state.ingest.status || 'idle')}</div></div>`; }
function updateHud(){ const structure = state.selectedStructure; const device = state.devices.phone1 || ensureDevice(); $('selectionStatus').textContent = structure ? `Locked: ${structure.address} (${structure.name})` : 'No structure locked.'; $('selectionKv').innerHTML = structure ? `<div>Address</div><div>${escapeHtml(structure.address)}</div><div>Name</div><div>${escapeHtml(structure.name)}</div><div>Type</div><div>${escapeHtml(structure.type)}</div><div>Levels</div><div>${escapeHtml(structure.levels)}</div><div>ID</div><div class="mono">${escapeHtml(structure.id)}</div>` : '<div>Status</div><div>Unlocked</div>';
  $('estimatorKv').innerHTML = `<div>Zone</div><div>${escapeHtml(device.zone || 'Unknown')}</div><div>Confidence</div><div>${Math.round((device.confidence||0)*100)}%</div><div>Frames</div><div>${device.estimatePath.length}</div><div>Spread</div><div>${Number(state.estimator.clusterSpread||0).toFixed(1)}m</div><div>Profile</div><div>${escapeHtml(activeCalibration().name)}</div>`;
  $('confidenceBar').style.width = `${Math.round((device.confidence||0)*100)}%`;
  $('healthKv').innerHTML = `<div>Map</div><div>${escapeHtml(state.map.provider)} @ ${state.map.zoom.toFixed(1)}</div><div>Sim</div><div>${state.sim.running ? 'Running':'Idle'}</div><div>Signals</div><div>${state.signals.length}</div><div>Theme</div><div>${escapeHtml(state.theme)}</div><div>Scenario</div><div>${escapeHtml(state.sim.scenarioLabel)}</div><div>Last Seen</div><div class="mono">${device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : '-'}</div>`;
  $('fusionKv').innerHTML = `<div>Est. Floor</div><div>${escapeHtml(device.estimatedFloor||1)}</div><div>Cloud</div><div>${escapeHtml(state.advanced.cloudDensity)}</div><div>Geo ring</div><div>${escapeHtml(state.advanced.geofenceRadius)}m</div><div>RMSE</div><div>${state.estimator.rmse ? `${state.estimator.rmse}m` : '-'}</div><div>P95</div><div>${state.estimator.p95 ? `${state.estimator.p95}m` : '-'}</div><div>Wizard</div><div>${state.estimator.wizard ? 'Ready' : 'Base'}</div>`;
  renderDashboard(); renderAudit();
}

function renderReplay(session, index){ if(!session || !session.timeline?.length) return; const frame = session.timeline[Math.max(0, Math.min(index, session.timeline.length-1))]; const device = ensureDevice(); device.truth = frame.truth; device.estimated = frame.estimate; device.confidence = frame.confidence || 0; device.zone = frame.zone || 'Unknown'; device.truthPath = session.timeline.slice(0, index+1).map(f => f.truth).filter(Boolean); device.estimatePath = session.timeline.slice(0, index+1).map(f => f.estimate).filter(Boolean); state.estimator.clusterSpread = state.estimator.clusterSpread || 0; renderMap(); updateHud(); $('timelineLabel').textContent = `${session.name} · frame ${index} / ${session.timeline.length-1}`; }
function playbackStart(){ clearInterval(state.replay.timer); const session = state.sessions[0]; if(!session || !session.timeline?.length) return; state.replay.timer = setInterval(() => { const max = session.timeline.length-1; state.replay.index = Math.min(max, state.replay.index+1); $('timelineRange').value = state.replay.index; renderReplay(session, state.replay.index); if(state.replay.index >= max) clearInterval(state.replay.timer); }, 350); }
function playbackPause(){ clearInterval(state.replay.timer); state.replay.timer = null; }

function setTheme(theme){ state.theme = theme; if(document.body) document.body.setAttribute('data-theme', theme); localStorage.setItem(STORAGE.theme, theme); if(state.map && state.map.root && state.map.tiles && state.map.svg && state.map.rf){ renderMap(); } if($('auditSnapshot')) renderAudit(); }
function switchTab(tab){ state.ui.tab = tab; document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab===tab)); document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id===`view-${tab}`)); }
function setCalibration(key){ state.calibrationKey = key in CALIBRATION ? key : 'balanced'; localStorage.setItem(STORAGE.calibration, state.calibrationKey); state.sim.noiseDb = activeCalibration().noise; if($('calibrationProfile') && !Array.from($('calibrationProfile').options).some(o => o.value === 'wizard') && CALIBRATION.wizard){ $('calibrationProfile').innerHTML += '<option value="wizard">Wizard-Calibrated</option>'; } renderAudit(); updateHud(); }

function initMap(){ state.map.root = $('map'); state.map.tiles = $('tiles'); state.map.svg = $('mapSvg'); state.map.rf = $('rf'); if(!state.map.root || !state.map.tiles || !state.map.svg || !state.map.rf) throw new Error('Map runtime surface missing required DOM nodes.'); resizeMap(); state.map.root.addEventListener('pointerdown', e => { state.map.dragging = true; state.map.dragStart = {x:e.clientX,y:e.clientY}; state.map.startCenter = {...state.map.center}; state.map.root.setPointerCapture(e.pointerId); });
  state.map.root.addEventListener('pointermove', e => { if(!state.map.dragging) return; const startWorld = mercatorWorld(state.map.startCenter, state.map.zoom); const nextWorld = {x:startWorld.x - (e.clientX - state.map.dragStart.x), y:startWorld.y - (e.clientY - state.map.dragStart.y)}; state.map.center = unprojectWorld(nextWorld.x, nextWorld.y, state.map.zoom); renderMap(); });
  const stopDrag = () => state.map.dragging = false; state.map.root.addEventListener('pointerup', stopDrag); state.map.root.addEventListener('pointercancel', stopDrag);
  state.map.root.addEventListener('wheel', e => { e.preventDefault(); const next = state.map.zoom + (e.deltaY < 0 ? 0.25 : -0.25); setCenterZoom(state.map.center, next); }, {passive:false});
}
function resizeMap(){ if(!state.map.root || !state.map.rf) return; const rect = state.map.root.getBoundingClientRect(); state.map.width = rect.width || 1000; state.map.height = rect.height || 700; state.map.rf.width = state.map.width; state.map.rf.height = state.map.height; }
function renderTiles(){ if(!state.map.tiles) return; const z = Math.max(0, Math.floor(state.map.zoom)); const worldCenter = mercatorWorld(state.map.center, z); const startX = worldCenter.x - state.map.width/2, startY = worldCenter.y - state.map.height/2; const endX = worldCenter.x + state.map.width/2, endY = worldCenter.y + state.map.height/2; const minTileX = Math.floor(startX/TILE_SIZE), maxTileX = Math.floor(endX/TILE_SIZE); const minTileY = Math.floor(startY/TILE_SIZE), maxTileY = Math.floor(endY/TILE_SIZE); const provider = PROVIDERS[state.map.provider] || PROVIDERS.topo; const limit = Math.max(1, Math.pow(2,z));
  let html = '';
  for(let tx=minTileX; tx<=maxTileX; tx++){
    for(let ty=minTileY; ty<=maxTileY; ty++){
      if(ty < 0 || ty >= limit) continue;
      const wrapX = ((tx % limit) + limit) % limit; const left = tx*TILE_SIZE - startX, top = ty*TILE_SIZE - startY;
      const url = provider.url.replace('{z}', z).replace('{x}', wrapX).replace('{y}', ty);
      html += `<img src="${url}" style="position:absolute;left:${left}px;top:${top}px;width:${TILE_SIZE}px;height:${TILE_SIZE}px;object-fit:cover;">`;
    }
  }
  state.map.tiles.innerHTML = html;
}
function renderSvg(){ if(!state.map.svg) return; const structure = state.selectedStructure; const device = state.devices.phone1 || ensureDevice(); const lines = [];
  const polyline = (points, attrs) => `<polyline points="${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" ${attrs}/>`;
  const circle = (p,r,attrs) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r}" ${attrs}/>`;
  const text = (p, label) => `<text x="${(p.x+8).toFixed(1)}" y="${(p.y-8).toFixed(1)}" fill="var(--fg)" font-size="11">${escapeHtml(label)}</text>`;
  for(const s of state.structures){ const pts = s.polygon.map(([lat,lng]) => project({lat,lng})); const selected = s.id === state.selectedStructureId; lines.push(polyline([...pts, pts[0]], `fill="${selected ? 'rgba(122,60,255,0.18)':'rgba(122,60,255,0.06)'}" stroke="${selected ? '#7A3CFF':'#B18CFF'}" stroke-width="${selected ? 3 : 2}" data-structure-id="${escapeHtml(s.id)}" style="cursor:pointer"`)); const c = project(s.center); lines.push(text(c, s.address)); }
  for(const sensor of state.sensors){ const p = project(sensor); if(state.flags.showRadius) lines.push(circle(p, sensor.type==='center-anchor'?34:22, 'fill="rgba(122,60,255,0.06)" stroke="rgba(122,60,255,0.16)" stroke-width="1"')); lines.push(circle(p, sensor.type==='center-anchor'?6:5, `fill="${sensor.type==='center-anchor' ? '#7A3CFF' : '#B18CFF'}" stroke="#fff" stroke-width="2"`)); lines.push(`<text x="${(p.x+8).toFixed(1)}" y="${(p.y+12).toFixed(1)}" fill="var(--muted)" font-size="10">R${Math.round(sensorReliability(sensor)*100)} · F${sensor.floor||1}</text>`); }
  if(device.truth && state.flags.showMarker){ const p = project(device.truth); lines.push(circle(p, 5, 'fill="#2f9e62" stroke="#fff" stroke-width="2"')); }
  if(device.estimated && state.flags.showMarker){ const p = project(device.estimated); if(state.flags.showRadius){ const rad = Math.max(10, 44*(1-(device.confidence||0))+10); lines.push(circle(p, rad, 'fill="rgba(122,60,255,0.10)" stroke="rgba(122,60,255,0.24)" stroke-width="2"')); } lines.push(circle(p, 6, 'fill="#7A3CFF" stroke="#fff" stroke-width="2"')); lines.push(`<text x="${(p.x+10).toFixed(1)}" y="${(p.y+14).toFixed(1)}" fill="var(--fg)" font-size="10">F${device.estimatedFloor||1}</text>`); }
  if(device.candidateCloud?.length){ for(const cp of device.candidateCloud){ const p = project(cp); lines.push(circle(p, 2.1, 'fill="rgba(122,60,255,0.22)" stroke="none"')); } }
  if(structure && state.advanced.geofenceRadius>0){ const c = project(structure.center); lines.push(circle(c, Math.max(20, state.advanced.geofenceRadius*2.4), 'fill="none" stroke="rgba(245,180,0,0.55)" stroke-dasharray="6 4" stroke-width="2"')); }
  if(device.truthPath.length>1){ lines.push(polyline(device.truthPath.map(project), 'fill="none" stroke="#2f9e62" stroke-width="2" opacity="0.55"')); }
  if(device.estimatePath.length>1){ lines.push(polyline(device.estimatePath.map(project), 'fill="none" stroke="#7A3CFF" stroke-width="2.5" opacity="0.85" stroke-dasharray="0"')); }
  state.map.svg.setAttribute('viewBox', `0 0 ${state.map.width} ${state.map.height}`); state.map.svg.innerHTML = lines.join('');
  state.map.svg.querySelectorAll('[data-structure-id]').forEach(el => el.addEventListener('click', () => lockStructure(el.getAttribute('data-structure-id'), true)));
}
function renderRF(){ if(!state.map.rf) return; const ctx = state.map.rf.getContext('2d'); if(!ctx) return; ctx.clearRect(0,0,state.map.width,state.map.height); const device = state.devices.phone1 || ensureDevice(); if(!device.estimated) return; const center = project(device.estimated); const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 110); gradient.addColorStop(0, 'rgba(122,60,255,0.20)'); gradient.addColorStop(1, 'rgba(122,60,255,0.0)'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(center.x, center.y, 110, 0, Math.PI*2); ctx.fill(); }
function renderBlueprint(){ const img = $('bpImage'); if(!img) return; const structure = state.selectedStructure; if(!structure || !state.blueprint.imageDataUrl){ img.style.display='none'; return; } const bounds = boundsFromPolygon(structure.polygon); const padLat = (bounds.maxLat-bounds.minLat)*(state.blueprint.scale-1)/2, padLng = (bounds.maxLng-bounds.minLng)*(state.blueprint.scale-1)/2; const nw = project({lat:bounds.maxLat+padLat+state.blueprint.offsetY, lng:bounds.minLng-padLng+state.blueprint.offsetX}); const se = project({lat:bounds.minLat-padLat+state.blueprint.offsetY, lng:bounds.maxLng+padLng+state.blueprint.offsetX}); img.src = state.blueprint.imageDataUrl; img.style.display='block'; img.style.left = `${nw.x}px`; img.style.top = `${nw.y}px`; img.style.width = `${se.x-nw.x}px`; img.style.height = `${se.y-nw.y}px`; img.style.opacity = state.blueprint.opacity; }
function renderMap(){ if(!state.map || !state.map.root) return; renderTiles(); renderSvg(); renderRF(); renderBlueprint(); if($('mapTag')) $('mapTag').textContent = `LuciferAI map · ${(PROVIDERS[state.map.provider] || PROVIDERS.topo).label} · drag to pan · wheel to zoom · calibration ${activeCalibration().name} · floor ${state.advanced.floor}`; }

function searchStructures(query){ const q = String(query || '').trim().toLowerCase(); return !q ? state.structures : state.structures.filter(s => [s.address,s.name,s.type,s.id].join(' ').toLowerCase().includes(q)); }
function populateStructures(structures){ $('structureSelect').innerHTML = structures.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.address)} — ${escapeHtml(s.name)}</option>`).join(''); }
function lockStructure(id, fit=true){ const structure = state.structures.find(s => s.id === id); if(!structure) return; state.selectedStructureId = id; state.selectedStructure = structure; state.sensors = buildSensorsForStructure(structure); if($('floorSelect')) $('floorSelect').innerHTML = Array.from({length:Math.max(1, Number(structure.levels||1))}, (_,i) => `<option value="${i+1}">Floor ${i+1}</option>`).join(''); const bp = loadJson(`arc.blueprint.${id}`, null); if(bp) Object.assign(state.blueprint, bp); const device = ensureDevice(); device.truth = null; device.estimated = null; device.smoothed = null; device.truthPath = []; device.estimatePath = []; device.observationHistory = []; state.sim.track = buildTrackPath(structure); state.sim.step = 0; if(fit) fitPoints(structure.polygon.map(([lat,lng]) => ({lat,lng}))); renderMap(); updateHud(); renderNotes(); log(`LOCK ${structure.address}`); }
function clearLock(){ stopSimulation(); state.selectedStructureId = null; state.selectedStructure = null; state.sensors = []; const device = ensureDevice(); device.truth = null; device.estimated = null; device.smoothed = null; device.truthPath = []; device.estimatePath = []; device.observationHistory = []; renderMap(); updateHud(); log('CLEAR LOCK'); }
function stepSimulation(){ if(!state.selectedStructure) return; const device = ensureDevice(); state.sim.step += 1; const truthFloor = Number(state.advanced.floor || 1); const truth = truthPointForStep(state.sim.track, state.sim.step); const observations = makeObservations(truth, state.sensors, truthFloor); const estimate = estimateFromObservations(observations, state.selectedStructure, device.smoothed || device.estimated, truthFloor); device.truth = truth; device.estimated = estimate?.point || truth; device.smoothed = device.estimated; device.estimatedFloor = estimate?.floor || truthFloor; device.candidateCloud = estimate?.cloud || []; device.truthPath.push(truth); device.estimatePath.push(device.estimated); device.truthPath = device.truthPath.slice(-180); device.estimatePath = device.estimatePath.slice(-180); device.confidence = estimate?.confidence || 0; const error = device.truth && device.estimated ? distanceMeters(device.truth, device.estimated) : 0; device.errors.push(error); device.errors = device.errors.slice(-180); device.zone = inferZone(state.selectedStructure, device.estimated); device.lastSeen = nowIso(); const topRssi = Math.max(...observations.map(o=>o.rssi)); device.observationHistory.push({time:device.lastSeen, confidence:device.confidence, zone:device.zone, topRssi}); device.observationHistory = device.observationHistory.slice(-180); state.sensors.forEach(sensor => { const obs = observations.find(o => o.sensor.id === sensor.id); const expected = obs ? (topRssi - obs.rssi) : 0; sensor.history = sensor.history || []; sensor.history.push({error:expected}); sensor.history = sensor.history.slice(-40); sensor.reliability = sensorReliability(sensor); }); state.estimator.last = device.estimated; state.estimator.confidence = device.confidence; state.estimator.zone = device.zone; state.estimator.floor = device.estimatedFloor; state.estimator.clusterSpread = estimate?.clusterSpread || 0; maybeCreateAnomaly(device, observations); renderMap(); updateHud(); log(`STEP ${state.sim.step} · zone=${device.zone} · floor=${device.estimatedFloor} · conf=${Math.round(device.confidence*100)}%`); }
function startSimulation(){ if(state.sim.running || !state.selectedStructure) return; state.sim.running = true; state.sim.tickMs = Number($('tickMs').value) || 900; state.sim.threshold = Number($('signalThreshold').value) || -58; state.sim.scenarioLabel = $('scenarioLabel').value.trim() || 'Default live sweep'; state.sim.timer = setInterval(stepSimulation, state.sim.tickMs); updateHud(); log(`SIM START ${state.sim.scenarioLabel}`); }
function stopSimulation(){ state.sim.running = false; clearInterval(state.sim.timer); state.sim.timer = null; updateHud(); }

function wireTabs(){ document.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab))); }
function wireUI(){
  $('searchBtn').onclick = () => { const results = searchStructures($('searchInput').value); populateStructures(results); log(`SEARCH ${results.length} result(s)`); };
  $('lockBtn').onclick = () => lockStructure($('structureSelect').value, true);
  $('clearBtn').onclick = clearLock;
  $('providerSelect').value = state.map.provider; $('providerSelect').onchange = () => { state.map.provider = $('providerSelect').value; renderMap(); renderAudit(); };
  $('zoomLevelInput').onchange = () => setCenterZoom(state.map.center, Number($('zoomLevelInput').value) || state.map.zoom);
  $('toggleMarkerBtn').onclick = () => { state.flags.showMarker = !state.flags.showMarker; saveJson(STORAGE.flags, state.flags); renderMap(); };
  $('toggleRadiusBtn').onclick = () => { state.flags.showRadius = !state.flags.showRadius; saveJson(STORAGE.flags, state.flags); renderMap(); };
  $('fitStructureBtn').onclick = () => state.selectedStructure && fitPoints(state.selectedStructure.polygon.map(([lat,lng]) => ({lat,lng})));
  $('recenterAllBtn').onclick = () => fitPoints(state.structures.flatMap(s => s.polygon.map(([lat,lng]) => ({lat,lng}))), 60);
  $('bpFile').onchange = async (e) => { const file = e.target.files?.[0]; if(!file) return; const dataUrl = await new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }); state.blueprint.imageDataUrl = dataUrl; saveJson(`arc.blueprint.${state.selectedStructureId}`, state.blueprint); renderBlueprint(); log(`BLUEPRINT LOAD ${file.name}`); };
  ['bpOpacity','bpScale','bpOffsetX','bpOffsetY'].forEach(id => $(id).oninput = () => { state.blueprint.opacity = Number($('bpOpacity').value); state.blueprint.scale = Number($('bpScale').value); state.blueprint.offsetX = Number($('bpOffsetX').value); state.blueprint.offsetY = Number($('bpOffsetY').value); saveJson(`arc.blueprint.${state.selectedStructureId}`, state.blueprint); renderBlueprint(); });
  $('saveBlueprint').onclick = () => { if(state.selectedStructureId) saveJson(`arc.blueprint.${state.selectedStructureId}`, state.blueprint); log('BLUEPRINT SAVE'); };
  $('resetBlueprint').onclick = () => { state.blueprint = {imageDataUrl:null, opacity:0.45, scale:1, offsetX:0, offsetY:0}; ['bpOpacity','bpScale','bpOffsetX','bpOffsetY'].forEach((id, idx) => { const vals = [0.45,1,0,0]; $(id).value = vals[idx]; }); renderBlueprint(); log('BLUEPRINT RESET'); };
  $('startBtn').onclick = startSimulation; $('stopBtn').onclick = () => { stopSimulation(); log('SIM STOP'); }; $('stepBtn').onclick = stepSimulation;
  $('themeDarkBtn').onclick = () => setTheme('dark'); $('themeLightBtn').onclick = () => setTheme('light');
  $('calibrationProfile').value = state.calibrationKey; $('calibrationProfile').onchange = () => setCalibration($('calibrationProfile').value);
  $('saveSessionBtn').onclick = () => saveSession($('sessionName').value.trim() || `Session ${new Date().toLocaleString()}`);
  $('exportSessionBtn').onclick = () => { const session = currentSessionSnapshot($('sessionName').value.trim() || 'Exported Session'); downloadJson(`arc-session-${Date.now()}.json`, session); };
  $('importSessionBtn').onclick = () => $('sessionFile').click();
  $('sessionFile').onchange = async (e) => { const file = e.target.files?.[0]; if(!file) return; try{ const parsed = JSON.parse(await file.text()); state.sessions.unshift(parsed); saveJson(STORAGE.sessions, state.sessions); renderSessions(); log(`SESSION IMPORT ${file.name}`); }catch(err){ fatal(err); } };
  $('sessionsList').onclick = (e) => { const openId = e.target.getAttribute('data-session-open'); const exportId = e.target.getAttribute('data-session-export'); if(openId){ const s = state.sessions.find(x => x.id === openId); if(s) loadSession(s); } if(exportId){ const s = state.sessions.find(x => x.id === exportId); if(s) downloadJson(`${s.name.replace(/\s+/g,'_')}.json`, s); } };
  $('playbackStartBtn').onclick = playbackStart; $('playbackPauseBtn').onclick = playbackPause; $('playbackStepBtn').onclick = () => { const session = state.sessions[0]; if(!session) return; state.replay.index = Math.min(session.timeline.length-1, state.replay.index+1); $('timelineRange').value = state.replay.index; renderReplay(session, state.replay.index); };
  $('timelineRange').oninput = () => { const session = state.sessions[0]; if(!session) return; state.replay.index = Number($('timelineRange').value); renderReplay(session, state.replay.index); };
  $('saveNoteBtn').onclick = () => { const text = $('noteInput').value.trim(); if(!text) return; addNote(text); $('noteInput').value=''; };
  $('clearNotesBtn').onclick = () => { state.notes = state.selectedStructureId ? state.notes.filter(n => n.structureId !== state.selectedStructureId) : []; saveJson(STORAGE.notes, state.notes); renderNotes(); };
  $('clearSignalsBtn').onclick = () => { state.signals = []; saveJson(STORAGE.signals, state.signals); renderSignals(); renderDashboard(); };
  $('refreshSignalsBtn').onclick = renderSignals;
  if($('floorSelect')) $('floorSelect').onchange = () => { state.advanced.floor = Number($('floorSelect').value)||1; updateHud(); renderMap(); };
  if($('geofenceRadius')) $('geofenceRadius').oninput = () => { state.advanced.geofenceRadius = Number($('geofenceRadius').value)||38; renderMap(); updateHud(); };
  if($('scenarioPreset')) $('scenarioPreset').onchange = () => { state.advanced.scenarioPreset = $('scenarioPreset').value; if(state.selectedStructure) state.sim.track = buildTrackPath(state.selectedStructure); updateHud(); };
  if($('cloudDensity')) $('cloudDensity').onchange = () => { state.advanced.cloudDensity = Number($('cloudDensity').value)||0; renderMap(); updateHud(); };
  if($('autoCalibrateBtn')) $('autoCalibrateBtn').onclick = runCalibrationWizard;
  if($('runAccuracyBtn')) $('runAccuracyBtn').onclick = runAccuracyLab;
  if($('exportAccuracyBtn')) $('exportAccuracyBtn').onclick = () => { const rpt = state.reports[0]; if(rpt) downloadJson(`arc-accuracy-report-${rpt.id}.json`, rpt); };
  if($('exportManifestBtn')) $('exportManifestBtn').onclick = () => downloadJson(`arc-manifest-${Date.now()}.json`, manifestSnapshot());
  if($('jumpLastReportBtn')) $('jumpLastReportBtn').onclick = () => { const s = state.sessions[0]; if(s) loadSession(s); };
  $('exportStructuresBtn').onclick = () => downloadJson('arc-structures.json', state.structures);
  $('resetDemoBtn').onclick = () => { state.structures = demoStructures.map(s => ({...s})); saveJson(STORAGE.structures, state.structures); populateStructures(state.structures); renderMap(); log('DEMO RESET'); };
  $('structurePackFile').onchange = async (e) => { const file = e.target.files?.[0]; if(!file) return; try{ const parsed = JSON.parse(await file.text()); const list = Array.isArray(parsed) ? parsed : parsed.structures; if(!Array.isArray(list)) throw new Error('Invalid structure pack'); const cleaned = list.filter(s => s?.id && Array.isArray(s.polygon) && s.polygon.length>=3).map(s => ({...s, center:centroid(s.polygon)})); state.structures = [...state.structures, ...cleaned.filter(n => !state.structures.some(s => s.id === n.id))]; saveJson(STORAGE.structures, state.structures); populateStructures(state.structures); renderMap(); log(`STRUCTURES IMPORT ${cleaned.length}`); }catch(err){ fatal(err); } };
  if($('applyIngestBtn')) $('applyIngestBtn').onclick = () => { try{ state.ingest.adapter = $('ingestAdapter').value; const pts = parseIngestPayload($('ingestText').value, state.ingest.adapter); applyIngestPoints(pts, state.ingest.adapter); }catch(err){ fatal(err); } };
  if($('startIngestBtn')) $('startIngestBtn').onclick = startIngestLoop;
  if($('stopIngestBtn')) $('stopIngestBtn').onclick = stopIngestLoop;
  if($('addOperatorBtn')) $('addOperatorBtn').onclick = () => { const name = $('operatorName').value.trim(); if(!name) return; addOperator(name, $('operatorRole').value); $('operatorName').value=''; };
  if($('createIncidentBtn')) $('createIncidentBtn').onclick = () => { const title = $('incidentTitle').value.trim(); if(!title) return; createIncident(title, $('incidentSeverity').value); $('incidentTitle').value=''; };
  if($('raiseSignalIncidentBtn')) $('raiseSignalIncidentBtn').onclick = () => { const sig = state.signals[0]; if(sig) createIncident(sig.title, sig.kind === 'alert' ? 'alert' : 'watch', sig.id); };
  if($('exportEvidenceBtn')) $('exportEvidenceBtn').onclick = () => downloadJson(`arc-evidence-pack-${Date.now()}.json`, evidencePack());
  if($('incidentsList')) $('incidentsList').onclick = (e) => { const id = e.target.getAttribute('data-incident-status'); const status = e.target.getAttribute('data-status'); if(id && status) setIncidentStatus(id, status); };
  window.addEventListener('resize', () => { resizeMap(); renderMap(); });
}
function downloadJson(filename, data){ const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function init(){ setBoot('LOAD_STATE'); setTheme(state.theme); clockTick(); setInterval(clockTick, 1000); wireTabs(); switchTab('dashboard'); initMap(); resizeMap(); state.map.provider = $('providerSelect').value = 'topo'; populateStructures(state.structures); wireUI(); if($('floorSelect')) $('floorSelect').value = String(state.advanced.floor); if($('geofenceRadius')) $('geofenceRadius').value = String(state.advanced.geofenceRadius); if($('scenarioPreset')) $('scenarioPreset').value = state.advanced.scenarioPreset; if($('cloudDensity')) $('cloudDensity').value = String(state.advanced.cloudDensity); setCalibration(state.calibrationKey); setBoot('READY'); renderSignals(); renderNotes(); renderSessions(); renderOperators(); renderIncidents(); renderDashboard(); renderAudit(); renderMap(); updateHud(); if($('ingestAdapter')) $('ingestAdapter').value = state.ingest.adapter || 'mock'; if($('ingestPollMs')) $('ingestPollMs').value = String(state.ingest.pollMs || 1200); if($('ingestStatus')) $('ingestStatus').textContent = `Gateway ${state.ingest.status || 'idle'}.`; fitPoints(state.structures.flatMap(s => s.polygon.map(([lat,lng]) => ({lat,lng}))), 60); log('ARC Spatial Intelligence RG Fusion v8 ready'); addSignal('info', 'System ready', 'LuciferAI service architecture v8 initialized', {confidence:0}); }
try{ init(); }catch(error){ fatal(error); }
})();
