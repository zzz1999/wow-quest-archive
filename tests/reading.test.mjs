import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/reading.js';
const {format,normalize}=globalThis.QuestReading;

test('player reading replaces documented placeholders in Chinese and keeps paragraph breaks',()=>{
 assert.equal(format('你好，$N。$B$b$n是一位$R$c。\\n继续。'),'你好，玩家名称。\n\n玩家名称是一位玩家种族玩家职业。\n继续。');
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
test('unknown dynamic variables and incomplete or referenced gender forms stay visible',()=>{
 const value='$2063w / $1oa / $T平民:平民; / $p / $G男:女:r; / $G缺少分号:保留';
 assert.equal(format(value),value);
});
test('stored settings reject malformed values and bound input size',()=>{
 assert.deepEqual(normalize({mode:'invalid',name:[],race:' 人类\n',className:'x'.repeat(100),gender:'unknown'}),{mode:'player',name:'',race:'人类',className:'x'.repeat(40),gender:'both'});
 assert.equal(normalize(null).mode,'player');
});
