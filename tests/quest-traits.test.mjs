import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildQuestTraitData,questTraitAudit} from '../scripts/quest-traits-data.mjs';
import '../web/quest-traits.js';

globalThis.QuestTraitData=await buildQuestTraitData();
const ui=globalThis.QuestTraits;
const quest=(version='wotlk',fields={})=>({version,id:1,raceMask:0,classMask:0,flags:0,specialFlags:0,type:0,zoneOrSort:12,sourceFields:{},...fields});
const traits=(version,fields)=>ui.derive(quest(version,fields));
const raceBit=id=>2**(id-1);

test('fixed client tables supply Chinese race/class names and distinguish neutral Pandaren',()=>{
 const data=globalThis.QuestTraitData;
 assert.equal(data.races.find(r=>r.id===1).name,'人类');
 assert.equal(data.races.find(r=>r.id===24).team,'neutral');
 assert.equal(data.classes.find(c=>c.id===8).name,'法师');
 assert.ok(data.worldQuestTypes.includes(109));assert.deepEqual(data.emissaryTypes,[128]);
 assert.doesNotMatch(ui.options('classic','races'),/血精灵|熊猫人|虚空精灵/);
 assert.match(ui.options('legion','races'),/虚空精灵/);
 assert.doesNotMatch(ui.options('cataclysm','classes'),/武僧|恶魔猎手/);
 assert.match(ui.options('pandaria','classes'),/武僧/);
});

test('repeat and reset flags are interpreted per core, including Cataclysm monthly bit 4',()=>{
 for(const version of Object.keys(globalThis.QuestTraitData.versions)){
  assert.equal(traits(version,{specialFlags:1}).repeat.repeatable,true);
  assert.equal(traits(version,{flags:32768}).repeat.kind,'weekly');
 }
 assert.equal(traits('classic',{flags:4096,specialFlags:16}).repeat.kind,'once');
 for(const version of ['wotlk','pandaria','legion']){
  assert.equal(traits(version,{specialFlags:16}).repeat.kind,'monthly');
  assert.equal(traits(version,{specialFlags:4}).repeat.kind,'once');
 }
 assert.equal(traits('cataclysm',{specialFlags:4}).repeat.kind,'monthly');
 assert.equal(traits('cataclysm',{specialFlags:16}).repeat.kind,'once');
});

test('period flags imply repeatability even without the special repeat bit; weekly wins over daily',()=>{
 for(const version of ['wotlk','cataclysm','pandaria','legion']){
  assert.equal(traits(version,{flags:4096}).repeat.kind,'daily');
  assert.equal(traits(version,{flags:4096|32768}).repeat.kind,'weekly');
 }
 const daily=traits('wotlk',{flags:4096});
 assert.equal(ui.matches(daily,{repeat:'repeatable'}),true);
 assert.equal(ui.matches(daily,{repeat:'once'}),false);
 assert.equal(ui.matches(daily,{repeat:'weekly'}),false);
});

test('auto-completion, sharing and tracking do not imply repetition',()=>{
 assert.equal(traits('legion',{flags:8|1024|65536,sourceFields:{questtype:0}}).repeat.kind,'once');
 assert.equal(traits('classic',{sourceFields:{method:0}}).repeat.kind,'once');
 assert.equal(traits('wotlk',{flags:-1,specialFlags:0}).repeat.kind,'unknown');
 assert.equal(traits('wotlk',{flags:null}).repeat.kind,'unknown');
});

test('world/emissary categories are recurring, task/display flags alone are inconclusive',()=>{
 const world=traits('legion',{type:109,sourceFields:{questtype:3}});
 assert.equal(world.repeat.kind,'world');assert.equal(ui.matches(world,{repeat:'repeatable'}),true);
 assert.equal(traits('legion',{type:128}).repeat.kind,'emissary');
 assert.equal(traits('pandaria',{type:109}).repeat.kind,'once');
 for(const sourceFields of [{questtype:3},{flagsex:0x8000},{flagsex:0x1000000}]){
  const t=traits('legion',{sourceFields});
  assert.equal(t.repeat.kind,'unknown');assert.equal(ui.matches(t,{repeat:'once'}),false);
  assert.equal(ui.matches(t,{repeat:'repeatable'}),false);assert.equal(ui.matches(t,{repeat:'unknown'}),true);
 }
});

test('seasonal quests without imported event reset relations stay unconfirmed',()=>{
 const seasonal=traits('wotlk',{zoneOrSort:-22});
 assert.equal(seasonal.repeat.repeatable,null);assert.equal(ui.matches(seasonal,{repeat:'unknown'}),true);
 assert.equal(ui.matches(seasonal,{repeat:'once'}),false);assert.equal(ui.matches(seasonal,{repeat:'repeatable'}),false);
 assert.equal(traits('wotlk',{zoneOrSort:-22,flags:4096}).repeat.kind,'daily');
 assert.equal(traits('pandaria',{zoneOrSort:-378}).repeat.kind,'seasonal');
 assert.equal(traits('wotlk',{zoneOrSort:22}).repeat.kind,'once');
});

