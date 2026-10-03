import { HandLandmarker, FilesetResolver } from
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

const video=document.querySelector("#video");
const canvas=document.querySelector("#canvas");
const ctx=canvas.getContext("2d");
const start=document.querySelector("#start");
const sw=document.querySelector("#switch");
const clear=document.querySelector("#clear");
const status=document.querySelector("#status");
const message=document.querySelector("#message");

let hand,stream,facing="user",running=false,lastTime=-1,lastPoint=null;
let flowers=[],strokes=[],currentStroke=[];
let dpr=1;

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr;
  canvas.style.width=innerWidth+"px"; canvas.style.height=innerHeight+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize); resize();

async function setup(){
  const vision=await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
  hand=await HandLandmarker.createFromOptions(vision,{
    baseOptions:{
      modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate:"GPU"
    },
    runningMode:"VIDEO",numHands:1,
    minHandDetectionConfidence:.58,
    minHandPresenceConfidence:.58,
    minTrackingConfidence:.58
  });
}

async function camera(){
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({
    video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},
    audio:false
  });
  video.srcObject=stream; await video.play();
  sw.disabled=false; running=true; resize();
  status.textContent="camera on";
  message.textContent="Angkat telunjuk dan tulis perlahan di udara.";
  requestAnimationFrame(loop);
}

function point(lm){
  const p=lm[8];
  return {x:(1-p.x)*innerWidth,y:p.y*innerHeight};
}

function indexOnly(lm){
  const i=lm[8],ip=lm[6],m=lm[12],mp=lm[10],r=lm[16],rp=lm[14],p=lm[20],pp=lm[18];
  return i.y<ip.y && m.y>mp.y && r.y>rp.y && p.y>pp.y;
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

function flower(x,y,scale=.8){
  const petals=5+Math.floor(Math.random()*2);
  flowers.push({
    x,y,
    vx:(Math.random()-.5)*.18,
    vy:.05+Math.random()*.18,
    size:(5.5+Math.random()*4)*scale,
    rot:Math.random()*Math.PI*2,
    spin:(Math.random()-.5)*.008,
    sway:Math.random()*6.28,
    swaySpeed:.012+Math.random()*.012,
    phase:Math.random()*6.28,
    petals,
    age:0
  });
}

function between(a,b){
  const d=dist(a,b);
  const n=Math.max(1,Math.floor(d/12));
  for(let i=0;i<n;i++){
    const t=i/n;
    flower(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,.68+Math.random()*.3);
  }
}

function drawFlower(f){
  ctx.save();
  ctx.translate(f.x,f.y);
  ctx.rotate(f.rot);
  const r=f.size;
  ctx.globalAlpha=Math.min(1,f.age/7);

  // Irregular, softly shaded jasmine petals — intentionally subtle.
  for(let i=0;i<f.petals;i++){
    ctx.save();
    ctx.rotate(i*Math.PI*2/f.petals);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-r*.9,-r*.35,-r*.58,-r*1.15,0,-r*1.28);
    ctx.bezierCurveTo(r*.58,-r*1.15,r*.9,-r*.35,0,0);
    const g=ctx.createRadialGradient(0,-r*.55,0,0,-r*.6,r*1.2);
    g.addColorStop(0,"#fffefa");
    g.addColorStop(.7,"#f8f6ee");
    g.addColorStop(1,"#dedbd1");
    ctx.fillStyle=g;
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0,0,r*.13,0,Math.PI*2);
  ctx.fillStyle="#e7d99e";
  ctx.fill();
  ctx.restore();
}

function updateFlowers(){
  for(let i=flowers.length-1;i>=0;i--){
    const f=flowers[i]; f.age++;
    if(f.age>24){
      f.vy+=.035;
      f.sway+=f.swaySpeed;
      f.x+=f.vx+Math.sin(f.sway+f.phase)*.38;
      f.y+=f.vy;
      f.rot+=f.spin;
    }
    if(f.y>innerHeight+40) flowers.splice(i,1);
  }
}

function drawStrokes(){
  for(const s of strokes){
    if(s.length<2)continue;
    ctx.beginPath(); ctx.moveTo(s[0].x,s[0].y);
    for(let i=1;i<s.length;i++)ctx.lineTo(s[i].x,s[i].y);
    ctx.strokeStyle="rgba(255,255,255,.10)";
    ctx.lineWidth=1; ctx.lineCap="round"; ctx.stroke();
  }
}

function loop(){
  if(!running)return;
  ctx.clearRect(0,0,innerWidth,innerHeight);

  if(video.readyState>=2&&hand&&video.currentTime!==lastTime){
    lastTime=video.currentTime;
    const result=hand.detectForVideo(video,performance.now());
    if(result.landmarks?.length&&indexOnly(result.landmarks[0])){
      const p=point(result.landmarks[0]);
      if(lastPoint){
        if(dist(lastPoint,p)>3){
          between(lastPoint,p);
          currentStroke.push(p);
        }
      }else currentStroke=[p];
      lastPoint=p;
    }else if(lastPoint){
      if(currentStroke.length>1)strokes.push(currentStroke);
      if(strokes.length>18)strokes.shift();
      currentStroke=[]; lastPoint=null;
    }
  }

  drawStrokes();
  updateFlowers();
  flowers.forEach(drawFlower);
  requestAnimationFrame(loop);
}

function clearAll(){
  flowers=[];strokes=[];currentStroke=[];lastPoint=null;
  ctx.clearRect(0,0,innerWidth,innerHeight);
}

start.onclick=async()=>{
  try{
    start.disabled=true;
    status.textContent="loading";
    await setup(); await camera();
  }catch(e){
    console.error(e);
    status.textContent="camera error";
    message.textContent="Kamera tidak dapat dibuka. Gunakan HTTPS/localhost dan izinkan akses kamera.";
    start.disabled=false;
  }
};

sw.onclick=async()=>{
  facing=facing==="user"?"environment":"user";
  try{await camera()}catch(e){status.textContent="camera error"}
};
clear.onclick=clearAll;
