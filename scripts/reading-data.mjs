import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);

function rows(csv){
 const parsed=[];let row=[],value='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));if(row.some(Boolean))parsed.push(row);row=[];value='';}
  else value+=c;
 }
 if(quoted)throw Error('Unclosed reading-table CSV quote');
 if(value||row.length){row.push(value);parsed.push(row);}
 const [columns,...lines]=parsed;
 return lines.map(values=>{if(values.length!==columns.length)throw Error('Reading-table column mismatch');return Object.fromEntries(columns.map((c,i)=>[c,values[i]]));});
}
export async function buildReadingData(){
 const manifest=JSON.parse(await fs.readFile(new URL('sources/reading/manifest.json',root),'utf8'));
 if(manifest.version!=='legion'||manifest.build!=='7.3.5.26972')throw Error('Unsupported reading-table version');
 const tables=new Map();
 for(const asset of manifest.assets){
  const buffer=await fs.readFile(new URL(asset.path,root));
  if(buffer.length!==asset.bytes||createHash('sha256').update(buffer).digest('hex')!==asset.sha256)throw Error('Reading-table hash mismatch: '+asset.path);
  tables.set(asset.table+':'+asset.locale,rows(buffer.toString('utf8')));
 }
 const locales=['zhCN','zhTW','enUS'];
 const row=(table,locale,id)=>tables.get(table+':'+locale)?.find(r=>Number(r.ChrClassID??r.ID)===id);
 const pick=(table,field,id)=>{
  for(const locale of locales){const value=row(table,locale,id)?.[field];if(value?.trim()&&(locale==='enUS'||/\p{Script=Han}/u.test(value)))return {text:value,locale};}
  return {text:'',locale:null};
 };
 const classes=Array.from({length:12},(_,i)=>{
  const id=i+1,aliases=new Set();
  for(const locale of locales){const r=row('ChrClasses',locale,id);for(const f of ['Filename','Name_lang','Name_male_lang','Name_female_lang'])if(r?.[f])aliases.add(r[f]);}
  const gender=Number(row('ChrClassVillain','enUS',id)?.Gender);
  if(!aliases.size||![0,1].includes(gender))throw Error('Incomplete class reading data: '+id);
  return {id,name:pick('ChrClasses','Name_lang',id),aliases:[...aliases],title:{male:pick('ChrClassTitle','Name_male_lang',id),female:pick('ChrClassTitle','Name_female_lang',id)},villain:{...pick('ChrClassVillain','Name_lang',id),gender:gender===0?'male':'female'}};
 });
 return {version:manifest.version,build:manifest.build,classes};
}
