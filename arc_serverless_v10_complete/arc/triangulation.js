
function triangulate(signals){
 if(signals.length<3) return null
 let lat=0,lon=0
 signals.slice(-3).forEach(s=>{
  lat+=s.lat
  lon+=s.lon
 })
 return {lat:lat/3,lon:lon/3}
}

bus.on("signal",sig=>{
 const d=getDevice(sig.device)
 d.signals.push(sig)
 const loc=triangulate(d.signals)
 if(loc){
  d.locations.push(loc)
  d.path.push(loc)
 }
 updateMap()
 drawRF(sig)
})
