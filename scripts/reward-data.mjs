import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readTables,tuples} from './sql.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function* csvRows(csv){
 let columns=null,row=[],value='',quoted=false;
 const record=values=>{if(values.length!==columns.length)throw Error('Reward CSV column mismatch');return Object.fromEntries(columns.map((c,i)=>[c.toLowerCase(),values[i]]));};
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));if(row.some(Boolean)){if(!columns)columns=row;else yield record(row);}row=[];value='';}
  else value+=c;
 }
 if(quoted)throw Error('Unclosed reward CSV quote');
 if(value||row.length){row.push(value);if(columns)yield record(row);}
}

// 4.3.4 WDBC layouts, checked against the pinned WoWDBDefs definitions.
const cataLayouts={
 Faction:{count:26,fields:{id:0,name:[23,'string']}},
 QuestXP:{count:11,fields:{id:0,...Object.fromEntries(Array.from({length:10},(_,i)=>['difficulty_'+i,i+1]))}},
 QuestFactionReward:{count:11,fields:{id:0,...Object.fromEntries(Array.from({length:10},(_,i)=>['difficulty_'+i,i+1]))}},
 SkillLine:{count:7,fields:{id:0,name:[2,'string']}},
 CharTitles:{count:6,fields:{id:0,name:[2,'string'],namefemale:[3,'string']}},
 CurrencyTypes:{count:11,fields:{id:0,name:[2,'string']}},
 Spell:{count:48,fields:{id:0,name:[21,'string']}}
};
export function readCataDBC(bytes,table){
 const layout=cataLayouts[table];if(!layout||bytes.length<20||bytes.toString('ascii',0,4)!=='WDBC')throw Error('Unsupported reward DBC '+table);
 const count=bytes.readUInt32LE(4),fields=bytes.readUInt32LE(8),size=bytes.readUInt32LE(12),stringsSize=bytes.readUInt32LE(16),stringsStart=20+count*size;
 if(fields!==layout.count||size!==fields*4||stringsStart+stringsSize!==bytes.length)throw Error('Reward DBC layout mismatch '+table);
 const rows=[];
 for(let i=0;i<count;i++){
  const row={};for(const [key,descriptor]of Object.entries(layout.fields)){
   const [index,type]=Array.isArray(descriptor)?descriptor:[descriptor,'number'];const offset=20+i*size+index*4;
   if(type==='string'){const start=bytes.readUInt32LE(offset);if(start>=stringsSize)throw Error('Invalid DBC string offset');const end=bytes.indexOf(0,stringsStart+start);if(end<0)throw Error('Unterminated DBC string');row[key]=bytes.toString('utf8',stringsStart+start,end);}
   else row[key]=bytes.readInt32LE(offset);
  }rows.push(row);
 }
 return rows;
}
export function sqlNamePrefixes(sql,table){
 // This export has invalid escaping in some DESCRIPTION columns. Read only the
 // independently valid ID + first localized name, never repair the description.
 if(!['Faction','Spell'].includes(table))throw Error('Unsupported SQL name-prefix table');
 const columns=[...sql.slice(0,sql.indexOf('INSERT INTO')).matchAll(/`([^`]+)`\s+(?:INT|BIGINT|FLOAT|DOUBLE|TEXT)/g)].map(m=>m[1]);
 const firstName=columns.findIndex(c=>/Name_Lang_enUS/.test(c));if(firstName<1||columns.slice(0,firstName).some(c=>/Lang/.test(c)))throw Error('Unexpected name-prefix schema');
 const rows=[];
 for(const line of sql.split(/\r?\n/))if(line.startsWith('INSERT INTO')){
  const match=/^INSERT INTO `([^`]+)` VALUES \((\d+),([^]*?)("(?:[^"\\]|\\.)*")(?=,)/.exec(line);
  if(!match||match[1]!==table||match[3].split(',').length!==firstName)throw Error(`Invalid reward name prefix ${table} ${match?.[2]} columns ${match?.[3].split(',').length}/${firstName}`);
  rows.push({id:Number(match[2]),name_lang_enus:[...tuples('('+match[4]+')')][0][0]});
 }
 return rows;
}
const keep=k=>/^(id|name|namefemale|display|difficulty|itemid|packageid|displaytype|itemquantity|allowableclass|overallqualityid|itemlevel|requiredlevel|inventorytype|scalingstatdistributionid|data)$/.test(k)||/^(name|displayname)_lang_|^(display|name)_lang$|^difficulty_\d+$/.test(k);
export async function loadRewardData(version){
 const lock=JSON.parse(await fs.readFile(path.join(root,'sources/rewards/manifest.json'),'utf8'));
 const source=lock.versions.find(v=>v.id===version),tables=new Map();
 if(!source)return {version,tables,source:null};
 for(const asset of source.assets){
  const file=path.join(root,'.cache/rewards',version,asset.name);let bytes;
  try{bytes=await fs.readFile(file);}catch{
   console.log('Download reward source '+asset.url);
   const response=await fetch(asset.url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Reward download failed '+response.status);
   bytes=Buffer.from(await response.arrayBuffer());await fs.mkdir(path.dirname(file),{recursive:true});
   if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Reward source hash mismatch '+asset.name);
   await fs.writeFile(file,bytes);
  }
  if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Reward source hash mismatch '+asset.name);
  const rows=asset.format==='dbc'?readCataDBC(bytes,asset.table):asset.format==='sql-name-prefix'?sqlNamePrefixes(bytes.toString('utf8'),asset.table):asset.format==='sql'?(await readTables([file],new Set([asset.table]))).get(asset.table):csvRows(bytes.toString('utf8'));
  if(!rows)throw Error('Missing reward table '+asset.table);
  const index=new Map();for(const row of rows)index.set(Number(row.id),Object.fromEntries(Object.entries(row).filter(([k])=>keep(k))));
  if(!index.size)throw Error('Empty reward table '+asset.table);
  tables.set(asset.table+':'+asset.locale,{rows:index,asset,build:source.build,source:'rewards-'+version});
 }
 return {version,tables,source};
}
