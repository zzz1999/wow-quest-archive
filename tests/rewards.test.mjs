import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRewardContext,normalizeRewards,roundQuestXP} from '../scripts/rewards.mjs';
import {csvRows,readCataDBC,sqlNamePrefixes} from '../scripts/reward-data.mjs';

function context(version,tables=new Map(),clientTables=new Map()){return createRewardContext(tables,version,{version,tables:clientTables});}
function client(table,rows,{locale='enUS',format='csv'}={}){return [table+':'+locale,{rows:new Map(rows.map(r=>[Number(r.id),r])),asset:{format},build:'test-build',source:'test-client'}];}
test('classic rewards distinguish fixed, choice and cost; item names fall back by language',()=>{
 const tables=new Map([['item_template',[{entry:1434,name:'Glowing Wax Stick',quality:1,itemlevel:7},{entry:100,name:'Missing Translation'}]],['locales_item',[{entry:1434,name_loc4:'蜡棒',name_loc5:'蠟棒'},{entry:100,name_loc4:'English placeholder',name_loc5:'繁體物品'}]]]);
 const base={questlevel:7,rewmoneymaxlevel:288,reworreqmoney:-125,rewitemid1:1434,rewitemcount1:5,rewchoiceitemid1:100,rewchoiceitemcount1:1,rewrepfaction1:72,rewrepvalue1:150};
 const r=normalizeRewards(base,{},'classic',context('classic',tables));
 assert.equal(r.items[0].name,'蜡棒');assert.equal(r.items[0].count,5);assert.equal(r.choices[0].nameLocale,'zhTW');
 assert.equal(r.money.copper,-125);assert.equal(r.experience.amount,480);assert.equal(r.reputation[0].amount,150);
 assert.equal(r.items[0].nameSource.column,'name_loc4');assert.equal(r.columns['items.1.count'],'quest_template.rewitemcount1');
 assert.equal(base.rewitemcount1,5);
});
test('wotlk XP uses zero-based difficulty against SQL columns starting at one; reputation keeps negative values',()=>{
 const data=new Map([client('QuestXP',[{id:20,difficulty_5:1150,difficulty_6:1550}],{format:'sql'}),client('QuestFactionReward',[{id:2,difficulty_6:-250}],{format:'sql'})]);
 const r=normalizeRewards({questlevel:20,rewardxpdifficulty:5,rewardfactionid1:87,rewardfactionvalue1:-5,rewardfactionid2:72,rewardfactionoverride2:12500,rewardmoney:600,rewardmoneydifficulty:5},{rewardtitle:63},'wotlk',context('wotlk',new Map(),data));
 assert.equal(r.experience.amount,1550);assert.equal(r.experience.basis.column,'difficulty_6');
 assert.equal(r.reputation[0].amount,-250);assert.equal(r.reputation[1].amount,125);
 assert.equal(r.money.dynamic,true);assert.equal(r.money.copper,600);assert.equal(r.columns.title,'quest_template_addon.rewardtitle');
});
test('legion resolves package candidates and table money without adding captured money twice',()=>{
 const data=new Map([client('ItemSparse',[{id:57398,display_lang:'烛光法杖',overallqualityid:2,itemlevel:8}],{locale:'zhCN'}),client('ItemSparse',[{id:57398,display_lang:'Candle Staff',overallqualityid:2,itemlevel:8}]),client('QuestPackageItem',[{id:4354,packageid:782,itemid:57398,itemquantity:1,displaytype:1}]),client('QuestXP',[{id:7,difficulty_5:830}]),client('QuestMoneyReward',[{id:7,difficulty_5:175}])]);
 const r=normalizeRewards({questlevel:7,questpackageid:782,rewardxpdifficulty:5,rewardxpmultiplier:1,rewardmoney:999,rewardmoneydifficulty:5,rewardmoneymultiplier:1}, {},'legion',context('legion',new Map(),data));
 assert.equal(r.items.length,0);assert.equal(r.choices.length,0);assert.equal(r.package.items[0].name,'烛光法杖');assert.equal(r.package.items[0].displayType,1);
 assert.equal(r.money.copper,175);assert.equal(r.money.capturedCopper,999);assert.equal(r.experience.amount,825);
});
test('zero multipliers, unknown quantities and scaling are not turned into made-up fixed rewards',()=>{
 const r=normalizeRewards({questlevel:-1,rewarditem1:1,rewardxpdifficulty:5,rewardxpmultiplier:0,rewardmoneydifficulty:5,rewardmoneymultiplier:1,rewardbonusmoney:100,flags:0x20000},{},'legion',context('legion'));
 assert.equal(r.items[0].count,null);assert.equal(r.experience.amount,0);assert.equal(r.money.copper,null);assert.equal(r.money.dynamic,true);assert.equal(r.money.maxLevelBonus,0);
 assert.throws(()=>createRewardContext(new Map(),'classic',{version:'legion',tables:new Map()}),/version mismatch/);
});
test('pandaria reward columns keep currency, skill and spell roles distinct',()=>{
 const r=normalizeRewards({level:90,rewardxpid:5,rewardorrequiredmoney:10000,rewarditemid1:101,rewarditemcount1:2,rewardcurrencyid1:738,rewardcurrencycount1:3,rewardfactionid1:1271,rewardfactionvalueidoverride1:25000,rewardskillid:185,rewardskillpoints:5,rewardspell:200,rewardspellcast:300,rewardpackageitemid:63},{},'pandaria',context('pandaria'));
 assert.equal(r.items[0].count,2);assert.equal(r.currencies[0].count,3);assert.equal(r.skill.points,5);assert.equal(r.reputation[0].amount,250);assert.equal(r.experience.amount,null);
 assert.deepEqual(r.spells.map(s=>[s.id,s.role]),[[200,'display'],[300,'cast']]);assert.equal(r.package.items.length,0);
});
test('CSV and named SQL prefixes preserve quoted text without parsing unrelated malformed descriptions',()=>{
 assert.deepEqual([...csvRows('ID,Name_lang\n1,"一,二"\n2,"说""你好""\n下一行"\n')],[{id:'1',name_lang:'一,二'},{id:'2',name_lang:'说"你好"\n下一行'}]);
 const sql='CREATE TABLE `Faction` (`ID` INT, `Name_Lang_enUS` TEXT, `Description` TEXT);\nINSERT INTO `Faction` VALUES (72,"Stormwind","unread malformed \\\\"quote");';
 assert.deepEqual(sqlNamePrefixes(sql,'Faction'),[{id:72,name_lang_enus:'Stormwind'}]);
 assert.throws(()=>readCataDBC(Buffer.alloc(20),'Faction'),/Unsupported/);
 assert.equal(roundQuestXP(830),825);
});
const sandbox={};vm.createContext(sandbox);vm.runInContext(await fs.readFile(new URL('../web/rewards.js',import.meta.url),'utf8'),sandbox);
test('reward HTML and copied text distinguish choice, payment and unknown values; external links are safe',()=>{
 const r=normalizeRewards({questlevel:2,rewmoneymaxlevel:102,reworreqmoney:-125,rewchoiceitemid1:1,rewchoiceitemcount1:1},{},'classic',context('classic',new Map([['item_template',[{entry:1,name:'<img src=x onerror=alert(1)>',quality:2}]]])));
 const q={version:'classic',tags:[],rewards:r},html=sandbox.QuestRewards.html(q);
 assert.match(html,/任选一件/);assert.match(html,/需要支付/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img /);
 assert.match(html,/wowhead\.com\/classic\/cn\/item=1/);assert.match(html,/rel="noopener noreferrer"/);
 assert.match(sandbox.QuestRewards.text(q),/任务奖励/);assert.match(sandbox.QuestRewards.text(q),/需要支付：1 银 25 铜/);
 assert.doesNotMatch(sandbox.QuestRewards.html({...q,tags:['community-custom']}),/href=/);
 assert.equal(sandbox.QuestRewards.money(123456),'12 金 34 银 56 铜');
 assert.equal(sandbox.QuestRewards.money(10000),'1 金');
 const titleQuest={...q,rewards:{...r,title:{id:1,name:'勇士 %s',nameLocale:'zhCN'}}};
 assert.match(sandbox.QuestRewards.text(titleQuest,{name:'$&<玩家>'}),/勇士 \$&<玩家>/);
});
