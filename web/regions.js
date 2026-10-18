/* Versioned, local region names; signed values remain the filter identity. */
(() => {
 'use strict';
 const data=globalThis.QuestRegionData;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={zhCN:'简中',zhTW:'繁中',enUS:'英文'};
 function lookup(version,value){return data.versions[version]?.[value]||null;}
 function name(version,value){return value===0?'未分类':lookup(version,value)?.name||(value<0?'未收录分类 #':'未收录区域 #')+Math.abs(value);}
 function searchText(version,value){const row=lookup(version,value);return [name(version,value),row?.english||''].join('\n');}
 function options(version,values){
  const unique=[...new Set(values)],group=(title,list)=>list.length?`<optgroup label="${title}">${list.sort((a,b)=>a-b).map(value=>{
   const row=lookup(version,value),suffix=row?.nameLocale&&row.nameLocale!=='zhCN'?` · ${labels[row.nameLocale]}`:'';
   return `<option value="${value}" title="${escape(name(version,value))} · ${value<0?'任务分类':'区域'} #${Math.abs(value)}">${escape(name(version,value)+suffix)}${row?.name?` · #${Math.abs(value)}`:''}</option>`;
  }).join('')}</optgroup>`:'';
  return '<option value="">全部区域 / 分类</option>'+group('区域',unique.filter(v=>v>0))+group('任务分类',unique.filter(v=>v<0))+(unique.includes(0)?'<option value="0">未分类</option>':'');
 }
 function metadata(version,value,source=false){
  const row=lookup(version,value),kind=value===0?'区域 / 分类':value<0?'任务分类':'区域';
  const badge=row?.nameLocale&&row.nameLocale!=='zhCN'?` <span class="locale-badge ${row.nameLocale}">${labels[row.nameLocale]}</span>`:'';
  return `<span>${kind} <b>${escape(name(version,value))}</b>${badge}${source?` <small>原始编号 ${value}</small>`:''}</span>`;
 }
 function provenance(version,value){
  const row=lookup(version,value),source=data.sources[row?.nameSource?.asset];
  if(!source)return value===0?'':'<p class="provenance">区域 / 分类名称暂未收录，保留原始编号。</p>';
  const supplemental=['id-and-source-name','id-and-core-enum'].includes(row.match?.rule)||version==='classic'&&value<0;
  return `<p class="provenance">区域 / 分类名称：${escape(name(version,value))} · ${labels[row.nameLocale]} · <a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.table)} ${escape(source.build)} ↗</a>${supplemental?' · 补充名称（匹配依据见 data/regions/）':''}</p>`;
 }
 globalThis.QuestRegions={lookup,name,searchText,options,metadata,provenance};
})();
