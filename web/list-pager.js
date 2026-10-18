/* A new gesture at a visible list edge turns one page; momentum never chains pages. */
(() => {
 'use strict';
 const IDLE=200,COOLDOWN=500,WHEEL_DISTANCE=36,TOUCH_DISTANCE=54;
 function createGate(){
  let edges={up:false,down:false},entered={up:0,down:0},lastWheel=-Infinity,eligible=0,distance=0,blockedUntil=0;
  const side=direction=>direction<0?'up':'down';
  function sync(next,time){
   for(const key of ['up','down'])if(Boolean(next[key])!==edges[key]){edges[key]=Boolean(next[key]);entered[key]=time;eligible=0;distance=0;}
  }
  function reset(next,time){eligible=0;distance=0;edges={up:false,down:false};sync(next,time);}
  function ready(direction,time){return edges[side(direction)]&&time>=blockedUntil;}
  function activate(time){if(time<blockedUntil)return false;blockedUntil=time+COOLDOWN;eligible=0;distance=0;return true;}
  function turn(direction,time){return ready(direction,time)&&activate(time);}
  function wheel(direction,amount,time){
   const fresh=time-lastWheel>=IDLE;lastWheel=time;
   if(fresh){eligible=ready(direction,time)&&time-entered[side(direction)]>=IDLE?direction:0;distance=0;}
   if(!ready(direction,time)||eligible!==direction){eligible=0;distance=0;return false;}
   distance+=Math.min(Math.abs(amount),120);
   return distance>=WHEEL_DISTANCE&&turn(direction,time);
  }
  return {sync,reset,ready,turn,wheel,activate};
 }
 function edgeMarkup(page,total){
  if(!total)return {top:'',bottom:''};
  const hint=(direction,title,detail)=>`<button type="button" class="list-page-edge" data-page-step="${direction}" aria-label="${direction<0?'上一页':'下一页'}"><span aria-hidden="true">${direction<0?'↑':'↓'}</span><span><strong>${title}</strong><small>${detail}</small></span></button>`;
  return {
   top:page>0?hint(-1,'已到本页顶部',`再向上滚动，查看第 ${page} 页`):'<div class="list-page-end">已到第一页</div>',
   bottom:page+1<total?hint(1,'已到本页底部',`再向下滚动，查看第 ${page+2} 页`):'<div class="list-page-end">已到最后一页</div>'
  };
 }
 function attach({list,getPage,changePage,now=()=>performance.now()}){
  const gate=createGate(),listeners=[];let touch=null;
  function boundaries(){
   const {page,total}=getPage(),max=Math.max(0,list.scrollHeight-list.clientHeight);
   return {up:page>0&&list.scrollTop<=2,down:page+1<total&&list.scrollTop>=max-2};
  }
  function sync(){const edges=boundaries();gate.sync(edges,now());return edges;}
  function clearTouch(){touch=null;list.removeAttribute('data-page-pull');}
  function refresh(){clearTouch();gate.reset(boundaries(),now());}
  function flip(direction){clearTouch();changePage(direction);}
  function on(type,handler,options){list.addEventListener(type,handler,options);listeners.push([type,handler,options]);}
  on('scroll',sync,{passive:true});
  on('wheel',event=>{
   if(event.ctrlKey||event.metaKey||event.shiftKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   const direction=Math.sign(event.deltaY),edges=sync(),atEdge=direction<0?edges.up:edges.down;
   const amount=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?list.clientHeight:1);
   const turn=gate.wheel(direction,amount,now());
   if(atEdge)event.preventDefault();
   if(turn)flip(direction);
  },{passive:false});
  on('touchstart',event=>{
   clearTouch();if(event.touches.length!==1)return;
   const edges=sync(),point=event.touches[0];
   touch={x:point.clientX,y:point.clientY,edges,pending:0};
  },{passive:true});
  on('touchmove',event=>{
   if(!touch)return;if(event.touches.length!==1){clearTouch();return;}
   const point=event.touches[0],dy=touch.y-point.clientY,dx=touch.x-point.clientX,direction=Math.sign(dy),edges=sync();
   const key=direction<0?'up':'down',outward=direction&&touch.edges[key]&&edges[key]&&Math.abs(dy)>Math.abs(dx)*1.2;
   touch.pending=outward&&Math.abs(dy)>=TOUCH_DISTANCE&&gate.ready(direction,now())?direction:0;
   if(outward)event.preventDefault();
   if(touch.pending)list.setAttribute('data-page-pull',String(touch.pending));else list.removeAttribute('data-page-pull');
  },{passive:false});
  on('touchend',()=>{const direction=touch?.pending;clearTouch();sync();if(direction&&gate.turn(direction,now()))flip(direction);});
  on('touchcancel',clearTouch);
  on('keydown',event=>{
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.key==='Home'||event.key==='End'){event.preventDefault();list.scrollTop=event.key==='Home'?0:list.scrollHeight;sync();return;}
   const direction=['ArrowUp','PageUp'].includes(event.key)?-1:['ArrowDown','PageDown'].includes(event.key)?1:0;
   if(!direction)return;const edges=sync(),atEdge=direction<0?edges.up:edges.down;
   if(atEdge){event.preventDefault();if(!event.repeat&&gate.turn(direction,now()))flip(direction);}
  });
  on('click',event=>{
   const hint=event.target.closest('[data-page-step]');if(!hint||!list.contains(hint))return;
   const direction=Number(hint.dataset.pageStep),{page,total}=getPage();
   // A partly visible hint is still an explicit request, independent of the exact scroll offset.
   if((direction===-1||direction===1)&&page+direction>=0&&page+direction<total&&gate.activate(now()))flip(direction);
  });
  refresh();
  return {refresh,destroy(){for(const args of listeners)list.removeEventListener(...args);clearTouch();}};
 }
 (typeof window==='undefined'?globalThis:window).QuestListPager=Object.freeze({createGate,edgeMarkup,attach});
})();
