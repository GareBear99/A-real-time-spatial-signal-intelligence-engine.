(function(){
'use strict';
const $ = id => document.getElementById(id);
const state = {boot:'INIT',structures:[],selectedStructure:null,selectedStructureId:null,sensors:[],devices:{},sim:{timer:null,running:false,tickMs:900,noiseDb:3,step:0},estimator:{last:null,confidence:0,zone:'Unknown'},debug:{logs:[]},blueprint:{imageDataUrl:null,opacity:0.45,scale:1,offsetX:0,offsetY:0},map:null};
const demoStructures = [
  {id:'s1', address:'100 Pine Ave', name:'Pine House', type:'house', levels:1, polygon:[[52.13188,-122.14235],[52.13188,-122.14203],[52.13168,-122.14203],[52.13168,-122.14235]]},
  {id:'s2', address:'118 Cedar St', name:'Cedar Duplex', type:'duplex', levels:2, polygon:[[52.13156,-122.14174],[52.13156,-122.14137],[52.13132,-122.14137],[52.13132,-122.14174]]},
  {id:'s3', address:'201 Birch Rd', name:'Birch Garage', type:'garage', levels:1, polygon:[[52.13123,-122.14246],[52.13123,-122.14215],[52.13104,-122.14215],[52.13104,-122.14246]]},
  {id:'s4', address:'240 Lakeview Dr', name:'Lakeview Home', type:'house', levels:2, polygon:[[52.13207,-122.14148],[52.13207,-122.14112],[52.13179,-122.14112],[52.13179,-122.14148]]},
  {id:'s5', address:'310 Hillcrest Ln', name:'Hillcrest Bungalow', type:'house', levels:1, polygon:[[52.13154,-122.14287],[52.13154,-122.14257],[52.13130,-122.14257],[52.13130,-122.14287]]}
].map(s=>({...s,center:centroid(s.polygon)}));

function setBoot(stage){ state.boot=stage; $(`boot`).textContent=`BOOT: ${stage}`; }
function fatal(err){ const root=$('fatal'); root.style.display='block'; root.textContent='FATAL BOOT ERROR\n\n'+(err&&err.stack?err.stack:String(err)); setBoot('FATAL'); console.error(err); }
function log(msg){ const t=new Date().toLocaleTimeString(); state.debug.logs.unshift({t,msg}); state.debug.logs=state.debug.logs.slice(0,120); $('log').innerHTML=state.debug.logs.map(x=>`<div class="log-item mono">${x.t} — ${escapeHtml(x.msg)}</div>`).join(''); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function centroid(poly){ let a=0,x=0,y=0; for(let i=0;i<poly.length;i++){ const [y1,x1]=poly[i], [y2,x2]=poly[(i+1)%poly.length]; const f=x1*y2-x2*y1; a+=f; x+=(x1+x2)*f; y+=(y1+y2)*f; } if(Math.abs(a)<1e-12){ const avg=poly.reduce((r,p)=>({lat:r.lat+p[0],lng:r.lng+p[1]}),{lat:0,lng:0}); return {lat:avg.lat/poly.length,lng:avg.lng/poly.length}; } a*=0.5; return {lat:y/(6*a),lng:x/(6*a)}; }
function boundsFromPolygon(poly){ const lats=poly.map(p=>p[0]), lngs=poly.map(p=>p[1]); return {minLat:Math.min(...lats),maxLat:Math.max(...lats),minLng:Math.min(...lngs),maxLng:Math.max(...lngs)}; }
function pointInPolygon(pt, poly){ let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const xi=poly[i][1], yi=poly[i][0], xj=poly[j][1], yj=poly[j][0]; const intersect=((yi>pt.lat)!==(yj>pt.lat)) && (pt.lng < (xj-xi)*(pt.lat-yi)/((yj-yi)||1e-12)+xi); if(intersect) inside=!inside; } return inside; }
function seeded(seed){ let t = Math.floor(seed*1e6) ^ 0x9e3779b9; return function(){ t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function seededPointInPolygon(poly, seed){ const b=boundsFromPolygon(poly); const rnd=seeded(seed); for(let i=0;i<1000;i++){ const p={lat:b.minLat+(b.maxLat-b.minLat)*rnd(),lng:b.minLng+(b.maxLng-b.minLng)*rnd()}; if(pointInPolygon(p,poly)) return p; } return centroid(poly); }
function distanceMeters(a,b){ const R=6371000, toRad=Math.PI/180; const dLat=(b.lat-a.lat)*toRad, dLng=(b.lng-a.lng)*toRad; const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2), lat1=a.lat*toRad, lat2=b.lat*toRad; const s=s1*s1 + Math.cos(lat1)*Math.cos(lat2)*s2*s2; return 2*R*Math.atan2(Math.sqrt(s),Math.sqrt(1-s)); }
function clampPointToBounds(pt, poly){ const b=boundsFromPolygon(poly); return {lat:Math.max(b.minLat,Math.min(b.maxLat,pt.lat)),lng:Math.max(b.minLng,Math.min(b.maxLng,pt.lng))}; }
function inferZone(structure, point){ if(!structure||!point) return 'Unknown'; const b=boundsFromPolygon(structure.polygon); const rx=(point.lng-b.minLng)/((b.maxLng-b.minLng)||1), ry=(point.lat-b.minLat)/((b.maxLat-b.minLat)||1); if(Math.abs(rx-0.5)<0.18&&Math.abs(ry-0.5)<0.18) return 'Center-Core'; if(ry<0.33) return 'North Zone'; if(ry>0.66) return 'South Zone'; return rx<0.5?'West Zone':'East Zone'; }
function ensureDevice(id='phone1'){ if(!state.devices[id]) state.devices[id]={id,truth:null,estimated:null,truthPath:[],estimatePath:[],observations:[],zone:'Unknown',confidence:0,lastSeen:null}; return state.devices[id]; }
function rssiFromDistanceMeters(meters, noiseDb){ const d=Math.max(1,meters), pathLoss=32+20*Math.log10(d), tx=-30, noise=(Math.random()-0.5)*2*noiseDb; return tx-pathLoss+noise; }
function makeObservations(truth, sensors, noiseDb){ return sensors.map(s=>{ const meters=distanceMeters(truth,{lat:s.lat,lng:s.lng}); const rssi=rssiFromDistanceMeters(meters,noiseDb); return {sensorId:s.id,lat:s.lat,lng:s.lng,rssi,meters}; }); }
function estimateFromObservations(obs, structure){ if(!obs.length) return null; let sum=0,lat=0,lng=0; for(const o of obs){ const w=Math.max(0.0001, Math.pow(10,(o.rssi+100)/18)); sum+=w; lat+=o.lat*w; lng+=o.lng*w; } let p={lat:lat/sum,lng:lng/sum}; if(!pointInPolygon(p,structure.polygon)) p=clampPointToBounds(p,structure.polygon); const avg = obs.reduce((a,o)=>a+o.meters,0)/obs.length; const conf = Math.max(0.08, Math.min(0.98, 1 - avg/45)); return {point:p, confidence:conf}; }
function buildSensorsForStructure(s){ const c=centroid(s.polygon); const pts=[seededPointInPolygon(s.polygon,11),seededPointInPolygon(s.polygon,27),seededPointInPolygon(s.polygon,53),seededPointInPolygon(s.polygon,81),{lat:c.lat,lng:c.lng}]; return pts.map((p,i)=>({id:`${s.id}-sn${i+1}`,lat:p.lat,lng:p.lng,type:i===4?'center-anchor':'anchor'})); }
function bpKey(){ return state.selectedStructure?`arc.blueprint.${state.selectedStructure.id}`:null; }
function saveBlueprintState(){ const k=bpKey(); if(!k) return; localStorage.setItem(k,JSON.stringify({imageDataUrl:state.blueprint.imageDataUrl,opacity:state.blueprint.opacity,scale:state.blueprint.scale,offsetX:state.blueprint.offsetX,offsetY:state.blueprint.offsetY})); }
function loadBlueprintState(){ const k=bpKey(); state.blueprint.imageDataUrl=null; if(!k) return null; const raw=localStorage.getItem(k); if(!raw) return null; try{return JSON.parse(raw);}catch{return null;} }
function searchStructures(q, structures){ q=String(q||'').trim().toLowerCase(); if(!q) return structures.slice(); return structures.filter(s=>[s.address,s.name,s.type,s.id].join(' ').toLowerCase().includes(q)); }

function createMapEngine(){
  const svg=$('mapSvg'), mapEl=$('map'), tileRoot=$('tiles');
  const ns='http://www.w3.org/2000/svg';
  const groups={};
  ['bg','roads','structures','selection','sensors','paths','truth','estimate'].forEach(id=>{ const g=document.createElementNS(ns,'g'); g.setAttribute('data-layer',id); svg.appendChild(g); groups[id]=g; });
  const world=(()=>{ let pts=[]; demoStructures.forEach(s=>pts=pts.concat(s.polygon.map(p=>({lat:p[0],lng:p[1]})))); const lats=pts.map(p=>p.lat), lngs=pts.map(p=>p.lng); return {minLat:Math.min(...lats)-0.0006,maxLat:Math.max(...lats)+0.0006,minLng:Math.min(...lngs)-0.0008,maxLng:Math.max(...lngs)+0.0008}; })();
  const view={cx:(world.minLng+world.maxLng)/2, cy:(world.minLat+world.maxLat)/2, zoom:16.7};
  const listeners={move:new Set(),zoom:new Set(),resize:new Set()};
  let dragging=false,last={x:0,y:0};
  const TILE=256;
  const tileState={loaded:0,failed:0};
  function size(){ const r=mapEl.getBoundingClientRect(); return {w:Math.max(1,r.width), h:Math.max(1,r.height)}; }
  function mercator(lat,lng,z){ const scale=TILE*Math.pow(2,z); const x=(lng+180)/360*scale; const sin=Math.sin(lat*Math.PI/180); const y=(0.5 - Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale; return {x,y}; }
  function unmercator(x,y,z){ const scale=TILE*Math.pow(2,z); const lng=x/scale*360-180; const n=Math.PI - 2*Math.PI*y/scale; const lat=180/Math.PI*Math.atan(Math.sinh(n)); return {lat,lng}; }
  function project(lat,lng){ const {w,h}=size(); const zi=Math.max(0,Math.floor(view.zoom)); const frac=view.zoom-zi; const scale=Math.pow(2,frac); const c=mercator(view.cy,view.cx,zi), p=mercator(lat,lng,zi); return {x:w/2 + (p.x-c.x)*scale, y:h/2 + (p.y-c.y)*scale}; }
  function unproject(x,y){ const {w,h}=size(); const zi=Math.max(0,Math.floor(view.zoom)); const frac=view.zoom-zi; const scale=Math.pow(2,frac); const c=mercator(view.cy,view.cx,zi); return unmercator(c.x + (x-w/2)/scale, c.y + (y-h/2)/scale, zi); }
  function pathFromPoly(poly){ return poly.map((p,i)=>{ const q=project(p[0],p[1]); return `${i?'L':'M'} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`; }).join(' ')+' Z'; }
  function clear(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function emit(type){ listeners[type].forEach(fn=>{ try{ fn(); }catch(e){ console.error(e); } }); }
  function tileUrl(z,x,y){ return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`; }
  function drawTiles(){
    tileRoot.innerHTML='';
    const {w,h}=size();
    const zi=Math.max(0,Math.min(19,Math.floor(view.zoom)));
    const frac=view.zoom-zi;
    const scale=Math.pow(2,frac);
    const c=mercator(view.cy,view.cx,zi);
    const topLeft={x:c.x - w/(2*scale), y:c.y - h/(2*scale)};
    const bottomRight={x:c.x + w/(2*scale), y:c.y + h/(2*scale)};
    const minTileX=Math.floor(topLeft.x/TILE), maxTileX=Math.floor(bottomRight.x/TILE);
    const minTileY=Math.floor(topLeft.y/TILE), maxTileY=Math.floor(bottomRight.y/TILE);
    const maxIndex=Math.pow(2,zi);
    for(let tx=minTileX; tx<=maxTileX; tx++){
      for(let ty=minTileY; ty<=maxTileY; ty++){
        if(ty<0 || ty>=maxIndex) continue;
        const wrapX=((tx%maxIndex)+maxIndex)%maxIndex;
        const img=document.createElement('img');
        img.alt='';
        img.draggable=false;
        img.referrerPolicy='no-referrer';
        img.decoding='async';
        img.src=tileUrl(zi,wrapX,ty);
        img.style.left=((tx*TILE-topLeft.x)*scale).toFixed(2)+'px';
        img.style.top=((ty*TILE-topLeft.y)*scale).toFixed(2)+'px';
        img.style.width=(TILE*scale).toFixed(2)+'px';
        img.style.height=(TILE*scale).toFixed(2)+'px';
        img.onload=()=>{ tileState.loaded++; };
        img.onerror=()=>{ tileState.failed++; img.style.display='none'; };
        tileRoot.appendChild(img);
      }
    }
  }
  function drawBackground(){
    drawTiles();
    clear(groups.bg); clear(groups.roads);
    const {w,h}=size();
    for(let i=0;i<18;i++){
      const line=document.createElementNS(ns,'line');
      line.setAttribute('x1',0); line.setAttribute('x2',w);
      line.setAttribute('y1',(i/17)*h); line.setAttribute('y2',(i/17)*h);
      line.setAttribute('stroke', i===8?'rgba(103,246,255,.06)':'rgba(103,246,255,.025)');
      line.setAttribute('stroke-width',1);
      groups.bg.appendChild(line);
    }
    for(let i=0;i<22;i++){
      const line=document.createElementNS(ns,'line');
      line.setAttribute('y1',0); line.setAttribute('y2',h);
      line.setAttribute('x1',(i/21)*w); line.setAttribute('x2',(i/21)*w);
      line.setAttribute('stroke', i===10?'rgba(103,246,255,.05)':'rgba(103,246,255,.02)');
      line.setAttribute('stroke-width',1);
      groups.bg.appendChild(line);
    }
  }
  function redraw(){ svg.setAttribute('viewBox',`0 0 ${size().w} ${size().h}`); drawBackground(); renderStructuresSvg(); renderSelectionSvg(); renderSensorsSvg(); renderDeviceSvg(); placeBlueprint(); emit('move'); }
  function fitBounds(poly){
    const b=boundsFromPolygon(poly); view.cx=(b.minLng+b.maxLng)/2; view.cy=(b.minLat+b.maxLat)/2;
    const {w,h}=size();
    const dx=Math.abs(mercator(view.cy,b.maxLng,0).x - mercator(view.cy,b.minLng,0).x) || 1e-9;
    const dy=Math.abs(mercator(b.maxLat,view.cx,0).y - mercator(b.minLat,view.cx,0).y) || 1e-9;
    const zx=Math.log2((w*0.62)/dx); const zy=Math.log2((h*0.62)/dy);
    view.zoom=Math.max(14,Math.min(19,Math.min(zx,zy)));
    redraw();
  }
  mapEl.addEventListener('mousedown',e=>{ dragging=true; last={x:e.clientX,y:e.clientY}; mapEl.style.cursor='grabbing'; });
  window.addEventListener('mouseup',()=>{ dragging=false; mapEl.style.cursor='grab'; });
  window.addEventListener('mousemove',e=>{ if(!dragging) return; const rect=mapEl.getBoundingClientRect(); const a=unproject(last.x-rect.left,last.y-rect.top), b=unproject(e.clientX-rect.left,e.clientY-rect.top); view.cx += a.lng-b.lng; view.cy += a.lat-b.lat; last={x:e.clientX,y:e.clientY}; redraw(); });
  mapEl.addEventListener('wheel',e=>{ e.preventDefault(); const dir=e.deltaY<0?1.18:0.85; view.zoom=Math.max(12.5,Math.min(19.5,view.zoom + Math.log2(dir))); redraw(); emit('zoom'); },{passive:false});
  window.addEventListener('resize',()=>{ redraw(); emit('resize'); });
  mapEl.style.cursor='grab';

  function polyNode(poly, opts){ const el=document.createElementNS(ns,'path'); el.setAttribute('d',pathFromPoly(poly)); el.setAttribute('fill',opts.fill||'none'); el.setAttribute('fill-opacity',opts.fillOpacity??1); el.setAttribute('stroke',opts.stroke||'none'); el.setAttribute('stroke-width',opts.strokeWidth||1); if(opts.dash) el.setAttribute('stroke-dasharray',opts.dash); return el; }
  function renderStructuresSvg(){ clear(groups.structures); state.structures.forEach(s=>{ const sel=s.id===state.selectedStructureId; const path=polyNode(s.polygon,{fill:sel?'#67f6ff':'#2670a8',fillOpacity:sel?.22:.10,stroke:sel?'#67f6ff':'#79c1ff',strokeWidth:sel?3:2}); path.style.cursor='pointer'; path.addEventListener('click',()=>{ $('structureSelect').value=s.id; lockStructureById(s.id); }); groups.structures.appendChild(path); const c=project(s.center.lat,s.center.lng); const txt=document.createElementNS(ns,'text'); txt.setAttribute('x',c.x); txt.setAttribute('y',c.y-10); txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','12'); txt.setAttribute('fill','rgba(214,242,255,.92)'); txt.setAttribute('stroke','rgba(7,16,21,.55)'); txt.setAttribute('stroke-width','3'); txt.setAttribute('paint-order','stroke'); txt.textContent=s.address; groups.structures.appendChild(txt); }); }
  function renderSelectionSvg(){ clear(groups.selection); if(!state.selectedStructure) return; groups.selection.appendChild(polyNode(state.selectedStructure.polygon,{fill:'none',stroke:'#a6ff68',strokeWidth:3,dash:'6 6'})); }
  function renderSensorsSvg(){ clear(groups.sensors); state.sensors.forEach(s=>{ const p=project(s.lat,s.lng); const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',s.type==='center-anchor'?7:5); c.setAttribute('fill',s.type==='center-anchor'?'#a6ff68':'#ffd166'); c.setAttribute('fill-opacity','.78'); c.setAttribute('stroke',s.type==='center-anchor'?'#a6ff68':'#8c6400'); c.setAttribute('stroke-width','2'); groups.sensors.appendChild(c); }); }
  function renderDeviceSvg(){ clear(groups.truth); clear(groups.estimate); clear(groups.paths); const d=state.devices.phone1; if(!d) return; function polyline(path,color,opacity){ if(path.length<2) return; const el=document.createElementNS(ns,'path'); el.setAttribute('d',path.map((p,i)=>{ const q=project(p.lat,p.lng); return `${i?'L':'M'} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`; }).join(' ')); el.setAttribute('fill','none'); el.setAttribute('stroke',color); el.setAttribute('stroke-width','2'); el.setAttribute('stroke-opacity',opacity); groups.paths.appendChild(el); }
    polyline(d.truthPath,'#a6ff68','.55'); polyline(d.estimatePath,'#67f6ff','.82');
    if(d.truth){ const p=project(d.truth.lat,d.truth.lng); const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',6); c.setAttribute('fill','#a6ff68'); groups.truth.appendChild(c); }
    if(d.estimated){ const p=project(d.estimated.lat,d.estimated.lng); const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',6); c.setAttribute('fill','#67f6ff'); groups.estimate.appendChild(c); }
  }
  function placeBlueprint(){ const img=$('bpImage'), s=state.selectedStructure, bp=state.blueprint; if(!s||!bp.imageDataUrl){ img.style.display='none'; return; } const b=boundsFromPolygon(s.polygon); const latPad=(b.maxLat-b.minLat)*(bp.scale-1)/2, lngPad=(b.maxLng-b.minLng)*(bp.scale-1)/2; const p1=project(b.maxLat+latPad+bp.offsetY,b.minLng-lngPad+bp.offsetX), p2=project(b.minLat-latPad+bp.offsetY,b.maxLng+lngPad+bp.offsetX); img.src=bp.imageDataUrl; img.style.display='block'; img.style.left=Math.min(p1.x,p2.x)+'px'; img.style.top=Math.min(p1.y,p2.y)+'px'; img.style.width=Math.abs(p2.x-p1.x)+'px'; img.style.height=Math.abs(p2.y-p1.y)+'px'; img.style.opacity=String(bp.opacity); }

  redraw();
  return {groups,project,fitBounds,on:(t,fn)=>listeners[t]?.add(fn), invalidateSize:()=>redraw(), redraw};
}

let map;
function renderStructures(){ map.redraw(); }
function renderSelection(){ map.redraw(); }
function renderSensors(){ map.redraw(); }
function renderDevice(){ map.redraw(); drawRF(); }
function initRF(){ const canvas=$('rf'); const ctx=canvas.getContext('2d'); state.rf={canvas,ctx}; function resize(){ const r=$('mapWrap').getBoundingClientRect(); canvas.width=Math.max(1,r.width*devicePixelRatio); canvas.height=Math.max(1,r.height*devicePixelRatio); canvas.style.width=r.width+'px'; canvas.style.height=r.height+'px'; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); drawRF(); } state.rf.resize=resize; resize(); window.addEventListener('resize',resize); }
function drawRF(){ const rf=state.rf, d=state.devices.phone1; if(!rf||!map) return; const {canvas,ctx}=rf; ctx.clearRect(0,0,canvas.width,canvas.height); if(!d) return; const points=[]; if(d.truth) points.push({pt:d.truth,color:'rgba(166,255,104,0.95)'}); if(d.estimated) points.push({pt:d.estimated,color:'rgba(103,246,255,0.95)'}); points.forEach(({pt,color})=>{ const p=map.project(pt.lat,pt.lng); for(let i=1;i<=6;i++){ ctx.beginPath(); ctx.arc(p.x,p.y,i*16,0,Math.PI*2); ctx.strokeStyle=color.replace('0.95',String(0.18/i+0.03)); ctx.lineWidth=1; ctx.stroke(); } }); if(d.estimated){ const ep=map.project(d.estimated.lat,d.estimated.lng); state.sensors.forEach(s=>{ const sp=map.project(s.lat,s.lng); ctx.beginPath(); ctx.moveTo(sp.x,sp.y); ctx.lineTo(ep.x,ep.y); ctx.strokeStyle='rgba(103,246,255,0.18)'; ctx.stroke(); }); } }
function refreshMapLayout(){ if(!map) return; requestAnimationFrame(()=>{ map.invalidateSize(); if(state.selectedStructure) map.fitBounds(state.selectedStructure.polygon); drawRF(); }); }
function populateSelect(structures){ $('structureSelect').innerHTML = structures.map(s=>`<option value="${s.id}">${escapeHtml(s.address)} — ${escapeHtml(s.name)}</option>`).join(''); }
function updateSelectionHud(){ const s=state.selectedStructure; $('selectionStatus').textContent=s?`Locked: ${s.address} (${s.name})`:'No structure locked.'; $('selectionKv').innerHTML=s?`<div>Address</div><div>${escapeHtml(s.address)}</div><div>Name</div><div>${escapeHtml(s.name)}</div><div>Type</div><div>${escapeHtml(s.type)}</div><div>Levels</div><div>${s.levels}</div><div>ID</div><div class="mono">${escapeHtml(s.id)}</div>`:'<div>Status</div><div>Unlocked</div>'; const d=state.devices.phone1; $('estimatorKv').innerHTML=d?`<div>Zone</div><div>${escapeHtml(d.zone)}</div><div>Confidence</div><div>${Math.round((d.confidence||0)*100)}%</div><div>Tracks</div><div>${d.estimatePath.length}</div><div>Last Seen</div><div class="mono">${d.lastSeen?new Date(d.lastSeen).toLocaleTimeString():'-'}</div>`:'<div>State</div><div>Idle</div>'; $('confidenceBar').style.width=`${Math.round((d?.confidence||0)*100)}%`; }
function applyBlueprintUI(data){ const bp=state.blueprint; if(data){ bp.imageDataUrl=data.imageDataUrl||null; bp.opacity=Number(data.opacity??bp.opacity); bp.scale=Number(data.scale??bp.scale); bp.offsetX=Number(data.offsetX??bp.offsetX); bp.offsetY=Number(data.offsetY??bp.offsetY); } $('bpOpacity').value=bp.opacity; $('bpScale').value=bp.scale; $('bpOffsetX').value=bp.offsetX; $('bpOffsetY').value=bp.offsetY; map.redraw(); }
function lockStructureById(id){ const s=state.structures.find(x=>x.id===id); if(!s) return; state.selectedStructureId=id; state.selectedStructure=s; state.sensors=buildSensorsForStructure(s); ensureDevice('phone1'); const stored=loadBlueprintState(); applyBlueprintUI(stored||{imageDataUrl:null,opacity:.45,scale:1,offsetX:0,offsetY:0}); updateSelectionHud(); log(`LOCK ${s.address}`); refreshMapLayout(); }
function clearLock(){ stopSim(); state.selectedStructureId=null; state.selectedStructure=null; state.sensors=[]; if(state.devices.phone1){ Object.assign(state.devices.phone1,{truth:null,estimated:null,truthPath:[],estimatePath:[],observations:[],zone:'Unknown',confidence:0,lastSeen:null}); } state.blueprint.imageDataUrl=null; $('bpImage').style.display='none'; renderDevice(); updateSelectionHud(); log('CLEAR LOCK'); refreshMapLayout(); }
function simStep(){ const structure=state.selectedStructure; if(!structure||!state.sensors.length) return; state.sim.step+=1; const d=ensureDevice('phone1'); const truth=seededPointInPolygon(structure.polygon,120+state.sim.step*1.1337); const obs=makeObservations(truth,state.sensors,state.sim.noiseDb); const est=estimateFromObservations(obs,structure); d.truth=truth; d.estimated=est?est.point:null; d.truthPath.push(truth); d.estimatePath.push(est?est.point:truth); d.truthPath=d.truthPath.slice(-32); d.estimatePath=d.estimatePath.slice(-32); d.observations=obs; d.confidence=est?est.confidence:0; d.zone=inferZone(structure,est?est.point:truth); d.lastSeen=new Date().toISOString(); state.estimator.last=d.estimated; state.estimator.confidence=d.confidence; state.estimator.zone=d.zone; renderDevice(); updateSelectionHud(); log(`STEP ${state.sim.step}: zone=${d.zone} conf=${Math.round(d.confidence*100)}%`); }
function startSim(){ if(state.sim.running) return; state.sim.running=true; state.sim.timer=setInterval(simStep,state.sim.tickMs); }
function stopSim(){ state.sim.running=false; clearInterval(state.sim.timer); state.sim.timer=null; }
function wireUI(){ $('searchBtn').onclick=()=>{ const results=searchStructures($('searchInput').value,demoStructures); state.structures=results; populateSelect(results); log(results[0]?`SEARCH ${results.length} match(es)`:'SEARCH 0 matches'); refreshMapLayout(); };
  $('lockBtn').onclick=()=>lockStructureById($('structureSelect').value); $('clearBtn').onclick=clearLock; $('startBtn').onclick=()=>{ if(!state.selectedStructure) return log('START blocked: no structure locked'); state.sim.tickMs=Number($('tickMs').value)||900; state.sim.noiseDb=Number($('noiseDb').value)||3; stopSim(); startSim(); log(`SIM START tick=${state.sim.tickMs} noise=${state.sim.noiseDb}`); };
  $('stopBtn').onclick=()=>{ stopSim(); log('SIM STOP'); }; $('stepBtn').onclick=simStep;
  $('bpFile').onchange=async e=>{ const file=e.target.files&&e.target.files[0]; if(!file||!state.selectedStructure) return; const dataUrl=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); state.blueprint.imageDataUrl=dataUrl; map.redraw(); log(`BLUEPRINT LOAD ${file.name}`); };
  ['bpOpacity','bpScale','bpOffsetX','bpOffsetY'].forEach(id=>$(id).oninput=()=>{ state.blueprint.opacity=Number($('bpOpacity').value); state.blueprint.scale=Number($('bpScale').value); state.blueprint.offsetX=Number($('bpOffsetX').value); state.blueprint.offsetY=Number($('bpOffsetY').value); map.redraw(); });
  $('saveBlueprint').onclick=()=>{ saveBlueprintState(); log('BLUEPRINT SAVE'); }; $('resetBlueprint').onclick=()=>{ Object.assign(state.blueprint,{opacity:.45,scale:1,offsetX:0,offsetY:0}); $('bpOpacity').value=.45; $('bpScale').value=1; $('bpOffsetX').value=0; $('bpOffsetY').value=0; map.redraw(); log('BLUEPRINT RESET'); };
}
function init(){ setBoot('LOAD_DATA'); state.structures=demoStructures.slice(); populateSelect(state.structures); setBoot('INIT_MAP'); map=state.map=createMapEngine(); initRF(); map.on('move',drawRF); map.on('zoom',drawRF); map.on('resize',()=>{ map.redraw(); drawRF(); }); setBoot('WIRE_UI'); wireUI(); updateSelectionHud(); map.redraw(); setBoot('READY'); log('ARC v16 ready'); }
try{ init(); }catch(err){ fatal(err); }
})();
