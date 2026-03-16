
const graph={devices:{}}

function getDevice(id){
 if(!graph.devices[id]){
  graph.devices[id]={id,signals:[],locations:[],path:[]}
 }
 return graph.devices[id]
}
