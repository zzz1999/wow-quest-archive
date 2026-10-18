/* Version-aware interpretation only. Source records and exported JSON stay untouched. */
(() => {
 'use strict';
 const data=()=>globalThis.QuestTraitData,cache=new WeakMap();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function integer(value){
  if(typeof value==='number'&&!Number.isSafeInteger(value))return null;
  if(!['number','string','bigint'].includes(typeof value)||! /^-?\d+$/.test(String(value)))return null;
  return BigInt(value);
 }
 const has=(value,flag)=>value!==null&&value>=0n&&flag>0&&(value&BigInt(flag))!==0n;
 function allowed(value,entries,zeroUnrestricted=true){
  const mask=integer(value);
  if(mask===null||mask< -1n)return {known:false,restricted:false,ids:[],names:[]};
  const selected=mask===-1n||(mask===0n&&zeroUnrestricted)?entries:entries.filter(e=>has(mask,2**(e.id-1)));
  return {known:selected.length>0,restricted:selected.length>0&&selected.length<entries.length,ids:selected.map(e=>e.id),names:selected.map(e=>e.name)};
 }
 function repetition(r,rules){
  const flags=integer(r.flags),special=integer(r.specialFlags),extra=integer(r.sourceFields?.flagsex??0);
  const result=(kind,label,repeatable,note)=>({kind,label,repeatable,note});
  if(r.version==='legion'){
   if(data().worldQuestTypes.includes(r.type))return result('world','世界任务 · 随刷新开放',true,'依据 7.3.5 QuestInfo 任务类型。再次开放取决于世界任务刷新，不等于每天固定可接。');
   if(data().emissaryTypes.includes(r.type))return result('emissary','使者任务 · 随刷新开放',true,'依据 7.3.5 QuestInfo 使者任务类型；开放和重置时间由活动轮换决定。');
  }
  if(has(flags,rules.weeklyFlag))return result('weekly','可重复 · 每周',true,'任务含每周重置标记。');
  if(has(flags,rules.dailyFlag))return result('daily','可重复 · 每日',true,'任务含每日重置标记。');
  if(has(special,rules.monthlySpecialFlag))return result('monthly','可重复 · 每月',true,'任务含该版本的每月重置标记。');
  if(has(special,rules.repeatSpecialFlag))return result('repeatable','可重复',true,'任务含可重复标记；未指定每日、每周或每月周期，仍可能有其他接取条件。');
  if(rules.seasonalSorts.includes(-r.zoneOrSort))return result('seasonal','活动任务 · 重复性待确认',null,'该版本核心将此分类作为节日或活动任务处理，但档案未收录完整事件重置关系，不能判为永久一次性或任意重复。');
  if(flags===null||special===null||flags<0n||special<0n||r.version==='legion'&&(r.sourceFields?.questtype===3||has(extra,0x8000)||has(extra,0x1000000)))return result('unknown','重复性待确认',null,'当前记录缺少明确的重复规则，或仅有任务 / 日常显示标记；不据此推断实际重置周期。');
  return result('once','非可重复',false,'该版本档案中未标记为重复或周期任务；脚本、后续数据库修订可能影响实际行为。');
 }
 function derive(r){
  const rules=data()?.versions[r.version];
  if(!rules)return {repeat:{kind:'unknown',label:'重复性待确认',repeatable:null,note:'缺少此版本的解释规则。'},faction:{kind:'unknown',label:'阵营待确认',teams:[]},races:{known:false,restricted:false,ids:[],names:[]},classes:{known:false,restricted:false,ids:[],names:[]}};
  const races=allowed(r.raceMask,data().races.filter(e=>rules.races.includes(e.id)),rules.raceZeroUnrestricted),classes=allowed(r.classMask,data().classes.filter(e=>rules.classes.includes(e.id)));
  const teams=[...new Set(data().races.filter(e=>races.ids.includes(e.id)).map(e=>e.team))];
  const kind=!races.known?'unknown':teams.includes('alliance')&&teams.includes('horde')?'both':teams.includes('alliance')?teams.includes('neutral')?'alliance-neutral':'alliance':teams.includes('horde')?teams.includes('neutral')?'horde-neutral':'horde':'neutral';
  const label={unknown:'阵营待确认',both:'联盟 / 部落',alliance:'仅联盟',horde:'仅部落',neutral:'未选阵营', 'alliance-neutral':'联盟 / 未选阵营','horde-neutral':'部落 / 未选阵营'}[kind];
  return {repeat:repetition(r,rules),faction:{kind,label,teams},races,classes};
 }
 function get(r){if(!cache.has(r))cache.set(r,derive(r));return cache.get(r);}
 function matches(t,{repeat='',faction='',race='',playerClass=''}={}){
  if(repeat&&(repeat==='repeatable'?t.repeat.repeatable!==true:repeat==='unknown'?t.repeat.repeatable!==null:t.repeat.kind!==repeat))return false;
  if(faction){
   if(['alliance','horde','neutral'].includes(faction)){if(!t.faction.teams.includes(faction))return false;}
   else if(faction==='alliance-only'||faction==='horde-only'){if(t.faction.kind!==faction.replace('-only',''))return false;}
   else if(t.faction.kind!==faction)return false;
  }
  if(race&&!t.races.ids.includes(Number(race)))return false;
  if(playerClass&&(playerClass==='restricted'?!t.classes.restricted:playerClass==='unrestricted'?!t.classes.known||t.classes.restricted:!t.classes.ids.includes(Number(playerClass))))return false;
  const team=faction.replace('-only','');
  if(race&&['alliance','horde','neutral'].includes(team)&&data().races.find(r=>r.id===Number(race))?.team!==team)return false;
  return true;
 }
 function options(version,kind){
  const entries=data()[kind].filter(e=>data().versions[version][kind].includes(e.id));
  return entries.map(e=>`<option value="${e.id}">${escape(e.name)}</option>`).join('');
 }
 function rowHtml(r){
  const t=get(r),shortLabel={daily:'每日',weekly:'每周',monthly:'每月',world:'世界任务',emissary:'使者任务',seasonal:'活动 · 待确认'}[t.repeat.kind]||t.repeat.label;
  const repeat=t.repeat.kind==='once'?'':`<span class="row-repeat" title="${escape(t.repeat.label+'：'+t.repeat.note)}">${escape(shortLabel)}</span>`,faction=t.faction.kind==='both'?'':`<span class="trait-faction ${t.faction.kind}" title="依据任务种族限制；其他接取条件另计">${escape(t.faction.label)}</span>`;
  return repeat+faction;
 }
 function html(r){
  const t=get(r),rules=data().versions[r.version],classText=!t.classes.known?'职业待确认':t.classes.restricted?t.classes.names.join('、'):'不限职业',raceText=!t.races.known?'未标注可用种族':t.races.restricted?t.races.names.join('、'):'本版本全部可玩种族';
  return `<div class="quest-traits" aria-label="任务性质与阵营"><span class="trait-pill" title="${escape(t.repeat.note)}">${escape(t.repeat.label)}</span><span class="trait-pill trait-faction ${t.faction.kind}" title="依据任务种族限制">${escape(t.faction.label)}</span>${t.classes.restricted?'<span class="trait-pill">'+escape(classText)+'</span>':''}</div><details class="quest-requirements"><summary>接取条件与重复规则</summary><dl><div><dt>重复规则</dt><dd>${escape(t.repeat.note)}</dd></div><div><dt>阵营要求</dt><dd>${escape(t.faction.label)}（按种族条件）</dd></div><div><dt>种族要求</dt><dd>${escape(raceText)}</dd></div><div><dt>职业要求</dt><dd>${escape(classText)}</dd></div></dl><p>以上按已收录条件筛选；前置任务、声望、NPC 关系及脚本也会影响实际接取。</p><p class="trait-source">解释依据：${rules?`<a href="https://github.com/${escape(rules.source.repo)}/blob/${escape(rules.source.commit)}/${escape(rules.source.path)}" target="_blank" rel="noopener noreferrer">${escape(rules.source.repo)} ↗</a>`:'未收录'} · <a href="docs/QUEST-TRAITS.md" target="_blank" rel="noopener noreferrer">字段与版本说明</a></p></details>`;
 }
 function text(r){const t=get(r);return `重复规则：${t.repeat.label}\n阵营要求：${t.faction.label}（按种族条件）\n种族要求：${t.races.known?t.races.restricted?t.races.names.join('、'):'本版本全部可玩种族':'待确认'}\n职业要求：${t.classes.known?t.classes.restricted?t.classes.names.join('、'):'不限职业':'待确认'}\n说明：${t.repeat.note}\n接取仍受前置任务、声望、NPC 关系及脚本等条件影响。`;}
 globalThis.QuestTraits=Object.freeze({derive,get,matches,options,rowHtml,html,text});
})();
