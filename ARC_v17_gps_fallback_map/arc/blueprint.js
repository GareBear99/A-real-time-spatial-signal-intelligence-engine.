import { state } from './state.js';

function key(){ return state.selectedStructure ? `arc.blueprint.${state.selectedStructure.id}` : null; }

export function saveBlueprintState(){
  const k = key(); if(!k) return;
  const bp = state.blueprint;
  localStorage.setItem(k, JSON.stringify({
    imageDataUrl: bp.imageDataUrl,
    opacity: bp.opacity,
    scale: bp.scale,
    offsetX: bp.offsetX,
    offsetY: bp.offsetY
  }));
}

export function loadBlueprintState(){
  const k = key();
  state.blueprint.overlay?.remove();
  state.blueprint.overlay = null;
  state.blueprint.imageDataUrl = null;
  if(!k) return null;
  const raw = localStorage.getItem(k);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}
