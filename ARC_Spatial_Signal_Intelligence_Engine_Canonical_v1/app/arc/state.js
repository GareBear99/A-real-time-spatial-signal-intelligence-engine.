export const state = {
  boot: 'INIT',
  map: null,
  layers: {},
  structures: [],
  selectedStructureId: null,
  selectedStructure: null,
  blueprint: { overlay:null, imageDataUrl:null, opacity:0.45, scale:1, offsetX:0, offsetY:0 },
  sensors: [],
  devices: {},
  sim: { timer:null, running:false, tickMs:900, noiseDb:3, step:0 },
  estimator: { last:null, confidence:0, zone:'Unknown' },
  debug: { logs:[] }
};

export function setBoot(stage){ state.boot = stage; document.getElementById('boot').textContent = `BOOT: ${stage}`; }
