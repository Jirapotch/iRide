/* GAME LOOP / browser lifecycle. All resources are embedded in this file. */
(() => {
'use strict';
const canvas=document.getElementById('scene');
function failure(message){const el=document.getElementById('loading');el.classList.remove('hidden');el.style.cssText='position:fixed;inset:0;z-index:1000;display:grid;place-content:center;padding:30px;background:#202b28;color:#fff;text-align:center';el.textContent=message;}
try{
 const game=new RacingCore.Game();globalThis.game=game;
 game.audio=new AudioManager();game.inputManager=new InputManager();
 game.renderer=new RaceRenderer(canvas,game.track);
 const ui=new GameUI(game);game.ui=ui;
 try{const best=Number(localStorage.getItem('dune-bolt-best'));if(best>0)game.bestLap=best;}catch(_){}
 let accumulator=0,last=performance.now(),quality=null,lost=false,previousBest=game.bestLap;
 function pause(){game.pause();game.inputManager.clear();accumulator=0;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now();});
 window.addEventListener('blur',pause);
 function resize(){if(matchMedia('(pointer:coarse)').matches&&innerHeight>innerWidth)pause();game.renderer.resize();}
 window.addEventListener('resize',resize);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;pause();failure('กำลังกู้คืนภาพเกม… การแข่งขันพักอยู่');});
 canvas.addEventListener('webglcontextrestored',()=>{try{game.renderer.dispose();game.renderer=new RaceRenderer(canvas,game.track);quality=null;lost=false;document.getElementById('loading').classList.add('hidden');last=performance.now();}catch(_){failure('กู้คืนภาพไม่สำเร็จ กรุณาเปิดไฟล์ใหม่');}});
 function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  if(lost||document.hidden)return;
  const input=game.inputManager.read();
  if(input.pause){if(game.state==='paused'&&!ui.dialog){game.audio.start();game.resume();}else pause();}
  if(input.reset)game.resetPlayer();
  game.input=input;
  if(game.settings.quality!==quality){quality=game.settings.quality;game.renderer.setQuality(quality);}
  accumulator+=dt;
  while(accumulator>=game.config.fixedStep){game.step(game.config.fixedStep);accumulator-=game.config.fixedStep;}
  for(const e of game.drainEvents()){
   if(Number.isFinite(e.x))game.renderer.emit(e);
   if(e.carId===0||e.type==='countdown')game.audio.emit(e.type==='countdown'&&e.intensity===0?'go':e.type);
  }
  if(previousBest!==game.bestLap){previousBest=game.bestLap;try{localStorage.setItem('dune-bolt-best',String(game.bestLap));}catch(_){}}
  game.audio.update(game.cars[0],game.state,dt);
  game.renderer.render(game,accumulator/game.config.fixedStep,dt);
  ui.update(dt);
 }
 resize();requestAnimationFrame(frame);
}catch(error){console.error(error);failure('อุปกรณ์นี้เริ่มภาพ 3D ไม่ได้ กรุณาเปิดด้วย Chrome / Edge ที่รองรับ WebGL 2 และเปิดการเร่งกราฟิก');}
})();
