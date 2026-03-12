
let map,heat,markers=[],showPath=true

function initMap(){
 map=L.map('map').setView([52.131,-122.141],15)
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map)
 heat=L.heatLayer([], {radius:25}).addTo(map)
}

function togglePath(){showPath=!showPath}

function updateMap(){
 markers.forEach(m=>map.removeLayer(m))
 markers=[]
 const heatPts=[]

 Object.values(graph.devices).forEach(d=>{
  const loc=d.locations.at(-1)
  if(!loc)return

  const m=L.marker([loc.lat,loc.lon]).addTo(map)
  markers.push(m)

  if(showPath && d.path.length>1){
   const pts=d.path.map(p=>[p.lat,p.lon])
   L.polyline(pts,{color:"cyan"}).addTo(map)
  }

  heatPts.push([loc.lat,loc.lon,0.8])
 })

 heat.setLatLngs(heatPts)

 document.getElementById("stats").innerText=
 "devices:"+Object.keys(graph.devices).length
}
