import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog={schemaVersion:1,generatedAt:'2026-10-18',localeOrder:['zhCN','zhTW','enUS'],versions:[]};
await fs.mkdir(path.join(root,'web/data'),{recursive:true});
for(const id of ['classic','wotlk','cataclysm','pandaria','legion']){
 const manifestPath=path.join(root,'data',id,'manifest.json');
 try{await fs.access(manifestPath);}catch{continue;}
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 let records=[];for(const f of manifest.files)records.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 const payload=gzipSync(Buffer.from(JSON.stringify(records)),{level:9}).toString('base64');
 await fs.writeFile(path.join(root,'web/data',id+'.js'),`window.QUEST_PACKS[${JSON.stringify(id)}]=${JSON.stringify(payload)};\n`);
 catalog.versions.push(manifest);console.log(id,records.length,Math.round(payload.length/1024)+' KiB browser bundle');
}
await fs.writeFile(path.join(root,'web/catalog.js'),'window.QUEST_CATALOG='+JSON.stringify(catalog)+';\n');
await fs.mkdir(path.join(root,'reports'),{recursive:true});
await fs.writeFile(path.join(root,'reports/coverage.json'),JSON.stringify(catalog,null,2)+'\n');
