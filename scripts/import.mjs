import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readTables} from './sql.mjs';
import {normalize} from './normalize.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const wanted=new Set(['quest_relations','quest_template','quest_template_addon','locales_quest','quest_template_locale','quest_request_items','quest_request_items_locale','quest_offer_reward','quest_offer_reward_locale','quest_objective','quest_objectives','quest_objective_locale','quest_objectives_locale','locales_quest_objective','creature_template','gameobject_template','locales_creature','locales_gameobject','creature_template_locale','gameobject_template_locale',...['creature','gameobject'].flatMap(k=>['queststarter','questender','questrelation','involvedrelation'].map(t=>k+'_'+t))]);
const metadata=[];
for(const src of config){
 if(process.argv[3]&&src.id!==process.argv[3])continue;
 console.log('Reading '+src.id);
 const tables=await readTables(src.localFiles,wanted);
 console.log(JSON.stringify([...tables].map(([key,rows])=>[key,rows.length])));
 const records=normalize(tables,src.id,{customQuestIds:src.customQuestIds||[],translationWarnings:src.translationWarnings||{}});
 if(!records.length)throw new Error('Empty source '+src.id);
 const dir=path.join(ROOT,'data',src.id);await fs.mkdir(dir,{recursive:true});
 const files=[];for(let i=0;i<records.length;i+=1000){
  const name=String(i/1000).padStart(3,'0')+'.jsonl';const content=records.slice(i,i+1000).map(r=>JSON.stringify(r)).join('\n')+'\n';
  await fs.writeFile(path.join(dir,name),content);files.push({path:`data/${src.id}/${name}`,records:Math.min(1000,records.length-i),sha256:createHash('sha256').update(content).digest('hex')});
 }
 const fields={};for(const r of records)for(const [field,locale]of Object.entries(r.textLocales)){fields[field]??={zhCN:0,zhTW:0,enUS:0,missing:0};fields[field][locale||'missing']++;}
 for(const name of await fs.readdir(dir))if(/^\d{3}\.jsonl$/.test(name)&&!files.some(f=>f.path.endsWith('/'+name)))await fs.unlink(path.join(dir,name));
 const {localFiles,...publicSource}=src;
 const info={...publicSource,count:records.length,fields,testLike:records.filter(x=>x.tags.includes('suspected-test')).length,communityCustom:records.filter(x=>x.tags.includes('community-custom')).length,files};
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(info,null,2)+'\n');metadata.push(info);
 console.log(`${src.id}: ${records.length} quests, titles ${JSON.stringify(fields.title)}, description ${JSON.stringify(fields.description)}`);
}
