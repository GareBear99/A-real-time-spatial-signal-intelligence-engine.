import { boundsFromPolygon } from './geometry.js';

export function inferZone(structure, point){
  if(!structure || !point) return 'Unknown';
  const b = boundsFromPolygon(structure.polygon);
  const w = b.maxLng - b.minLng;
  const h = b.maxLat - b.minLat;
  const rx = (point.lng - b.minLng) / (w || 1);
  const ry = (point.lat - b.minLat) / (h || 1);
  const center = Math.abs(rx - 0.5) < 0.18 && Math.abs(ry - 0.5) < 0.18;
  if(center) return 'Center-Core';
  if(ry < 0.33) return 'North Zone';
  if(ry > 0.66) return 'South Zone';
  if(rx < 0.5) return 'West Zone';
  return 'East Zone';
}
