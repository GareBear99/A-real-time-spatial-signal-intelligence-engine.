import { centroid, seededPointInPolygon } from './geometry.js';

export function buildSensorsForStructure(structure){
  const c = centroid(structure.polygon);
  const pts = [
    seededPointInPolygon(structure.polygon, 11),
    seededPointInPolygon(structure.polygon, 27),
    seededPointInPolygon(structure.polygon, 53),
    seededPointInPolygon(structure.polygon, 81),
    { lat:c.lat, lng:c.lng }
  ];
  return pts.map((p, i) => ({
    id: `${structure.id}-sn${i+1}`,
    lat: p.lat,
    lng: p.lng,
    type: i===4 ? 'center-anchor' : 'anchor'
  }));
}
