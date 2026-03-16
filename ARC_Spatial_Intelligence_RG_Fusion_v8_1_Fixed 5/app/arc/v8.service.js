(function(){
  const $ = id => document.getElementById(id);
  const LS = {
    workspace: 'arc.rg.v8.workspace',
    auth: 'arc.rg.v8.auth',
    events: 'arc.rg.v8.events',
    benchmarks: 'arc.rg.v8.benchmarks'
  };
  const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('arc-rg-v8-collab') : null;
  const roles = {
    Lead: ['calibrate','incident','evidence','reset','exports','ingest'],
    Analyst: ['calibrate','incident','exports','ingest'],
    Field: ['incident','ingest'],
    Observer: []
  };
  function load(k, fallback){ try{ return JSON.parse(localStorage.getItem(k)) ?? fallback; }catch(_){ return fallback; } }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  const workspace = Object.assign({
    id: 'lucifer-williams-lake',
    name: 'LuciferAI Spatial Ops',
    environment: 'local-lab',
    apiBase: '/api/v1',
    rbacMode: 'strict',
    datastore: 'sqlite->postgres upgrade path',
    presence: [],
    events: []
  }, load(LS.workspace, {}));
  const auth = Object.assign({ name:'', role:'Lead', status:'anonymous' }, load(LS.auth, {}));
  const benchmarks = load(LS.benchmarks, []);
  function saveWorkspace(){ save(LS.workspace, workspace); }
  function saveAuth(){ save(LS.auth, auth); }
  function emitEvent(kind, message, meta){
    const evt = { id:'evt-'+Date.now()+'-'+Math.random().toString(36).slice(2,7), ts:new Date().toISOString(), kind, message, meta: meta||{} };
    workspace.events.unshift(evt); workspace.events = workspace.events.slice(0,40); saveWorkspace(); renderEvents();
    if(channel) channel.postMessage({type:'evt', evt});
  }
  function allowed(cap){ return (roles[auth.role]||[]).includes(cap); }
  function gateButton(id, cap, title){ const el=$(id); if(!el) return; const on = allowed(cap); el.disabled = !on; el.title = on ? '' : `${title||'Restricted'} — ${auth.role} cannot perform this action`; }
  function applyRBAC(){
    gateButton('autoCalibrateBtn','calibrate','Calibration restricted');
    gateButton('createIncidentBtn','incident','Incident creation restricted');
    gateButton('raiseSignalIncidentBtn','incident','Incident escalation restricted');
    gateButton('exportEvidenceBtn','evidence','Evidence export restricted');
    gateButton('resetDemoBtn','reset','Demo reset restricted');
    gateButton('exportManifestBtn','exports','Manifest export restricted');
    gateButton('exportAccuracyBtn','exports','Accuracy export restricted');
    gateButton('applyIngestBtn','ingest','Ingestion restricted');
    gateButton('startIngestBtn','ingest','Live ingest restricted');
  }
  function presenceHeartbeat(){
    if(auth.status!=='authenticated' || !auth.name) return;
    const now = Date.now();
    workspace.presence = workspace.presence.filter(p => now - p.t < 30000);
    const existing = workspace.presence.find(p => p.name===auth.name);
    if(existing){ existing.t = now; existing.role = auth.role; }
    else workspace.presence.push({name:auth.name, role:auth.role, t:now});
    saveWorkspace(); renderPresence();
    if(channel) channel.postMessage({type:'presence', presence: workspace.presence});
  }
  function renderPresence(){
    const el = $('v8Presence'); if(!el) return;
    const now = Date.now();
    el.innerHTML = workspace.presence.filter(p => now-p.t < 30000).map(p => `<span class="pill">${escapeHtml(p.name)} · ${escapeHtml(p.role)}</span>`).join('') || '<div class="small">No active operators in shared local workspace.</div>';
  }
  function renderEvents(){
    const el=$('v8Events'); if(!el) return;
    el.innerHTML = workspace.events.map(evt => `<div class="feed-item"><div class="t">${escapeHtml(evt.kind)}</div><div class="m">${escapeHtml(evt.message)}</div><div class="meta">${escapeHtml(new Date(evt.ts).toLocaleString())}</div></div>`).join('') || '<div class="small">No collaboration events yet.</div>';
  }
  function renderBenchmarks(){
    const el=$('v8Benchmarks'); if(!el) return;
    el.innerHTML = benchmarks.slice(0,6).map(b => `<div class="feed-item"><div class="t">${escapeHtml(b.name)}</div><div class="m">mean step ${b.meanStepMs.toFixed(2)} ms · export ${b.exportMs.toFixed(2)} ms · score ${b.score}/100</div><div class="meta">${escapeHtml(new Date(b.ts).toLocaleString())}</div></div>`).join('') || '<div class="small">No benchmark runs yet.</div>';
  }
  function renderAuth(){
    if($('v8AuthName')) $('v8AuthName').value = auth.name || '';
    if($('v8AuthRole')) $('v8AuthRole').value = auth.role || 'Lead';
    if($('v8AuthStatus')) $('v8AuthStatus').innerHTML = `<div class="kv2"><div>Status</div><div>${escapeHtml(auth.status)}</div><div>Operator</div><div>${escapeHtml(auth.name || 'None')}</div><div>Role</div><div>${escapeHtml(auth.role)}</div><div>RBAC Mode</div><div>${escapeHtml(workspace.rbacMode)}</div></div>`;
    applyRBAC();
  }
  function escapeHtml(v){ return String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function openApiSpec(){ return {
    openapi:'3.1.0',
    info:{title:'LuciferAI Spatial Intelligence Engine API', version:'v8-local-service', description:'Local-first service architecture scaffold for future production backend.'},
    servers:[{url:workspace.apiBase}],
    paths:{
      '/health':{get:{summary:'Health probe',responses:{'200':{description:'OK'}}}},
      '/ingest/track':{post:{summary:'Ingest GPS/RF track payload',responses:{'202':{description:'Accepted'}}}},
      '/sessions':{get:{summary:'List sessions'},post:{summary:'Create session'}} ,
      '/incidents':{get:{summary:'List incidents'},post:{summary:'Create incident'}},
      '/operators':{get:{summary:'List operators'}},
      '/evidence/export':{post:{summary:'Build evidence pack'}},
      '/benchmarks/run':{post:{summary:'Run deterministic local benchmark harness'}}
    },
    components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer'}}}
  }; }
  function sqlSchema(){ return `-- LuciferAI Spatial Intelligence Engine v8 local service schema\ncreate table workspaces (id text primary key, name text not null, environment text, api_base text, rbac_mode text, created_at text default current_timestamp);\ncreate table operators (id text primary key, workspace_id text not null, name text not null, role text not null, status text default 'active', last_seen text);\ncreate table sessions (id text primary key, workspace_id text not null, name text not null, structure_id text, calibration_profile text, created_at text, payload_json text not null);\ncreate table incidents (id text primary key, workspace_id text not null, title text not null, severity text not null, status text not null, source_signal_id text, created_at text, payload_json text);\ncreate table signals (id text primary key, workspace_id text not null, kind text not null, confidence real, floor integer, ts text, payload_json text);\ncreate table benchmark_runs (id text primary key, workspace_id text not null, ts text not null, score integer, payload_json text not null);\ncreate index idx_sessions_workspace on sessions(workspace_id, created_at);\ncreate index idx_incidents_workspace on incidents(workspace_id, created_at);\ncreate index idx_signals_workspace on signals(workspace_id, ts);`; }
  function serviceManifest(){ return {
    name:'LuciferAI Spatial Intelligence Engine',
    version:'RG Fusion v8',
    workspace,
    auth,
    architecture:{frontend:'browser SPA', sync:'BroadcastChannel + localStorage mirror', ingest:'local adapters -> future API', datastore:'local JSON now / sql schema scaffolded', auth:'local pseudo-auth now / JWT RBAC later', deployment:['static web app','future edge api','future postgres + object storage']},
    production_gap:['real auth provider','server-side incident bus','persistent DB','websocket ingest','signed evidence packs','multi-tenant RBAC enforcement']
  }; }
  function download(name, text, type){ const blob = new Blob([text], {type:type||'text/plain'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function runBenchmark(){
    const stepBtn = $('stepBtn');
    const exportBtn = $('exportManifestBtn');
    const samples=[]; const loops=20;
    for(let i=0;i<loops;i++){
      const t0=performance.now(); if(stepBtn) stepBtn.click(); const t1=performance.now(); samples.push(t1-t0);
    }
    const e0=performance.now(); const payload = JSON.stringify(serviceManifest()); const e1=performance.now();
    const mean=samples.reduce((a,b)=>a+b,0)/samples.length; const p95=samples.slice().sort((a,b)=>a-b)[Math.floor(samples.length*0.95)-1]||mean;
    const score = Math.max(1, Math.round(100 - Math.min(70, mean*10 + p95*4)));
    const run = { id:'bench-'+Date.now(), ts:new Date().toISOString(), name:'Local UI/Service Harness', loops, meanStepMs:mean, p95StepMs:p95, exportMs:(e1-e0), payloadBytes:payload.length, score };
    benchmarks.unshift(run); while(benchmarks.length>12) benchmarks.pop(); save(LS.benchmarks, benchmarks); renderBenchmarks(); emitEvent('benchmark', `Benchmark completed with score ${score}/100`, run); if($('v8BenchStatus')) $('v8BenchStatus').textContent = `Latest mean step ${mean.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms · export ${(e1-e0).toFixed(2)} ms · score ${score}/100.`;
  }
  function installPanels(){
    const settings = $('view-settings'); if(!settings) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="card"><div class="hd"><h3>Workspace Auth + RBAC</h3><span class="v8-badge">v8</span></div><div class="bd stack">
        <div class="grid3"><input id="v8AuthName" placeholder="Operator identity"><select id="v8AuthRole"><option>Lead</option><option>Analyst</option><option>Field</option><option>Observer</option></select><button id="v8LoginBtn" class="primary">Authenticate</button></div>
        <div class="grid2"><button id="v8LogoutBtn">Logout</button><button id="v8SyncBtn" class="good">Broadcast Presence</button></div>
        <div id="v8AuthStatus"></div>
        <div><label>Active Workspace Presence</label><div class="presence" id="v8Presence"></div></div>
      </div></div>
      <div class="card"><div class="hd"><h3>Service Architecture Export</h3><span class="v8-badge">OpenAPI + SQL</span></div><div class="bd stack">
        <div class="grid2"><div><label>Workspace Name</label><input id="v8WorkspaceName" value="${escapeHtml(workspace.name)}"></div><div><label>API Base</label><input id="v8ApiBase" value="${escapeHtml(workspace.apiBase)}"></div></div>
        <div class="grid2"><div><label>Environment</label><input id="v8Environment" value="${escapeHtml(workspace.environment)}"></div><div><label>RBAC Mode</label><select id="v8RbacMode"><option value="strict">strict</option><option value="advisory">advisory</option></select></div></div>
        <div class="grid3"><button id="v8ExportOpenApiBtn" class="primary">Export OpenAPI</button><button id="v8ExportSqlBtn">Export SQL Schema</button><button id="v8ExportServiceManifestBtn" class="good">Export Service Manifest</button></div>
        <div class="codebox" id="v8ServicePreview"></div>
      </div></div>
      <div class="card"><div class="hd"><h3>Shared Workspace Events</h3><span class="v8-badge">cross-tab</span></div><div class="bd stack"><div class="feed" id="v8Events"></div></div></div>
      <div class="card"><div class="hd"><h3>Benchmark Harness</h3><span class="v8-badge">local deterministic-ish</span></div><div class="bd stack">
        <div class="grid2"><button id="v8RunBenchBtn" class="good">Run Harness</button><button id="v8ExportBenchBtn">Export Benchmarks</button></div>
        <div id="v8BenchStatus" class="small">No benchmark run yet.</div><div class="feed" id="v8Benchmarks"></div>
      </div></div>`;
    settings.insertBefore(wrap, settings.firstChild);
    $('v8RbacMode').value = workspace.rbacMode || 'strict';
  }
  function wire(){
    $('v8LoginBtn').onclick = () => {
      auth.name = $('v8AuthName').value.trim(); auth.role = $('v8AuthRole').value; auth.status = auth.name ? 'authenticated' : 'anonymous'; saveAuth(); renderAuth(); presenceHeartbeat(); emitEvent('auth', `${auth.name || 'anonymous'} authenticated as ${auth.role}`);
    };
    $('v8LogoutBtn').onclick = () => { emitEvent('auth', `${auth.name || 'operator'} logged out`); auth.name=''; auth.status='anonymous'; saveAuth(); renderAuth(); };
    $('v8SyncBtn').onclick = () => { presenceHeartbeat(); emitEvent('sync', 'Presence broadcast triggered manually'); };
    $('v8WorkspaceName').oninput = () => { workspace.name = $('v8WorkspaceName').value || workspace.name; saveWorkspace(); previewService(); };
    $('v8ApiBase').oninput = () => { workspace.apiBase = $('v8ApiBase').value || '/api/v1'; saveWorkspace(); previewService(); };
    $('v8Environment').oninput = () => { workspace.environment = $('v8Environment').value || 'local-lab'; saveWorkspace(); previewService(); };
    $('v8RbacMode').onchange = () => { workspace.rbacMode = $('v8RbacMode').value; saveWorkspace(); renderAuth(); previewService(); };
    $('v8ExportOpenApiBtn').onclick = () => { download('luciferai_spatial_openapi_v8.json', JSON.stringify(openApiSpec(), null, 2), 'application/json'); emitEvent('export', 'OpenAPI spec exported'); };
    $('v8ExportSqlBtn').onclick = () => { download('luciferai_spatial_schema_v8.sql', sqlSchema(), 'text/sql'); emitEvent('export', 'SQL schema exported'); };
    $('v8ExportServiceManifestBtn').onclick = () => { download('luciferai_spatial_service_manifest_v8.json', JSON.stringify(serviceManifest(), null, 2), 'application/json'); emitEvent('export', 'Service manifest exported'); };
    $('v8RunBenchBtn').onclick = runBenchmark;
    $('v8ExportBenchBtn').onclick = () => { download('luciferai_spatial_benchmarks_v8.json', JSON.stringify(benchmarks, null, 2), 'application/json'); emitEvent('export', 'Benchmarks exported'); };
    channel && (channel.onmessage = (msg) => {
      const data = msg.data || {};
      if(data.type==='presence' && Array.isArray(data.presence)){ workspace.presence = data.presence; saveWorkspace(); renderPresence(); }
      if(data.type==='evt' && data.evt){ if(!workspace.events.some(e => e.id===data.evt.id)){ workspace.events.unshift(data.evt); workspace.events = workspace.events.slice(0,40); saveWorkspace(); renderEvents(); } }
    });
    ['createIncidentBtn','exportEvidenceBtn','applyIngestBtn','startIngestBtn','stopIngestBtn','saveSessionBtn','runAccuracyBtn','autoCalibrateBtn'].forEach(id => {
      const el=$(id); if(!el) return; el.addEventListener('click', ()=> setTimeout(()=>emitEvent('ui-action', `Action executed: ${id}`, {id}), 0));
    });
  }
  function previewService(){ const el=$('v8ServicePreview'); if(!el) return; const preview = serviceManifest(); el.textContent = JSON.stringify(preview, null, 2); }
  function bootV8(){
    installPanels();
    renderAuth();
    renderPresence();
    renderEvents();
    renderBenchmarks();
    previewService();
    wire();
    presenceHeartbeat();
    setInterval(presenceHeartbeat, 10000);
    emitEvent('system', 'v8 service architecture layer initialized');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootV8, {once:true});
  else bootV8();
})();