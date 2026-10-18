import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegionSources,normalizeRegion,regionAudit,regionVersions} from './region-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const selected=process.argv[2]?[process.argv[2]]:regionVersions;
if(selected.some(v=>!regionVersions.includes(v)))throw Error('Unknown region version');
const lock=JSON.parse(await fs.readFile(path.join(root,'sources/regions/manifest.json'),'utf8'));
const tables=await loadRegionSources(root,lock);
await fs.mkdir(path.join(root,'data/regions'),{recursive:true});
for(const version of selected){
 const m=JSON.parse(await fs.readFile(path.join(root,'data',version,'manifest.json'),'utf8')),values=new Set();
 for(const f of m.files)for(const line of (await fs.readFile(path.join(root,f.path),'utf8')).trim().split('\n')){const r=JSON.parse(line);if(r.zoneOrSort!==0)values.add(r.zoneOrSort);}
 const dataset={schemaVersion:1,version,records:[...values].sort((a,b)=>a-b).map(value=>normalizeRegion(version,value,tables))};
 await fs.writeFile(path.join(root,'data/regions',version+'.json'),JSON.stringify(dataset,null,2)+'\n');
 console.log(JSON.stringify(regionAudit(dataset)));
}
