import { bus } from './bus.js';
import { state, setBoot } from './state.js';
import { demoStructures, searchStructures } from './structures.js';
import { initMap, renderStructures, renderSelection, renderSensors, renderDevice } from './map.js';
import { initRF, drawRF } from './webgl_rf.js';
import { buildSensorsForStructure } from './sensors.js';
import { saveBlueprintState, loadBlueprintState } from './blueprint.js';
import { startSim, stopSim, simStep } from './simulator.js';
import { ensureDevice } from './entities.js';

const $ = (id) => document.getElementById(id);

function log(msg){
  const time = new Date().toLocaleTimeString();
  const item = { time, msg };
  state.debug.logs.unshift(item);
  state.debug.logs = state.debug.logs.slice(0, 120);
  const root = $('log');
  root.innerHTML = state.debug.logs.map(x => `<div class="log-item mono">${x.time} — ${x.msg}</div>`).join('');
}

function populateSelect(structures){
  const sel = $('structureSelect');
  sel.innerHTML = structures.map(s => `<option value="${s.id}">${s.address} — ${s.name}</option>`).join('');
}

function updateSelectionHud(){
  const s = state.selectedStructure;
  $('selectionStatus').textContent = s ? `Locked: ${s.address} (${s.name})` : 'No structure locked.';
  $('selectionKv').innerHTML = s ? `
    <div>Address</div><div>${s.address}</div>
    <div>Name</div><div>${s.name}</div>
    <div>Type</div><div>${s.type}</div>
    <div>Levels</div><div>${s.levels}</div>
    <div>ID</div><div class="mono">${s.id}</div>
  ` : '<div>Status</div><div>Unlocked</div>';
  const d = state.devices.phone1;
  $('estimatorKv').innerHTML = d ? `
    <div>Zone</div><div>${d.zone}</div>
    <div>Confidence</div><div>${Math.round((d.confidence||0)*100)}%</div>
    <div>Tracks</div><div>${d.estimatePath.length}</div>
    <div>Last Seen</div><div class="mono">${d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : '-'}</div>
  ` : '<div>State</div><div>Idle</div>';
  $('confidenceBar').style.width = `${Math.round((d?.confidence || 0) * 100)}%`;
}

function applyBlueprintUI(data){
  const bp = state.blueprint;
  if(data){
    bp.imageDataUrl = data.imageDataUrl || null;
    bp.opacity = Number(data.opacity ?? bp.opacity);
    bp.scale = Number(data.scale ?? bp.scale);
    bp.offsetX = Number(data.offsetX ?? bp.offsetX);
    bp.offsetY = Number(data.offsetY ?? bp.offsetY);
  }
  $('bpOpacity').value = bp.opacity;
  $('bpScale').value = bp.scale;
  $('bpOffsetX').value = bp.offsetX;
  $('bpOffsetY').value = bp.offsetY;
  renderBlueprint();
}

function renderBlueprint(){
  const s = state.selectedStructure;
  const bp = state.blueprint;
  bp.overlay?.remove();
  bp.overlay = null;
  if(!s || !bp.imageDataUrl) return;
  const lats = s.polygon.map(p => p[0]);
  const lngs = s.polygon.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latPad = (maxLat - minLat) * (bp.scale - 1) / 2;
  const lngPad = (maxLng - minLng) * (bp.scale - 1) / 2;
  const bounds = [[minLat - latPad + bp.offsetY, minLng - lngPad + bp.offsetX],[maxLat + latPad + bp.offsetY, maxLng + lngPad + bp.offsetX]];
  bp.overlay = L.imageOverlay(bp.imageDataUrl, bounds, { opacity: bp.opacity, interactive:false }).addTo(state.map);
}

function lockStructureById(id){
  const s = state.structures.find(x => x.id === id);
  if(!s) return;
  state.selectedStructureId = id;
  state.selectedStructure = s;
  state.sensors = buildSensorsForStructure(s);
  ensureDevice(state, 'phone1');
  renderStructures(state.structures);
  renderSelection();
  renderSensors();
  const stored = loadBlueprintState();
  applyBlueprintUI(stored || { imageDataUrl:null, opacity:0.45, scale:1, offsetX:0, offsetY:0 });
  updateSelectionHud();
  log(`LOCK ${s.address}`);
  refreshMapLayout();
}

