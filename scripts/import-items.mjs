import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT,loadItemClient,sourceBytes} from './item-client.mjs';
import {readTables} from './sql.mjs';
import {normalizeItem,createSpellLookup} from './item-data.mjs';
const versions=['classic','wotlk','cataclysm','pandaria','legion'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const readJSON=async p=>JSON.parse(await fs.readFile(path.join(ROOT,p),'utf8'));
const writeJSON=async(p,value)=>{await fs.mkdir(path.dirname(path.join(ROOT,p)),{recursive:true});await fs.writeFile(path.join(ROOT,p),JSON.stringify(value,null,2)+'\n');};
const selected=process.argv[2];
if(!selected){
 for(const id of versions){const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),id],{cwd:ROOT,stdio:'inherit'});if(r.status!==0)throw Error('Item import failed '+id);}
 await collectIcons();
}else if(selected==='--icons')await collectIcons();
else{
 if(!versions.includes(selected))throw Error('Unknown version');
 const version=selected,manifest=await readJSON('sources/items/manifest.json'),config=(await readJSON('.cache/rebuild-inputs.json')).find(v=>v.id===version);
 if(!config)throw Error('Run scripts/rebuild.mjs to prepare version-pinned SQL inputs first.');
 const quests=await readJSON('data/'+version+'/manifest.json'),refs=new Map();
 for(const file of quests.files)for(const line of (await fs.readFile(path.join(ROOT,file.path),'utf8')).trim().split('\n')){const q=JSON.parse(line);for(const item of [...q.rewards.items,...q.rewards.choices,...(q.rewards.package?.items||[])])refs.set(item.id,item);}
 console.log(version,refs.size,'reward items; reading pinned tables');
 const sql=version==='legion'?new Map():await readTables(config.localFiles,new Set(['item_template','item_template_locale','locales_item','spell_template']));
 const tables=await loadItemClient(version,manifest),index=new Map((sql.get('item_template')||[]).map(r=>[Number(r.entry??r.id),r]));
 const localeItems=new Map();for(const r of [...(sql.get('locales_item')||[]),...(sql.get('item_template_locale')||[])]){const id=Number(r.id??r.entry);if(!refs.has(id))continue;if(!localeItems.has(id))localeItems.set(id,[]);localeItems.get(id).push(r);}sql.set('_localeItems',localeItems);
 const icons=new Map();
 if(version==='classic')for(const r of tables.get('client:enUS').rows.item_display_info)icons.set(Number(r.ID),r.icon);
 if(version==='legion'){
  for(const id of refs.keys()){const sparse=tables.get('ItemSparse:enUS').rows.get(id),base=tables.get('Item:enUS').rows.get(id);if(sparse)index.set(id,{...sparse,...base});}
  const wanted=new Set([...index.values()].map(r=>Number(r.iconfiledataid)));
  const list=(await sourceBytes(manifest.assets.find(a=>a.table==='listfile'))).toString('utf8');
  for(const m of list.matchAll(/^(\d+);interface\/icons\/([^\r\n]+)\.blp\r?$/gim))if(wanted.has(Number(m[1])))icons.set(Number(m[1]),m[2]);
  const grouped=new Map();for(const r of tables.get('ItemEffect:enUS').rows.values()){const id=Number(r.parentitemid);if(refs.has(id)){if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(r);}}sql.set('_itemEffects',grouped);
 }
 const spells=createSpellLookup(version,tables,sql),records=[...refs.values()].sort((a,b)=>a.id-b.id).map(ref=>normalizeItem(version,ref,index.get(ref.id),tables,sql,icons,spells));
 const files=[];await fs.mkdir(path.join(ROOT,'data/items',version),{recursive:true});
 for(let offset=0;offset<records.length;offset+=1000){const shard=records.slice(offset,offset+1000),relative=`data/items/${version}/${String(offset/1000).padStart(3,'0')}.jsonl`,bytes=Buffer.from(shard.map(r=>JSON.stringify(r)).join('\n')+'\n');await fs.writeFile(path.join(ROOT,relative),bytes);files.push({path:relative,bytes:bytes.length,records:shard.length,sha256:hash(bytes)});}
 const report={version,count:records.length,templates:records.filter(r=>r.templatePresent).length,iconMappings:records.filter(r=>r.icon).length,withStats:records.filter(r=>r.stats.length).length,withEffects:records.filter(r=>r.effects.length).length,effects:records.reduce((a,r)=>a+r.effects.length,0),resolvedEffectText:records.reduce((a,r)=>a+r.effects.filter(e=>e.text&&!e.unresolved).length,0),missingEffectText:records.reduce((a,r)=>a+r.effects.filter(e=>!e.text).length,0),files};
 await writeJSON('data/items/'+version+'-manifest.json',report);console.log(JSON.stringify(report));
}
async function collectIcons(){
 const wanted=new Set(['inv_misc_questionmark']);for(const v of versions){const manifest=await readJSON('data/items/'+v+'-manifest.json');for(const file of manifest.files){const lines=(await fs.readFile(path.join(ROOT,file.path),'utf8')).trim().split('\n');for(const l of lines){const r=JSON.parse(l);if(r.icon)wanted.add(r.icon);}}}
 let previous={icons:[]};try{previous=await readJSON('sources/items/icons.json');}catch{}
 const saved=new Map(previous.icons.map(a=>[a.name,a])),queue=[...wanted].sort(),assets=[];let cursor=0,downloaded=0;
 await fs.mkdir(path.join(ROOT,'web/icons'),{recursive:true});
 async function worker(){while(cursor<queue.length){const name=queue[cursor++],old=saved.get(name),relative='web/icons/'+name+'.jpg',url='https://wow.zamimg.com/images/wow/icons/large/'+name+'.jpg';let bytes;
  try{bytes=await fs.readFile(path.join(ROOT,relative));}catch{}
  if(old?.missing){assets.push(old);continue;}
  if(bytes&&old){if(hash(bytes)!==old.sha256)throw Error('Local icon hash mismatch '+name);assets.push(old);continue;}
  if(!bytes){for(let attempt=0;attempt<3;attempt++)try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(r.status===404){assets.push({name,url,missing:true});break;}if(!r.ok)throw Error('Icon HTTP '+r.status);bytes=Buffer.from(await r.arrayBuffer());break;}catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,500*(attempt+1)));}}
  if(!bytes)continue;if(bytes.length<50||bytes[0]!==255||bytes[1]!==216||bytes.length>500000)throw Error('Invalid JPEG '+name);
  if(old&&hash(bytes)!==old.sha256)throw Error('Upstream icon changed '+name);
  await fs.writeFile(path.join(ROOT,relative),bytes);assets.push({name,path:relative,url,bytes:bytes.length,sha256:hash(bytes)});downloaded++;if(downloaded%200===0)console.log('Downloaded',downloaded,'/',queue.length,'icons');
 }}
 await Promise.all(Array.from({length:6},()=>worker()));
 assets.sort((a,b)=>a.name.localeCompare(b.name,'en'));
 await writeJSON('sources/items/icons.json',{schemaVersion:1,collectedAt:'2026-10-18',provider:'Wowhead/ZAM icon CDN; Blizzard artwork. Stored locally; never requested by the browser at runtime.',icons:assets});
 console.log('Local icons',assets.filter(a=>!a.missing).length,'; unavailable',assets.filter(a=>a.missing).length);
}
