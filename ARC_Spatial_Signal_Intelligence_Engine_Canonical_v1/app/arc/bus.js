export class Bus {
  constructor(){ this.listeners = {}; this.tap = null; }
  on(event, fn){ (this.listeners[event] ||= new Set()).add(fn); return () => this.off(event, fn); }
  off(event, fn){ this.listeners[event]?.delete(fn); }
  emit(event, payload){
    this.tap?.(event, payload);
    for(const fn of this.listeners[event] || []){
      try{ fn(payload); }catch(err){ console.error('[BUS]', event, err); }
    }
  }
}
export const bus = new Bus();
