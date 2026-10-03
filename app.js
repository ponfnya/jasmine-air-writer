const $=s=>document.querySelector(s);
const video=$("#video"), canvas=$("#canvas"), ctx=canvas.getContext("2d");
const startBtn=$("#start"), switchBtn=$("#switch"), clearBtn=$("#clear");
const status=$("#status"), message=$("#message"), errorBox=$("#error");

let HandLandmarker, FilesetResolver, hand, stream;
let facing="user", running=false, lastVideoTime=-1;
let previousPinch=false, pinchArmed=false, lastTrigger=0;
let flowers=[], dpr=1;

const VISION_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";
const WASM_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr;
  canvas.style.width=innerWidth+"px"; canvas.style.height=innerHeight+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize); resize();

function showError(msg){
  status.textContent="error";
  errorBox.hidden=false;
  errorBox.textContent=msg+"\n\nRefresh and try again.";
}
function hideError(){errorBox.hidden=true}

async function loadHandTracking(){
  status.textContent="loading";
  message.textContent="Loading hand tracking…";
  try{
    const mod=await import(VISION_URL);
    HandLandmarker=mod.HandLandmarker;
    FilesetResolver=mod.FilesetResolver;
    const vision=await FilesetResolver.forVisionTasks(WASM_URL);
    hand=await HandLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},
      runningMode:"VIDEO",
      numHands:1,
      minHandDetectionConfidence:.55,
      minHandPresenceConfidence:.55,
      minTrackingConfidence:.55
    });
  }catch(e){
    throw new Error("Hand tracking gagal dimuat.\n"+(e?.message||String(e)));
  }
}

async function openCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
    throw new Error("Browser ini tidak menyediakan akses kamera. Buka melalui HTTPS/GitHub Pages.");
  }
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({
    video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},
    audio:false
  });
  video.srcObject=stream;
  await video.play();
  switchBtn.disabled=false;
  running=true;
  status.textContent="camera on";
  message.textContent="Buka → tutup/cubit → buka lagi.";
  requestAnimationFrame(loop);
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function point(lm){return {x:(1-lm[8].x)*innerWidth,y:lm[8].y*innerHeight}}

function getGesture(lm){
  const thumb=lm[4], index=lm[8];
  const wrist=lm[0], middle=lm[12], ring=lm[16], pinky=lm[20];
  const palm=Math.max(dist(wrist,middle),dist(wrist,ring),dist(wrist,pinky));
  const pinch=dist(thumb,index) < palm*.28;

  // A closed hand is recognized when fingertips are relatively near the palm.
  const closed =
    dist(index,wrist) < palm*1.18 &&
    dist(middle,wrist) < palm*1.12 &&
    dist(ring,wrist) < palm*1.05 &&
    dist(pinky,wrist) < palm*1.0;

  return {pinch,closed};
}

function triggerAt(p){
  const now=performance.now();
  if(now-lastTrigger<550)return;
  lastTrigger=now;

  // Only a small local cluster: 5–8 flowers.
  const count=5+Math.floor(Math.random()*4);
  for(let i=0;i<count;i++){
    const angle=(-Math.PI*.82)+(Math.random()*Math.PI*.64);
    const spread=12+Math.random()*28;
    const x=p.x+(Math.random()-.5)*spread;
    const y=p.y+(Math.random()-.5)*spread*.65;
    const speed=.9+Math.random()*1.35;
    flowers.push({
      x,y,
      vx:Math.cos(angle)*speed+(Math.random()-.5)*.45,
      vy:Math.sin(angle)*speed+1.1+Math.random()*.7,
      size:4.5+Math.random()*3.5,
      rot:Math.random()*Math.PI*2,
      spin:(Math.random()-.5)*.035,
      sway:Math.random()*Math.PI*2,
      swaySpeed:.025+Math.random()*.018,
      age:0,
      delay:Math.random()*7,
      life:1,
      petals:5+Math.floor(Math.random()*2)
    });
  }
}

function drawFlower(f){
  ctx.save();
  ctx.translate(f.x,f.y); ctx.rotate(f.rot);
  const r=f.size;
  ctx.globalAlpha=Math.min(1,f.age/5);

  for(let i=0;i<f.petals;i++){
    ctx.save();
    ctx.rotate(i*Math.PI*2/f.petals);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-r*.9,-r*.34,-r*.58,-r*1.08,0,-r*1.25);
    ctx.bezierCurveTo(r*.58,-r*1.08,r*.9,-r*.34,0,0);
    const g=ctx.createRadialGradient(0,-r*.55,0,0,-r*.55,r*1.15);
    g.addColorStop(0,"#fffefa");
    g.addColorStop(.7,"#f7f5ed");
    g.addColorStop(1,"#d9d6cc");
    ctx.fillStyle=g;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0,0,r*.13,0,Math.PI*2);
  ctx.fillStyle="#e5d69a";
  ctx.fill();
  ctx.restore();
}

function updateFlowers(){
  for(let i=flowers.length-1;i>=0;i--){
    const f=flowers[i];
    f.age++;
    if(f.age>f.delay){
      f.vy+=.055;
      f.sway+=f.swaySpeed;
      f.x+=f.vx+Math.sin(f.sway)*.34;
      f.y+=f.vy;
      f.rot+=f.spin;
    }
    if(f.y>innerHeight+35) flowers.splice(i,1);
  }
}

function loop(){
  if(!running)return;
  ctx.clearRect(0,0,innerWidth,innerHeight);

  if(video.readyState>=2&&hand&&video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime;
    const result=hand.detectForVideo(video,performance.now());

    if(result.landmarks?.length){
      const lm=result.landmarks[0];
      const g=getGesture(lm);
      const p=point(lm);

      // Arm the trigger when the hand is open / not pinching.
      if(!g.pinch && !g.closed) pinchArmed=true;

      // Trigger on a pinch/close followed by opening again.
      if(pinchArmed && g.pinch) previousPinch=true;

      if(previousPinch && !g.pinch && !g.closed){
        triggerAt(p);
        previousPinch=false;
        pinchArmed=false;
      }

      // Also support a simple open -> closed -> open motion.
      if(pinchArmed && g.closed){
        previousPinch=true;
      }
      if(previousPinch && !g.closed && !g.pinch){
        triggerAt(p);
        previousPinch=false;
        pinchArmed=false;
      }
    }
  }

  updateFlowers();
  flowers.forEach(drawFlower);
  requestAnimationFrame(loop);
}

startBtn.onclick=async()=>{
  hideError();
  startBtn.disabled=true;
  try{
    await loadHandTracking();
    await openCamera();
  }catch(e){
    console.error(e);
    showError(e?.message||String(e));
    startBtn.disabled=false;
  }
};

switchBtn.onclick=async()=>{
  try{
    facing=facing==="user"?"environment":"user";
    await openCamera();
  }catch(e){showError(e?.message||String(e))}
};

clearBtn.onclick=()=>{
  flowers=[];
  ctx.clearRect(0,0,innerWidth,innerHeight);
  previousPinch=false;
  pinchArmed=false;
};
