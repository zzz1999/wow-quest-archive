import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let total=0;
for(const id of ['classic','wotlk','cataclysm','pandaria','legion']){
 const m=JSON.parse(await fs.readFile(path.join(root,'data',id,'manifest.json'),'utf8'));
 const seen=new Set(),fields={},records=[];
 for(const f of m.files){const content=await fs.readFile(path.join(root,f.path));assert.equal(createHash('sha256').update(content).digest('hex'),f.sha256,f.path);const rows=content.toString('utf8').trim().split('\n').map(x=>JSON.parse(x));assert.equal(rows.length,f.records);
  for(const r of rows){assert.equal(r.version,id);assert.equal(r.key,`${id}:${r.id}`);assert.ok(Number.isInteger(r.id)&&r.id>0);assert.ok(!seen.has(r.key),'Duplicate '+r.key);seen.add(r.key);
   for(const [key,value]of Object.entries(r.text)){assert.equal(typeof value,'string');assert.ok(!value.includes('\ufffd'),'Invalid UTF-8 replacement in '+r.key);const locale=r.textLocales[key];assert.ok(['zhCN','zhTW','enUS',null].includes(locale));if(value)assert.ok(locale);else assert.equal(locale,null);if(locale==='zhCN'||locale==='zhTW')assert.ok(/\p{Script=Han}/u.test(value));fields[key]??={zhCN:0,zhTW:0,enUS:0,missing:0};fields[key][locale||'missing']++;}
  }records.push(...rows);
 }
 assert.equal(seen.size,m.count);assert.deepEqual(fields,m.fields);
 const bundle=await fs.readFile(path.join(root,'web/data',id+'.js'),'utf8');const b64=bundle.match(/="([A-Za-z0-9+/=]+)";/)?.[1];assert.ok(b64,'Missing bundle '+id);const packed=JSON.parse(gunzipSync(Buffer.from(b64,'base64')));assert.deepEqual(packed,records,'Browser bundle differs from JSONL '+id);
 total+=m.count;console.log(`${id}: ${m.count} records; hashes, locale provenance, UTF-8 and offline bundle verified`);
}
console.log(`Verified ${total} versioned quest records.`);
