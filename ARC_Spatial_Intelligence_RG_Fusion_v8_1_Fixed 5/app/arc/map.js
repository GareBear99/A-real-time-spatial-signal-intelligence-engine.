import { state } from './state.js';
import { bus } from './bus.js';

function makeLayerGroup(){ return L.layerGroup().addTo(state.map); }

function addBaseTiles(){
  const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains:'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    attribution: '&copy; OpenStreetMap contributors'
  });

  let fallbackTriggered = false;
  let tileErrors = 0;
  carto.on('tileerror', () => {
    tileErrors += 1;
    if(fallbackTriggered || tileErrors < 8) return;
    fallbackTriggered = true;
    if(state.map.hasLayer(carto)) state.map.removeLayer(carto);
    osm.addTo(state.map);
  });

  carto.addTo(state.map);
  state.layers.base = carto;
  state.layers.baseFallback = osm;
}

export function initMap(){
  state.map = L.map('map', { zoomControl:true, preferCanvas:true }).setView([52.13163, -122.14188], 17);
  addBaseTiles();
  state.layers.structures = makeLayerGroup();
  state.layers.selection = makeLayerGroup();
  state.layers.sensors = makeLayerGroup();
  state.layers.truth = makeLayerGroup();
  state.layers.estimate = makeLayerGroup();
  state.layers.paths = makeLayerGroup();
}

export function renderStructures(structures){
  state.layers.structures.clearLayers();
  structures.forEach(s => {
    const isSelected = s.id === state.selectedStructureId;
    const poly = L.polygon(s.polygon, {
      color: isSelected ? '#7A3CFF' : '#B18CFF',
      weight: isSelected ? 3 : 2,
      fillColor: isSelected ? '#7A3CFF' : '#7A3CFF',
      fillOpacity: isSelected ? 0.28 : 0.12
    }).addTo(state.layers.structures);
    poly.bindTooltip(`${s.address}<br>${s.name}`);
    poly.on('click', () => bus.emit('structure:choose', s.id));
  });
}

export function renderSelection(){
  state.layers.selection.clearLayers();
  if(!state.selectedStructure) return;
  const s = state.selectedStructure;
  L.polygon(s.polygon, { color:'#7A3CFF', weight:3, fillOpacity:0.06, dashArray:'5, 5' }).addTo(state.layers.selection);
  state.map.fitBounds(L.latLngBounds(s.polygon), { padding:[70,70] });
}

export function renderSensors(){
  state.layers.sensors.clearLayers();
  for(const s of state.sensors){
    L.circleMarker([s.lat, s.lng], {
      radius: s.type === 'center-anchor' ? 7 : 5,
      color: s.type === 'center-anchor' ? '#7A3CFF' : '#B18CFF',
      weight: 2,
      fillOpacity: 0.7
    }).addTo(state.layers.sensors).bindTooltip(`${s.id} (${s.type})`);
  }
}

export function renderDevice(device){
  state.layers.truth.clearLayers();
  state.layers.estimate.clearLayers();
  state.layers.paths.clearLayers();
  if(!device) return;
  if(device.truth){ L.circleMarker([device.truth.lat, device.truth.lng], { radius:6, color:'#7A3CFF', fillOpacity:0.85 }).addTo(state.layers.truth).bindTooltip('Ground Truth'); }
  if(device.estimated){ L.circleMarker([device.estimated.lat, device.estimated.lng], { radius:6, color:'#7A3CFF', fillOpacity:0.85 }).addTo(state.layers.estimate).bindTooltip('Estimated'); }
  if(device.truthPath.length > 1){ L.polyline(device.truthPath.map(p => [p.lat, p.lng]), { color:'#7A3CFF', weight:2, opacity:0.55 }).addTo(state.layers.paths); }
  if(device.estimatePath.length > 1){ L.polyline(device.estimatePath.map(p => [p.lat, p.lng]), { color:'#7A3CFF', weight:2, opacity:0.75 }).addTo(state.layers.paths); }
}
