import { state } from './state.js';

let canvas, ctx;

export function initRF(){
  canvas = document.getElementById('rf');
  ctx = canvas.getContext('2d');
  resizeRF();
  window.addEventListener('resize', resizeRF);
}

export function resizeRF(){
  const rect = document.getElementById('mapWrap').getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}

export function drawRF(truth, estimate, sensors=[]){
  if(!ctx || !state.map) return;
  const map = state.map;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const points = [];
  if(truth) points.push({pt:truth, color:'rgba(166,255,104,0.95)'});
  if(estimate) points.push({pt:estimate, color:'rgba(103,246,255,0.95)'});
  for(const {pt, color} of points){
    const p = map.latLngToContainerPoint([pt.lat, pt.lng]);
    for(let i=1;i<=6;i++){
      ctx.beginPath();
      ctx.arc(p.x,p.y,i*16,0,Math.PI*2);
      ctx.strokeStyle = color.replace('0.95', String(0.18 / i + 0.03));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if(estimate){
    const ep = map.latLngToContainerPoint([estimate.lat, estimate.lng]);
    for(const s of sensors){
      const sp = map.latLngToContainerPoint([s.lat, s.lng]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ep.x, ep.y);
      ctx.strokeStyle = 'rgba(103,246,255,0.18)';
      ctx.stroke();
    }
  }
}
