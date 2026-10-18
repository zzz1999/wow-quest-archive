import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readTables} from './sql.mjs';
import {normalize,normalizeActors} from './normalize.mjs';
import {supplementQuests,textCoverage,filterSupplementBuilds} from './supplements.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const wanted=new Set(['quest_relations','quest_template','quest_template_addon','locales_quest','quest_template_locale','quest_request_items','quest_request_items_locale','quest_offer_reward','quest_offer_reward_locale','quest_objective','quest_objectives','quest_objective_locale','quest_objectives_locale','locales_quest_objective','creature_template','gameobject_template','locales_creature','locales_gameobject','creature_template_locale','gameobject_template_locale',...['creature','gameobject'].flatMap(k=>['queststarter','questender','questrelation','involvedrelation'].map(t=>k+'_'+t))]);
const metadata=[];
for(const src of config){
 if(process.argv[3]&&src.id!==process.argv[3])continue;
 console.log('Reading '+src.id);
 const tables=await readTables(src.localFiles,wanted);
 console.log(JSON.stringify([...tables].map(([key,rows])=>[key,rows.length])));
 const primary=normalize(tables,src.id,{customQuestIds:src.customQuestIds||[],translationWarnings:src.translationWarnings||{}});
 const supplements=[];
 const textTables=new Set(['quest_template','locales_quest','quest_template_locale','quest_request_items','quest_request_items_locale','quest_offer_reward','quest_offer_reward_locale']);
 for(const supplement of src.supplements||[]){
  console.log('Compare '+supplement.id+' for '+src.id);
  const {tables:data,excludedBuildRows}=filterSupplementBuilds(await readTables(supplement.localFiles,textTables),supplement.maxVerifiedBuild);
  supplements.push({id:supplement.id,version:supplement.version,allowedLocales:supplement.allowedLocales,excludedBuildRows,records:normalize(data,supplement.version,{customQuestIds:supplement.customQuestIds||[]})});
 }
 const {records,report}=supplementQuests(primary,supplements,src.id);
 await fs.mkdir(path.join(ROOT,'reports/text-audit'),{recursive:true});
 await fs.writeFile(path.join(ROOT,'reports/text-audit',src.id+'.json'),JSON.stringify(report,null,2)+'\n');
 const actors=normalizeActors(tables,src.id,records);
 if(!records.length)throw new Error('Empty source '+src.id);
 const dir=path.join(ROOT,'data',src.id);await fs.mkdir(dir,{recursive:true});
 const files=[];for(let i=0;i<records.length;i+=1000){
  const name=String(i/1000).padStart(3,'0')+'.jsonl';const content=records.slice(i,i+1000).map(r=>JSON.stringify(r)).join('\n')+'\n';
  await fs.writeFile(path.join(dir,name),content);files.push({path:`data/${src.id}/${name}`,records:Math.min(1000,records.length-i),sha256:createHash('sha256').update(content).digest('hex')});
 }
 const fields=textCoverage(records);
 for(const name of await fs.readdir(dir))if(/^\d{3}\.jsonl$/.test(name)&&!files.some(f=>f.path.endsWith('/'+name)))await fs.unlink(path.join(dir,name));
 const actorDir=path.join(dir,'actors');await fs.mkdir(actorDir,{recursive:true});const actorFiles=[];
 for(let i=0;i<actors.length;i+=1000){
  const name=String(i/1000).padStart(3,'0')+'.jsonl',content=actors.slice(i,i+1000).map(r=>JSON.stringify(r)).join('\n')+'\n';
  await fs.writeFile(path.join(actorDir,name),content);actorFiles.push({path:`data/${src.id}/actors/${name}`,records:Math.min(1000,actors.length-i),sha256:createHash('sha256').update(content).digest('hex')});
 }
 for(const name of await fs.readdir(actorDir))if(/^\d{3}\.jsonl$/.test(name)&&!actorFiles.some(f=>f.path.endsWith('/'+name)))await fs.unlink(path.join(actorDir,name));
 const actorFields={};for(const field of ['name','subname']){actorFields[field]={zhCN:0,zhTW:0,enUS:0,missing:0};for(const actor of actors)actorFields[field][actor[field+'Locale']||'missing']++;}
 const actorInfo={count:actors.length,npcs:actors.filter(a=>a.kind==='creature').length,objects:actors.filter(a=>a.kind==='gameobject').length,fields:actorFields,files:actorFiles};
 const {localFiles,supplements:sourceSupplements,...publicSource}=src;
 const supplementSources=(sourceSupplements||[]).map(({localFiles,...metadata})=>metadata);
 const textAudit={policy:report.policy,changedQuests:report.changedQuests,changedFields:report.changedFields,report:`reports/text-audit/${src.id}.json`};
 const info={...publicSource,supplements:supplementSources,textAudit,count:records.length,fields,testLike:records.filter(x=>x.tags.includes('suspected-test')).length,communityCustom:records.filter(x=>x.tags.includes('community-custom')).length,files,actors:actorInfo};
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(info,null,2)+'\n');metadata.push(info);
 console.log(`${src.id}: ${records.length} quests, titles ${JSON.stringify(fields.title)}, description ${JSON.stringify(fields.description)}`);
 console.log(`${src.id}: ${actorInfo.npcs} NPCs, ${actorInfo.objects} quest objects, names ${JSON.stringify(actorFields.name)}`);
}
