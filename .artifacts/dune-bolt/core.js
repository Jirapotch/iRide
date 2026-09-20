/* DUNE BOLT RACING — standalone deterministic simulation. World units: metres. */
(() => {
'use strict';
const GAME_CONFIG={laps:3,aiCount:6,fixedStep:1/60,maxFrame:.1,physics:{gravity:20},particles:{max:320},camera:{minZoom:.85,maxZoom:1.05}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const mod=(a,b)=>(a%b+b)%b;
const SPECS={
 rally:{acceleration:18,maxSpeed:32,grip:7.8,handling:1,weight:1},
 sport:{acceleration:18.5,maxSpeed:37,grip:6.5,handling:.93,weight:.88},
 muscle:{acceleration:23,maxSpeed:34,grip:6.7,handling:.86,weight:1.3},
 buggy:{acceleration:17,maxSpeed:31,grip:8.8,handling:1.1,weight:.82}
};
const COLORS=[0xff632e,0x20d5c6,0xf4c848,0x8a7aef,0xe9619a,0x58a2f2,0xa5ce67];
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function cat(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}

// TRACK: one authoritative centreline for geometry, AI, checkpoints and map.
class Track{
 constructor(){
  const knots=[[-78,-58],[-28,-65],[26,-65],[73,-51],[89,-16],[57,4],[84,29],[61,65],[15,76],[-28,60],[-32,25],[-72,25],[-96,0]];
  this.points=[];this.length=0;this.props=[];
  for(let i=0;i<knots.length;i++)for(let j=0;j<20;j++){
   const a=knots[mod(i-1,knots.length)],b=knots[i],c=knots[(i+1)%knots.length],d=knots[(i+2)%knots.length],t=j/20;
   const p={x:cat(a[0],b[0],c[0],d[0],t),z:cat(a[1],b[1],c[1],d[1],t)};
   if(this.points.length){const q=this.points.at(-1);this.length+=Math.hypot(p.x-q.x,p.z-q.z);}
   p.s=this.length;this.points.push(p);
  }
  this.length+=Math.hypot(this.points[0].x-this.points.at(-1).x,this.points[0].z-this.points.at(-1).z);
  this.points.forEach((p,i)=>{const q=this.points[(i+1)%this.points.length],len=Math.hypot(q.x-p.x,q.z-p.z);p.tx=(q.x-p.x)/len;p.tz=(q.z-p.z)/len;p.segmentLength=len;Object.assign(p,this.attributes(p.s));});
  this.checkpoints=Array.from({length:12},(_,i)=>({...this.sample(i*this.length/12),index:i}));
  // Chord cuts a shallow bend; both ends belong to checkpoint interval 4 -> 5.
  this.shortcut={a:this.sample(this.length*.35),b:this.sample(this.length*.405),width:8};
  this.initialProps();
 }
 attributes(s){
  const f=mod(s,this.length)/this.length;
  let surface='concrete',height=0,width=16;
  if(f>.13&&f<.21)surface='dirt';
  if(f>.45&&f<.56){surface='wood';width=11.5;height=3*Math.min(1,(f-.45)/.025,(.56-f)/.025);}
  if(f>.72&&f<.81)surface='sand';
  if(f>.86&&f<.89){surface='wood';height=(f-.86)/.03*2.4;}
  return{surface,height:Math.max(0,height),width};
 }
 sample(s){
  s=mod(s,this.length);let lo=0,hi=this.points.length-1;
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(this.points[m].s<=s)lo=m;else hi=m-1;}
  const p=this.points[lo],q=this.points[(lo+1)%this.points.length],t=clamp((s-p.s)/p.segmentLength,0,1);
  return{x:mix(p.x,q.x,t),z:mix(p.z,q.z,t),tx:p.tx,tz:p.tz,s,...this.attributes(s)};
 }
 nearest(x,z,includeShortcut=true){
  let best=Infinity,out;
  for(const p of this.points){const t=clamp(((x-p.x)*p.tx+(z-p.z)*p.tz)/p.segmentLength,0,1),qx=p.x+p.tx*p.segmentLength*t,qz=p.z+p.tz*p.segmentLength*t,d=(x-qx)**2+(z-qz)**2;
   if(d<best){best=d;const s=p.s+t*p.segmentLength;out={x:qx,z:qz,s,tx:p.tx,tz:p.tz,signed:(x-qx)*p.tz-(z-qz)*p.tx,distance:Math.sqrt(d),...this.attributes(s)};}
  }
  if(includeShortcut&&this.shortcut){const {a,b,width}=this.shortcut,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(len*len),0,1),qx=a.x+dx*t,qz=a.z+dz*t,d=Math.hypot(x-qx,z-qz);
   if(d<out.distance&&d<width*.5+1)out={x:qx,z:qz,s:mix(a.s,b.s,t),tx:dx/len,tz:dz/len,signed:(x-qx)*dz/len-(z-qz)*dx/len,distance:d,width,surface:'sand',height:0,shortcut:true};
  }
  return out;
 }
 initialProps(){
  const random=seeded(4471);this.props=[];
  for(let i=0;i<92;i++){
   const s=(i+.5)/92*this.length,p=this.sample(s),kind=['cone','box','tire','barrel'][i%4],side=i%2?1:-1,offset=p.width/2+(i%9===0?-1.6:1.8+random()*2.2);
   this.props.push({id:i,x:p.x+p.tz*offset*side,z:p.z-p.tx*offset*side,y:p.height,radius:kind==='cone'?.38:.65,kind,dynamic:true,vx:0,vz:0,angle:random()*6.28});
  }
  for(let i=0;i<28;i++){const p=this.sample(i/28*this.length),side=i%2?1:-1;this.props.push({id:100+i,x:p.x+p.tz*(p.width/2+3.5)*side,z:p.z-p.tx*(p.width/2+3.5)*side,y:p.height,radius:1,kind:i%3===0?'palm':'block',dynamic:false,vx:0,vz:0,angle:0});}
 }
 advance(v,time){
  if(v.finished)return false;
  const c=this.checkpoints[v.nextCheckpoint],before=(v.px-c.x)*c.tx+(v.pz-c.z)*c.tz,after=(v.x-c.x)*c.tx+(v.z-c.z)*c.tz;
  if(before<0&&after>=0){
   const t=-before/(after-before),x=mix(v.px,v.x,t),z=mix(v.pz,v.z,t),across=Math.abs((x-c.x)*c.tz-(z-c.z)*c.tx);
   if(across<=c.width/2+1.1&&Math.abs(v.y-c.height)<5){
    if(v.nextCheckpoint===0){v.lap++;v.lastLap=time-v.lapStart;v.bestLap=Math.min(v.bestLap,v.lastLap);v.lapStart=time;}
    v.safeS=c.s+3;v.nextCheckpoint=(v.nextCheckpoint+1)%this.checkpoints.length;return true;
   }
  }return false;
 }
 progress(v){
  if(v.finished)return GAME_CONFIG.laps*this.length+1;
  const last=mod(v.nextCheckpoint-1,12),a=last*this.length/12,b=(last+1)*this.length/12;
  let s=v.s;if(last===11&&s<this.length*.1)s=this.length;
  return v.lap*this.length+clamp(s,a,b);
 }
}

// VEHICLE / PHYSICS: planar momentum with independent jump height.
class Vehicle{
 constructor(id,type,track){
  this.id=id;this.type=SPECS[type]?type:'rally';this.spec=SPECS[this.type];this.color=COLORS[id%COLORS.length];
  const p=track.sample(14-Math.floor(id/2)*4.5),offset=(id%2?1:-1)*2.2;
  this.x=p.x+p.tz*offset;this.z=p.z-p.tx*offset;this.y=p.height;this.heading=Math.atan2(p.tx,p.tz);
  this.px=this.x;this.pz=this.z;this.py=this.y;this.prevHeading=this.heading;this.vx=0;this.vz=0;this.vy=0;this.angularVelocity=0;this.speed=0;this.steer=0;this.nitro=65;
  this.lap=0;this.nextCheckpoint=1;this.lapStart=0;this.bestLap=Infinity;this.lastLap=0;this.safeS=14;this.s=p.s;this.surface=p.surface;this.grip=1;
  this.finished=false;this.finishTime=0;this.finishOrder=0;this.resetLock=0;this.stuckTime=0;this.airborne=false;this.drifting=false;this.boosting=false;this.jumpCooldown=0;this.hitCooldown=0;this.rewardCooldown=0;this.personality=['balanced','aggressive','technical','speed'][id%4];this.events=[];this.lastRank=7;
 }
 event(type,intensity=1){this.events.push({type,x:this.x,z:this.z,y:this.y,intensity,carId:this.id});}
 integrate(input={},dt,track){
  this.px=this.x;this.pz=this.z;this.py=this.y;this.prevHeading=this.heading;
  this.hitCooldown=Math.max(0,this.hitCooldown-dt);this.rewardCooldown=Math.max(0,this.rewardCooldown-dt);this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);
  if(this.resetLock>0){this.resetLock=Math.max(0,this.resetLock-dt);this.vx=this.vz=this.speed=0;return;}
  const road=track.nearest(this.x,this.z),spec=this.spec,speed=Math.hypot(this.vx,this.vz),gas=clamp(input.gas||0,0,1),brake=clamp(input.brake||0,0,1),steer=clamp(input.steer||0,-1,1);
  const surfaceGrip={concrete:1,sand:.65,wood:.85,dirt:.7}[road.surface]||1;
  this.surface=road.surface;this.grip=surfaceGrip;this.steer=steer;
  const fx=Math.sin(this.heading),fz=Math.cos(this.heading),rx=fz,rz=-fx;
  let forward=this.vx*fx+this.vz*fz,lateral=this.vx*rx+this.vz*rz;
  const slip=Math.abs(Math.atan2(lateral,Math.max(2,Math.abs(forward))));
  this.drifting=!this.airborne&&speed>9&&(input.handbrake&&Math.abs(steer)>.15||slip>.22||speed>23&&Math.abs(steer)>.62);
  this.boosting=!!input.nitro&&gas>0&&this.nitro>.3&&!this.airborne;
  if(this.boosting)this.nitro=Math.max(0,this.nitro-27*dt);
  if(this.drifting&&speed>11&&Math.abs(lateral)>1.4&&Math.abs(lateral)<speed*.85)this.nitro=Math.min(100,this.nitro+7*dt);
  const maxSpeed=spec.maxSpeed*(this.boosting?1.28:1),offroad=road.surface==='sand'||road.surface==='dirt',surfaceAccel=offroad?(this.type==='buggy'?.96:.72):1;
  const airborneControl=this.airborne?.25:1;
  forward+=gas*spec.acceleration*surfaceAccel*(this.boosting?1.55:1)*Math.max(.07,1-Math.max(0,forward)/maxSpeed)*dt*airborneControl;
  if(brake){if(forward>1)forward=Math.max(0,forward-brake*31*dt);else forward=Math.max(-8,forward-brake*9*dt);}
  if(input.handbrake)forward*=Math.exp(-.7*dt);
  forward*=Math.exp(-(.12+Math.abs(forward)*.0025)*dt);
  const grip=spec.grip*surfaceGrip*(this.drifting?.26:1)*(this.type==='buggy'&&offroad?1.25:1);
  lateral*=Math.exp(-grip*dt*airborneControl);
  const wantedYaw=steer*Math.min(2.45,.18+Math.abs(forward)*.085)*spec.handling*Math.sign(forward||1)*clamp(speed/3,0,1)*airborneControl;
  this.angularVelocity=mix(this.angularVelocity,wantedYaw,1-Math.exp(-7*dt));
  this.heading=angle(this.heading+this.angularVelocity*dt);
  this.vx=fx*forward+rx*lateral;this.vz=fz*forward+rz*lateral;
  const steps=Math.max(1,Math.ceil(speed*dt/.55));
  for(let i=0;i<steps;i++){
   this.x+=this.vx*dt/steps;this.z+=this.vz*dt/steps;
   const near=track.nearest(this.x,this.z),limit=near.width/2-1.05;
   if(near.distance>limit){const nx=(this.x-near.x)/near.distance,nz=(this.z-near.z)/near.distance;this.x=near.x+nx*limit;this.z=near.z+nz*limit;const out=this.vx*nx+this.vz*nz;
    if(out>0){this.vx-=out*1.25*nx;this.vz-=out*1.25*nz;this.angularVelocity+=steer*.25;if(out>2&&this.hitCooldown<=0){this.event('collision',Math.min(1,out/14));this.hitCooldown=.22;}}
   }
  }
  const now=track.nearest(this.x,this.z);this.s=now.s;
  if(!this.airborne&&road.height-now.height>.1&&road.height>1&&speed>10&&this.jumpCooldown<=0){this.airborne=true;this.vy=4+speed*.1;this.jumpCooldown=1.5;this.event('jump');}
  if(this.airborne){this.vy-=GAME_CONFIG.physics.gravity*dt;this.y+=this.vy*dt;if(this.y<=now.height&&this.vy<0){this.y=now.height;this.airborne=false;this.vy=0;this.event('landing');if(speed>8&&this.rewardCooldown<=0){this.nitro=Math.min(100,this.nitro+9);this.rewardCooldown=1;}}}
  else this.y=now.height;
  this.speed=Math.hypot(this.vx,this.vz);
  this.stuckTime=this.speed<1.2&&gas>.1?this.stuckTime+dt:0;
 }
 reset(track){const p=track.sample(this.safeS);this.x=p.x;this.z=p.z;this.y=p.height;this.px=this.x;this.pz=this.z;this.py=this.y;this.heading=Math.atan2(p.tx,p.tz);this.prevHeading=this.heading;this.vx=this.vz=this.vy=this.angularVelocity=this.speed=0;this.airborne=false;this.s=p.s;this.resetLock=1.5;this.stuckTime=0;this.boosting=this.drifting=false;this.event('reset');}
}

