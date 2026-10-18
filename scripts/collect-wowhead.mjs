// Explicit online acquisition. Normal builds use the reviewed local snapshot.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {versions,locales,editions,sha,pageUrl,tooltipUrl,parseQuest,questAnchor,parseItemTooltip,itemAnchor,selectItemEffects,realLocale} from './wowhead-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cache=path.join(root,'.cache/wowhead/captures');
await fs.mkdir(cache,{recursive:true});await fs.mkdir(path.join(root,'sources/wowhead'),{recursive:true});
const requests=[],targets={},errors=[],blocked=new Set(process.argv.includes('--items-only')?['www.wowhead.com']:[]);let count=0;
async function get(url){
 const key=sha(url),file=path.join(cache,key+'.json');let record;
 try{record=JSON.parse(await fs.readFile(file,'utf8'));if(record.url!==url||sha(record.body)!==record.sha256)throw Error('Cached capture mismatch');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!record){
  if(blocked.has(new URL(url).hostname)||process.argv.includes('--cached-only'))return null;
  let response;try{response=await fetch(url,{signal:AbortSignal.timeout(45000)});}catch(error){errors.push({url,reason:error.name});console.log('Request failed; leaving missing:',url);return null;}
  if([401,403,429].includes(response.status)){blocked.add(new URL(url).hostname);errors.push({url,status:response.status,reason:'access-limit'});console.log(`Source access/rate limit ${response.status}; stopping host ${new URL(url).hostname}`);return null;}
  const body=await response.text();record={url,status:response.status,finalUrl:response.url,capturedAt:new Date().toISOString(),sha256:sha(body),bytes:Buffer.byteLength(body),body};
  if(![200,404,410].includes(response.status))throw Error(`Unexpected HTTP ${response.status} ${url}`);
  await fs.writeFile(file,JSON.stringify(record)+'\n');await new Promise(resolve=>setTimeout(resolve,300));
 }
 const {body,...meta}=record;requests.push(meta);if(++count%50===0)console.log('Captured/reused',count,'responses');return record.status===200?{...meta,body}:null;
}
async function shards(files){const rows=[];for(const f of files)rows.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse));return rows;}
async function pool(rows,fn){let at=0;await Promise.all(Array.from({length:2},async()=>{while(at<rows.length){const row=rows[at++];await fn(row);}}));}
for(const version of versions){
 const m=JSON.parse(await fs.readFile(path.join(root,'data',version,'manifest.json'),'utf8')),all=await shards(m.files),quests=all.filter(q=>!q.tags.some(t=>['suspected-test','community-custom'].includes(t))&&!/(?:\b(?:task|tracking|placeholder|zzold|reuse|test|DNT|NYI)\b)/i.test(q.english.title));
 const candidates=quests.filter(q=>(!q.text.description&&q.english.objectives)||(!q.text.completion&&q.english.description&&q.english.objectives&&q.enders.length&&(version!=='legion'||q.id>=38600)));
 const im=JSON.parse(await fs.readFile(path.join(root,'data/items',version+'-manifest.json'),'utf8')),items=await shards(im.files),used=new Set(quests.flatMap(q=>[...q.rewards.items,...q.rewards.choices,...(q.rewards.package?.items||[])].map(i=>i.id)));
 const itemCandidates=items.filter(i=>used.has(i.id)&&i.templatePresent&&i.effects.some(e=>!e.text||e.unresolved));
 targets[version]={quests:candidates.map(q=>q.id),items:itemCandidates.map(i=>i.id)};
 console.log(version,candidates.length,'quests;',itemCandidates.length,'items');
 await pool(candidates,async q=>{
  const missing=['description','progress','completion'].filter(f=>!q.text[f]),found=new Set();let anchored=false;
  for(const locale of Object.keys(locales)){
   const response=await get(pageUrl(version,'quest',q.id,locale)),page=response&&parseQuest(response.body,q.id);if(!page)continue;
   anchored||=Boolean(questAnchor(q,page,locale));for(const field of missing)if(realLocale(page[field],locale))found.add(field);
   if(anchored&&missing.every(f=>found.has(f)))break;
  }
 });
 await pool(itemCandidates,async item=>{
  let remaining=item.effects.filter(e=>!e.text||e.unresolved).length;
  for(const locale of Object.keys(locales)){
   const response=await get(tooltipUrl(version,item.id,locale));if(!response)continue;
   let tooltip;try{tooltip=parseItemTooltip(JSON.parse(response.body));}catch{continue;}if(!tooltip)continue;
   // Locale variants share item identity. Prefer a name/level/quality match.
   if(itemAnchor(item,tooltip,locale)){remaining-=selectItemEffects(item,tooltip,locale).length;if(remaining<=0||tooltip.effects.every(e=>realLocale(e.text,locale)))break;}
   if(locale==='zhCN'&&tooltip.itemLevel!==item.itemLevel)break;
  }
 });
}
const unique=[...new Map(requests.map(r=>[r.url,r])).values()].sort((a,b)=>a.url.localeCompare(b.url));
await fs.writeFile(path.join(root,'sources/wowhead/manifest.json'),JSON.stringify({schemaVersion:1,capturedAt:new Date().toISOString(),policy:'matching-identity-context-short-quest-fields-and-unscaled-item-effects-v1',blockedHosts:[...blocked],editions,targets,requests:unique,errors},null,2)+'\n');
console.log('Acquisition complete:',unique.length,'responses');
