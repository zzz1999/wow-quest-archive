/* Local script bundles keep NPC archives available offline without a server. */
'use strict';
window.createActorBrowser = ({catalog, getVersion, getQuests, questTitle, onQuest, onSelect, onClose, escape, badge, download}) => {
 const $=id=>document.getElementById(id), dialog=$('actor-dialog'), PAGE=40;
 const cache=new Map(), loading=new Map();
 let generation=0, restoreOnClose=true;
 let state={version:null, rows:[], filtered:[], selected:null, page:0};
 window.QUEST_ACTOR_PACKS={};
 const title=a=>a.name||`未命名${a.kind==='creature'?' NPC':'物件'} #${a.id}`;
 const searchText=a=>[a.id,a.name,a.subname,a.english.name,a.english.subname].join('\n').toLocaleLowerCase();

 function load(version){
  if(cache.has(version))return Promise.resolve(cache.get(version));
  if(loading.has(version))return loading.get(version);
  const promise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=`web/actors/${version}.js`;
   script.onload=async()=>{try{
    if(typeof DecompressionStream==='undefined')throw new Error('请使用较新版本的 Chrome、Edge、Firefox 或 Safari。');
    const encoded=window.QUEST_ACTOR_PACKS[version];if(!encoded)throw new Error('NPC 资料文件不完整，请重新下载整个项目。');
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const rows=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    const prepared=rows.map(record=>({record,search:searchText(record)}));
    cache.set(version,prepared);delete window.QUEST_ACTOR_PACKS[version];resolve(prepared);
   }catch(error){reject(error);}finally{script.remove();}};
   script.onerror=()=>{script.remove();reject(new Error(location.protocol==='file:'?'无法读取 NPC 资料，请解压整个项目后再打开 index.html。':'无法下载 NPC 资料，请检查网络后重试。'));};
   document.head.append(script);
  });
  loading.set(version,promise);promise.catch(()=>loading.delete(version));return promise;
 }

 async function open({kind='creature',id,updateHash=true}={}){
  const version=getVersion(), request=++generation, meta=catalog.versions.find(v=>v.id===version);
  state={version,rows:[],filtered:[],selected:null,page:0};
  $('actor-search').disabled=true;$('actor-kind').disabled=true;
  $('actor-search').value='';$('actor-kind').value=kind;
  $('actor-version').textContent=`${meta.name} · ${meta.patch} · ${meta.actors.npcs.toLocaleString()} 个任务关联 NPC`;
  $('actor-detail').innerHTML='<div class="empty"><h2>正在打开档案</h2><p>首次读取这个版本需要片刻。</p></div>';
  renderList();$('actor-count').textContent='正在载入资料…';
  restoreOnClose=true;if(!dialog.open)dialog.showModal();
  try{
   const rows=await load(version);
   if(request!==generation||!dialog.open||getVersion()!==version)return;
   state.rows=rows;$('actor-search').disabled=false;$('actor-kind').disabled=false;filter(false);
   const chosen=id!==undefined?rows.find(x=>x.record.kind===kind&&x.record.id===Number(id))?.record:state.filtered[0];
   if(chosen)select(chosen.id,{updateHash});
   else $('actor-detail').innerHTML='<div class="empty"><h2>快照中没有这份档案</h2><p>只收录与任务接取或交付有关的 NPC 和物件。</p></div>';
  }catch(error){
   if(request!==generation||!dialog.open)return;
   $('actor-count').textContent='读取失败';
   $('actor-detail').innerHTML=`<div class="empty"><h2>NPC 资料读取失败</h2><p>${escape(error.message)}</p><button id="actor-retry">重试</button></div>`;
   $('actor-retry').onclick=()=>open({kind,id,updateHash});
  }
 }

 function filter(selectFirst=true){
  const words=$('actor-search').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),kind=$('actor-kind').value;
  state.filtered=state.rows.filter(x=>x.record.kind===kind&&words.every(w=>x.search.includes(w))).map(x=>x.record);
  state.page=0;renderList();
  if(selectFirst){
   if(state.filtered.length)select(state.filtered[0].id);
   else {state.selected=null;$('actor-detail').innerHTML='<div class="empty"><h2>没有匹配的档案</h2><p>试试其他名称或 ID。</p></div>';}
  }
 }

 function renderList(){
  const pages=Math.max(1,Math.ceil(state.filtered.length/PAGE));state.page=Math.max(0,Math.min(state.page,pages-1));
  $('actor-count').textContent=`${state.filtered.length.toLocaleString()} 份档案`;
  $('actor-page').textContent=`${state.page+1} / ${pages}`;$('actor-prev').disabled=state.page===0;$('actor-next').disabled=state.page+1>=pages;
  $('actor-export-results').disabled=!state.filtered.length;
  $('actor-list').innerHTML=state.filtered.slice(state.page*PAGE,(state.page+1)*PAGE).map(a=>`<button class="quest-row ${a.key===state.selected?.key?'selected':''}" data-actor="${a.id}" aria-pressed="${a.key===state.selected?.key}"><strong>${escape(title(a))}</strong><span class="row-meta"><span>#${a.id}</span><span>${a.starts.length} 接取 · ${a.ends.length} 交付</span>${badge(a.nameLocale)}</span></button>`).join('');
  $('actor-list').scrollTop=0;
 }

 function questLinks(ids,label,quests){
  return `<section class="text-section"><h3 class="section-label">${label} <span class="relation-count">${ids.length}</span></h3>${ids.length?`<div class="actor-quests">${ids.map(id=>{const q=quests.get(id);const tags=q?.tags||[];return `<button data-actor-quest="${id}" ${q?'':'disabled'}><span>${escape(q?questTitle(q):'未命名任务')} <small>#${id}</small></span>${tags.includes('community-custom')?'<small class="relation-warning">社区自定义</small>':tags.includes('suspected-test')?'<small class="relation-warning">疑似测试 / 废弃</small>':''}</button>`;}).join('')}</div>`:'<p class="empty-field">源数据未提供这类关系</p>'}</section>`;
 }

 function select(id,{updateHash=true}={}){
  const actor=state.filtered.find(a=>a.id===Number(id));if(!actor)return;
  state.selected=actor;const previous=state.page;state.page=Math.floor(state.filtered.indexOf(actor)/PAGE);
  if(previous!==state.page)renderList();
  else for(const button of $('actor-list').querySelectorAll('[data-actor]')){const active=Number(button.dataset.actor)===actor.id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
  if(updateHash)onSelect(actor);
  const quests=new Map(getQuests().map(q=>[q.id,q])),meta=catalog.versions.find(v=>v.id===state.version);
  const levels=actor.minLevel===null?'源未提供':actor.minLevel===actor.maxLevel?actor.minLevel:`${actor.minLevel}–${actor.maxLevel??'未知'}`;
  const provenance=['name','subname'].filter(k=>actor.textColumns[k]).map(k=>`${k==='name'?'名称':'称号'}：${escape(actor.textColumns[k])}${actor.textBuilds[k]!==null?' · 采集 build '+escape(actor.textBuilds[k]):''}`).join('<br>');
  $('actor-detail').innerHTML=`<div class="reader-top"><span>${actor.kind==='creature'?'NPC':'OBJECT'} RECORD / ${actor.id}</span><button id="actor-export">导出 JSON ↓</button></div><h2>${escape(title(actor))} ${badge(actor.nameLocale)}</h2><div class="english-title">${escape(actor.english.name!==actor.name?actor.english.name:'')}</div>${actor.subname?`<p class="actor-subname">${escape(actor.subname)} ${badge(actor.subnameLocale)}${actor.english.subname&&actor.english.subname!==actor.subname?`<small>${escape(actor.english.subname)}</small>`:''}</p>`:'<p class="empty-field actor-subname">源未提供独立称号</p>'}<div class="quest-meta"><span>${escape(meta.name)}</span><span>${actor.kind==='creature'?'NPC':'任务物件'} #${actor.id}</span>${actor.kind==='creature'?`<span>模板等级 ${levels}</span>`:''}</div>${!actor.templatePresent?'<div class="notice">关系表引用了这个对象，但快照中缺少对应模板，未补写名称与属性。</div>':''}${Object.keys(actor.textIssues).length?'<div class="notice">上游部分名称含损坏字符，已跳过损坏候选并继续语言回退。</div>':''}${questLinks(actor.starts,'可接取的任务',quests)}${questLinks(actor.ends,'可交付的任务',quests)}<p class="actor-scope">以上来自当前版本的静态接取 / 交付关系。阵营、等级、阶段及脚本可能影响实际接取条件。</p><details><summary>结构化档案与来源字段</summary><pre>${escape(JSON.stringify(actor,null,2))}</pre></details><div class="provenance">来源 <a href="https://github.com/${meta.repo}/tree/${meta.commit}" target="_blank" rel="noreferrer">${escape(meta.repo)} ↗</a><br>${provenance}<br>名称与称号分别按简中、繁中、英文回退；不同版本的同 ID 对象独立保存。</div>`;
  $('actor-detail').scrollTop=0;
  $('actor-export').onclick=()=>download(actor.key.replaceAll(':','-')+'.json',JSON.stringify(actor,null,2),'application/json');
 }

 function close({restoreHash=true}={}){++generation;restoreOnClose=restoreHash;if(dialog.open)dialog.close();}
 $('actor-close').onclick=()=>close();
 dialog.addEventListener('close',()=>{if(dialog.open)return;++generation;if(restoreOnClose)onClose();});
 dialog.addEventListener('cancel',()=>{++generation;restoreOnClose=true;});
 dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}};
 $('actor-list').onclick=e=>{const b=e.target.closest('[data-actor]');if(b)select(b.dataset.actor);};
 $('actor-detail').onclick=e=>{const b=e.target.closest('[data-actor-quest]');if(b&&!b.disabled){close({restoreHash:false});onQuest(Number(b.dataset.actorQuest));}};
 $('actor-search').oninput=()=>filter();$('actor-kind').onchange=()=>filter();
 $('actor-prev').onclick=()=>{state.page--;renderList();};$('actor-next').onclick=()=>{state.page++;renderList();};
 $('actor-export-results').onclick=()=>download(`${state.version}-${$('actor-kind').value}-${state.filtered.length}.jsonl`,state.filtered.map(a=>JSON.stringify(a)).join('\n')+'\n','application/x-ndjson');
 return {open,close,isOpen:()=>dialog.open};
};
