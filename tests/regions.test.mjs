import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeRegion,questSortEnums} from '../scripts/region-data.mjs';
const table=(fields,rows)=>({asset:{name:[fields.version||fields.reference,fields.table,fields.locale].join('/'),format:'csv',build:'test',...fields},rows:new Map(rows)});
const area=(scope,locale,rows)=>table({...scope,table:'AreaTable',locale},rows.map(([id,name])=>[id,{areaname_lang:name}]));
const sort=(scope,locale,rows)=>table({...scope,table:'QuestSort',locale},rows.map(([id,name])=>[id,{sortname_lang:name}]));

test('region translations require both ID and original name; renamed zones remain versioned',()=>{
 const tables=[area({version:'classic'},'enUS',[[33,'Stranglethorn Vale']]),area({version:'cataclysm'},'enUS',[[33,'Northern Stranglethorn']]),area({reference:'classic-ref'},'enUS',[[33,'Stranglethorn Vale']]),area({reference:'classic-ref'},'zhCN',[[33,'荆棘谷']]),area({reference:'legion'},'enUS',[[33,'Northern Stranglethorn']]),area({reference:'legion'},'zhCN',[[33,'北荆棘谷']])];
 assert.equal(normalizeRegion('classic',33,tables).name,'荆棘谷');
 assert.equal(normalizeRegion('cataclysm',33,tables).name,'北荆棘谷');
 assert.equal(normalizeRegion('classic',33,tables.filter(s=>s.asset.reference!=='classic-ref')).name,'Stranglethorn Vale');
});
test('region locale priority skips English placeholders and corrupt Chinese, then falls back to English',()=>{
 const base=area({version:'wotlk'},'enUS',[[12,'Elwynn Forest'],[22,'Programmer Isle'],[24,'Northshire Abbey']]);
 const tables=[base,area({reference:'legion'},'enUS',[[12,'Elwynn Forest'],[22,'Programmer Isle'],[24,'Northshire Abbey']]),area({reference:'legion'},'zhCN',[[12,'艾尔文森林'],[22,'Programmer Isle'],[24,'损坏\ufffd']]),area({reference:'legion'},'zhTW',[[12,'艾爾文森林'],[22,'工程師島']])];
 assert.equal(normalizeRegion('wotlk',12,tables).nameLocale,'zhCN');
 assert.equal(normalizeRegion('wotlk',22,tables).name,'工程師島');
 assert.equal(normalizeRegion('wotlk',24,tables).name,'Northshire Abbey');
 assert.equal(normalizeRegion('wotlk',999,tables).nameLocale,null);
});
test('areas and categories with equal absolute IDs cannot collide',()=>{
 const tables=[area({reference:'legion'},'enUS',[[24,'Northshire Abbey']]),area({reference:'legion'},'zhCN',[[24,'北郡修道院']]),sort({reference:'legion'},'enUS',[[24,'Herbalism']]),sort({reference:'legion'},'zhCN',[[24,'草药学']])];
 assert.equal(normalizeRegion('legion',24,tables).name,'北郡修道院');
 assert.equal(normalizeRegion('legion',-24,tables).name,'草药学');
 assert.throws(()=>normalizeRegion('legion',0,tables),/identity/);
});
test('Pandaria categories accept an exact same-version enum when Russian labels changed',()=>{
 const rows=questSortEnums('enum QuestSort { QUEST_SORT_BATTLEGROUNDS = 25, QUEST_SORT_FISHING = 101, };');
 const tables=[sort({version:'pandaria'},'ruRU',[[25,'Поля сражений']]),sort({reference:'legion'},'ruRU',[[25,'Поля боя']]),sort({reference:'legion'},'enUS',[[25,'Battlegrounds']]),sort({reference:'legion'},'zhCN',[[25,'战场']]),{asset:{version:'pandaria',name:'core',format:'cpp-enum'},rows}];
 const r=normalizeRegion('pandaria',-25,tables);assert.equal(r.name,'战场');assert.equal(r.match.rule,'id-and-core-enum');assert.equal(r.base.name,'Поля сражений');
 tables.at(-1).rows=new Map([[25,'FISHING']]);assert.equal(normalizeRegion('pandaria',-25,tables).name,'');
});
test('offline region UI keeps signed filter values, groups names and escapes source text',async()=>{
 const context={QuestRegionData:{versions:{classic:{12:{name:'艾尔文森林',nameLocale:'zhCN',english:'Elwynn Forest'},'-24':{name:'草药学',nameLocale:'zhCN'},24:{name:'<script>&',nameLocale:'enUS'}}},sources:{}}};
 vm.runInNewContext(await fs.readFile(new URL('../web/regions.js',import.meta.url),'utf8'),context);
 const ui=context.QuestRegions,html=ui.options('classic',[12,-24,24,0,12]);
 assert.match(html,/optgroup label="区域"/);assert.match(html,/optgroup label="任务分类"/);assert.match(html,/value="-24"/);assert.match(html,/value="0"/);assert.equal(html.match(/value="12"/g).length,1);
 assert.match(html,/&lt;script&gt;&amp;/);assert.ok(!html.includes('<script>'));
 assert.match(ui.searchText('classic',12),/艾尔文森林\nElwynn Forest/);
 assert.match(ui.metadata('classic',-24,true),/原始编号 -24/);
 assert.equal(ui.name('wotlk',12),'未收录区域 #12');assert.equal(ui.name('classic',0),'未分类');
});
