import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {tuples,readTables} from '../scripts/sql.mjs';
import {chooseText,normalize} from '../scripts/normalize.mjs';

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
