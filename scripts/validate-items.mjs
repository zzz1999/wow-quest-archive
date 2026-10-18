import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import {attachReferences} from './wowhead-data.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function validateItems(root,catalog){
 const lock=JSON.parse(await fs.readFile(path.join(root,'sources/items/manifest.json'),'utf8')),assets=new Map(lock.assets.map(a=>[a.name,a]));
 for(const a of assets.values()){assert.ok(/^[a-f0-9]{64}$/.test(a.sha256));assert.ok(a.bytes>0);assert.ok(a.build);assert.ok(a.url.startsWith('https://'));}
 const icons=JSON.parse(await fs.readFile(path.join(root,'sources/items/icons.json'),'utf8')).icons,byIcon=new Map(icons.map(i=>[i.name,i]));
 for(const a of icons){assert.match(a.name,/^[a-z0-9_-]+$/);if(a.missing)continue;assert.equal(a.path,`web/icons/${a.name}.jpg`);const b=await fs.readFile(path.join(root,a.path));assert.equal(b.length,a.bytes);assert.equal(hash(b),a.sha256);assert.equal(b[0],255);assert.equal(b[1],216);}
 assert.ok(byIcon.get('inv_misc_questionmark')&&!byIcon.get('inv_misc_questionmark').missing);
 for(const v of catalog.versions){
  const m=JSON.parse(await fs.readFile(path.join(root,'data/items',v.id+'-manifest.json'),'utf8')),rows=[];
  for(const f of m.files){const b=await fs.readFile(path.join(root,f.path));assert.equal(hash(b),f.sha256);assert.equal(b.length,f.bytes);const shard=b.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);assert.equal(shard.length,f.records);rows.push(...shard);}
  const ids=new Set();for(const r of rows){assert.equal(r.version,v.id);assert.equal(r.key,`${v.id}:item:${r.id}`);assert.ok(!ids.has(r.id));ids.add(r.id);assert.ok(['zhCN','zhTW','enUS',null].includes(r.nameLocale));if(r.icon)assert.ok(byIcon.has(r.icon),'Untracked icon '+r.key);
   for(const d of r.damage){assert.ok(d.min>=0&&d.max>=d.min,'Invalid damage '+r.key);assert.ok(Number.isFinite(d.min)&&Number.isFinite(d.max));}
   for(const stat of r.stats)assert.ok(stat.amount===null||Number.isFinite(stat.amount));
   for(const e of r.effects){assert.ok(e.id>0);assert.ok(!e.text||!e.text.includes('$'),'Unresolved tooltip syntax '+r.key);if(e.descriptionSource?.asset){const source=assets.get(e.descriptionSource.asset);assert.equal(source?.version,v.id);assert.equal(source.build,e.descriptionSource.build);}}
  }
  assert.equal(rows.length,m.count);assert.equal(v.items.count,m.count);
  const expected=new Set();for(const file of v.files)for(const line of (await fs.readFile(path.join(root,file.path),'utf8')).trim().split('\n')){const q=JSON.parse(line);for(const i of [...q.rewards.items,...q.rewards.choices,...(q.rewards.package?.items||[])])expected.add(i.id);}
  assert.deepEqual([...ids].sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b),'Missing reward item archive '+v.id);
  const bundle=await fs.readFile(path.join(root,'web/items',v.id+'.js'),'utf8');assert.equal(hash(bundle).slice(0,12),v.bundleHashes.items);
  const browser=JSON.parse(gunzipSync(Buffer.from(bundle.match(/="([A-Za-z0-9+/=]+)";/)[1],'base64')));
  const references=JSON.parse(await fs.readFile(path.join(root,'data/wowhead',v.id+'.json'),'utf8'));
  assert.deepEqual(browser,attachReferences(rows,references,'items').map(({raw,sources,...r})=>({...r,icon:byIcon.get(r.icon)?.missing?null:r.icon})));
  console.log(`${v.id}: ${rows.length} offline items, reward references, sources and browser bundle verified`);
 }
 for(const file of ['web/items.js','web/items.css']){const text=await fs.readFile(path.join(root,file),'utf8');assert.doesNotMatch(text,/https?:\/\/|fetch\s*\(|url\(\s*['"]?https?:/,'Runtime remote dependency '+file);}
 console.log(`${icons.filter(i=>!i.missing).length} local item icons verified by SHA-256.`);
}
