import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/list-pager.js';

const {attach,edgeMarkup}=globalThis.QuestListPager;
function fixture({page=0,total=4,position=0,height=1200,viewport=300}={}){
 let time=0,scrollTop=position,controller;
 const handlers=new Map(),attributes=new Map(),turns=[];
 const list={
  scrollHeight:height,clientHeight:viewport,
  get scrollTop(){return scrollTop;},
  set scrollTop(value){scrollTop=Math.max(0,Math.min(value,Math.max(0,this.scrollHeight-this.clientHeight)));},
  addEventListener(type,handler){handlers.set(type,handler);},
  removeEventListener(type){handlers.delete(type);},
  setAttribute(key,value){attributes.set(key,value);},
  removeAttribute(key){attributes.delete(key);},
  contains(element){return element?.owner===list;}
 };
 controller=attach({list,now:()=>time,getPage:()=>({page,total}),changePage(direction){
  page+=direction;turns.push(page);list.scrollTop=direction<0?list.scrollHeight:0;controller.refresh();
 }});
 function event(type,at,values={}){
  time=at;const e={deltaX:0,deltaY:0,deltaMode:0,prevented:false,preventDefault(){this.prevented=true;},...values};
  handlers.get(type)?.(e);return e;
 }
 function scroll(position,at){list.scrollTop=position;event('scroll',at);}
 const point=(x,y)=>({clientX:x,clientY:y});
 const touch=(type,at,x=100,y=300)=>event(type,at,{touches:type==='touchend'||type==='touchcancel'?[]:[point(x,y)]});
 return {list,turns,attributes,handlers,controller,event,scroll,touch,point,get page(){return page;},
  replace(nextPage,nextTotal,at){time=at;page=nextPage;total=nextTotal;list.scrollTop=0;controller.refresh();}};
}

test('the scroll reaching an edge and its momentum cannot turn a page; a fresh scroll can',()=>{
 const f=fixture({position:700});
 assert.equal(f.event('wheel',100,{deltaY:250}).prevented,false);
 f.scroll(900,110);
 for(const at of [120,160,200,260,320,390])assert.equal(f.event('wheel',at,{deltaY:40}).prevented,true);
 assert.deepEqual(f.turns,[]);
 f.event('wheel',650,{deltaY:16});f.event('wheel',666,{deltaY:16});
 assert.deepEqual(f.turns,[],'small touchpad deltas accumulate without reacting to jitter');
 f.event('wheel',682,{deltaY:8});
 assert.deepEqual(f.turns,[1]);assert.equal(f.list.scrollTop,0);
});

test('one large wheel event turns only one page and continued inertia never chains pages',()=>{
 const f=fixture({position:900});f.event('wheel',300,{deltaY:10000});
 assert.deepEqual(f.turns,[1]);
 // Even when momentum subsequently carries the new list all the way to its bottom.
 f.scroll(900,310);
 for(let at=320;at<1800;at+=80)f.event('wheel',at,{deltaY:180});
 assert.deepEqual(f.turns,[1]);
 f.event('wheel',2200,{deltaY:80});assert.deepEqual(f.turns,[1,2]);
});

test('previous-page scrolling starts at the preceding page bottom and honors the cooldown',()=>{
 const f=fixture({page:2});f.event('wheel',300,{deltaY:-60});
 assert.equal(f.page,1);assert.equal(f.list.scrollTop,900);
 f.event('wheel',560,{deltaY:60});assert.equal(f.page,1,'immediate reversal cannot bounce between pages');
 f.event('wheel',900,{deltaY:60});assert.equal(f.page,2);assert.equal(f.list.scrollTop,0);
});

test('inward scrolling cancels a pending outward gesture',()=>{
 const f=fixture({position:900});f.event('wheel',300,{deltaY:20});
 f.event('wheel',320,{deltaY:-10});f.event('wheel',340,{deltaY:80});
 assert.deepEqual(f.turns,[]);
 f.event('wheel',600,{deltaY:40});assert.deepEqual(f.turns,[1]);
});

test('line/page wheel units work; zoom and horizontal gestures never paginate',()=>{
 for(const values of [{deltaY:3,deltaMode:1},{deltaY:1,deltaMode:2}]){
  const f=fixture({position:900});f.event('wheel',300,values);assert.equal(f.page,1);
 }
 const f=fixture({position:900});
 for(const values of [{deltaY:100,ctrlKey:true},{deltaY:100,metaKey:true},{deltaY:100,shiftKey:true},{deltaY:100,deltaX:200}]){
  assert.equal(f.event('wheel',300,values).prevented,false);assert.deepEqual(f.turns,[]);
 }
});