// AI: forward look-ahead steering, curvature braking and lateral avoidance.
function aiInput(v,game,dt){
 const track=game.track,difficulty=game.difficulty,near=track.nearest(v.x,v.z,false),look=7+v.speed*.35;
 const p=track.sample(near.s+look),future=track.sample(near.s+look+12),h=Math.atan2(p.tx,p.tz),futureH=Math.atan2(future.tx,future.tz),curvature=Math.abs(angle(futureH-h));
 let lane=Math.sin(v.id*2.7+game.time*.22)*(difficulty==='easy'?1.1:.5);
 for(const other of game.cars){if(other===v)continue;const dx=other.x-v.x,dz=other.z-v.z,ahead=dx*near.tx+dz*near.tz,side=dx*near.tz-dz*near.tx;if(ahead>0&&ahead<12&&Math.abs(side)<3)lane+=(side>=0?-1:1)*(v.personality==='aggressive'?1.8:2.8)*(1-ahead/14);}
 lane=clamp(lane,-p.width*.25,p.width*.25);
 const targetH=Math.atan2(p.x+p.tz*lane-v.x,p.z-p.tx*lane-v.z),error=angle(targetH-v.heading);
 const turn=clamp(error*2.1,-1,1);
 const targetSpeed=clamp(v.spec.maxSpeed*(difficulty==='easy'?.8:difficulty==='hard'?1:.91)/(1+curvature*1.9),12,v.spec.maxSpeed);
 return{gas:v.speed<targetSpeed?1:.12,brake:v.speed>targetSpeed+2?.4:0,steer:turn,handbrake:false,nitro:difficulty!=='easy'&&curvature<.12&&Math.abs(error)<.12&&v.nitro>30&&v.speed>20};
}