function clearLock(){
  stopSim();
  state.selectedStructureId = null;
  state.selectedStructure = null;
  state.sensors = [];
  if(state.devices.phone1){
    state.devices.phone1.truth = null;
    state.devices.phone1.estimated = null;
    state.devices.phone1.truthPath = [];
    state.devices.phone1.estimatePath = [];
  }
  state.blueprint.overlay?.remove();
  state.blueprint.overlay = null;
  renderStructures(state.structures);
  renderSelection();
  renderSensors();
  renderDevice(null);
  drawRF(null,null,[]);
  updateSelectionHud();
  log('CLEAR LOCK');
  refreshMapLayout();
}

function runOneStep(){
  const d = simStep(log);
  renderDevice(d);
  updateSelectionHud();
}

function wireUI(){
  $('searchBtn').onclick = () => {
    const results = searchStructures($('searchInput').value, demoStructures);
    populateSelect(results);
    if(results[0]) log(`SEARCH ${results.length} match(es)`);
    else log('SEARCH 0 matches');
    renderStructures(results);
    state.structures = results;
    refreshMapLayout();
  };

  $('lockBtn').onclick = () => lockStructureById($('structureSelect').value);
  $('clearBtn').onclick = clearLock;
  $('startBtn').onclick = () => {
    if(!state.selectedStructure) return log('START blocked: no structure locked');
    state.sim.tickMs = Number($('tickMs').value) || 900;
    state.sim.noiseDb = Number($('noiseDb').value) || 3;
    startSim(runOneStep);
    log(`SIM START tick=${state.sim.tickMs} noise=${state.sim.noiseDb}`);
  };
  $('stopBtn').onclick = () => { stopSim(); log('SIM STOP'); };
  $('stepBtn').onclick = () => runOneStep();

  $('bpFile').onchange = async (e) => {
    const file = e.target.files?.[0];
    if(!file || !state.selectedStructure) return;
    const dataUrl = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
    state.blueprint.imageDataUrl = dataUrl;
    renderBlueprint();
    log(`BLUEPRINT LOAD ${file.name}`);
  };

  for(const id of ['bpOpacity','bpScale','bpOffsetX','bpOffsetY']){
    $(id).oninput = () => {
      state.blueprint.opacity = Number($('bpOpacity').value);
      state.blueprint.scale = Number($('bpScale').value);
      state.blueprint.offsetX = Number($('bpOffsetX').value);
      state.blueprint.offsetY = Number($('bpOffsetY').value);
      renderBlueprint();
    };
  }
  $('saveBlueprint').onclick = () => { saveBlueprintState(); log('BLUEPRINT SAVE'); };
  $('resetBlueprint').onclick = () => {
    state.blueprint.opacity = 0.45; state.blueprint.scale = 1; state.blueprint.offsetX = 0; state.blueprint.offsetY = 0;
    $('bpOpacity').value = state.blueprint.opacity; $('bpScale').value = state.blueprint.scale; $('bpOffsetX').value = 0; $('bpOffsetY').value = 0;
    renderBlueprint(); log('BLUEPRINT RESET');
  };
}

function wireBus(){
  bus.tap = (event, payload) => log(`EVENT ${event}${payload ? ` ${JSON.stringify(payload)}` : ''}`.slice(0,120));
  bus.on('structure:choose', id => {
    $('structureSelect').value = id;
    lockStructureById(id);
  });
}

function wireMapRefresh(){
  state.map.on('move zoom resize', () => {
    const d = state.devices.phone1;
    drawRF(d?.truth || null, d?.estimated || null, state.sensors);
  });
}

function refreshMapLayout(){
  if(!state.map) return;
  requestAnimationFrame(() => {
    state.map.invalidateSize(true);
    const s = state.selectedStructure;
    if(s){
      state.map.fitBounds(L.latLngBounds(s.polygon), { padding:[70,70] });
    }
    const d = state.devices.phone1;
    drawRF(d?.truth || null, d?.estimated || null, state.sensors);
  });
}

function init(){
  setBoot('LOAD_MODULES');
  state.structures = demoStructures;
  populateSelect(demoStructures);
  setBoot('INIT_MAP');
  initMap();
  initRF();
  renderStructures(state.structures);
  wireBus();
  wireUI();
  wireMapRefresh();
  window.addEventListener('resize', refreshMapLayout);
  updateSelectionHud();
  setBoot('READY');
  log('ARC v14 ready');
}

init();
