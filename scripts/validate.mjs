import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {rewardAudit} from './reward-audit.mjs';
import {validateItems} from './validate-items.mjs';
import {validateRegions,validateRegionBundle} from './validate-regions.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(await fs.readFile(path.join(root,'sources/manifest.json'),'utf8'));
const catalog=JSON.parse((await fs.readFile(path.join(root,'web/catalog.js'),'utf8')).replace(/^window\.QUEST_CATALOG=/,'').replace(/;\s*$/,''));
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const rewardReport=JSON.parse(await fs.readFile(path.join(root,'reports/reward-audit.json'),'utf8'));
for(const match of html.matchAll(/(?:src|href)="(web\/[a-z-]+\.(?:js|css))(?:\?v=([a-f0-9]+))?"/g)){
 const hash=createHash('sha256').update(await fs.readFile(path.join(root,match[1]))).digest('hex').slice(0,12);
 assert.equal(match[2],hash,'Stale page asset revision: '+match[1]);
}
let total=0,totalNpcs=0,totalObjects=0;
async function readShards(files){
 const rows=[];
 for(const f of files){const content=await fs.readFile(path.join(root,f.path));assert.equal(createHash('sha256').update(content).digest('hex'),f.sha256,f.path);const shard=content.toString('utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));assert.equal(shard.length,f.records,f.path);rows.push(...shard);}
 return rows;
}
async function verifyBundle(directory,id,records){
 const bundle=await fs.readFile(path.join(root,'web',directory,id+'.js'),'utf8'),b64=bundle.match(/="([A-Za-z0-9+/=]+)";/)?.[1];assert.ok(b64,'Missing bundle '+directory+'/'+id);assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(b64,'base64'))),records,'Browser bundle differs from JSONL '+directory+'/'+id);
}
for(const id of ['classic','wotlk','cataclysm','pandaria','legion']){
 const m=JSON.parse(await fs.readFile(path.join(root,'data',id,'manifest.json'),'utf8'));
 const sourceIds=new Set([id,...(m.supplements||[]).map(s=>s.id)]),sourceLock=lock.versions.find(v=>v.id===id);
 const supplementalSources=new Map();
 for(const source of m.supplements||[]){assert.equal(source.version,id);const pinned=sourceLock.supplements.find(s=>s.id===source.id);assert.ok(pinned);assert.equal(source.repo,pinned.repo);assert.equal(source.commit,pinned.commit);assert.deepEqual(source.allowedLocales,pinned.allowedLocales);assert.equal(source.maxVerifiedBuild,pinned.maxVerifiedBuild);assert.ok(!source.localFiles,'Local paths must not enter published provenance');supplementalSources.set(source.id,source);}
 const audit=JSON.parse(await fs.readFile(path.join(root,m.textAudit.report),'utf8')),auditChanges=new Map(audit.changes.map(c=>[c.id+':'+c.field,c]));
 const seen=new Set(),fields={},records=[];
 for(const f of m.files){const content=await fs.readFile(path.join(root,f.path));assert.equal(createHash('sha256').update(content).digest('hex'),f.sha256,f.path);const rows=content.toString('utf8').trim().split('\n').map(x=>JSON.parse(x));assert.equal(rows.length,f.records);
  for(const r of rows){assert.equal(r.version,id);assert.equal(r.key,`${id}:${r.id}`);assert.ok(Number.isInteger(r.id)&&r.id>0);assert.ok(!seen.has(r.key),'Duplicate '+r.key);seen.add(r.key);
   for(const [key,value]of Object.entries(r.text)){assert.equal(typeof value,'string');assert.ok(!value.includes('\ufffd'),'Invalid UTF-8 replacement in '+r.key);const locale=r.textLocales[key];assert.ok(['zhCN','zhTW','enUS',null].includes(locale));if(value){assert.ok(locale);assert.ok(sourceIds.has(r.textSources[key]),'Unknown text source '+r.key);assert.equal(typeof r.textColumns[key],'string');}else{assert.equal(locale,null);assert.equal(r.textSources[key],null);}if(locale==='zhCN'||locale==='zhTW')assert.ok(/\p{Script=Han}/u.test(value));fields[key]??={zhCN:0,zhTW:0,enUS:0,missing:0};fields[key][locale||'missing']++;
    if(value&&r.textSources[key]!==id){const change=auditChanges.get(r.id+':'+key);assert.ok(change,'Unaudited supplement '+r.key+':'+key);assert.equal(change.source,r.textSources[key]);assert.equal(change.match,r.textMatches[key]);assert.equal(change.toLocale,locale);auditChanges.delete(r.id+':'+key);const source=supplementalSources.get(r.textSources[key]);if(source.allowedLocales)assert.ok(source.allowedLocales.includes(locale),'Disallowed supplement locale');if(source.maxVerifiedBuild!==undefined){const build=Number(r.textBuilds[key]??0);assert.ok(Number.isSafeInteger(build)&&Math.abs(build)<=source.maxVerifiedBuild,'Later build entered '+r.key+':'+key);}}
    if(r.english[key])assert.ok(sourceIds.has(r.englishSources[key]));else assert.equal(r.englishSources[key],null);
   }
  }records.push(...rows);
 }
 for(const q of records){
  const r=q.rewards;assert.equal(r?.schemaVersion,1);assert.equal(r.source,id);
  for(const field of ['items','choices','currencies','reputation','spells'])assert.ok(Array.isArray(r[field]));
  const entries=[...r.items,...r.choices,...r.currencies,...r.reputation,...r.spells,...(r.package?.items||[]),...(r.skill?[r.skill]:[]),...(r.title?[r.title]:[])];
  for(const e of entries){
   assert.ok(Number.isSafeInteger(e.id)&&e.id>0);assert.equal(typeof e.name,'string');assert.ok(!e.name.includes('\ufffd'));
   assert.ok(['zhCN','zhTW','enUS',null].includes(e.nameLocale));
   if(e.name){assert.ok(e.nameLocale);assert.ok([id,'rewards-'+id].includes(e.nameSource?.source));assert.equal(typeof e.nameSource.table,'string');assert.equal(typeof e.nameSource.column,'string');}else{assert.equal(e.nameLocale,null);assert.equal(e.nameSource,null);}
   if(['zhCN','zhTW'].includes(e.nameLocale))assert.ok(/\p{Script=Han}/u.test(e.name));
   if(e.count!==undefined)assert.ok(e.count===null||Number.isSafeInteger(e.count)&&e.count>=0);
  }
  for(const field of ['items','choices','currencies'])for(const e of r[field]){
   const idColumn=r.columns[`${field}.${e.slot}.id`]?.split('.')[1],countColumn=r.columns[`${field}.${e.slot}.count`]?.split('.')[1];
   assert.equal(q.sourceFields[idColumn],e.id,'Reward reference differs from source '+q.key);
   assert.equal(countColumn?(q.sourceFields[countColumn]??0):null,e.count,'Reward quantity differs from source '+q.key);
  }
  assert.ok(r.experience.amount===null||Number.isSafeInteger(r.experience.amount)&&r.experience.amount>=0);
  assert.ok(r.money.copper===null||Number.isSafeInteger(r.money.copper));
  for(const e of r.reputation)assert.ok(e.amount===null||Number.isSafeInteger(e.amount));
 }
 assert.deepEqual(rewardReport.versions.find(v=>v.version===id),rewardAudit(records),'Reward report out of date');
 assert.equal(seen.size,m.count);assert.deepEqual(fields,m.fields);
 assert.equal(auditChanges.size,0,'Audit contains unused changes');assert.deepEqual(audit.after,fields);assert.equal(audit.changedFields,audit.changes.length);assert.equal(audit.changedFields,m.textAudit.changedFields);assert.equal(audit.changedQuests,new Set(audit.changes.map(c=>c.id)).size);
 const catalogEntry=catalog.versions.find(v=>v.id===id);assert.ok(catalogEntry);
 for(const [directory,key]of [['data','quests'],['actors','actors']])assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,'web',directory,id+'.js'))).digest('hex').slice(0,12),catalogEntry.bundleHashes[key],'Stale browser cache revision');
 await verifyBundle('data',id,records);
 await validateRegions(root,id,records);
 const actors=await readShards(m.actors.files),byKey=new Map(),expected=new Map(),actorFields={};
 for(const a of actors){
  assert.equal(a.schemaVersion,1);assert.equal(a.version,id);assert.equal(a.source,id);assert.ok(['creature','gameobject'].includes(a.kind));assert.ok(Number.isInteger(a.id)&&a.id>0);assert.equal(a.key,`${id}:${a.kind}:${a.id}`);assert.ok(!byKey.has(a.key),'Duplicate '+a.key);byKey.set(a.key,a);expected.set(a.key,{starts:new Set(),ends:new Set()});
  assert.equal(typeof a.templatePresent,'boolean');for(const k of ['minLevel','maxLevel'])assert.ok(a[k]===null||Number.isFinite(a[k]));
  for(const key of ['name','subname']){const value=a[key],locale=a[key+'Locale'];assert.equal(typeof value,'string');assert.ok(!value.includes('\ufffd'),'Invalid UTF-8 replacement in '+a.key);assert.ok(['zhCN','zhTW','enUS',null].includes(locale));if(value){assert.ok(locale);assert.equal(typeof a.textColumns[key],'string');}else{assert.equal(locale,null);assert.equal(a.textColumns[key],null);}if(locale==='zhCN'||locale==='zhTW')assert.ok(/\p{Script=Han}/u.test(value));assert.equal(typeof a.english[key],'string');actorFields[key]??={zhCN:0,zhTW:0,enUS:0,missing:0};actorFields[key][locale||'missing']++;}
 }
 for(const q of records)for(const [field,role]of [['starters','starts'],['enders','ends']])for(const ref of q[field]){const actor=byKey.get(ref.key);assert.ok(actor,'Missing actor '+ref.key);assert.equal(ref.kind,actor.kind);assert.equal(ref.id,actor.id);assert.equal(ref.name,actor.name);assert.equal(ref.nameLocale,actor.nameLocale);expected.get(ref.key)[role].add(q.id);}
 for(const a of actors)for(const role of ['starts','ends'])assert.deepEqual(a[role],[...expected.get(a.key)[role]].sort((a,b)=>a-b),'Incorrect reverse relation '+a.key+' '+role);
 assert.equal(actors.length,m.actors.count);assert.equal(actors.filter(a=>a.kind==='creature').length,m.actors.npcs);assert.equal(actors.filter(a=>a.kind==='gameobject').length,m.actors.objects);assert.deepEqual(actorFields,m.actors.fields);
 await verifyBundle('actors',id,actors);
 total+=m.count;totalNpcs+=m.actors.npcs;totalObjects+=m.actors.objects;console.log(`${id}: ${m.count} quests, ${m.actors.npcs} NPCs, ${m.actors.objects} objects; hashes, locales, reverse relations and browser bundles verified`);
}
console.log(`Verified ${total} versioned quests, ${totalNpcs} NPCs and ${totalObjects} task objects.`);
await validateItems(root,catalog);
await validateRegionBundle(root);
