import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {versions,editions,locales,sha,pageUrl,tooltipUrl,comparable,selectItemEffects} from './wowhead-data.mjs';
export async function validateWowhead(root){
 const lock=JSON.parse(await fs.readFile(path.join(root,'sources/wowhead/manifest.json'),'utf8')),audit=JSON.parse(await fs.readFile(path.join(root,'reports/wowhead-audit.json'),'utf8'));
 assert.deepEqual(lock.editions,editions);const requests=new Map(lock.requests.map(r=>[r.url,r]));assert.equal(requests.size,lock.requests.length);
 for(const r of requests.values()){assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.ok([200,404,410].includes(r.status));assert.ok(r.bytes>0);assert.ok(Number.isFinite(Date.parse(r.capturedAt)));assert.match(r.url,/^https:\/\/(?:www|nether)\.wowhead\.com\//);}
 const source=s=>{const response=requests.get(s.responseUrl);assert.ok(response);assert.equal(response.status,200);assert.equal(s.sha256,response.sha256);assert.equal(s.capturedAt,response.capturedAt);};
 async function records(files){const map=new Map();for(const f of files)for(const line of (await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n')){const r=JSON.parse(line);map.set(r.id,r);}return map;}
 for(const version of versions){
  const file=lock.files.find(f=>f.version===version);assert.equal(file.path,`data/wowhead/${version}.json`);const content=await fs.readFile(path.join(root,file.path));assert.equal(sha(content),file.sha256);assert.equal(content.length,file.bytes);
  const data=JSON.parse(content);assert.equal(data.version,version);assert.equal(data.edition,editions[version].label);
  const qm=JSON.parse(await fs.readFile(path.join(root,'data',version,'manifest.json'),'utf8')),im=JSON.parse(await fs.readFile(path.join(root,'data/items',version+'-manifest.json'),'utf8')),quests=await records(qm.files),items=await records(im.files);
  let fieldCount=0,effectCount=0;
  for(const [id,reference]of Object.entries(data.quests)){
   const q=quests.get(Number(id));assert.ok(q);assert.equal(reference.edition,data.edition);assert.ok(!q.tags.some(t=>['suspected-test','community-custom'].includes(t)));
   let wordCount=0;
   for(const [field,value]of Object.entries(reference.fields)){
    assert.ok(['description','progress','completion'].includes(field));assert.ok(!q.text[field]);assert.ok(value.text.trim());assert.ok(locales[value.locale]);assert.ok(!value.text.includes('\ufffd'));source(value.source);source(value.anchor.source);
    assert.equal(value.source.url,pageUrl(version,'quest',q.id,value.locale));assert.equal(value.source.responseUrl,value.source.url);
    const a=value.anchor;assert.ok(['description','objectives'].includes(a.field));assert.equal(a.source.url,pageUrl(version,'quest',q.id,a.locale));
    const text=a.locale==='enUS'?q.english:q.text;if(a.locale!=='enUS'){assert.equal(q.textLocales.title,a.locale);assert.equal(q.textLocales[a.field],a.locale);}
    assert.equal(sha(comparable(text.title)),a.titleSha256);assert.ok(text[a.field]);assert.equal(sha(comparable(text[a.field])),a.contextSha256);
    wordCount+=[...new Intl.Segmenter('zh',{granularity:'word'}).segment(value.text)].filter(s=>s.isWordLike).length;fieldCount++;
   }
   assert.ok(wordCount<=25,'Long quest passage '+version+':'+id);
  }
  for(const [id,reference]of Object.entries(data.items)){
   const item=items.get(Number(id));assert.ok(item);assert.equal(reference.edition,data.edition);const seen=new Set();
   for(const e of reference.effects){
    const key=e.id+':'+e.trigger;assert.ok(!seen.has(key));seen.add(key);source(e.source);assert.equal(e.source.url,pageUrl(version,'item',item.id,e.locale));assert.equal(e.source.responseUrl,tooltipUrl(version,item.id,e.locale));
    const a=e.anchor,name=a.locale===item.nameLocale?item.name:a.locale==='enUS'?(item.raw.name||item.raw.display_lang_enus):null;assert.ok(name);assert.equal(sha(comparable(name)),a.nameSha256);assert.equal(a.itemLevel,item.itemLevel);assert.equal(a.quality,item.quality);source(a.source);assert.equal(a.source.responseUrl,tooltipUrl(version,item.id,a.locale));assert.equal(a.source.url,pageUrl(version,'item',item.id,a.locale));
    assert.ok(e.sourceItem.name);assert.equal(e.sourceItem.itemLevel,item.itemLevel);assert.equal(e.sourceItem.quality,item.quality);
    const selected=selectItemEffects(item,{effects:[{...e,id:e.learnedSpellId||e.id,trigger:e.trigger===5?0:e.trigger}]},e.locale);assert.equal(selected.length,1);assert.equal(selected[0].learnedSpellId,e.learnedSpellId);effectCount++;
   }
  }
  const report=audit.versions.find(r=>r.version===version);assert.equal(report.questFields,fieldCount);assert.equal(report.itemEffects,effectCount);assert.deepEqual(report.quests,Object.keys(data.quests).map(Number));assert.deepEqual(report.items,Object.keys(data.items).map(Number));
  console.log(`${version}: ${fieldCount} Wowhead quest fields, ${effectCount} item effects; local snapshots and matching evidence verified`);
 }
}
