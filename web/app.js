/* No CDN, fetch, modules or service worker: works from file:// after extraction. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),cat=window.QUEST_CATALOG;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label={zhCN:'简中',zhTW:'繁中',enUS:'英文'};
 const wowheadPaths={classic:'classic/',wotlk:'wotlk/',cataclysm:'cata/',pandaria:'mop-classic/',legion:''};
 const fieldLabels={title:'标题',objectives:'任务目标',description:'任务描述',progress:'进行中对白',completion:'完成对白',end:'区域提示',completed:'完成日志',giverWindow:'接取角色对白',giverTarget:'接取角色名',turninWindow:'交付角色对白',turninTarget:'交付角色名',objective1:'目标说明 1',objective2:'目标说明 2',objective3:'目标说明 3',objective4:'目标说明 4'};
 let state={version:'classic',rows:[],filtered:[],selected:null,page:0,bookmarks:false},loadGeneration=0,navigateGeneration=0;
 const PAGE=40,cache=new Map(),loading=new Map();window.QUEST_PACKS={};
 const navigation=window.QuestNavigation.create({history,location});
 const filterIds=['search','language','zone','level-min','level-max','story-only','hide-test'];
 let restoringView=false,viewTimer=0;
 history.scrollRestoration='manual';
 let reading;try{reading=window.QuestReading.normalize(JSON.parse(localStorage.getItem('wow-quest-reading-v1')||'null'));}catch{reading=window.QuestReading.normalize(null);}
 let bookmarks;try{bookmarks=new Set(JSON.parse(localStorage.getItem('wow-quest-bookmarks-v1')||'[]'));}catch{bookmarks=new Set();}
 function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2500);}
 function saveBookmarks(){try{localStorage.setItem('wow-quest-bookmarks-v1',JSON.stringify([...bookmarks]));}catch{toast('浏览器未允许本地保存；本次会话仍可使用书签。');}$('bookmark-count').textContent=bookmarks.size;}
 function badge(locale){return locale?`<span class="locale-badge ${locale}">${label[locale]||escape(locale)}</span>`:'';}
 function format(text){return window.QuestReading.format(text,reading);}
 function readingHtml(text){return window.QuestReading.html(text,reading);}
 function originalLayout(text){return String(text||'').replace(/\$[Bb]/g,'\n').replace(/\\n/g,'\n');}
 function questTitle(r){return format(r.text.title||'未命名任务 #'+r.id);}
 function questTitleHtml(r){return readingHtml(r.text.title||'未命名任务 #'+r.id);}
 function wowheadLink(r,type='quest'){
  const path=wowheadPaths[r.version];if(!['quest','npc'].includes(type)||path===undefined||!Number.isSafeInteger(r.id)||r.id<=0||r.tags?.includes('community-custom'))return '';
  const edition=r.version==='legion'?'正式服数据库（含军团再临资料）':cat.versions.find(x=>x.id===r.version).name+'怀旧服数据库';
  return `<a id="${type==='npc'?'actor-wowhead':'wowhead-current'}" href="https://www.wowhead.com/${path}cn/${type}=${r.id}" target="_blank" rel="noopener noreferrer" title="在新标签页查看 Wowhead ${escape(edition)} · 需要联网" aria-label="在 Wowhead 查看${type==='npc'?' NPC':'任务'} #${r.id}（新标签页）">在 Wowhead 查看 ↗</a>`;
 }
 function rememberView(){
  if(restoringView||!state.selected||navigation.current().quest?.route!==`#${state.version}/${state.selected.id}`)return;
  const filters=Object.fromEntries(filterIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
  navigation.save({filters,bookmarks:state.bookmarks,page:state.page,listScroll:$('quest-list').scrollTop,x:scrollX,y:scrollY,details:[...$('reader').querySelectorAll('details')].map(el=>el.open),moreFilters:document.querySelector('.more-filters').open});
 }
 function queueView(){clearTimeout(viewTimer);viewTimer=setTimeout(rememberView,250);}
 function backButton(){const previous=navigation.previous();return `<div class="quest-history"><button id="quest-back" ${previous?'':'disabled'} title="${previous?'返回：'+escape(previous.title):'还没有上一条任务'}">← 返回上一任务</button>${previous?`<span>${escape(previous.title)}</span>`:''}</div>`;}
 function restoreFilters(view){
  if(!view?.filters)return;
  for(const id of filterIds){const el=$(id),value=view.filters[id];if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value??'');}
  state.bookmarks=Boolean(view.bookmarks);$('bookmarks').setAttribute('aria-pressed',state.bookmarks);
  document.querySelector('.more-filters').open=Boolean(view.moreFilters);
 }
 function fieldLabel(field){return reading.mode==='player'?({description:'任务说明',progress:'尚未完成时',completion:'完成任务时',giverWindow:'接取时的对话',turninWindow:'交付时的对话'}[field]||fieldLabels[field]):fieldLabels[field];}
 function questMetadata(r,source=false){return `<div class="quest-meta"><span>任务等级 <b>${r.level===-1?'随角色等级变化':r.level}</b></span><span>需要等级 <b>${r.minLevel}</b></span>${source?`<span>区域 / 分类 <b>${r.zoneOrSort}</b></span><span>类型 <b>${r.type}</b></span>`:''}${r.suggestedPlayers?`<span>建议人数 <b>${r.suggestedPlayers}</b></span>`:source?'<span>建议人数 <b>未指定</b></span>':''}</div>`;}
 function fillReadingForm(value){
  $('reading-form').querySelector(`input[name="reading-mode"][value="${value.mode}"]`).checked=true;
  $('player-name').value=value.name;$('player-race').value=value.race;$('player-class').value=value.className;$('player-gender').value=value.gender;
  $('character-settings').disabled=value.mode==='source';
 }
 function openReading(){fillReadingForm(reading);$('reading-dialog').showModal();}
 function refreshReading(){
  $('reading-open').textContent=reading.mode==='player'?'玩家视角 · 设置':'原文视角 · 设置';
  if(state.selected)selectQuest(state.selected.id,{updateHash:false});
  const byId=new Map(state.filtered.map(r=>[r.id,r]));
  for(const button of $('quest-list').querySelectorAll('[data-id]')){const r=byId.get(Number(button.dataset.id));if(r)button.querySelector('strong').innerHTML=(bookmarks.has(r.key)?'☆ ':'')+questTitleHtml(r);}
 }
 function rowText(r){return [r.id,...Object.values(r.text),...Object.values(r.english),...r.starters.map(x=>x.name),...r.enders.map(x=>x.name),r.zoneOrSort].join('\n').toLocaleLowerCase();}
 function loadVersion(id){
  if(cache.has(id))return Promise.resolve(cache.get(id));if(loading.has(id))return loading.get(id);
  const promise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`web/data/${id}.js?v=${cat.versions.find(v=>v.id===id).bundleHashes?.quests||'1'}`;s.onload=async()=>{try{
    if(typeof DecompressionStream==='undefined')throw new Error('请使用较新版本的 Chrome、Edge、Firefox 或 Safari。');
    const b64=window.QUEST_PACKS[id];if(!b64)throw new Error('数据文件不完整，请下载并解压整个项目。');
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const data=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    const prepared=data.map(r=>({record:r,search:rowText(r)}));cache.set(id,prepared);delete window.QUEST_PACKS[id];resolve(prepared);
   }catch(e){reject(e);}finally{s.remove();}};s.onerror=()=>{s.remove();reject(new Error(location.protocol==='file:'?'无法读取本地数据。请先解压整个文件夹，再打开 index.html。':'无法下载这个版本的数据。请检查网络后重试。'));};document.head.append(s);});
  loading.set(id,promise);promise.catch(()=>loading.delete(id));return promise;
 }
 async function selectVersion(id,questId,{fromHash=false,view=null,resetSearch=false}={}){
  const meta=cat.versions.find(x=>x.id===id);if(!meta)return;
  if(!fromHash)restoringView=false;
  rememberView();
  if(resetSearch)$('search').value='';
  const generation=++loadGeneration;actors.close({restoreHash:false});$('actors-open').disabled=true;state.version=id;state.selected=null;state.rows=[];state.filtered=[];
  document.querySelectorAll('.version-button').forEach(b=>{b.classList.toggle('active',b.dataset.version===id);b.setAttribute('aria-current',b.dataset.version===id?'page':'false');});
  $('version-title').textContent=meta.name;$('version-patch').textContent=meta.patch;$('breadcrumb').textContent=meta.name;$('result-count').textContent='正在载入资料…';$('quest-list').replaceChildren();
  $('reader').innerHTML='<div class="empty"><span>✦</span><h2>正在打开任务档案</h2><p>首次读取这个版本需要片刻。</p></div>';
  try{const prepared=await loadVersion(id);if(generation!==loadGeneration)return;state.rows=prepared;$('actors-open').disabled=false;
   const zones=[...new Set(prepared.map(x=>x.record.zoneOrSort))].sort((a,b)=>a-b);
   $('zone').innerHTML='<option value="">全部区域</option>'+zones.map(z=>`<option value="${z}">${z===0?'未分类':z<0?'任务分类 #'+Math.abs(z):'区域 #'+z}</option>`).join('');
   restoreFilters(view);applyFilters(false);const chosen=questId?prepared.find(x=>x.record.id===Number(questId))?.record:state.filtered.find(r=>r.id===783&&r.textLocales.title==="zhCN")||state.filtered.find(r=>r.text.description&&r.textLocales.description==='zhCN')||state.filtered[0];
   if(chosen)selectQuest(chosen.id,{updateHash:!fromHash});else if(questId)$('reader').innerHTML='<div class="empty"><h2>快照中没有这条任务</h2><p>请在当前版本中选择其他记录。</p></div>';
   else renderEmpty();
  }catch(e){if(generation!==loadGeneration)return;$('reader').innerHTML=`<div class="empty"><h2>资料读取失败</h2><p>${escape(e.message)}</p><button id="retry">重试</button></div>`;$('result-count').textContent='读取失败';$('retry').onclick=()=>selectVersion(id,questId);}
 }
 function applyFilters(select=true){
  const words=$('search').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),language=$('language').value,zone=$('zone').value;
  const min=$('level-min').value,max=$('level-max').value;
  state.filtered=state.rows.filter(({record:r,search})=>(!state.bookmarks||bookmarks.has(r.key))&&(!language||r.textLocales.title===language)&&(!zone||r.zoneOrSort===Number(zone))&&(min===''||r.level>=Number(min))&&(max===''||r.level<=Number(max))&&(!$('story-only').checked||r.text.description.trim())&&(!$('hide-test').checked||!r.tags.some(t=>['suspected-test','community-custom'].includes(t)))&&words.every(w=>search.includes(w))).map(x=>x.record);
  state.page=0;renderList();if(select&&(!state.selected||!state.filtered.some(r=>r.id===state.selected.id))){if(state.filtered.length)selectQuest(state.filtered[0].id);else{state.selected=null;renderEmpty();}}
 }
 function renderList(){
  const max=Math.max(1,Math.ceil(state.filtered.length/PAGE));state.page=Math.max(0,Math.min(state.page,max-1));
  $('result-count').textContent=`${state.filtered.length.toLocaleString()} 条结果`;
  $('page-label').textContent=`${state.page+1} / ${max}`;$('prev-page').disabled=state.page===0;$('next-page').disabled=state.page+1>=max;
  $('quest-list').innerHTML=state.filtered.slice(state.page*PAGE,(state.page+1)*PAGE).map(r=>`<button class="quest-row ${r.id===state.selected?.id?'selected':''}" data-id="${r.id}" aria-pressed="${r.id===state.selected?.id}"><strong>${bookmarks.has(r.key)?'☆ ':''}${questTitleHtml(r)}</strong><span class="row-meta"><span>#${r.id}</span><span>等级 ${r.level===-1?'动态':r.level}</span>${badge(r.textLocales.title)}</span></button>`).join('')||'<div class="empty"><h2>没有匹配任务</h2><p>试试其他关键词，或重置筛选。</p></div>';
  $('quest-list').scrollTop=0;
 }
 function section(r,field,extraClass=''){
  const value=r.text[field],notes=window.QuestReading.notes(value,reading);
  const help=notes.length?`<details class="variable-help"><summary>游戏变量说明（${notes.length}）</summary><p>这些是原文中的游戏标记。缺少上下文或含义尚未核实的内容显示为标签，下方保留原始标记供对照。</p><dl>${notes.map(n=>`<dt><code>${escape(n.token)}</code> · ${escape(n.label)}</dt><dd>${escape(n.note)}</dd>`).join('')}</dl></details>`:'';
  return `<section class="text-section ${extraClass}" data-field="${field}"><h3 class="section-label">${fieldLabel(field)} ${badge(r.textLocales[field])}</h3>${value?`<div class="quest-prose">${readingHtml(value)}</div>${help}`:'<p class="empty-field">暂未收录这段文本</p>'}</section>`;
 }
 function sourceFor(r,id){const meta=cat.versions.find(v=>v.id===r.version);return id===r.version?meta:meta.supplements?.find(s=>s.id===id);}
 function sourceLink(source){return source?`<a href="https://github.com/${escape(source.repo)}/tree/${escape(source.commit)}" target="_blank" rel="noopener noreferrer">${escape(source.repo)} ↗</a>`:'未记录';}
 function textSources(r){
  return `<div class="text-sources"><p>同版本资料按字段补充，优先简中，其次繁中和英文。表中列出本任务实际使用的文字来源。</p><table><thead><tr><th>文字</th><th>语言</th><th>来源</th></tr></thead><tbody>${Object.entries(r.text).filter(([,value])=>value).map(([field])=>`<tr><td>${fieldLabels[field]}</td><td>${badge(r.textLocales[field])}</td><td>${sourceLink(sourceFor(r,r.textSources?.[field]||r.version))}${r.textSources?.[field]&&r.textSources[field]!==r.version?' <small>补充来源</small>':''}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function related(r){
  const links=[],seen=new Set();function add(id,label){if(!id||Math.abs(id)===r.id)return;const key=label+id;if(seen.has(key))return;seen.add(key);const target=state.rows.find(x=>x.record.id===Math.abs(id))?.record;const text=reading.mode==='player'?({'前置字段':'前置任务','后续字段':'后续任务','链后续字段':'任务链后续','奖励后续':'完成后的指引','引导目标':'引导任务','以本任务为前置':'后续关联','指向本任务':'前序关联'}[label]||label):label;links.push(`<button data-related="${Math.abs(id)}" ${target?'':'disabled'}><small>${text}${id<0?(reading.mode==='player'?' · 特殊条件':' · 负值条件'):''}</small>${target?questTitleHtml(target):'快照未收录'} #${id}</button>`);}
  add(r.links.prevQuestId,'前置字段');add(r.links.nextQuestId,'后续字段');add(r.links.nextQuestInChain,'链后续字段');add(r.links.rewardNextQuest,'奖励后续');add(r.links.breadcrumbForQuestId,'引导目标');
  for(const {record:x}of state.rows){if(x.links.prevQuestId===r.id)add(x.id,'以本任务为前置');if(x.links.nextQuestId===r.id||x.links.nextQuestInChain===r.id)add(x.id,'指向本任务');}
  return links.length?`<section class="text-section"><h3 class="section-label">任务关系</h3><div class="related">${links.join('')}</div><p class="empty-field" style="margin-top:10px;font-size:10px">依据数据库字段关联；分支、条件与脚本可能影响实际顺序。</p></section>`:'';
 }
 function entityList(rows){return rows.length?rows.map(x=>`<button class="actor-link" data-actor-kind="${x.kind}" data-actor-id="${x.id}" title="打开${x.kind==='creature'?'NPC':'物件'}档案">${escape(x.name||'未命名')} ↗</button> ${badge(x.nameLocale)}${reading.mode==='source'?` <span>#${x.id} · ${x.kind==='creature'?'NPC':'物件'}</span>`:x.kind==='gameobject'?' <span>任务物件</span>':''}`).join('<br>'):'暂未收录';}
 function renderEmpty(){$('reader').innerHTML='<div class="empty"><span>✦</span><h2>选择一条任务，开始阅读</h2><p>可按关键词、语言与等级筛选。</p></div>';}
 function selectQuest(id,{updateHash=true}={}){
  const r=state.rows.find(x=>x.record.id===Number(id))?.record;if(!r)return;
  if(updateHash){rememberView();navigation.showQuest(`#${state.version}/${r.id}`,questTitle(r));}
  state.selected=r;
  $('reader').dataset.readingMode=reading.mode;
  const previousPage=state.page,position=state.filtered.findIndex(x=>x.id===r.id);if(position>=0)state.page=Math.floor(position/PAGE);
  if(state.page!==previousPage)renderList();
  else for(const button of $('quest-list').querySelectorAll('[data-id]')){
   const selected=Number(button.dataset.id)===r.id;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
   if(selected)button.querySelector('strong').innerHTML=(bookmarks.has(r.key)?'☆ ':'')+questTitleHtml(r);
  }
  const meta=cat.versions.find(x=>x.id===state.version);
  const quality=(r.qualityNotes||[]).map(note=>'<div class="notice">翻译待核：'+escape(note)+'</div>').join('')+(r.tags.includes('community-custom')?'<div class="notice">已核实的社区服务器自定义任务，不应当作暴雪原版任务样本。</div>':'')+(r.tags.includes('source-encoding-issue')?'<div class="notice">上游部分文本含损坏字符，已跳过损坏候选并继续语言回退；详见结构化记录 textIssues。</div>':'');
  $('reader').innerHTML=`${backButton()}<div class="reader-top"><span>${reading.mode==='player'?'任务日志 · #':'QUEST RECORD / '}${r.id}</span><div class="reader-actions">${wowheadLink(r)}<button id="bookmark-current" aria-pressed="${bookmarks.has(r.key)}">${bookmarks.has(r.key)?'★ 已收藏':'☆ 收藏'}</button><button id="copy-current">复制当前文本</button><button id="export-current" title="导出保留游戏变量的原始资料">原始 JSON ↓</button></div></div>
   <h2>${questTitleHtml(r)}</h2>${reading.mode==='source'?`<div class="english-title">${escape(r.english.title&&r.english.title!==r.text.title?r.english.title:'')}</div>`:''}${questMetadata(r,reading.mode==='source')}
   <div class="reading-strip"><span>${reading.mode==='player'?`玩家视角 · ${escape(reading.name||'玩家名称')}`:'原文视角 · 保留游戏变量'}</span><button id="reading-current">阅读设置</button></div>
   ${quality}${r.tags.includes('suspected-test')?'<div class="notice">标题含测试、废弃或占位线索。该标签来自规则筛选，尚未人工核验。</div>':''}${r.locales.includes('enUS')?'<div class="notice">部分字段使用英文回退；每段文本右侧标明实际选用的语言。</div>':''}
   ${section(r,'objectives','objective-box')}${section(r,'description')}<div class="npc-strip"><div>接取任务<b>${entityList(r.starters)}</b></div><div>交付任务<b>${entityList(r.enders)}</b></div></div>${section(r,'progress')}${section(r,'completion')}${related(r)}
   <details><summary>更多任务信息</summary>${['end','completed','giverWindow','giverTarget','turninWindow','turninTarget','objective1','objective2','objective3','objective4'].filter(k=>r.text[k]).map(k=>section(r,k)).join('')}${r.objectiveDetails.map(o=>`<p>${readingHtml(o.description||'目标 #'+o.id)} ${badge(o.locale)}<br><small>类型 ${o.type} · 对象 ${o.objectId} · 数量 ${o.amount}</small></p>`).join('')||'<p>无额外目标记录</p>'}</details>
   <details><summary>英文原文对照</summary>${Object.entries(r.english).filter(([,v])=>v).map(([k,v])=>`<h3>${fieldLabels[k]}</h3><div class="quest-prose">${escape(originalLayout(v))}</div>`).join('')}</details>
   <details id="quest-source"><summary>原始资料 · 字段、奖励与来源</summary>${questMetadata(r,true)}${textSources(r)}<pre>${escape(JSON.stringify(r,null,2))}</pre><div class="provenance">任务基础资料 ${sourceLink(meta)} · ${escape(meta.snapshot)}<br>${escape(meta.note)}<br>玩家视角仅代入已设置的称呼；JSON / JSONL 中的游戏变量与原文保持不变。</div></details>`;
  $('bookmark-current').onclick=()=>{bookmarks.has(r.key)?bookmarks.delete(r.key):bookmarks.add(r.key);saveBookmarks();if(state.bookmarks)applyFilters();else selectQuest(r.id,{updateHash:false});};
  $('reading-current').onclick=openReading;
  $('quest-back').onclick=()=>{rememberView();navigation.goBack();};
  $('copy-current').onclick=()=>copyText(markdown(r),r.key.replace(':','-')+'-'+reading.mode+'.md');$('export-current').onclick=()=>download(r.key.replace(':','-')+'.json',JSON.stringify(r,null,2),'application/json');
  queueView();
 }
 function markdown(r){return `# ${questTitle(r)}\n\n版本：${r.version} | 任务 ID：${r.id}\n阅读视角：${reading.mode==='player'?'玩家视角（称呼已代入）':'原文视角'}\n\n`+Object.entries(r.text).filter(([,v])=>v).map(([k,v])=>`## ${fieldLabel(k)} [${r.textLocales[k]}]\n\n${format(v)}\n\n来源：${sourceFor(r,r.textSources?.[k]||r.version)?.repo||r.source}`).join('\n\n')+'\n';}
 async function copyText(text,filename){try{if(navigator.clipboard){await navigator.clipboard.writeText(text);}else{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();if(!document.execCommand('copy'))throw new Error('copy');t.remove();}toast('已复制当前视角的文本');}catch{download(filename,text,'text/markdown');toast('浏览器限制剪贴板，已导出当前文本');}}
 function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function info(){
  const coverage=cat.versions.map(v=>'<tr><td>'+escape(v.name)+'<br>'+escape(v.patch)+'</td><td>'+v.count.toLocaleString()+'</td><td>'+v.fields.title.zhCN+'</td><td>'+v.fields.title.zhTW+'</td><td>'+v.fields.title.enUS+'</td><td>'+v.fields.description.zhCN+'</td></tr>').join('');
  const sources=cat.versions.map(v=>'<h3>'+escape(v.name)+' · '+escape(v.patch)+'</h3><p>基础资料：'+sourceLink(v)+' · '+escape(v.snapshot)+'<br>'+escape(v.note)+'</p>'+(v.supplements||[]).map(s=>'<p>补充来源：'+sourceLink(s)+' · '+escape(s.snapshot)+'<br>'+escape(s.note)+'</p>').join('')+(v.textAudit?'<p>多源补充累计涉及 '+v.textAudit.changedQuests.toLocaleString()+' 条任务、'+v.textAudit.changedFields.toLocaleString()+' 个文字字段。<a href="'+escape(v.textAudit.report)+'" target="_blank" rel="noopener noreferrer">查看逐字段检查报告 ↗</a></p>':'')).join('');
  $('info-body').innerHTML='<p>按客户端版本分别收录社区数据库的任务快照，并使用同版本的其他来源补充文字。数量按「版本 + ID」统计，不能相加视为独立故事数，也不代表全部任务均可在游戏中接取。</p>'+
   '<p>每个字段依次选用 <b>简体中文 → 繁体中文 → 英文</b>；同语言优先保留原有主库。补充文字必须匹配英文标题与对应英文内容；空字段需要匹配描述或目标作为依据。不会只凭相同数字 ID 跨版本套用文字。</p>'+
   '<p>空白与损坏文本不参与回退，中文表中的英文占位不计作中文。暂时没有可匹配来源的内容保留为空；部分自动任务、测试任务或可选对白本身也可能没有文本。译文仍可能存在社区修订或错误，不由 AI 补写。</p>'+
   '<table><thead><tr><th>版本</th><th>任务</th><th>简中标题</th><th>繁中标题</th><th>英文标题</th><th>简中描述</th></tr></thead><tbody>'+coverage+'</tbody></table>'+
   '<p>任务详情的“原始资料”可按字段查看实际来源。完整语言与缺失统计见 reports/coverage.json；补充前后统计、匹配依据见下方检查报告。测试及已确认的自定义记录默认隐藏，仍保存在原始数据中。</p>'+sources+
   '<h3>研究与 AI 使用</h3><p>JSONL 位于 data/版本/。导出保留游戏变量、实际语言、版本差异与字段来源，研究者的分析标签应与原文分开。阅读设置和书签只保存于当前浏览器。详细限制和复现方法见 README、docs/ 与 sources/。</p>'+
   '<p>网页和工具代码采用 MIT；社区资料遵循各自上游许可与署名。魔兽世界文本、商标及相关内容归 Blizzard Entertainment 或相应权利人所有。代码许可不等于游戏原文或模型训练的授权。</p>';
  $('info-dialog').showModal();
 }
 const actors=window.createActorBrowser({catalog:cat,getVersion:()=>state.version,getQuests:()=>state.rows.map(x=>x.record),questTitleHtml,wowheadLink,escape,badge,download,
  onQuest:id=>{selectQuest(id);$('reader').scrollIntoView({behavior:'smooth',block:'start'});},
  onSelect:actor=>{rememberView();navigation.showActor(`#${actor.version}/${actor.kind==='creature'?'npc':'object'}/${actor.id}`);},
  onClose:()=>{if(/^#[^/]+\/(npc|object)\//.test(location.hash)&&state.selected){navigation.showQuest(`#${state.version}/${state.selected.id}`,questTitle(state.selected),{push:false});rememberView();}}
 });
 $('actors-open').onclick=()=>actors.open();
 $('reading-open').onclick=openReading;
 $('reading-close').onclick=$('reading-cancel').onclick=()=>$('reading-dialog').close();
 $('reading-reset').onclick=()=>fillReadingForm(window.QuestReading.normalize(null));
 $('reading-form').onchange=()=>{$('character-settings').disabled=$('reading-form').querySelector('input[name="reading-mode"]:checked').value==='source';};
 $('reading-form').onsubmit=e=>{
  e.preventDefault();reading=window.QuestReading.normalize({mode:$('reading-form').querySelector('input[name="reading-mode"]:checked').value,name:$('player-name').value,race:$('player-race').value,className:$('player-class').value,gender:$('player-gender').value});
  let saved=true;try{localStorage.setItem('wow-quest-reading-v1',JSON.stringify(reading));}catch{saved=false;}
  $('reading-dialog').close();refreshReading();toast(saved?'已应用阅读设置':'已应用；浏览器限制保存，本次会话仍可使用');
 };
 refreshReading();
 $('versions').innerHTML=cat.versions.map((v,i)=>`<button class="version-button" data-version="${v.id}"><span class="version-icon" aria-hidden="true">${['✦','❅','♜','◈','☾'][i]}</span><span><b>${v.name}</b><small>${v.patch} · ${v.count.toLocaleString()} 条</small></span></button>`).join('');
 $('total-count').textContent=cat.versions.reduce((s,v)=>s+v.count,0).toLocaleString();saveBookmarks();
 $('versions').onclick=e=>{const b=e.target.closest('[data-version]');if(b){++navigateGeneration;selectVersion(b.dataset.version,undefined,{resetSearch:true});}};
 $('quest-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b){selectQuest(b.dataset.id);if(innerWidth<650)$('reader').scrollIntoView({behavior:'smooth'});}};
 $('reader').onclick=e=>{const actor=e.target.closest('[data-actor-id]');if(actor){actors.open({kind:actor.dataset.actorKind,id:Number(actor.dataset.actorId)});return;}const b=e.target.closest('[data-related]');if(b&&!b.disabled){selectQuest(b.dataset.related);$('reader').scrollIntoView({behavior:'smooth',block:'start'});}};
 let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(applyFilters,140);};
 for(const id of ['language','zone','level-min','level-max','story-only','hide-test'])$(id).onchange=applyFilters;
 $('reset').onclick=()=>{for(const id of ['search','language','zone','level-min','level-max'])$(id).value='';$('story-only').checked=false;$('hide-test').checked=true;applyFilters();};
 $('prev-page').onclick=()=>{state.page--;renderList();queueView();};$('next-page').onclick=()=>{state.page++;renderList();queueView();};
 $('bookmarks').onclick=()=>{state.bookmarks=!state.bookmarks;$('bookmarks').setAttribute('aria-pressed',state.bookmarks);applyFilters();};
 $('export-results').onclick=()=>{if(!state.filtered.length){toast('当前筛选没有可导出的任务');return;}download(`${state.version}-quests-${state.filtered.length}.jsonl`,state.filtered.map(r=>JSON.stringify(r)).join('\n')+'\n','application/x-ndjson');toast(`已导出 ${state.filtered.length} 条任务`);};
 $('about').onclick=$('source-open').onclick=info;$('close-dialog').onclick=()=>$('info-dialog').close();
 $('info-dialog').onclick=e=>{if(e.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info-dialog').close();}};
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('reading-dialog').open&&!$('info-dialog').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$(actors.isOpen()?'actor-search':'search').focus();}});
 async function navigate(){
  clearTimeout(searchTimer);clearTimeout(viewTimer);restoringView=true;
  const entry=navigation.adopt(),view=entry.view;
  const request=++navigateGeneration,[v,id,actorId]=location.hash.slice(1).split('/'),actorRoute=['npc','object'].includes(id);
  const version=cat.versions.some(x=>x.id===v)?v:cat.versions[0].id;
  if(!actorRoute)actors.close({restoreHash:false});
  const questId=actorRoute?entry.quest?.route.split('/')[1]:id;
  if(version!==state.version||!state.rows.length)await selectVersion(version,questId,{fromHash:true,view});
  else {restoreFilters(view);if(view)applyFilters(false);if(questId)selectQuest(questId,{updateHash:false});}
  if(request!==navigateGeneration)return;
  if(version!==state.version||!state.rows.length){restoringView=false;return;}
  if(!actorRoute&&state.selected){navigation.showQuest(`#${state.version}/${state.selected.id}`,questTitle(state.selected),{push:false});selectQuest(state.selected.id,{updateHash:false});}
  if(view){state.page=view.page||0;renderList();[...$('reader').querySelectorAll('details')].forEach((el,i)=>el.open=Boolean(view.details?.[i]));}
  requestAnimationFrame(()=>{if(request!==navigateGeneration)return;if(view){$('quest-list').scrollTop=view.listScroll||0;window.scrollTo({left:view.x||0,top:view.y||0,behavior:'instant'});}restoringView=false;rememberView();});
  if(actorRoute)await actors.open({kind:id==='npc'?'creature':'gameobject',id:Number(actorId),updateHash:false});
 }
 addEventListener('scroll',queueView,{passive:true});$('quest-list').addEventListener('scroll',queueView,{passive:true});
 document.addEventListener('change',queueView);document.addEventListener('toggle',queueView,true);addEventListener('pagehide',rememberView);
 addEventListener('popstate',navigate);navigate();
})();
