import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {armorValue,damageValue,legionStat,renderSpellText,choose} from '../scripts/item-data.mjs';
import {dbcSchema,dbcTable} from '../scripts/item-client.mjs';
test('item locale fallback preserves real translations and rejects a Chinese-tagged English placeholder',()=>{
 assert.equal(choose([{text:'Sword',locale:'zhCN'},{text:'劍',locale:'zhTW'},{text:'Sword',locale:'enUS'}]).locale,'zhTW');
 assert.equal(choose([{text:'剑',locale:'zhCN'},{text:'劍',locale:'zhTW'}]).text,'剑');
 assert.equal(choose([{text:'Меч',locale:'ruRU'}]).text,'');
});
test('armor uses version-local level, quality and slot; missing client rows remain unknown',()=>{
 const rows={ItemArmorTotal:{cloth:100},ItemArmorQuality:{qualitymod_2:1.1},ArmorLocation:{clothmodifier:.2},ItemArmorShield:{quality_2:123.6}};
 const item={classId:4,subclassId:1,itemLevel:20,quality:2,inventoryType:20},seen=[];
 assert.equal(armorValue(item,(t,id)=>(seen.push([t,id]),rows[t])),22);assert.deepEqual(seen.at(-1),['ArmorLocation',5]);
 assert.equal(armorValue({...item,subclassId:6},t=>rows[t]),124);assert.equal(armorValue(item,()=>null),null);
});
test('weapons retain legacy multiple damage schools and use the right later-version ranged table',()=>{
 const item={classId:2,subclassId:2,version:'pandaria',quality:2,itemLevel:20,inventoryType:15,delay:2000};
 assert.deepEqual(damageValue(item,{dmg_min1:10,dmg_max1:20,dmg_type1:0,dmg_min2:2,dmg_max2:4,dmg_type2:2},()=>null).map(d=>d.school),[0,2]);
 const seen=[];const d=damageValue(item,{statscalingfactor:.4},t=>(seen.push(t),{quality_2:10}));assert.equal(seen[0],'ItemDamageRanged');assert.equal(d[0].min,16);assert.equal(d[0].max,24);
 seen.length=0;damageValue({...item,version:'legion'},{dmgvariance:.4},t=>(seen.push(t),{quality_2:10}));assert.equal(seen[0],'ItemDamageTwoHand');
});
test('Legion allocated stats do not silently become zero or ignore missing socket costs',()=>{
 const item={quality:2,inventoryType:5,itemLevel:20},raw={statmodifier_bonusstat_0:7,statpercenteditor_0:4000,statpercentageofsocket_0:0};
 assert.equal(legionStat(item,raw,0,()=>({good_0:25})).amount,10);
 assert.equal(legionStat(item,{...raw,statpercentageofsocket_0:.2},0,()=>({good_0:25})).amount,null);
 assert.equal(legionStat(item,raw,0,()=>null).amount,null);
});
test('spell values resolve ranges, duration, ticks and linked spells without evaluating expressions',()=>{
 const s={id:1,duration:10000,effects:[{effectbasepoints:9,effectdiesides:1,effectauraperiod:2000}]};const lookup=id=>id===1?s:null;
 assert.equal(renderSpellText('恢复 $s1，持续 $d，共 $o1。',s,lookup,'zhCN').text,'恢复 10，持续 10 秒，共 50。');
 assert.equal(renderSpellText('$1s1',s,lookup).text,'10');
 assert.equal(renderSpellText('${globalThis.pwned=1}',s,lookup).unresolved,true);assert.equal(globalThis.pwned,undefined);
 assert.equal(renderSpellText('$s1', {...s,effects:[{effectbasepoints:0,coefficient:1}]},lookup).unresolved,true);
 assert.equal(renderSpellText('$999s1',s,lookup).unresolved,true);
 assert.equal(renderSpellText('$spellname',s,lookup).unresolved,true);
 assert.equal(renderSpellText('$s1',{...s,effects:[{effectbasepoints:4,effectdiesides:6}]},lookup).text,'5–10');
});
test('DBC readers enforce layout and reject malformed bounds',()=>{
 const schema=dbcSchema('COLUMNS\nint ID\nstring Name\n\nBUILD 1.12.1.5875\n$id$ID<32>\nName\n','1.12.1.5875');
 const b=Buffer.alloc(31);b.write('WDBC');[1,2,8,3].forEach((v,i)=>b.writeUInt32LE(v,4+i*4));b.writeUInt32LE(7,20);b.writeUInt32LE(1,24);b.write('X',29);
 assert.equal(dbcTable(b,schema).get(7).name,'X');b.writeUInt32LE(7,24);assert.throws(()=>dbcTable(b,schema).get(7),/string/);
 assert.throws(()=>dbcSchema('COLUMNS\nint ID\n\nBUILD 3.3.5.12340\n$id$ID<32>','5.4.8.18414'),/layout/);
});
test('offline tooltip escapes game strings, shows stats/effects and restricts icon paths',async()=>{
 const sandbox={};vm.runInNewContext(await fs.readFile(new URL('../web/items.js',import.meta.url),'utf8'),sandbox);
 const item={version:'classic',id:9,name:'<img src=x onerror=alert(1)>',quality:3,itemLevel:40,inventoryType:5,classId:4,subclassId:1,armor:50,stats:[{type:7,label:'耐力',amount:12}],effects:[{trigger:0,text:'恢复 100 生命',textLocale:'zhCN',cooldown:120000}],notes:[]};
 const html=sandbox.QuestItems.tooltipHtml(item);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|<[^>]+onerror=/);assert.match(html,/\+12 耐力/);assert.match(html,/使用：恢复 100 生命/);assert.match(html,/冷却 2 分钟/);assert.doesNotMatch(html,/https?:/);
 assert.equal(sandbox.QuestItems.icon({icon:'../../evil'}),'web/icons/inv_misc_questionmark.jpg');
 assert.match(sandbox.QuestItems.button('classic',item),/aria-label="查看&lt;img/);assert.doesNotMatch(sandbox.QuestItems.button('classic',item),/src="https?:/);
});