test('first, last, empty and short result sets never move past their available pages',()=>{
 for(const options of [{page:0,total:4,delta:-60},{page:3,total:4,position:900,delta:60},{total:0,delta:60},{total:1,height:100,delta:60}]){
  const f=fixture(options);f.event('wheel',500,{deltaY:options.delta});assert.deepEqual(f.turns,[]);
 }
 const f=fixture({page:1,total:2,height:100});
 f.event('wheel',500,{deltaY:60});assert.equal(f.page,1);
 f.event('wheel',800,{deltaY:-60});assert.equal(f.page,0);
});

test('replacing filter results disarms an unfinished wheel gesture',()=>{
 const f=fixture({page:1});f.event('wheel',300,{deltaY:-20});
 f.replace(1,4,310);f.event('wheel',320,{deltaY:-80});assert.deepEqual(f.turns,[]);
 f.event('wheel',650,{deltaY:-80});assert.deepEqual(f.turns,[0]);
});

test('a touch that merely reaches the bottom does not paginate; the next swipe turns on release',()=>{
 const f=fixture({position:700});f.touch('touchstart',100,100,400);
 f.scroll(900,130);f.touch('touchmove',150,100,200);f.touch('touchend',180);
 assert.deepEqual(f.turns,[]);
 f.touch('touchstart',300,100,400);
 assert.equal(f.touch('touchmove',350,100,330).prevented,true);
 assert.equal(f.attributes.get('data-page-pull'),'1');assert.deepEqual(f.turns,[]);
 f.touch('touchend',400);assert.deepEqual(f.turns,[1]);assert.equal(f.list.scrollTop,0);
 assert.equal(f.attributes.has('data-page-pull'),false);
});

test('short, horizontal, reversed, cancelled and multitouch swipes do not turn pages',()=>{
 for(const kind of ['short','horizontal','reverse','cancel','multitouch']){
  const f=fixture({position:900});f.touch('touchstart',100,100,400);
  if(kind==='short')f.touch('touchmove',150,100,370);
  else if(kind==='horizontal')f.touch('touchmove',150,250,330);
  else {
   f.touch('touchmove',150,100,330);assert.equal(f.attributes.get('data-page-pull'),'1');
   if(kind==='reverse')f.touch('touchmove',170,100,410);
   if(kind==='cancel')f.touch('touchcancel',170);
   if(kind==='multitouch')f.event('touchmove',170,{touches:[f.point(100,330),f.point(200,330)]});
  }
  f.touch('touchend',200);assert.deepEqual(f.turns,[],kind);assert.equal(f.attributes.has('data-page-pull'),false);
 }
 const f=fixture({page:1});f.touch('touchstart',100,100,200);f.touch('touchmove',150,100,270);f.touch('touchend',200);
 assert.equal(f.page,0);assert.equal(f.list.scrollTop,900);
});

test('Home/End reveal the edge; a separate key press turns while held-key repeats cannot',()=>{
 const f=fixture();f.event('keydown',100,{key:'End'});assert.equal(f.list.scrollTop,900);assert.deepEqual(f.turns,[]);
 f.event('keydown',200,{key:'PageDown',repeat:true});assert.deepEqual(f.turns,[]);
 f.event('keydown',300,{key:'PageDown'});assert.equal(f.page,1);assert.equal(f.list.scrollTop,0);
 f.event('keydown',900,{key:'ArrowUp',repeat:true});assert.equal(f.page,1);
 f.event('keydown',1000,{key:'ArrowUp'});assert.equal(f.page,0);assert.equal(f.list.scrollTop,900);
});

test('an explicit click on a partly visible edge hint works without requiring the exact boundary',()=>{
 const f=fixture({position:870});const hint={owner:f.list,dataset:{pageStep:'1'}};
 const target={closest:()=>hint};f.event('click',100,{target});assert.equal(f.page,1);
 f.event('click',200,{target});assert.equal(f.page,1,'duplicate activations cannot skip a page');
});

test('edge prompts name only available pages and event handlers can be detached',()=>{
 assert.deepEqual(edgeMarkup(0,0),{top:'',bottom:''});
 const first=edgeMarkup(0,3),last=edgeMarkup(2,3);
 assert.match(first.top,/已到第一页/);assert.doesNotMatch(first.top,/data-page-step/);
 assert.match(first.bottom,/再向下滚动，查看第 2 页/);
 assert.match(last.top,/再向上滚动，查看第 2 页/);
 assert.match(last.bottom,/已到最后一页/);assert.doesNotMatch(last.bottom,/data-page-step/);
 const f=fixture();f.controller.destroy();assert.equal(f.handlers.size,0);
});
