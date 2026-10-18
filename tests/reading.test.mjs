import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/reading-data.js';
import '../web/reading.js';
import {buildReadingData} from '../scripts/reading-data.mjs';
const {format,normalize,html,notes}=globalThis.QuestReading;

test('player reading replaces documented placeholders in Chinese and keeps paragraph breaks',()=>{
 assert.equal(format('你好，$N。$B$b$n是一位$R$c。\\n继续。'),'你好，名字。\n\n名字是一位种族职业。\n继续。');
});
test('character settings resolve gender branches and preserve case conventions',()=>{
 const character={name:'林风',race:'human',className:'Mage',gender:'female'};
 assert.equal(format('$G先生:女士; $N，$R $C / $r $c',character),'女士 林风，Human Mage / human mage');
 assert.equal(format('$g兄弟:姐妹;',{gender:'male'}),'兄弟');
 assert.equal(format('$g兄弟:姐妹;'),'兄弟 / 姐妹');
 assert.equal(format('$G勇士:勇士;'),'勇士');
});
test('source view preserves exact text and formatting tokens without mutating the record',()=>{
 const record=Object.freeze({description:'$N，$G兄弟:姐妹;$B$B原文\\n'});
 assert.equal(format(record.description,{mode:'source',name:'林风',gender:'female'}),record.description);
 format(record.description,{name:'林风'});
 assert.equal(record.description,'$N，$G兄弟:姐妹;$B$B原文\\n');
});
test('names are inserted literally without interpreting nested game tokens or markup',()=>{
 assert.equal(format('$N / $C',{name:'$B<img src=x>',className:'$N'}),'$B<img src=x> / $N');
 assert.equal(format('$G$N先生:$N女士;',{name:'$G男:女;',gender:'female'}),'$G男:女;女士');
});
test('runtime variables explain missing context while malformed gender forms stay visible',()=>{
 const value='$2063w / $1oa / $T平民:平民; / $p / $G男:女:r; / $G缺少分号:保留';
 assert.equal(format(value),'服务器实时数值〔$2063w〕 / 第 1 项目标所需数量〔$1oa〕 / 玩家军衔〔$T平民:平民;〕 / 名字 / 男 / 女〔$G男:女:r;〕 / $G缺少分号:保留');
 assert.equal(notes(value).length,5);
 assert.match(notes(value)[0].note,/#2063/);
 assert.deepEqual(notes(value,{mode:'source'}),[]);
});
test('stored settings reject malformed values and bound input size',()=>{
 assert.deepEqual(normalize({mode:'invalid',name:[],race:' 人类\n',className:'x'.repeat(100),gender:'unknown'}),{mode:'player',name:'',race:'人类',className:'x'.repeat(40),gender:'both'});
 assert.equal(normalize(null).mode,'player');
});

test('badges mark only character variables, retain paragraph breaks and keep plain-text copying free of HTML',()=>{
 const source='名字 $N，$c，$R。$B$2063w';
 const markup=html(source);
 assert.equal((markup.match(/class="locale-badge zhCN variable-badge"/g)||[]).length,4);
 assert.ok(markup.startsWith('名字 <span'));
 for(const [token,label] of [['$N','名字'],['$c','职业'],['$R','种族']])assert.ok(markup.includes(`data-variable="${token}" title="${token} · ${label}">${label}</span>`));
 assert.ok(markup.includes('。\n<span'));
 assert.equal(format(source),'名字 名字，职业，种族。\n服务器实时数值〔$2063w〕');
});

test('Legion 9065 keeps complete special tokens and never assumes the player gender for an unknown object',()=>{
 const value='嘿，$ct，拆了那座塔！否则的话，$vn会把你拆了的……$vg他:她;很生气！';
 const rendered=html(value,{className:'法师',gender:'female'});
 assert.ok(rendered.includes('data-variable="$ct"'));
 assert.ok(!rendered.includes('职业</span>t')&&!rendered.includes('>大法师</span>'));
 assert.ok(rendered.includes('>他 / 她</span>很生气'));
 assert.deepEqual(notes(value).map(n=>n.token),['$ct','$vn','$vg他:她;']);
 assert.equal(format(value,{mode:'source'}),value);
 assert.equal(notes('$ct $ct').length,1);
 assert.match(html('$vg<男>:"女";'),/data-variable="\$vg&lt;男&gt;:&quot;女&quot;;"/);
 assert.equal(format('$BHello $Nrium, $rs!'),'\nHello 名字rium, 种族s!');
});

test('pinned client-table names, aliases and browser data are reproducible',async()=>{
 assert.deepEqual(await buildReadingData(),globalThis.QuestReadingData);
 assert.equal(globalThis.QuestReadingData.classes.length,12);
});

test('Legion class title and villain use the class, not the turn-in NPC or player gender',()=>{
 const quest={version:'legion',classMask:0,enders:[{name:'坎瑞薩德'}]};
 const source='嘿，$ct！$vn……$vg他:她;很生气！$p，你是$c。';
 assert.equal(format(source,{className:'法师',gender:'female',name:'林风'},{quest}),'嘿，大法师！玛克扎尔……他很生气！林风，你是法师。');
 assert.equal(format('$ct $vn',{className:'德魯伊'},{quest}),'大德鲁伊 提克迪奥斯');
 assert.equal(format('$ct $vn',{className:'Death Knight'},{quest}),'死亡领主 玛尔加尼斯');
 assert.ok(notes(source,{className:'Mage'},{quest}).every(n=>n.resolved));
 assert.equal(format(source,{mode:'source',className:'法师'},{quest}),source);
 assert.ok(notes('$ct $vn',{}, {quest}).every(n=>!n.resolved));
 assert.ok(notes('$ct $vn',{className:'自创职业'},{quest}).every(n=>!n.resolved));
 assert.ok(notes('$ct $vn',{className:'法师'},{quest:{...quest,version:'pandaria'}}).every(n=>!n.resolved));
});

test('only a single quest class restriction can supply a missing class; user choice takes precedence',()=>{
 const quest={version:'legion',classMask:1024};
 assert.equal(format('$ct',{}, {quest}),'大德鲁伊');
 assert.match(notes('$ct',{}, {quest})[0].note,/单一职业限制/);
 assert.equal(format('$ct',{className:'法师'},{quest}),'大法师');
 for(const classMask of [0,1025,-1,4095])assert.equal(notes('$ct',{}, {quest:{...quest,classMask}})[0].resolved,false);
});

test('objective amounts handle shuffled rows, single currency targets and never use array position as a guessed index',()=>{
 const quest={version:'legion',objectiveDetails:[{id:2,order:1,amount:5},{id:1,order:0,amount:10}]};
 assert.equal(format('杀死$1oa个甲和$2oa个乙',{}, {quest}),'杀死10个甲和5个乙');
 assert.equal(format('$1Oa',{}, {quest}),'10');
 assert.ok(html('$1oa',{}, {quest}).includes('>10</span>'));
 const currency={objectiveDetails:[{id:3,order:-1,amount:2500}]};
 assert.equal(format('$1oa块碎片',{}, {quest:currency}),'2500块碎片');
 assert.equal(format('$oa个',{}, {quest:currency}),'2500个');
 assert.equal(format('$oa个',{}, {quest,objective:quest.objectiveDetails[0]}),'5个');
 assert.equal(notes('$oa',{}, {quest})[0].resolved,false);
 for(const objectiveDetails of [[],[{id:3,order:0,amount:-1}],[{id:3,order:0,amount:'10'}],[{id:3,order:1,amount:10},{id:4,order:2,amount:5}],[{id:3,order:0,amount:10},{id:4,order:0,amount:5}]]){
  assert.equal(notes('$1oa',{}, {quest:{objectiveDetails}})[0].resolved,false);
 }
 assert.equal(notes('$3oa',{}, {quest})[0].resolved,false);
 assert.equal(format('$1oa',{mode:'source'},{quest}),'$1oa');
 assert.equal(format('$cy $1oo'),'待核实：$cy 待核实：$1oo');
 assert.equal(format('$p',{name:'$B<b>林风</b>'}),'$B<b>林风</b>');
});

test('badge rendering escapes source text and custom values; source view never inserts badges',()=>{
 const source='<img src=x> $N $G$C先生:$C女士;';
 const markup=html(source,{name:'<b>$R</b>',className:'Mage',gender:'female'});
 assert.ok(markup.startsWith('&lt;img src=x&gt; '));
 assert.ok(markup.includes('&lt;b&gt;$R&lt;/b&gt;</span>'));
 assert.ok(markup.includes('>Mage</span>女士'));
 assert.ok(!markup.includes('<img')&&!markup.includes('<b>'));
 assert.equal(html(source,{mode:'source'}),'&lt;img src=x&gt; $N $G$C先生:$C女士;');
});
