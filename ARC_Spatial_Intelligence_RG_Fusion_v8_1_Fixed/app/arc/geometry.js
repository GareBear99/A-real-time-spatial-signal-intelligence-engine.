export function centroid(latlngs){
  let lat=0, lng=0;
  for(const p of latlngs){ lat += p[0]; lng += p[1]; }
  return { lat: lat/latlngs.length, lng: lng/latlngs.length };
}

export function boundsFromPolygon(poly){
  let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity;
  for(const [lat,lng] of poly){
    if(lat<minLat) minLat=lat; if(lat>maxLat) maxLat=lat;
    if(lng<minLng) minLng=lng; if(lng>maxLng) maxLng=lng;
  }
  return { minLat,maxLat,minLng,maxLng };
}

export function pointInPolygon(point, polygon){
  const x = point.lng, y = point.lat;
  let inside = false;
  for(let i=0, j=polygon.length-1; i<polygon.length; j=i++){
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

export function clampPointToBounds(point, b){
  return {
    lat: Math.min(b.maxLat, Math.max(b.minLat, point.lat)),
    lng: Math.min(b.maxLng, Math.max(b.minLng, point.lng))
  };
}

export function seeded(seed){
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function seededPointInPolygon(polygon, seed=1){
  const b = boundsFromPolygon(polygon);
  for(let i=0;i<300;i++){
    const r1 = seeded(seed + i*2.17);
    const r2 = seeded(seed + i*3.41 + 9.2);
    const candidate = { lat: b.minLat + (b.maxLat-b.minLat)*r1, lng: b.minLng + (b.maxLng-b.minLng)*r2 };
    if(pointInPolygon(candidate, polygon)) return candidate;
  }
  const c = centroid(polygon);
  return { lat:c.lat, lng:c.lng };
}

export function distanceMeters(a,b){
  const R = 6371000;
  const dLat = (b.lat-a.lat) * Math.PI/180;
  const dLng = (b.lng-a.lng) * Math.PI/180;
  const lat1 = a.lat * Math.PI/180;
  const lat2 = b.lat * Math.PI/180;
  const x = dLat/2, y = dLng/2;
  const s = Math.sin(x)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(y)**2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
