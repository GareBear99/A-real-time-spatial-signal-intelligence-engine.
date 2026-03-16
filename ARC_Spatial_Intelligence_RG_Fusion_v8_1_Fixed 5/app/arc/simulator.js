import { state } from './state.js';
import { ensureDevice } from './entities.js';
import { seededPointInPolygon } from './geometry.js';
import { makeObservations, estimateFromObservations } from './estimator.js';
import { inferZone } from './room_inference.js';
import { drawRF } from './webgl_rf.js';

export function simStep(log){
  const structure = state.selectedStructure;
  if(!structure || !state.sensors.length) return;
  state.sim.step += 1;
  const d = ensureDevice(state, 'phone1');
  const truth = seededPointInPolygon(structure.polygon, 120 + state.sim.step * 1.1337);
  const observations = makeObservations(truth, state.sensors, state.sim.noiseDb);
  const estimated = estimateFromObservations(observations, structure);
  d.truth = truth;
  d.estimated = estimated?.point || null;
  d.truthPath.push(truth);
  d.estimatePath.push(estimated?.point || truth);
  d.observations = observations;
  d.confidence = estimated?.confidence || 0;
  d.zone = inferZone(structure, estimated?.point || truth);
  d.lastSeen = new Date().toISOString();
  d.truthPath = d.truthPath.slice(-32);
  d.estimatePath = d.estimatePath.slice(-32);
  state.estimator.last = d.estimated;
  state.estimator.confidence = d.confidence;
  state.estimator.zone = d.zone;
  drawRF(d.truth, d.estimated, state.sensors);
  log(`STEP ${state.sim.step}: zone=${d.zone} conf=${Math.round(d.confidence*100)}%`);
  return d;
}

export function startSim(stepFn){
  if(state.sim.running) return;
  state.sim.running = true;
  state.sim.timer = setInterval(stepFn, state.sim.tickMs);
}

export function stopSim(){
  state.sim.running = false;
  clearInterval(state.sim.timer);
  state.sim.timer = null;
}
