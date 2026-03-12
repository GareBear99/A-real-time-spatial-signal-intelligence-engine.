import { centroid } from './geometry.js';

export const demoStructures = [
  {
    id:'s1', address:'100 Pine Ave', name:'Pine House', type:'house', levels:1,
    polygon:[[52.13188,-122.14235],[52.13188,-122.14203],[52.13168,-122.14203],[52.13168,-122.14235]],
  },
  {
    id:'s2', address:'118 Cedar St', name:'Cedar Duplex', type:'duplex', levels:2,
    polygon:[[52.13156,-122.14174],[52.13156,-122.14137],[52.13132,-122.14137],[52.13132,-122.14174]],
  },
  {
    id:'s3', address:'201 Birch Rd', name:'Birch Garage', type:'garage', levels:1,
    polygon:[[52.13123,-122.14246],[52.13123,-122.14215],[52.13104,-122.14215],[52.13104,-122.14246]],
  },
  {
    id:'s4', address:'240 Lakeview Dr', name:'Lakeview Home', type:'house', levels:2,
    polygon:[[52.13207,-122.14148],[52.13207,-122.14112],[52.13179,-122.14112],[52.13179,-122.14148]],
  },
  {
    id:'s5', address:'310 Hillcrest Ln', name:'Hillcrest Bungalow', type:'house', levels:1,
    polygon:[[52.13154,-122.14287],[52.13154,-122.14257],[52.13130,-122.14257],[52.13130,-122.14287]],
  }
].map(s => ({...s, center: centroid(s.polygon)}));

export function searchStructures(query, structures){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return structures;
  return structures.filter(s => [s.address,s.name,s.type,s.id].join(' ').toLowerCase().includes(q));
}
