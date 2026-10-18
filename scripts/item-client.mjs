import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {csvRows} from './reward-data.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const locales=['enUS','koKR','frFR','deDE','zhCN','zhTW','esES','esMX','ruRU'];
const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<4;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
export function dbcSchema(text,build){
 const blocks=text.replace(/\r/g,'').split(/\n\s*\n/),types=new Map();
 for(const line of blocks[0].split('\n')){const m=/^(int|float|string|locstring)(?:<[^>]+>)? ([\w?]+)/.exec(line);if(m)types.set(m[2].replace('?',''),m[1]);}
 const matches=blocks.slice(1).filter(block=>block.split('\n').filter(l=>l.startsWith('BUILD ')).some(line=>line.slice(6).split(/,\s*/).some(range=>{const [from,to=from]=range.split('-');return compare(build,from)>=0&&compare(build,to)<=0;})));
 if(matches.length!==1)throw Error(`Expected one DBC layout for ${build}, found ${matches.length}`);
 let offset=0;const fields=[];
 for(const line of matches[0].split('\n')){
  if(!line||/^(BUILD|LAYOUT|COMMENT)/.test(line))continue;
  const m=/^(?:\$[\w,]+\$)?(\w+)(?:<([u]?\d+)>)?(?:\[(\d+)\])?(?:\s*\/\/.*)?$/.exec(line.trim());
  if(!m||m[2]&&!['32','u32'].includes(m[2]))throw Error('Unsupported DBC field '+line);
  const type=types.get(m[1]);if(!type)throw Error('Missing DBC column '+m[1]);
  const count=Number(m[3]||1),width=type==='locstring'?(Number(build[0])<2?9:Number(build[0])<4?17:1):1;
  fields.push({name:m[1].toLowerCase(),type,count,width,offset});offset+=count*width;
 }
 return {fields,count:offset};
}
export function dbcTable(bytes,schema){
 if(bytes.toString('ascii',0,4)!=='WDBC')throw Error('Expected WDBC');
 const rows=bytes.readUInt32LE(4),fields=bytes.readUInt32LE(8),size=bytes.readUInt32LE(12),stringSize=bytes.readUInt32LE(16),start=20+rows*size;
 if(fields!==schema.count||size!==fields*4||start+stringSize!==bytes.length)throw Error(`DBC layout mismatch: file ${fields}, schema ${schema.count}`);
 const index=new Map();for(let i=0;i<rows;i++){const id=bytes.readUInt32LE(20+i*size);if(index.has(id))throw Error('Duplicate DBC ID');index.set(id,20+i*size);}
 const string=offset=>{const p=bytes.readUInt32LE(offset);if(p>=stringSize)throw Error('Invalid DBC string');const end=bytes.indexOf(0,start+p);if(end<0)throw Error('Unterminated DBC string');return bytes.toString('utf8',start+p,end);};
 const get=id=>{const base=index.get(Number(id));if(base===undefined)return null;const row={};
  for(const f of schema.fields)for(let i=0;i<f.count;i++){
   const key=f.name+(f.count>1?'_'+i:''),offset=base+4*(f.offset+i*f.width);
   if(f.type==='locstring'&&f.width>1){row[key]=Object.fromEntries(locales.slice(0,f.width-1).map((l,i)=>[l,string(offset+i*4)]));}
   else row[key]=f.type==='string'||f.type==='locstring'?string(offset):f.type==='float'?bytes.readFloatLE(offset):bytes.readInt32LE(offset);
  }return row;};
 return {get,size:rows,*values(){for(const id of index.keys())yield get(id);}};
}
export async function sourceBytes(asset){
 const file=path.resolve(ROOT,'.cache/items',asset.name),prefix=path.resolve(ROOT,'.cache/items')+path.sep;
 if(!file.startsWith(prefix))throw Error('Invalid item source path');
 let bytes;try{bytes=await fs.readFile(file);}catch{
  if(asset.archive){
   const a=asset.archive,end=a.offset+30+Buffer.byteLength(a.name)+a.packed+2047;
   const r=await fetch(a.url,{headers:{Range:`bytes=${a.offset}-${end}`,Accept:'application/octet-stream'},signal:AbortSignal.timeout(120000)});
   if(r.status!==206||r.headers.get('content-range')!==`bytes ${a.offset}-${end}/${a.total}`){await r.body?.cancel();throw Error('Item archive must support exact byte ranges: '+asset.name);}
   const packed=Buffer.from(await r.arrayBuffer()),start=30+packed.readUInt16LE(26)+packed.readUInt16LE(28);
   if(packed.readUInt32LE(0)!==0x04034b50||packed.readUInt16LE(6)&1||packed.toString('utf8',30,30+packed.readUInt16LE(26))!==a.name)throw Error('Invalid item ZIP member');
   bytes=a.method===8?inflateRawSync(packed.subarray(start,start+a.packed)):a.method===0?packed.subarray(start,start+a.packed):null;
   if(!bytes)throw Error('Unsupported item ZIP compression');
  }else{
   const r=await fetch(asset.url,{headers:asset.headers,signal:AbortSignal.timeout(240000)});if(!r.ok)throw Error(`Item source HTTP ${r.status}: ${asset.name}`);bytes=Buffer.from(await r.arrayBuffer());
  }
 }
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Item source hash mismatch '+asset.name);
 await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.access(file);}catch{await fs.writeFile(file,bytes);}return bytes;
}
export async function loadItemClient(version,manifest){
 const tables=new Map(),assets=manifest.assets.filter(a=>a.version===version);
 for(const asset of assets){
  const bytes=await sourceBytes(asset);let rows;
  if(asset.format==='dbc'){
   const def=manifest.assets.find(a=>a.version==='schemas'&&a.table===asset.table);if(!def)throw Error('Missing schema '+asset.table);
   // WoWDBDefs omits 18414 here. The pinned 5.4.8 core's SpellMiscEntry
   // explicitly verifies the same 26 columns (DBCStructure.h, lines 2235-2263).
   const layoutBuild=asset.table==='SpellMisc'&&asset.build==='5.4.8.18414'?'5.4.8.18291':asset.build;
   rows=dbcTable(bytes,dbcSchema((await sourceBytes(def)).toString('utf8'),layoutBuild));
  }else if(asset.format==='csv')rows=new Map([...csvRows(bytes.toString('utf8'))].map(r=>[Number(r.id),r]));
  else if(asset.format==='json')rows=JSON.parse(bytes.toString('utf8'));
  else throw Error('Unsupported item source '+asset.format);
  tables.set(asset.table+':'+asset.locale,{rows,source:{asset:asset.name,table:asset.table,build:asset.build,locale:asset.locale}});
 }
 return tables;
}
