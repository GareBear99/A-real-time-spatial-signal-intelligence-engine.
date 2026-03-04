
let sensors=[]
let visible=false

function toggleSensors(){
 visible=!visible
 if(!visible){
  sensors.forEach(s=>map.removeLayer(s))
  sensors=[]
  return
 }
 for(let i=0;i<6;i++){
  const lat=52.131+Math.random()/700
  const lon=-122.141+Math.random()/700
  const s=L.circle([lat,lon],{radius:8,color:"yellow"}).addTo(map)
  sensors.push(s)
 }
}
