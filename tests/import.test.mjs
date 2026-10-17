import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {tuples,readTables} from '../scripts/sql.mjs';
import {chooseText,normalize,normalizeActors} from '../scripts/normalize.mjs';

test('SQL preserves apostrophes, separators, Unicode, NULL and game tokens',()=>{
 const rows=[...tuples("(7,'中文; (x), \\'quote\\' $B$N',NULL,-3),(8,'it''s\\nnext',0,2);")];
 assert.deepEqual(rows,[[7,"中文; (x), 'quote' $B$N",null,-3],[8,"it's\nnext",0,2]]);
});
test('stream handles comments, large inserts and flexible INSERT whitespace',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quest-sql-'));const file=path.join(dir,'test.sql');
 const title='汉'.repeat(700000);
 await fs.writeFile(file,"-- don't interpret the quote; here\nCREATE TABLE `quest_template` (\n `ID` int,\n `Title` text\n);\n/* don't; */\ninsert  into `quest_template` (`ID`,`Title`) values (1,'"+title+"'),(2,'O\\'Brien; $B');\n");
 const t=await readTables([file],new Set(['quest_template']));assert.equal(t.get('quest_template').length,2);assert.equal(t.get('quest_template')[0].title,title);assert.equal(t.get('quest_template')[1].title,"O'Brien; $B");
 await fs.unlink(file);await fs.rmdir(dir);
});
test('field fallback skips blank and untranslated Chinese locale entries',()=>{
 assert.equal(chooseText([{locale:'zhCN',text:' '},{locale:'zhTW',text:'任務敘述'},{locale:'enUS',text:'English'}]).locale,'zhTW');
 assert.equal(chooseText([{locale:'zhCN',text:'English placeholder'},{locale:'zhTW',text:'真正的繁體中文'}]).locale,'zhTW');
 assert.equal(chooseText([{locale:'zhCN',text:'English placeholder'},{locale:'enUS',text:'Base English'}]).text,'Base English');
 assert.equal(chooseText([]).locale,null);
 assert.equal(chooseText([{locale:'zhCN',text:'损坏\ufffd文字'},{locale:'zhTW',text:'正常文字'}]).locale,'zhTW');
});
test('normalization keeps version boundaries, negative dependencies and missing text',()=>{
 const tables=new Map([
  ['quest_template',[{id:10,title:'Base',details:'English',prevquestid:-9,nextquestid:11}]],
  ['locales_quest',[{id:10,title_loc4:'标题',details_loc4:'',details_loc5:'繁體正文'},{id:99,title_loc4:'无基库记录'}]],
  ['quest_request_items',[{id:10,completiontext:'Progress'}]],
  ['quest_request_items_locale',[{id:10,locale:'zhCN',completiontext:'进行中'}]]
 ]);
 const [r]=normalize(tables,'classic');assert.equal(r.key,'classic:10');assert.equal(normalize(tables,'classic').length,1);assert.equal(r.text.title,'标题');assert.equal(r.text.description,'繁體正文');assert.equal(r.textLocales.description,'zhTW');assert.equal(r.text.progress,'进行中');assert.equal(r.text.completion,'');assert.equal(r.links.prevQuestId,-9);assert.equal(r.english.description,'English');
});
test('numeric objective locales and source-specific custom IDs stay explicit',()=>{
 const tables=new Map([['quest_template',[{id:40000,title:'Custom'}]],['quest_objective',[{id:1,questid:40000,type:0,objectid:42,amount:3,description:'Defeat'}]],['locales_quest_objective',[{id:1,locale:4,description:'击败'}]]]);
 const [r]=normalize(tables,'pandaria',{customQuestIds:[40000]});assert.ok(r.tags.includes('community-custom'));assert.equal(r.objectiveDetails[0].description,'击败');assert.equal(r.objectiveDetails[0].locale,'zhCN');
});
test('locale UPDATEs merge fields by task ID without executing SQL',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quest-update-')),file=path.join(dir,'locale.sql');
 await fs.writeFile(file,"UPDATE `locales_quest` SET `Title_loc4`='简中',`Details_loc4`='甲,乙; WHERE' WHERE `entry`=42;\nUPDATE `locales_quest` SET `RequestItemsText_loc4`='进度',`Title_loc4`='修正标题' WHERE `entry`='42';\n");
 const t=await readTables([file],new Set(['locales_quest']));assert.deepEqual(t.get('locales_quest'),[{entry:42,title_loc4:'修正标题',details_loc4:'甲,乙; WHERE',requestitemstext_loc4:'进度'}]);
 await fs.unlink(file);await fs.rmdir(dir);
});
test('NPC archives retain localized names, separate title provenance and reverse quest roles',()=>{
 const tables=new Map([
  ['quest_template',[{id:1,title:'Quest one'},{id:2,title:'Quest two'}]],
  ['creature_template',[{entry:42,name:'A guard',subname:'Officer',minlevel:5,maxlevel:6},{entry:999,name:'Unrelated NPC'}]],
  ['creature_template_locale',[{id:42,locale:'zhCN',name:'守卫',title:'',verifiedbuild:123},{id:42,locale:'zhTW',name:'守衛',title:'軍官',verifiedbuild:456}]],
  ['creature_queststarter',[{id:42,quest:1},{id:42,quest:1}]],
  ['creature_questender',[{id:42,quest:1},{id:42,quest:2}]]
 ]);
 const quests=normalize(tables,'wotlk'),actors=normalizeActors(tables,'wotlk',quests);assert.equal(actors.length,1);
 const [npc]=actors;assert.equal(npc.key,'wotlk:creature:42');assert.equal(npc.name,'守卫');assert.equal(npc.subname,'軍官');assert.equal(npc.subnameLocale,'zhTW');
 assert.equal(npc.textColumns.subname,'creature_template_locale.title');assert.equal(npc.textBuilds.subname,456);assert.equal(npc.english.subname,'Officer');
 assert.deepEqual(npc.starts,[1]);assert.deepEqual(npc.ends,[1,2]);assert.equal(npc.minLevel,5);assert.equal(quests[0].starters[0].key,npc.key);
 assert.equal(normalizeActors(tables,'legion',normalize(tables,'legion'))[0].key,'legion:creature:42');
});
test('legacy and numeric NPC locales preserve object identity and missing source facts',()=>{
 const tables=new Map([
  ['quest_template',[{entry:7,title:'Quest'}]],
  ['creature_template',[{entry:197,name:'Marshal McBride',subname:''},{entry:200,name:'English NPC'}]],
  ['locales_creature',[{entry:197,name_loc4:'治安官玛克布莱德',subname_loc4:''},{entry:200,locale:4,name:'中文名称',subname:'中文称号'}]],
  ['gameobject_template',[{entry:197,name:'A chest'}]],
  ['locales_gameobject',[{entry:197,name_loc4:'',name_loc5:'寶箱'}]],
  ['creature_questrelation',[{id:197,quest:7},{id:200,quest:7}]],
  ['gameobject_involvedrelation',[{id:197,quest:7},{id:999,quest:7}]]
 ]);
 const quests=normalize(tables,'classic'),actors=normalizeActors(tables,'classic',quests),byKey=new Map(actors.map(a=>[a.key,a]));
 assert.equal(byKey.get('classic:creature:197').name,'治安官玛克布莱德');assert.equal(byKey.get('classic:creature:197').subname,'');
 assert.equal(byKey.get('classic:creature:200').subname,'中文称号');assert.equal(byKey.get('classic:gameobject:197').nameLocale,'zhTW');
 const missing=byKey.get('classic:gameobject:999');assert.equal(missing.templatePresent,false);assert.equal(missing.name,'');assert.equal(missing.nameLocale,null);assert.equal(missing.minLevel,null);
});
