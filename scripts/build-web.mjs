import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildReadingData} from './reading-data.mjs';
import {rewardAudit} from './reward-audit.mjs';
import {regionAudit,regionBrowserData,regionVersions} from './region-data.mjs';
import {buildQuestTraitData,questTraitAudit} from './quest-traits-data.mjs';
import '../web/quest-traits.js';
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.writeFile(path.join(root,'web/reading-data.js'),'globalThis.QuestReadingData='+JSON.stringify(await buildReadingData())+';\n');
globalThis.QuestTraitData=await buildQuestTraitData();
await fs.writeFile(path.join(root,'web/quest-traits-data.js'),'globalThis.QuestTraitData='+JSON.stringify(globalThis.QuestTraitData)+';\n');
const catalog={schemaVersion:1,generatedAt:'2026-10-18',localeOrder:['zhCN','zhTW','enUS'],versions:[]};
const rewardReports=[];
const traitReports=[];
await fs.mkdir(path.join(root,'web/data'),{recursive:true});
await fs.mkdir(path.join(root,'web/actors'),{recursive:true});
await fs.mkdir(path.join(root,'web/items'),{recursive:true});
const iconLock=JSON.parse(await fs.readFile(path.join(root,'sources/items/icons.json'),'utf8'));
const unavailableIcons=new Set(iconLock.icons.filter(i=>i.missing).map(i=>i.name));
const itemReports=[];
for(const id of ['classic','wotlk','cataclysm','pandaria','legion']){
 const manifestPath=path.join(root,'data',id,'manifest.json');
 try{await fs.access(manifestPath);}catch{continue;}
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 let records=[];for(const f of manifest.files)records.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 rewardReports.push(rewardAudit(records));
 traitReports.push(questTraitAudit(records,globalThis.QuestTraits.derive));
 const payload=gzipSync(Buffer.from(JSON.stringify(records)),{level:9}).toString('base64');
 const questBundle=`window.QUEST_PACKS[${JSON.stringify(id)}]=${JSON.stringify(payload)};\n`;
 await fs.writeFile(path.join(root,'web/data',id+'.js'),questBundle);
 const actors=[];for(const f of manifest.actors.files)actors.push(...(await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 const actorPayload=gzipSync(Buffer.from(JSON.stringify(actors)),{level:9}).toString('base64');
 const actorBundle=`window.QUEST_ACTOR_PACKS[${JSON.stringify(id)}]=${JSON.stringify(actorPayload)};\n`;
 await fs.writeFile(path.join(root,'web/actors',id+'.js'),actorBundle);
 const itemManifest=JSON.parse(await fs.readFile(path.join(root,'data/items',id+'-manifest.json'),'utf8'));
 const items=[];for(const file of itemManifest.files)items.push(...(await fs.readFile(path.join(root,file.path),'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)));
 // Raw fields stay in JSONL. The browser needs only the normalized presentation.
 const browserItems=items.map(({raw,sources,...item})=>({...item,icon:unavailableIcons.has(item.icon)?null:item.icon}));
 const itemPayload=gzipSync(Buffer.from(JSON.stringify(browserItems)),{level:9}).toString('base64');
 const itemBundle=`window.QUEST_ITEM_PACKS[${JSON.stringify(id)}]=${JSON.stringify(itemPayload)};\n`;
 await fs.writeFile(path.join(root,'web/items',id+'.js'),itemBundle);
 itemReports.push(itemManifest);
 catalog.versions.push({...manifest,items:{count:items.length},bundleHashes:{quests:hash(questBundle),actors:hash(actorBundle),items:hash(itemBundle)}});console.log(id,records.length,Math.round(payload.length/1024)+' KiB browser bundle',items.length,'items');
}
await fs.writeFile(path.join(root,'web/catalog.js'),'window.QUEST_CATALOG='+JSON.stringify(catalog)+';\n');
await fs.mkdir(path.join(root,'reports'),{recursive:true});
await fs.writeFile(path.join(root,'reports/coverage.json'),JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile(path.join(root,'reports/reward-audit.json'),JSON.stringify({schemaVersion:1,versions:rewardReports},null,2)+'\n');
await fs.writeFile(path.join(root,'reports/quest-traits.json'),JSON.stringify({schemaVersion:1,versions:traitReports},null,2)+'\n');
await fs.writeFile(path.join(root,'reports/item-audit.json'),JSON.stringify({schemaVersion:1,versions:itemReports,icons:{available:iconLock.icons.filter(i=>!i.missing).length,missing:iconLock.icons.filter(i=>i.missing).map(i=>i.name)}},null,2)+'\n');
const regionLock=JSON.parse(await fs.readFile(path.join(root,'sources/regions/manifest.json'),'utf8'));
const regions=await Promise.all(regionVersions.map(async id=>JSON.parse(await fs.readFile(path.join(root,'data/regions',id+'.json'),'utf8'))));
await fs.writeFile(path.join(root,'web/regions-data.js'),'globalThis.QuestRegionData='+JSON.stringify(regionBrowserData(regions,regionLock))+';\n');
await fs.writeFile(path.join(root,'reports/region-audit.json'),JSON.stringify({schemaVersion:1,versions:regions.map(regionAudit)},null,2)+'\n');
// Stable content hashes refresh old Pages/browser caches and still work offline.
const htmlPath=path.join(root,'index.html');let html=await fs.readFile(htmlPath,'utf8');
for(const match of [...html.matchAll(/(?:src|href)="(web\/[a-z-]+\.(?:js|css))(?:\?v=[a-f0-9]+)?"/g)]){
 // Match .gitattributes before hashing, including files edited with CRLF on Windows.
 const assetPath=path.join(root,match[1]),asset=await fs.readFile(assetPath,'utf8'),normalized=asset.replace(/\r\n/g,'\n');
 if(normalized!==asset)await fs.writeFile(assetPath,normalized);
 const revision=hash(normalized);
 html=html.replace(match[0],match[0].replace(/="[^"]+"$/,`="${match[1]}?v=${revision}"`));
}
await fs.writeFile(htmlPath,html);