class SpatialGrid{
 constructor(size=10){this.size=size;this.cells=new Map();}
 clear(){this.cells.clear();}
 insert(o){const x=Math.floor(o.x/this.size),z=Math.floor(o.z/this.size),key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(o);}
 query(x,z){const out=[],ix=Math.floor(x/this.size),iz=Math.floor(z/this.size);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const c=this.cells.get((ix+a)+','+(iz+b));if(c)out.push(...c);}return out;}
}
class CollisionSystem{
 constructor(){this.grid=new SpatialGrid();}
 step(game,dt){
  const props=game.track.props;this.grid.clear();
  for(const p of props){if(p.dynamic){p.x+=p.vx*dt;p.z+=p.vz*dt;p.angle+=Math.hypot(p.vx,p.vz)*dt*.5;p.vx*=Math.exp(-3*dt);p.vz*=Math.exp(-3*dt);}this.grid.insert(p);}
  for(const v of game.cars){
   for(const p of this.grid.query(v.x,v.z)){
    if(Math.abs(v.y-(p.y||0))>1.5)continue;
    const dx=v.x-p.x,dz=v.z-p.z,d=Math.hypot(dx,dz),r=1.05+p.radius;if(d>=r||d<.001)continue;
    const nx=dx/d,nz=dz/d,overlap=r-d;
    if(p.dynamic){p.x-=nx*overlap*.8;p.z-=nz*overlap*.8;v.x+=nx*overlap*.2;v.z+=nz*overlap*.2;const impact=Math.max(0,-v.vx*nx-v.vz*nz);p.vx-=nx*impact*.85;p.vz-=nz*impact*.85;v.vx*=.96;v.vz*=.96;}
    else{v.x+=nx*overlap;v.z+=nz*overlap;const toward=v.vx*nx+v.vz*nz;if(toward<0){v.vx-=toward*1.3*nx;v.vz-=toward*1.3*nz;}}
    if(v.speed>3&&v.hitCooldown<=0){v.event('collision',p.dynamic?.35:.8);v.hitCooldown=.22;}
   }
  }
  for(let i=0;i<game.cars.length;i++)for(let j=i+1;j<game.cars.length;j++){
   const a=game.cars[i],b=game.cars[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(Math.abs(a.y-b.y)>1.5||d>2.3||d<.001)continue;
   const nx=dx/d,nz=dz/d,over=(2.3-d)*.5;a.x-=nx*over;a.z-=nz*over;b.x+=nx*over;b.z+=nz*over;
   const rel=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(rel<0){const impulse=-(1.25)*rel/(1/a.spec.weight+1/b.spec.weight);a.vx-=impulse*nx/a.spec.weight;a.vz-=impulse*nz/a.spec.weight;b.vx+=impulse*nx/b.spec.weight;b.vz+=impulse*nz/b.spec.weight;a.angularVelocity+=nz*.3;b.angularVelocity-=nz*.3;if(a.hitCooldown<=0){a.event('collision',Math.min(1,-rel/12));a.hitCooldown=.25;}}
  }
 }
}

// GAME STATE: rendering and browser APIs are optional consumers.
class Game{
 constructor(){this.config=GAME_CONFIG;this.track=new Track();this.cars=[];this.state='menu';this.difficulty='normal';this.selectedType='rally';this.settings={volume:.45,quality:'auto',shake:true};this.time=0;this.countdown=3;this.input={};this.events=[];this.bestLap=Infinity;this.lapStart=0;this.finishCount=0;this.collision=new CollisionSystem();this.buildCars();}
 buildCars(){this.cars=Array.from({length:this.config.aiCount+1},(_,i)=>new Vehicle(i,i===0?this.selectedType:['sport','rally','buggy','muscle'][i%4],this.track));}
 start(type='rally',difficulty='normal'){this.selectedType=SPECS[type]?type:'rally';this.difficulty=['easy','normal','hard'].includes(difficulty)?difficulty:'normal';this.track.initialProps();this.buildCars();this.state='countdown';this.countdown=3;this.time=0;this.lapStart=0;this.finishCount=0;this.events=[];this.input={};this.lastCountdown=4;}
 pause(){if(this.state==='racing'||this.state==='countdown'){this.previousState=this.state;this.state='paused';this.input={};}}
 resume(){if(this.state==='paused')this.state=this.previousState||'racing';}
 restart(){this.start(this.selectedType,this.difficulty);}
 toMenu(){this.state='menu';this.input={};}
 resetPlayer(){if(this.state==='racing')this.cars[0].reset(this.track);}
 rank(v){if(v.finished)return v.finishOrder;const progress=this.track.progress(v);return 1+this.cars.filter(o=>o!==v&&(o.finished||this.track.progress(o)>progress)).length;}
 drainEvents(){const e=this.events;this.events=[];return e;}
 step(dt){
  if(this.state==='paused'||this.state==='menu'||this.state==='finished')return;
  if(this.state==='countdown'){this.countdown-=dt;const n=Math.ceil(this.countdown);if(n!==this.lastCountdown){this.events.push({type:'countdown',intensity:n});this.lastCountdown=n;}if(this.countdown<=0){this.state='racing';this.countdown=0;}return;}
  this.time+=dt;
  for(const v of this.cars){const input=v.id===0?this.input:aiInput(v,this,dt);v.integrate(v.finished?{brake:1}:input,dt,this.track);if(v.id>0&&v.stuckTime>3)v.reset(this.track);}
  this.collision.step(this,dt);
  for(const v of this.cars){
   if(this.track.advance(v,this.time)){
    if(v.nextCheckpoint===1){v.event('lap');if(v.id===0){this.bestLap=Math.min(this.bestLap,v.bestLap);this.lapStart=this.time;}if(v.lap>=this.config.laps){v.finished=true;v.finishTime=this.time;v.finishOrder=++this.finishCount;v.event('finish');}}
   }
   this.events.push(...v.events);v.events.length=0;
  }
  const player=this.cars[0],rank=this.rank(player);
  if(rank<player.lastRank&&this.time>3&&player.rewardCooldown<=0){player.nitro=Math.min(100,player.nitro+7);player.rewardCooldown=1.5;this.events.push({type:'overtake',x:player.x,z:player.z,y:player.y,carId:0});}
  player.lastRank=rank;
  if(player.speed>17&&player.rewardCooldown<=0&&player.hitCooldown<=0){for(const v of this.cars.slice(1)){const d=Math.hypot(v.x-player.x,v.z-player.z);if(d>2.5&&d<3.7&&Math.abs(player.speed-v.speed)>3){player.nitro=Math.min(100,player.nitro+3);player.rewardCooldown=2;this.events.push({type:'nearMiss',x:player.x,z:player.z,y:player.y,carId:0});break;}}}
  if(player.finished)this.state='finished';
 }
}
globalThis.RacingCore={GAME_CONFIG,SPECS,Track,Vehicle,Game,SpatialGrid,CollisionSystem,aiInput,clamp,angle};
})();
