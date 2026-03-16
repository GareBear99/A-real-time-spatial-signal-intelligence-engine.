(function(){
'use strict';
const STORAGE = {
  addresses: 'arc.local.addresses',
  addressPrefs: 'arc.local.addressPrefs'
};
const $ = (id) => document.getElementById(id);
const load = (k,f) => { try{ const raw=localStorage.getItem(k); return raw?JSON.parse(raw):f; }catch{ return f; } };
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const state = {
  addresses: load(STORAGE.addresses, []),
  prefs: Object.assign({showOverlay:true, showLabels:true, autoParcel:true}, load(STORAGE.addressPrefs, {})),
  activeAddressId: null,
  overlaySvg: null,
  listEl: null,
  statusEl: null,
  metricsEl: null,
  nearestEl: null,
  interval: null
};

function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function canonicalizeAddress(raw){
  return String(raw||'')
    .trim()
    .toUpperCase()
    .replace(/\bSTREET\b/g,'ST').replace(/\bAVENUE\b/g,'AVE').replace(/\bROAD\b/g,'RD')
    .replace(/\bDRIVE\b/g,'DR').replace(/\bLANE\b/g,'LN').replace(/\bCOURT\b/g,'CT')
    .replace(/\bAPARTMENT\b/g,'APT').replace(/\bUNIT\b/g,'UNIT')
    .replace(/\s+/g,' ');
}
function quadkey(x,y,z){ let q=''; for(let i=z;i>0;i--){ let d=0; const mask=1<<(i-1); if((x & mask)!==0) d++; if((y & mask)!==0) d+=2; q+=d; } return q; }
function latLngToTile(lat,lng,z){
  const n = Math.pow(2,z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = lat * Math.PI/180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return {z,x:Math.max(0,Math.min(n-1,x)),y:Math.max(0,Math.min(n-1,y))};
}
function tileCenter(x,y,z){
  const n = Math.pow(2,z);
  const lng = (x + 0.5) / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)));
  return {lat: latRad * 180/Math.PI, lng};
}
function buildTileStack(lat,lng){
  return [6,10,12,14,16,18].map(z => {
    const t = latLngToTile(lat,lng,z); const c = tileCenter(t.x,t.y,t.z);
    return {...t, quadkey:quadkey(t.x,t.y,t.z), center:c};
  });
}
function download(filename, data, type='application/json'){
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function getArc(){ return window.__ARC; }
function activeFix(){
  const arc = getArc();
  const dev = arc?.state?.devices?.phone1;
  return dev?.estimated || dev?.truth || null;
}
function nearestAddress(point){
  const arc = getArc();
  if(!point || !arc || !state.addresses.length) return null;
  return state.addresses.map(a => ({a, d: arc.distanceMeters(point, a)})).sort((a,b)=>a.d-b.d)[0] || null;
}
function metrics(){
  const byZ10 = new Map(), byZ14 = new Map();
  state.addresses.forEach(a => {
    const t10 = a.tiles.find(t=>t.z===10); const t14 = a.tiles.find(t=>t.z===14);
    if(t10) byZ10.set(`${t10.z}/${t10.x}/${t10.y}`, (byZ10.get(`${t10.z}/${t10.x}/${t10.y}`)||0)+1);
    if(t14) byZ14.set(`${t14.z}/${t14.x}/${t14.y}`, (byZ14.get(`${t14.z}/${t14.x}/${t14.y}`)||0)+1);
  });
  return {addresses: state.addresses.length, z10: byZ10.size, z14: byZ14.size};
}
function ensureUi(){
  const settings = $('view-settings');
  if(!settings || $('addressInputLine')) return;
  settings.insertAdjacentHTML('beforeend', `
  <div class="card"><div class="hd"><h3>Address Input + Tiling</h3></div><div class="bd stack">
    <div><label>Address / Place</label><input id="addressInputLine" placeholder="123 Main St, Williams Lake, BC"></div>
    <div class="grid2"><div><label>Label</label><input id="addressLabelLine" placeholder="Home / Shop / Anchor"></div><div><label>Canonical Preview</label><input id="addressCanonicalPreview" readonly></div></div>
    <div class="grid2"><div><label>Latitude</label><input id="addressLat" type="number" step="0.000001" placeholder="52.131700"></div><div><label>Longitude</label><input id="addressLng" type="number" step="0.000001" placeholder="-122.142100"></div></div>
    <div class="grid3"><button id="useActiveFixBtn" class="primary">Use Active Device Fix</button><button id="saveAddressAnchorBtn" class="good">Save Address Anchor</button><button id="clearAddressFormBtn">Clear</button></div>
    <div class="grid3"><button id="exportAddressesBtn">Export JSON</button><button id="exportAddressesCsvBtn">Export CSV</button><button id="importAddressesBtn">Import JSON/CSV</button></div>
    <input id="addressImportFile" type="file" accept=".json,.csv" class="hidden">
    <div id="addressStatus" class="small">Local-only address tiling ready.</div>
    <div id="addressMetrics" class="small"></div>
    <div id="nearestAddressHint" class="small"></div>
  </div></div>
  <div class="card"><div class="hd"><h3>Address Vault + Search</h3></div><div class="bd stack">
    <div class="grid2"><input id="addressSearchInput" placeholder="Search addresses / labels"><button id="addressSearchBtn">Search</button></div>
    <div id="addressesList"></div>
  </div></div>
  <div class="card"><div class="hd"><h3>Tile Occupancy + Parcel Overlay</h3></div><div class="bd stack">
    <div class="grid3"><button id="toggleAddressOverlayBtn">Toggle Overlay</button><button id="toggleAddressLabelsBtn">Toggle Labels</button><button id="refreshAddressOverlayBtn">Refresh</button></div>
    <div class="small">Low zoom: occupancy tiles. Mid zoom: block cells. High zoom: parcel anchors and labels.</div>
  </div></div>`);
  state.listEl = $('addressesList'); state.statusEl = $('addressStatus'); state.metricsEl = $('addressMetrics'); state.nearestEl = $('nearestAddressHint');
  wireUi(); renderVault(); renderMetrics();
}
function wireUi(){
  $('addressInputLine').addEventListener('input', ()=>{ $('addressCanonicalPreview').value = canonicalizeAddress($('addressInputLine').value); });
  $('useActiveFixBtn').onclick = () => {
    const pt = activeFix(); if(!pt){ setStatus('No active device fix available.'); return; }
    $('addressLat').value = Number(pt.lat).toFixed(6); $('addressLng').value = Number(pt.lng).toFixed(6); setStatus('Loaded active device fix.');
  };
  $('saveAddressAnchorBtn').onclick = saveAnchor;
  $('clearAddressFormBtn').onclick = () => { ['addressInputLine','addressLabelLine','addressLat','addressLng','addressCanonicalPreview'].forEach(id => $(id).value=''); setStatus('Cleared address form.'); };
  $('exportAddressesBtn').onclick = () => download(`arc-address-vault-${Date.now()}.json`, {addresses:state.addresses});
  $('exportAddressesCsvBtn').onclick = () => {
    const rows = ['id,label,address,canonical,lat,lng,createdAt'];
    state.addresses.forEach(a => rows.push([a.id,a.label,a.address,a.canonical,a.lat,a.lng,a.createdAt].map(csv).join(',')));
    download(`arc-address-vault-${Date.now()}.csv`, rows.join('\n'), 'text/csv');
  };
  $('importAddressesBtn').onclick = () => $('addressImportFile').click();
  $('addressImportFile').onchange = importFile;
  $('addressSearchBtn').onclick = renderVault;
  $('toggleAddressOverlayBtn').onclick = () => { state.prefs.showOverlay = !state.prefs.showOverlay; save(STORAGE.addressPrefs, state.prefs); renderOverlay(true); setStatus(`Overlay ${state.prefs.showOverlay?'enabled':'disabled'}.`); };
  $('toggleAddressLabelsBtn').onclick = () => { state.prefs.showLabels = !state.prefs.showLabels; save(STORAGE.addressPrefs, state.prefs); renderOverlay(true); setStatus(`Labels ${state.prefs.showLabels?'enabled':'disabled'}.`); };
  $('refreshAddressOverlayBtn').onclick = () => renderOverlay(true);
  state.listEl.onclick = (e) => {
    const id = e.target.getAttribute('data-open-address') || e.target.getAttribute('data-delete-address') || e.target.getAttribute('data-export-address');
    if(!id) return;
    if(e.target.hasAttribute('data-open-address')) openAddress(id);
    if(e.target.hasAttribute('data-delete-address')) deleteAddress(id);
    if(e.target.hasAttribute('data-export-address')) exportAddress(id);
  };
}
function csv(v){ return `"${String(v??'').replace(/"/g,'""')}"`; }
function saveAnchor(){
  const address = $('addressInputLine').value.trim();
  const label = $('addressLabelLine').value.trim() || 'Address Anchor';
  const lat = Number($('addressLat').value); const lng = Number($('addressLng').value);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)){ setStatus('Latitude and longitude are required.'); return; }
  const canonical = canonicalizeAddress(address || label);
  const anchor = { id:'addr'+Date.now()+Math.random().toString(36).slice(2,6), label, address, canonical, lat, lng, tiles:buildTileStack(lat,lng), createdAt:new Date().toISOString() };
  const existing = state.addresses.findIndex(a => a.canonical && a.canonical === canonical && Math.abs(a.lat-lat)<0.00001 && Math.abs(a.lng-lng)<0.00001);
  if(existing >= 0) state.addresses[existing] = {...state.addresses[existing], ...anchor, id: state.addresses[existing].id}; else state.addresses.unshift(anchor);
  save(STORAGE.addresses, state.addresses);
  state.activeAddressId = anchor.id;
  renderVault(); renderMetrics(); renderOverlay(true); updateNearestHint();
  setStatus(`Saved ${label} · ${canonical || 'manual anchor'} · ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
}
function importFile(e){
  const file = e.target.files?.[0]; if(!file) return;
  file.text().then(text => {
    let rows = [];
    if(/\.csv$/i.test(file.name)){
      const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const start = /address|lat/i.test(lines[0]) ? 1 : 0;
      rows = lines.slice(start).map(line => { const parts = line.split(','); return {label:(parts[0]||'').replace(/^"|"$/g,''), address:(parts[1]||'').replace(/^"|"$/g,''), canonical:canonicalizeAddress(parts[1]||parts[0]||''), lat:Number(parts[4]||parts[2]), lng:Number(parts[5]||parts[3])}; }).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));
    } else {
      const parsed = JSON.parse(text); rows = Array.isArray(parsed) ? parsed : (parsed.addresses || []);
    }
    rows.forEach(r => {
      const item = { id:r.id || ('addr'+Date.now()+Math.random().toString(36).slice(2,6)), label:r.label || 'Imported Address', address:r.address || '', canonical:r.canonical || canonicalizeAddress(r.address || r.label || ''), lat:Number(r.lat), lng:Number(r.lng), tiles:r.tiles || buildTileStack(Number(r.lat), Number(r.lng)), createdAt:r.createdAt || new Date().toISOString() };
      if(Number.isFinite(item.lat) && Number.isFinite(item.lng)) state.addresses.push(item);
    });
    const uniq = new Map(); state.addresses.forEach(a => uniq.set(a.id, a)); state.addresses = Array.from(uniq.values()).sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));
    save(STORAGE.addresses, state.addresses); renderVault(); renderMetrics(); renderOverlay(true); updateNearestHint(); setStatus(`Imported ${rows.length} address anchor(s).`);
  }).catch(() => setStatus('Import failed.'));
}
function openAddress(id){
  const arc = getArc(); const a = state.addresses.find(x => x.id === id); if(!a || !arc) return;
  state.activeAddressId = id; arc.setCenterZoom({lat:a.lat,lng:a.lng}, Math.max(17.2, arc.state.map.zoom || 17.2)); renderOverlay(true); setStatus(`Opened ${a.label}.`);
}
function deleteAddress(id){ state.addresses = state.addresses.filter(a => a.id !== id); save(STORAGE.addresses, state.addresses); renderVault(); renderMetrics(); renderOverlay(true); updateNearestHint(); setStatus('Address anchor removed.'); }
function exportAddress(id){ const a = state.addresses.find(x => x.id === id); if(a) download(`${(a.label||'address').replace(/\s+/g,'_')}.json`, a); }
function renderVault(){
  if(!state.listEl) return;
  const q = String($('addressSearchInput')?.value || '').trim().toLowerCase();
  const list = !q ? state.addresses : state.addresses.filter(a => [a.label,a.address,a.canonical].join(' ').toLowerCase().includes(q));
  state.listEl.innerHTML = list.length ? list.map(a => `
    <div class="feed-item">
      <div class="t">${esc(a.label)}</div>
      <div class="m">${esc(a.address || a.canonical || 'Manual anchor')}</div>
      <div class="meta">${esc(a.lat.toFixed(6))}, ${esc(a.lng.toFixed(6))} · ${esc((a.tiles.find(t=>t.z===14)?.quadkey)||'')}</div>
      <div class="row" style="margin-top:8px"><button data-open-address="${esc(a.id)}" class="primary">Open</button><button data-export-address="${esc(a.id)}">Export</button><button data-delete-address="${esc(a.id)}" class="bad">Delete</button></div>
    </div>`).join('') : '<div class="small">No address anchors yet.</div>';
}
function renderMetrics(){ const m = metrics(); if(state.metricsEl) state.metricsEl.textContent = `${m.addresses} anchors · ${m.z10} regional tiles · ${m.z14} block tiles`; }
function updateNearestHint(){
  const pt = activeFix(); const nearest = nearestAddress(pt);
  if(!state.nearestEl) return;
  state.nearestEl.textContent = nearest ? `Nearest saved address to active device: ${nearest.a.label} · ${Math.round(nearest.d)}m` : 'Nearest saved address hint: unavailable.';
}
function setStatus(text){ if(state.statusEl) state.statusEl.textContent = text; }
function project(point){ return getArc()?.project?.(point); }
function occupancyBuckets(z){
  const map = new Map();
  state.addresses.forEach(a => {
    const t = a.tiles.find(t=>t.z===z) || latLngToTile(a.lat,a.lng,z);
    const k = `${t.z}/${t.x}/${t.y}`;
    const cur = map.get(k) || {tile:t, count:0, items:[]};
    cur.count += 1; cur.items.push(a); map.set(k, cur);
  });
  return Array.from(map.values());
}
function tilePolygon(tile){
  const n = Math.pow(2, tile.z);
  const lng1 = tile.x / n * 360 - 180;
  const lng2 = (tile.x + 1) / n * 360 - 180;
  const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / n))) * 180/Math.PI;
  const lat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + 1) / n))) * 180/Math.PI;
  return [{lat:lat1,lng:lng1},{lat:lat1,lng:lng2},{lat:lat2,lng:lng2},{lat:lat2,lng:lng1}];
}
function drawRect(points, fill, stroke, extra=''){
  return `<polygon points="${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
}
function renderOverlay(force){
  const arc = getArc(); if(!arc || !arc.state?.map?.svg) return;
  const parent = arc.state.map.root; if(!parent) return;
  if(!state.overlaySvg){
    state.overlaySvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    state.overlaySvg.setAttribute('id','addressOverlaySvg');
    Object.assign(state.overlaySvg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});
    parent.appendChild(state.overlaySvg);
  }
  state.overlaySvg.setAttribute('viewBox', `0 0 ${arc.state.map.width} ${arc.state.map.height}`);
  if(!state.prefs.showOverlay){ state.overlaySvg.innerHTML=''; return; }
  const z = arc.state.map.zoom || 0; const bits = [];
  if(z < 12.2){
    occupancyBuckets(10).forEach(b => {
      const pts = tilePolygon(b.tile).map(project).filter(Boolean); if(pts.length !== 4) return;
      const alpha = Math.min(0.42, 0.10 + b.count * 0.06);
      bits.push(drawRect(pts, `rgba(122,60,255,${alpha.toFixed(3)})`, 'rgba(177,140,255,0.38)', 'stroke-width="1.2"'));
      if(state.prefs.showLabels){ const c = project(tileCenter(b.tile.x,b.tile.y,b.tile.z)); bits.push(`<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" fill="var(--fg)" font-size="11" text-anchor="middle" fill-opacity="0.86">${b.count}</text>`); }
    });
  } else if(z < 16.3){
    occupancyBuckets(14).forEach(b => {
      const pts = tilePolygon(b.tile).map(project).filter(Boolean); if(pts.length !== 4) return;
      const active = b.items.some(a => a.id === state.activeAddressId);
      bits.push(drawRect(pts, active ? 'rgba(122,60,255,0.18)' : 'rgba(122,60,255,0.08)', active ? 'rgba(255,214,102,0.62)' : 'rgba(177,140,255,0.30)', `stroke-width="${active?1.8:1.1}"`));
      if(state.prefs.showLabels && b.count > 1){ const c = project(tileCenter(b.tile.x,b.tile.y,b.tile.z)); bits.push(`<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" fill="var(--fg)" font-size="10.5" text-anchor="middle" fill-opacity="0.80">${b.count} addr</text>`); }
    });
  } else {
    state.addresses.forEach(a => {
      const p = project(a); if(!p) return;
      const s = a.id === state.activeAddressId ? 16 : 11;
      bits.push(`<rect x="${(p.x-s/2).toFixed(2)}" y="${(p.y-s/2).toFixed(2)}" width="${s}" height="${s}" rx="3" fill="${a.id === state.activeAddressId ? 'rgba(255,214,102,0.24)' : 'rgba(122,60,255,0.14)'}" stroke="${a.id === state.activeAddressId ? 'rgba(255,214,102,0.95)' : 'rgba(177,140,255,0.58)'}" stroke-width="1.5" />`);
      bits.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${a.id === state.activeAddressId ? 5.5 : 4.2}" fill="rgba(122,60,255,0.92)" stroke="rgba(255,255,255,0.95)" stroke-width="1.6" />`);
      if(state.prefs.showLabels){ bits.push(`<text x="${(p.x+10).toFixed(1)}" y="${(p.y-10).toFixed(1)}" fill="var(--fg)" font-size="10.8" fill-opacity="0.92">${esc(a.label)}</text>`); }
    });
  }
  const fix = activeFix(); const near = nearestAddress(fix);
  if(fix && near && z >= 16){
    const fp = project(fix); const ap = project(near.a);
    bits.push(`<line x1="${fp.x.toFixed(2)}" y1="${fp.y.toFixed(2)}" x2="${ap.x.toFixed(2)}" y2="${ap.y.toFixed(2)}" stroke="rgba(255,214,102,0.55)" stroke-dasharray="6 4" stroke-width="1.5" />`);
  }
  state.overlaySvg.innerHTML = bits.join('');
}
function install(){
  ensureUi();
  updateNearestHint();
  renderOverlay(true);
  clearInterval(state.interval);
  state.interval = setInterval(()=>{ if(window.__ARC){ renderOverlay(false); updateNearestHint(); } }, 600);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
