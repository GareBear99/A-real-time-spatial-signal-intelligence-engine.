export function ensureDevice(state, id='phone1'){
  if(!state.devices[id]){
    state.devices[id] = {
      id,
      truth: null,
      estimated: null,
      truthPath: [],
      estimatePath: [],
      observations: [],
      zone: 'Unknown',
      confidence: 0,
      lastSeen: null,
    };
  }
  return state.devices[id];
}
