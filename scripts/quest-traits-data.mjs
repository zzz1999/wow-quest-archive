import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {csvRows} from './reward-data.mjs';
import {buildReadingData} from './reading-data.mjs';
const root=new URL('../',import.meta.url);
export async function buildQuestTraitData(){
 const manifest=JSON.parse(await fs.readFile(new URL('sources/quest-traits/manifest.json',root),'utf8')),tables={};
 for(const asset of manifest.assets){
  const bytes=await fs.readFile(new URL(asset.path,root));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  tables[asset.table]=[...csvRows(bytes.toString('utf8'))];
 }
 const versions=Object.fromEntries(manifest.versions.map(v=>[v.id,{...v.rules,source:{repo:v.repo,commit:v.commit,path:v.assets.find(a=>a.path.endsWith('/QuestDef.h')).path}}]));
 const ids=new Set(Object.values(versions).flatMap(v=>v.races));
 const races=tables.ChrRaces.filter(r=>ids.has(Number(r.id))).map(r=>{
  const id=Number(r.id),team=['alliance','horde','neutral'][Number(r.alliance)];assert.ok(team);assert.match(r.name_lang,/\p{Script=Han}/u);
  return {id,name:r.name_lang+({24:'（未选阵营）',25:'（联盟）',26:'（部落）'}[id]||''),team};
 });
 assert.equal(races.length,ids.size);
 const classes=(await buildReadingData()).classes.map(c=>({id:c.id,name:c.name.text}));
 return {schemaVersion:1,versions,races,classes,worldQuestTypes:tables.QuestInfo.filter(r=>r.infoname_lang.includes('世界任务')).map(r=>Number(r.id)),emissaryTypes:tables.QuestInfo.filter(r=>r.infoname_lang==='使者任务').map(r=>Number(r.id))};
}
export function questTraitAudit(records,derive){
 const result={version:records[0]?.version,count:records.length,repetition:{},factions:{},restrictedClasses:0,restrictedRaces:0,unknownRepetition:[],unknownFaction:[]};
 for(const r of records){const t=derive(r);result.repetition[t.repeat.kind]=(result.repetition[t.repeat.kind]||0)+1;result.factions[t.faction.kind]=(result.factions[t.faction.kind]||0)+1;if(t.classes.restricted)result.restrictedClasses++;if(t.races.restricted)result.restrictedRaces++;if(t.repeat.repeatable===null)result.unknownRepetition.push(r.id);if(t.faction.kind==='unknown')result.unknownFaction.push(r.id);}
 return result;
}
