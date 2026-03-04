
let canvas,ctx

function initRF(){
 canvas=document.getElementById("rf")
 canvas.width=window.innerWidth
 canvas.height=window.innerHeight
 ctx=canvas.getContext("2d")
}

function drawRF(sig){
 ctx.clearRect(0,0,canvas.width,canvas.height)
 const x=Math.random()*canvas.width
 const y=Math.random()*canvas.height

 for(let i=0;i<12;i++){
  ctx.beginPath()
  ctx.arc(x,y,i*18,0,Math.PI*2)
  ctx.strokeStyle="rgba(0,255,0,"+(1/(i+1))+")"
  ctx.stroke()
 }
}
