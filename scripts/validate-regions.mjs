import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {regionAudit,regionBrowserData,regionVersions} from './region-data.mjs';
const read=async(root,file)=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
export async function validateRegions(root,version,quests){
 const data=await read(root,`data/regions/${version}.json`),lock=await read(root,'sources/regions/manifest.json');
 const assets=new Map(lock.assets.map(a=>[a.name,a]));
 assert.equal(data.schemaVersion,1);assert.equal(data.version,version);
 const used=[...new Set(quests.map(q=>q.zoneOrSort).filter(Boolean))].sort((a,b)=>a-b);
 assert.deepEqual(data.records.map(r=>r.value),used,'Region table must cover exactly this version\'s used IDs');
 const verifySource=s=>{assert.ok(s);const a=assets.get(s.asset);assert.ok(a,'Unknown region source');assert.equal(s.build,a.build);assert.equal(s.table,a.table);assert.equal(s.locale,a.locale);assert.equal(typeof s.column,'string');};
 for(const r of data.records){
  assert.equal(r.id,Math.abs(r.value));assert.equal(r.kind,r.value<0?'category':'area');assert.equal(typeof r.name,'string');assert.equal(typeof r.english,'string');
  if(r.name){assert.ok(['zhCN','zhTW','enUS'].includes(r.nameLocale));assert.ok(!r.name.includes('\ufffd'));verifySource(r.nameSource);assert.equal(r.nameSource.locale,r.nameLocale);assert.equal(r.nameSource.table,r.value<0?'QuestSort':'AreaTable');assert.ok(r.match);assert.ok(r.base);if(r.nameLocale.startsWith('zh'))assert.match(r.name,/\p{Script=Han}/u);}
  else{assert.equal(r.nameLocale,null);assert.equal(r.nameSource,null);assert.equal(r.match,null);}
  if(r.english){verifySource(r.englishSource);assert.equal(r.englishSource.locale,'enUS');}else assert.equal(r.englishSource,null);
  if(r.base){verifySource(r.base.source);const a=assets.get(r.base.source.asset);assert.ok(a.version===version||a.reference==='legion'&&version==='legion'||a.reference==='classic-ref'&&version==='classic'&&r.kind==='category','Wrong version base region');}
  if(r.match?.source)assert.ok(assets.has(r.match.source),'Missing region match evidence');
 }
 const report=await read(root,'reports/region-audit.json');assert.deepEqual(report.versions.find(v=>v.version===version),regionAudit(data),'Stale region audit');
}
export async function validateRegionBundle(root){
 const datasets=await Promise.all(regionVersions.map(v=>read(root,`data/regions/${v}.json`))),lock=await read(root,'sources/regions/manifest.json');
 const script=await fs.readFile(path.join(root,'web/regions-data.js'),'utf8');
 assert.deepEqual(JSON.parse(script.replace(/^globalThis\.QuestRegionData=/,'').replace(/;\s*$/,'')),regionBrowserData(datasets,lock),'Browser region names differ from source records');
 console.log('Verified versioned region/category names, provenance, coverage and offline browser bundle.');
}
