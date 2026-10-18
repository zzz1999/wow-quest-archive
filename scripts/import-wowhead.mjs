import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {versions,locales,editions,sha,pageUrl,tooltipUrl,parseQuest,questAnchor,parseItemTooltip,itemAnchor,selectItemEffects,realLocale} from './wowhead-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),manifestPath=path.join(root,'sources/wowhead/manifest.json'),lock=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const requests=new Map(lock.requests.map(r=>[r.url,r])),files=[],report={schemaVersion:1,capturedAt:lock.capturedAt,versions:[]};
await fs.mkdir(path.join(root,'data/wowhead'),{recursive:true});
async function capture(url){
 const meta=requests.get(url);if(!meta||meta.status!==200)return null;
 const saved=JSON.parse(await fs.readFile(path.join(root,'.cache/wowhead/captures',sha(url)+'.json'),'utf8'));
 if(saved.url!==url||saved.sha256!==meta.sha256||sha(saved.body)!==meta.sha256)throw Error('Capture differs from locked source: '+url);
 return {...meta,body:saved.body};
}
async function shards(files){const rows=[];for(const f of files)rows.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse));return rows;}
const words=text=>[...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)].filter(s=>s.isWordLike).length;
const source=(response,url=response.url)=>({url,capturedAt:response.capturedAt,responseUrl:response.url,sha256:response.sha256});
for(const version of versions){
 const questManifest=JSON.parse(await fs.readFile(path.join(root,'data',version,'manifest.json'),'utf8')),itemManifest=JSON.parse(await fs.readFile(path.join(root,'data/items',version+'-manifest.json'),'utf8'));
 const quests=new Map((await shards(questManifest.files)).map(q=>[q.id,q])),items=new Map((await shards(itemManifest.files)).map(i=>[i.id,i]));
 const data={schemaVersion:1,version,edition:editions[version].label,quests:{},items:{}};
 const stats={version,questCandidates:lock.targets[version].quests.length,itemCandidates:lock.targets[version].items.length,questsFetched:0,itemsFetched:0,questFields:0,itemEffects:0,quests:[],items:[],skipped:[]};
 for(const id of lock.targets[version].quests){
  const q=quests.get(id),pages=[];for(const locale of Object.keys(locales)){const response=await capture(pageUrl(version,'quest',id,locale)),page=response&&parseQuest(response.body,id);if(page)pages.push({locale,response,page});}
  if(pages.length)stats.questsFetched++;
  const matched=pages.map(p=>({...p,anchor:questAnchor(q,p.page,p.locale)})).find(p=>p.anchor);
  if(!matched){stats.skipped.push({kind:'quest',id,reason:pages.length?'context-mismatch':'no-page'});continue;}
  const fields={};let used=0;
  for(const field of ['description','completion','progress']){
   if(q.text[field])continue;
   // One complete short field, never a truncated passage presented as original.
   for(const p of pages){
    if(!realLocale(p.page[field],p.locale))continue;
    // All language pages must independently identify the same quest title;
    // a translated title may differ, so compare existing fields when possible.
    const english=p.locale==='enUS',knownTitle=english?q.english.title:q.textLocales.title===p.locale?q.text.title:null;
    if(knownTitle&&p.page.title!==knownTitle&&!(questAnchor(q,p.page,p.locale)))continue;
    const count=words(p.page[field]);
    if(used+count>25){stats.skipped.push({kind:'quest-field',id,field,locale:p.locale,reason:'long-passage'});continue;}
    fields[field]={text:p.page[field],locale:p.locale,source:source(p.response),anchor:{...matched.anchor,source:source(matched.response)}};used+=count;break;
   }
  }
  if(Object.keys(fields).length){data.quests[id]={edition:data.edition,fields};stats.questFields+=Object.keys(fields).length;stats.quests.push(id);}
  else stats.skipped.push({kind:'quest',id,reason:'no-eligible-missing-field'});
 }
 for(const id of lock.targets[version].items){
  const item=items.get(id),effects=[],pages=[];
  for(const locale of Object.keys(locales)){
   const response=await capture(tooltipUrl(version,id,locale));if(!response)continue;let page;try{page=parseItemTooltip(JSON.parse(response.body));}catch{continue;}if(page)pages.push({locale,response,page,anchor:itemAnchor(item,page,locale)});
  }
  if(pages.length)stats.itemsFetched++;
  // A localized name may have been revised. A matching English name still
  // identifies this item; require identical level/quality and spell bindings
  // in each selected localized response, and retain the separate anchor URL.
  const matched=pages.find(p=>p.anchor);
  if(matched)for(const p of pages){
   if(p.page.itemLevel!==item.itemLevel||p.page.quality!==item.quality)continue;
   const proof=p.anchor?p:matched;
   for(const e of selectItemEffects(item,p.page,p.locale))if(!effects.some(x=>x.id===e.id&&x.trigger===e.trigger))effects.push({...e,source:source(p.response,pageUrl(version,'item',id,p.locale)),sourceItem:{name:p.page.name,quality:p.page.quality,itemLevel:p.page.itemLevel},anchor:{...proof.anchor,source:source(proof.response,pageUrl(version,'item',id,proof.locale))}});
  }
  if(effects.length){data.items[id]={edition:data.edition,effects};stats.itemEffects+=effects.length;stats.items.push(id);}
  else stats.skipped.push({kind:'item',id,reason:'no-matching-unscaled-effect'});
 }
 const relative=`data/wowhead/${version}.json`,content=JSON.stringify(data,null,2)+'\n';await fs.writeFile(path.join(root,relative),content);files.push({version,path:relative,bytes:Buffer.byteLength(content),sha256:sha(content)});report.versions.push(stats);
 console.log(version,stats.quests.length,'quests /',stats.questFields,'fields;',stats.items.length,'items /',stats.itemEffects,'effects');
}
lock.files=files;await fs.writeFile(manifestPath,JSON.stringify(lock,null,2)+'\n');await fs.writeFile(path.join(root,'reports/wowhead-audit.json'),JSON.stringify(report,null,2)+'\n');
