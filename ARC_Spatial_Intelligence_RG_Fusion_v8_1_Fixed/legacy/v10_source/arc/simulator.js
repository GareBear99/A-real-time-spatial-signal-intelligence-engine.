
let timer
let devices=["phone1","phone2"]

function startSim(){
 if(timer) return
 timer=setInterval(()=>{
  devices.forEach(d=>{
   const sig={
    device:d,
    rssi:-40-Math.random()*40,
    lat:52.131+Math.random()/400,
    lon:-122.141+Math.random()/400
   }
   bus.emit("signal",sig)
  })
 },600)
}

function stopSim(){
 clearInterval(timer)
 timer=null
}
