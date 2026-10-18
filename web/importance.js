/* Editorial highlights are separate from original quest records. */
(() => {
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=()=>globalThis.QuestImportanceData;
 function get(r){const entry=data()?.versions[r.version]?.[r.id];return entry&&entry.englishTitle===r.english?.title?entry:null;}
 function labels(entry){return entry.categories.map(c=>data().categories[c]).filter(Boolean);}
 function badge(r){const entry=get(r);return entry?`<span class="importance-badge" title="${escape(labels(entry).join(' · '))}"><span aria-hidden="true">◆</span> 重要</span>`:'';}
 function sourceLink(source){const url=String(source?.url||'');return /^(?:https:\/\/|docs\/[A-Z-]+\.md(?:#[^\s"<>]*)?$)/.test(url)?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`:escape(source?.label||'档案说明');}
 function html(r){
  const entry=get(r);if(!entry)return '';
  const reasons=[...new Set(entry.reasons.map(x=>x.reason))];
  return `<section class="importance-note" aria-label="重要任务"><div class="importance-heading">${badge(r)}<span>${escape(labels(entry).join(' · '))}</span></div><ul>${reasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul><details><summary>标记依据</summary><p>这是任务档案的重点分类，按当前版本的分类、奖励与核对条目整理。</p><ul>${entry.reasons.map(reason=>`<li>${escape(data().categories[reason.category])} · ${sourceLink(reason.source)}<small>${escape(JSON.stringify(reason.fields))}</small></li>`).join('')}</ul><a href="docs/IMPORTANCE.md" target="_blank" rel="noopener noreferrer">查看收录范围与规则 ↗</a></details></section>`;
 }
 function text(r){const entry=get(r);return entry?`档案重点：${labels(entry).join('、')}\n${[...new Set(entry.reasons.map(x=>x.reason))].join('\n')}\n`:'';}
 globalThis.QuestImportance=Object.freeze({get,badge,html,text});
})();
