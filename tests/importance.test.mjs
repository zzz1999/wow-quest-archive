import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildQuestImportance,importanceBrowserData} from '../scripts/importance-data.mjs';
import {buildQuestTraitData} from '../scripts/quest-traits-data.mjs';
import '../web/quest-traits.js';
import '../web/importance.js';

globalThis.QuestTraitData=await buildQuestTraitData();
const original=JSON.parse(await fs.readFile(new URL('../annotations/importance-rules.json',import.meta.url),'utf8'));
const definition={...original,groups:[]};
const quest=(version='classic',fields={})=>({version,id:1,key:`${version}:1`,english:{title:'A quest'},tags:[],flags:0,specialFlags:0,type:0,zoneOrSort:12,classMask:0,raceMask:0,sourceFields:{},rewards:{spells:[]},...fields});
const regions=(version,records=[])=>({version,records:records.map(([value,english,name=english])=>({value,kind:'category',english,name}))});
const build=(rows,regionData,def=definition)=>buildQuestImportance(rows,regionData,def,globalThis.QuestTraits.derive);

test('legendary and artifact highlights use explicit categories, not reward quality or ordinary quest links',()=>{
 assert.ok(build([quest('classic',{zoneOrSort:-344})],regions('classic',[[-344,'Legendary']])).quests[1].categories.includes('legendary'));
 assert.ok(build([quest('cataclysm',{type:83})],regions('cataclysm')).quests[1]);
 assert.ok(build([quest('legion',{type:107})],regions('legion')).quests[1].categories.includes('class'));
 assert.equal(build([quest('wotlk',{type:107})],regions('wotlk')).count,0);
 assert.equal(build([quest('legion',{type:110,sourceFields:{flagsex:65536},links:{nextQuestId:2},rewards:{items:[{quality:5}]}})],regions('legion')).count,0);
});

test('campaign categories distinguish class campaigns from story campaigns and skip repeatable chores',()=>{
 const r=regions('legion',[[-413,'Death Knight Campaign','死亡骑士战役'],[-428,'Legionfall Campaign','抗魔联军战役']]);
 assert.deepEqual(build([quest('legion',{zoneOrSort:-413})],r).quests[1].categories,['class']);
 assert.deepEqual(build([quest('legion',{zoneOrSort:-428})],r).quests[1].categories,['story']);
 assert.equal(build([quest('legion',{zoneOrSort:-413,flags:4096})],r).count,0);
 assert.equal(build([quest('legion',{classMask:32})],r).count,0);
});

test('class unlocks require a versioned ability allowlist and a real class restriction',()=>{
 const ability={rewards:{spells:[{id:697,role:'display'}]},classMask:256};
 assert.deepEqual(build([quest('classic',ability)],regions('classic')).quests[1].categories,['class']);
 assert.equal(build([quest('classic',{...ability,classMask:0})],regions('classic')).count,0);
 assert.equal(build([quest('legion',ability)],regions('legion')).count,0);
 assert.equal(build([quest('classic',{...ability,rewards:{spells:[{id:9884,role:'cast'}]}})],regions('classic')).count,0);
});

test('reviewed entries guard exact version and title; no tag changes or source mutations occur',()=>{
 const q=quest(),before=JSON.stringify(q),def={...definition,groups:[{id:'reviewed',version:'classic',categories:['unlock'],reason:'Opens a gate',source:{label:'Archive',url:'docs/IMPORTANCE.md'},quests:[{id:1,englishTitle:'A quest'}]}]};
 assert.ok(build([q],regions('classic'),def).quests[1]);
 assert.equal(JSON.stringify(q),before);
 assert.equal(build([quest('wotlk')],regions('wotlk'),def).count,0);
 assert.throws(()=>build([quest('classic',{english:{title:'Another quest'}})],regions('classic'),def),/Importance title changed/);
 assert.throws(()=>build([],regions('classic'),def),/Missing importance anchor/);
});

test('unreviewed test, hidden tracking and custom rows do not acquire importance from broad categories',()=>{
 for(const fields of [{tags:['suspected-test']},{tags:['community-custom']},{flags:1024}])assert.equal(build([quest('classic',{type:83,...fields})],regions('classic')).count,0);
 assert.equal(build([quest('legion',{type:107,sourceFields:{flagsex:0x20000}})],regions('legion')).count,0);
});

test('offline highlights preserve source titles, expose reasons and escape annotation content',()=>{
 const q=quest('classic',{type:83}),result=build([q],regions('classic'));
 globalThis.QuestImportanceData=importanceBrowserData(definition,[result]);
 assert.match(globalThis.QuestImportance.badge(q),/重要/);
 assert.match(globalThis.QuestImportance.html(q),/传说任务/);
 assert.equal(globalThis.QuestImportance.get(quest('wotlk')),null);
 assert.equal(globalThis.QuestImportance.get({...q,english:{title:'Changed'}}),null);
 const reason=result.quests[1].reasons[0];reason.reason='<script>alert(1)</script>';reason.source={label:'<b>Unsafe</b>',url:'javascript:alert(1)'};
 const html=globalThis.QuestImportance.html(q);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script|href="javascript:/);
 assert.match(globalThis.QuestImportance.text(q),/档案重点：传说任务/);
});
