/* Keep task navigation in browser history; snapshots contain UI state, never quest data. */
(() => {
 'use strict';
 const KEY='wowQuestNavigation',questRoute=/^#[a-z]+\/\d+$/;
 function create({history,location}){
  function read(){
   const saved=history.state?.[KEY];
   return saved?.schema===1&&saved.route===location.hash&&Number.isSafeInteger(saved.index)&&saved.index>=0?saved:{schema:1,index:0,route:location.hash,quest:null,back:null,view:null};
  }
  let entry=read();
  function write(push=false){history[push?'pushState':'replaceState']({...(!push?history.state:{}),[KEY]:entry},'',entry.route);}
  function save(view){if(location.hash!==entry.route)return;entry={...entry,view};write();}
  function showQuest(route,title,{push=true}={}){
   if(!questRoute.test(route))return;
   const same=entry.quest?.route===route;
   const append=push&&entry.route!==route&&Boolean(entry.quest||/\/(npc|object)\//.test(entry.route));
   const index=entry.index+(append?1:0);
   entry={schema:1,index,route,quest:{route,title,index},back:append&&!same?entry.quest:entry.back,view:append?null:entry.view};
   write(append);
  }
  function showActor(route){
   if(route===entry.route)return;
   entry={...entry,index:entry.index+1,route};write(true);
  }
  function previous(){
   const back=entry.back;
   return back&&questRoute.test(back.route)&&Number.isSafeInteger(back.index)&&back.index>=0&&back.index<entry.index?back:null;
  }
  function goBack(){const back=previous();if(!back)return false;history.go(back.index-entry.index);return true;}
  return {current:()=>entry,save,showQuest,showActor,previous,goBack,adopt:()=>{entry=read();return entry;}};
 }
 (typeof window==='undefined'?globalThis:window).QuestNavigation=Object.freeze({create});
})();
