/* Saved references are plain text; viewing them never contacts a third party. */
(() => {
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function field(record,name){const fallback=record.wowhead?.fields?.[name];return record.text[name]?{text:record.text[name],locale:record.textLocales[name]}:fallback?{...fallback,edition:record.wowhead.edition}: {text:'',locale:null};}
 function link(source,label='Wowhead 补充 ↗'){
  // Only our fixed source host; untrusted data cannot create an active URL.
  const url=source?.url;if(!/^https:\/\/www\.wowhead\.com\/(?:classic\/|wotlk\/|cata\/|mop-classic\/)?(?:cn\/|tw\/)?(?:quest|item)=\d+$/.test(url||''))return escape(label.replace(' ↗',''));
  return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
 }
 function provenance(value){return value.source?`<div class="wowhead-reference">${link(value.source)} · ${escape(value.edition)} · ${escape(value.source.capturedAt.slice(0,10))} 收录<br>网页补充文本，已保存供离线阅读。</div>`:'';}
 function effect(item,effect){return item?.wowhead?.effects?.find(e=>e.id===effect.id&&e.trigger===effect.trigger);}
 globalThis.QuestWowhead={field,link,provenance,effect};
})();