test('faction derives from playable races in that version, including masks containing future bits',()=>{
 assert.equal(traits('classic',{raceMask:77}).faction.kind,'alliance');
 assert.equal(traits('classic',{raceMask:1101}).faction.kind,'alliance');
 assert.equal(traits('classic',{raceMask:178}).faction.kind,'horde');
 assert.equal(traits('wotlk',{raceMask:690}).faction.kind,'horde');
 assert.equal(traits('cataclysm',{raceMask:2098253}).faction.kind,'alliance');
 assert.equal(traits('cataclysm',{raceMask:946}).faction.kind,'horde');
 assert.equal(traits('pandaria',{raceMask:18875469}).faction.kind,'alliance');
 assert.equal(traits('pandaria',{raceMask:33555378}).faction.kind,'horde');
 assert.equal(traits('legion',{raceMask:raceBit(27)}).faction.kind,'horde');
 assert.equal(traits('legion',{raceMask:raceBit(29)}).faction.kind,'alliance');
 assert.equal(traits('classic',{raceMask:raceBit(29)}).faction.kind,'unknown');
});

test('unrestricted and 64-bit masks preserve their semantics; Legion zero remains unconfirmed',()=>{
 for(const version of ['classic','wotlk','cataclysm','pandaria'])assert.equal(traits(version,{raceMask:0}).faction.kind,'both');
 assert.equal(traits('legion',{raceMask:0}).faction.kind,'unknown');
 for(const raceMask of [-1,4294967295,'18446744073709551615']){
  const t=traits('legion',{raceMask});assert.equal(t.faction.kind,'both');assert.equal(t.races.restricted,false);
 }
 for(const raceMask of [null,'not a mask',2**60,-2])assert.equal(traits('legion',{raceMask}).faction.kind,'unknown');
});

test('neutral Pandaren are not faction-exclusive, and contradictory faction/race filters return no match',()=>{
 const neutral=traits('pandaria',{raceMask:raceBit(24)});
 assert.equal(neutral.faction.kind,'neutral');assert.equal(ui.matches(neutral,{faction:'alliance'}),false);
 const mixed=traits('pandaria',{raceMask:raceBit(24)+1});
 assert.equal(mixed.faction.kind,'alliance-neutral');assert.equal(ui.matches(mixed,{faction:'alliance-only'}),false);
 const both=traits('legion',{raceMask:-1});
 assert.equal(ui.matches(both,{faction:'alliance',race:'2'}),false);
 assert.equal(ui.matches(both,{faction:'alliance',race:'1'}),true);
 assert.equal(ui.matches(both,{faction:'horde',race:'2'}),true);
 assert.equal(ui.matches(both,{faction:'alliance-only'}),false);
});

test('class requirements compose with faction, race and repetition without inferring race/class combinations',()=>{
 const mage=traits('classic',{raceMask:77,classMask:128,specialFlags:1});
 assert.equal(ui.matches(mage,{repeat:'repeatable',faction:'alliance-only',race:'1',playerClass:'8'}),true);
 assert.equal(ui.matches(mage,{playerClass:'1'}),false);assert.equal(ui.matches(mage,{playerClass:'restricted'}),true);
 assert.equal(ui.matches(mage,{playerClass:'unrestricted'}),false);
 assert.equal(ui.matches(traits('classic'),{playerClass:'8'}),true);
 assert.equal(ui.matches(traits('classic'),{playerClass:'12'}),false);
 assert.equal(traits('classic',{classMask:512}).classes.known,false);
 assert.deepEqual(traits('pandaria',{classMask:512}).classes.names,['武僧']);
});

test('presentation leaves source records untouched, includes qualification and escapes names',()=>{
 const q=Object.freeze(quest('classic',{raceMask:77,classMask:128})),before=JSON.stringify(q);
 assert.match(ui.html(q),/非可重复/);assert.match(ui.html(q),/仅联盟/);assert.match(ui.text(q),/职业要求：法师/);
 assert.match(ui.html(q),/前置任务、声望、NPC/);assert.equal(JSON.stringify(q),before);
 const human=globalThis.QuestTraitData.races.find(r=>r.id===1),name=human.name;
 try{human.name='<script>&';assert.match(ui.html(quest('classic',{raceMask:1})),/&lt;script&gt;&amp;/);}
 finally{human.name=name;}
});

test('actual archived Classic quests retain opposing faction restrictions and reports account for every row',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../data/classic/manifest.json',import.meta.url),'utf8'));
 const rows=(await fs.readFile(new URL('../'+manifest.files[0].path,import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(ui.derive(rows.find(r=>r.id===2)).faction.kind,'horde');
 assert.equal(ui.derive(rows.find(r=>r.id===5)).faction.kind,'alliance');
 const audit=questTraitAudit(rows,ui.derive);
 assert.equal(Object.values(audit.repetition).reduce((a,b)=>a+b,0),rows.length);
 assert.equal(Object.values(audit.factions).reduce((a,b)=>a+b,0),rows.length);
});
