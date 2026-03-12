
class Bus{
 constructor(){this.l={}}
 on(e,f){(this.l[e] ||= []).push(f)}
 emit(e,d){(this.l[e]||[]).forEach(fn=>fn(d))}
}
const bus=new Bus()
