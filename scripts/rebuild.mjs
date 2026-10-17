import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(await fs.readFile(path.join(root,'sources/manifest.json'),'utf8'));
const selected=lock.versions.filter(v=>!process.argv[2]||v.id===process.argv[2]);
if(!selected.length)throw new Error('Unknown version. Use classic, wotlk, cataclysm, pandaria, legion.');
const configs=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{cwd:root,stdio:'inherit',...options});if(r.error||r.status!==0)throw new Error(`${cmd} failed. ${r.error?.message||'exit '+r.status}`);}
for(const src of selected){
 const dir=path.join(root,'.cache',src.id);await fs.mkdir(dir,{recursive:true});const localFiles=[];
 for(const asset of src.assets){
  if(!asset.input)continue;
  const file=path.join(dir,asset.name);let bytes;try{bytes=await fs.readFile(file);}catch{}
  if(!bytes){console.log('Download '+asset.url);const r=await fetch(asset.url,{signal:AbortSignal.timeout(600000)});if(!r.ok)throw new Error('Download failed: '+r.status);bytes=Buffer.from(await r.arrayBuffer());if(hash(bytes)!==asset.sha256)throw new Error('Hash mismatch: '+asset.name);await fs.writeFile(file,bytes);}
  if(hash(bytes)!==asset.sha256)throw new Error('Cached source hash mismatch: '+asset.name);
  if(asset.entry){
   const dest=path.resolve(dir,asset.entry);if(!dest.startsWith(dir+path.sep))throw new Error('Unsafe archive entry');
   if(asset.name.endsWith('.gz')){await fs.writeFile(dest,gunzipSync(bytes));}
   else if(asset.name.endsWith('.7z')){
    const candidates=[process.env.SEVEN_ZIP,process.platform==='win32'?'C:/Program Files/7-Zip/7z.exe':null,'7z','7zz'].filter(Boolean);
    const bin=candidates.find(c=>spawnSync(c,['i'],{stdio:'ignore'}).status===0);if(!bin)throw new Error('Install 7-Zip, or set SEVEN_ZIP to the executable path.');
    run(bin,['x','-y',file,asset.entry,`-o${dir}`]);
   }else{run('tar',['-xf',file,'-C',dir,asset.entry]);}
   localFiles.push(dest);
  }else localFiles.push(file);
 }
 const {assets,...metadata}=src;configs.push({...metadata,localFiles});
}
const config=path.join(root,'.cache/rebuild-inputs.json');await fs.writeFile(config,JSON.stringify(configs,null,2));
run(process.execPath,[path.join(root,'scripts/import.mjs'),config]);
run(process.execPath,[path.join(root,'scripts/build-web.mjs')]);
run(process.execPath,[path.join(root,'scripts/validate.mjs')]);
