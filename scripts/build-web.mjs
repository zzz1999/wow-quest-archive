import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildReadingData} from './reading-data.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.writeFile(path.join(root,'web/reading-data.js'),'globalThis.QuestReadingData='+JSON.stringify(await buildReadingData())+';\n');
const catalog={schemaVersion:1,generatedAt:'2026-10-18',localeOrder:['zhCN','zhTW','enUS'],versions:[]};
await fs.mkdir(path.join(root,'web/data'),{recursive:true});
await fs.mkdir(path.join(root,'web/actors'),{recursive:true});
for(const id of ['classic','wotlk','cataclysm','pandaria','legion']){
 const manifestPath=path.join(root,'data',id,'manifest.json');
 try{await fs.access(manifestPath);}catch{continue;}
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 let records=[];for(const f of manifest.files)records.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 const payload=gzipSync(Buffer.from(JSON.stringify(records)),{level:9}).toString('base64');
 const questBundle=`window.QUEST_PACKS[${JSON.stringify(id)}]=${JSON.stringify(payload)};\n`;
 await fs.writeFile(path.join(root,'web/data',id+'.js'),questBundle);
 const actors=[];for(const f of manifest.actors.files)actors.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 const actorPayload=gzipSync(Buffer.from(JSON.stringify(actors)),{level:9}).toString('base64');
 const actorBundle=`window.QUEST_ACTOR_PACKS[${JSON.stringify(id)}]=${JSON.stringify(actorPayload)};\n`;
 await fs.writeFile(path.join(root,'web/actors',id+'.js'),actorBundle);
 catalog.versions.push({...manifest,bundleHashes:{quests:hash(questBundle),actors:hash(actorBundle)}});console.log(id,records.length,Math.round(payload.length/1024)+' KiB browser bundle');
}
await fs.writeFile(path.join(root,'web/catalog.js'),'window.QUEST_CATALOG='+JSON.stringify(catalog)+';\n');
await fs.mkdir(path.join(root,'reports'),{recursive:true});
await fs.writeFile(path.join(root,'reports/coverage.json'),JSON.stringify(catalog,null,2)+'\n');
// Stable content hashes refresh old Pages/browser caches and still work offline.
const htmlPath=path.join(root,'index.html');let html=await fs.readFile(htmlPath,'utf8');
for(const match of [...html.matchAll(/(?:src|href)="(web\/[a-z-]+\.(?:js|css))(?:\?v=[a-f0-9]+)?"/g)]){
 const revision=hash(await fs.readFile(path.join(root,match[1])));
 html=html.replace(match[0],match[0].replace(/="[^"]+"$/,`="${match[1]}?v=${revision}"`));
}
await fs.writeFile(htmlPath,html);
