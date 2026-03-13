import { distanceMeters, pointInPolygon, clampPointToBounds, boundsFromPolygon } from './geometry.js';

export function rssiFromDistanceMeters(meters, noiseDb=2.5){
  const d = Math.max(1, meters);
  const pathLoss = 32 + 20 * Math.log10(d);
  const tx = -30;
  const noise = (Math.random() - 0.5) * 2 * noiseDb;
  return tx - pathLoss + noise;
}

export function estimateFromObservations(observations, structure){
  if(!observations?.length) return null;
  let sumW=0, lat=0, lng=0;
  for(const o of observations){
    const w = Math.max(0.0001, Math.pow(10, (o.rssi + 100) / 12));
    sumW += w;
    lat += o.sensor.lat * w;
    lng += o.sensor.lng * w;
  }
  let point = { lat: lat/sumW, lng: lng/sumW };
  if(structure){
    if(!pointInPolygon(point, structure.polygon)) point = clampPointToBounds(point, boundsFromPolygon(structure.polygon));
  }
  const sorted = [...observations].sort((a,b) => b.rssi - a.rssi);
  const spread = sorted.length >= 2 ? Math.abs(sorted[0].rssi - sorted[1].rssi) : 0;
  const confidence = Math.max(0.15, Math.min(0.98, 0.35 + spread / 22));
  return { point, confidence };
}

export function makeObservations(truth, sensors, noiseDb){
  return sensors.map(sensor => ({
    sensor,
    rssi: rssiFromDistanceMeters(distanceMeters(truth, sensor), noiseDb)
  }));
}
