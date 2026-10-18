import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {dbcSchema,dbcTable} from './item-client.mjs';
import {csvRows} from './reward-data.mjs';

export const regionVersions=['classic','wotlk','cataclysm','pandaria','legion'];
const locales=['zhCN','zhTW','enUS'];
const columnFor=table=>table==='AreaTable'?'areaname_lang':'sortname_lang';
const comparable=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const enumName=value=>comparable(value).replace(/[^a-z0-9]/g,'');
const valid=(name,locale)=>typeof name==='string'&&Boolean(name.trim())&&!name.includes('\ufffd')&&(!locale.startsWith('zh')||/\p{Script=Han}/u.test(name));

async function sourceBytes(root,asset){
 const cache=path.resolve(root,'.cache/regions'),file=path.resolve(cache,asset.name);
 if(!file.startsWith(cache+path.sep))throw Error('Invalid region source path');
 let bytes;try{bytes=await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!bytes){
  if(asset.archive){
   const a=asset.archive,end=a.offset+30+Buffer.byteLength(a.name)+a.packed+2047;
   const r=await fetch(a.url,{headers:{Range:`bytes=${a.offset}-${end}`,Accept:'application/octet-stream'},signal:AbortSignal.timeout(120000)});
   if(r.status!==206||r.headers.get('content-range')!==`bytes ${a.offset}-${end}/${a.total}`){await r.body?.cancel();throw Error('Region archive range mismatch: '+asset.name);}
   const packed=Buffer.from(await r.arrayBuffer()),start=30+packed.readUInt16LE(26)+packed.readUInt16LE(28);
   if(packed.readUInt32LE(0)!==0x04034b50||packed.readUInt16LE(6)&1||packed.toString('utf8',30,30+packed.readUInt16LE(26))!==a.name)throw Error('Invalid region ZIP member');
   bytes=a.method===8?inflateRawSync(packed.subarray(start,start+a.packed)):a.method===0?packed.subarray(start,start+a.packed):null;
   if(!bytes)throw Error('Unsupported region archive compression');
  }else{
   const r=await fetch(asset.url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Region source HTTP ${r.status}: ${asset.name}`);bytes=Buffer.from(await r.arrayBuffer());
  }
 }
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Region source hash mismatch: '+asset.name);
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);return bytes;
}

// Read data only. Neither the C++ enum nor downloaded files are executed.
export function questSortEnums(text){
 const block=/enum\s+QuestSort\s*\{([\s\S]*?)\}/.exec(text)?.[1];if(!block)throw Error('Missing QuestSort enum');
 return new Map([...block.matchAll(/\bQUEST_SORT_([A-Z_]+)\s*=\s*(\d+)\s*,/g)].map(m=>[Number(m[2]),m[1]]));
}
export async function loadRegionSources(root,lock){
 const bytes=new Map();
 // Small batches also keep a clean rebuild polite to the source hosts.
 for(let i=0;i<lock.assets.length;i+=4)await Promise.all(lock.assets.slice(i,i+4).map(async a=>bytes.set(a.name,await sourceBytes(root,a))));
 const tables=[];
 for(const asset of lock.assets){
  const b=bytes.get(asset.name);let rows;
  if(asset.format==='dbd')continue;
  if(asset.format==='dbc'){
   const schema=lock.assets.find(a=>a.format==='dbd'&&a.table===asset.table);if(!schema)throw Error('Missing region DBC schema');
   rows=dbcTable(b,dbcSchema(bytes.get(schema.name).toString('utf8'),asset.build));
  }else if(asset.format==='csv')rows=new Map([...csvRows(b.toString('utf8'))].map(r=>[Number(r.id),r]));
  else if(asset.format==='classic-json')rows=new Map(JSON.parse(b.toString('utf8')).areas.map(r=>[r.entry,{areaname_lang:r.name}]));
  else if(asset.format==='cpp-enum')rows=questSortEnums(b.toString('utf8'));
  else throw Error('Unsupported region source '+asset.format);
  tables.push({asset,rows});
 }
 return tables;
}
function nameAt(source,id){
 const name=source?.rows.get(id)?.[columnFor(source.asset.table)];
 return typeof name==='object'&&name?name[source.asset.locale]:name;
}
function provenance(source){
 const a=source.asset;return {asset:a.name,table:a.table,column:a.format==='classic-json'?'areas.name':columnFor(a.table),build:a.build,locale:a.locale};
}

export function normalizeRegion(version,value,tables){
 if(!regionVersions.includes(version)||!Number.isSafeInteger(value)||value===0)throw Error('Invalid region identity');
 const id=Math.abs(value),kind=value<0?'category':'area',table=value<0?'QuestSort':'AreaTable';
 const baseSource=version==='legion'||version==='classic'&&kind==='category'
  ?tables.find(s=>s.asset.reference===(version==='classic'?'classic-ref':'legion')&&s.asset.table===table&&s.asset.locale==='enUS')
  :tables.find(s=>s.asset.version===version&&s.asset.table===table&&s.asset.format!=='cpp-enum');
 if(!baseSource)throw Error(`Missing base region table: ${version}/${table}`);
 const baseName=nameAt(baseSource,id)||'',baseLocale=baseSource.asset.locale;
 const base=baseName?{name:baseName,locale:baseLocale,source:provenance(baseSource)}:null;
 const enumSource=tables.find(s=>s.asset.version===version&&s.asset.format==='cpp-enum'),constant=enumSource?.rows.get(id);
 const references=version==='legion'?['legion']:version==='pandaria'?['mop-ref','legion']:version==='cataclysm'?['legion','mop-ref','classic-ref']:['classic-ref','legion','mop-ref'];
 const candidates=[];
 for(const reference of references){
  const anchor=tables.find(s=>s.asset.reference===reference&&s.asset.table===table&&s.asset.locale===baseLocale);
  const english=tables.find(s=>s.asset.reference===reference&&s.asset.table===table&&s.asset.locale==='enUS');
  const anchorName=nameAt(anchor,id),englishName=nameAt(english,id);
  let match=null;
  if(baseName&&anchorName&&comparable(baseName)===comparable(anchorName))match={rule:baseSource.asset.reference===reference?'same-client-table':'id-and-source-name',locale:baseLocale,name:baseName,source:anchor.asset.name};
  else if(baseName&&kind==='category'&&constant&&englishName&&enumName(constant)===enumName(englishName))match={rule:'id-and-core-enum',name:'QUEST_SORT_'+constant,source:enumSource.asset.name};
  if(!match)continue;
  for(const locale of locales){
   const source=tables.find(s=>s.asset.reference===reference&&s.asset.table===table&&s.asset.locale===locale),name=nameAt(source,id);
   if(valid(name,locale))candidates.push({name,locale,source:provenance(source),match,english:englishName||'',englishSource:englishName?provenance(english):null});
  }
 }
 // Prefer the original English spelling when a base English row exists.
 if(valid(baseName,baseLocale)&&baseLocale==='enUS')candidates.unshift({name:baseName,locale:'enUS',source:provenance(baseSource),match:{rule:version==='classic'&&kind==='category'?'classic-era-reference':'base-client-table'},english:baseName,englishSource:provenance(baseSource)});
 const selected=locales.map(locale=>candidates.find(c=>c.locale===locale)).find(Boolean);
 return {value,id,kind,name:selected?.name||'',nameLocale:selected?.locale||null,nameSource:selected?.source||null,english:baseLocale==='enUS'?baseName:selected?.english||'',englishSource:baseLocale==='enUS'&&baseName?provenance(baseSource):selected?.englishSource||null,base,match:selected?.match||null};
}

export function regionAudit(dataset){
 const counts={zhCN:0,zhTW:0,enUS:0,missing:0};for(const r of dataset.records)counts[r.nameLocale||'missing']++;
 return {version:dataset.version,total:dataset.records.length,areas:dataset.records.filter(r=>r.kind==='area').length,categories:dataset.records.filter(r=>r.kind==='category').length,locales:counts,missing:dataset.records.filter(r=>!r.name).map(r=>r.value)};
}
export function regionBrowserData(datasets,lock){
 const sources=Object.fromEntries(lock.assets.filter(a=>a.format!=='dbd').map(a=>[a.name,{url:a.url,build:a.build,table:a.table}]));
 return {schemaVersion:1,sources,versions:Object.fromEntries(datasets.map(d=>[d.version,Object.fromEntries(d.records.map(r=>[r.value,{name:r.name,nameLocale:r.nameLocale,english:r.english,nameSource:r.nameSource,match:r.match}]))]))};
}
