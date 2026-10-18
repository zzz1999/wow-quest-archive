import test from 'node:test';import assert from 'node:assert/strict';
import {plainHtml,parseQuest,questAnchor,parseItemTooltip,itemAnchor,selectItemEffects,attachReferences} from '../scripts/wowhead-data.mjs';
import '../web/wowhead.js';import '../web/items.js';import '../web/reading.js';
test('quest parser isolates database fields, keeps encoded player placeholders and excludes comments',()=>{
 const html='<script>$.extend(g_quests[42], {});</script><h1 class="heading-size-1">Quest</h1>Bring a letter.<table>unrelated targets</table><h2 class="heading-size-3">Description</h2>Meet &lt;name&gt;.<br><br>Go!<h2>Completion</h2><div id="lknlksndgg-completion" style="display:none">Thanks, &lt;name&gt;!<div>Done.</div></div><h2 class="heading-size-2 clear">Related</h2><div id="lknlksndgg-progress">user comment</div>';
 assert.deepEqual(parseQuest(html,42),{title:'Quest',objectives:'Bring a letter.',description:'Meet <name>.\n\nGo!',completion:'Thanks, <name>!Done.',progress:''});assert.equal(parseQuest(html,99),null);
 assert.equal(plainHtml('A<script>alert(1)</script><b>&lt;name&gt;</b> &amp; &#x4e2d; &#25991;'),'A<name> & 中 文');
});
test('quest matching requires nonempty title and unchanged same-locale story context',()=>{
 const q={english:{title:'A Quest',description:'Hello, $N.$BGo!',objectives:'Bring 3 apples.'},text:{title:'任务',description:'你好，$N。'},textLocales:{title:'zhCN',description:'zhCN'}};
 assert.equal(questAnchor(q,{title:'A Quest',description:'Hello, <name>.\nGo!'},'enUS').field,'description');
 assert.equal(questAnchor(q,{title:'A Quest',objectives:'Bring 30 apples.'},'enUS'),null);
 assert.equal(questAnchor(q,{title:'Other Quest',description:q.english.description},'enUS'),null);
 assert.equal(questAnchor(q,{title:'任务',description:q.text.description},'zhTW'),null);
});
test('item supplementation verifies identity, item level, quality, binding and safe nonnumeric effect',()=>{
 const item={id:17690,name:'1级霜狼徽记',nameLocale:'zhCN',quality:2,itemLevel:60,effects:[{id:22563,trigger:0,text:'',unresolved:true}]};
 const page=parseItemTooltip({name:item.name,quality:2,tooltip:'<!--ilvl-->60<!--useEffect:0:1--><a href="/mop-classic/cn/spell=22563" class="q2">将你传送到霜狼要塞。</a> (2分钟 冷却)<!--useEffect:1-->'});
 assert.ok(itemAnchor(item,page,'zhCN'));assert.equal(selectItemEffects(item,page,'zhCN')[0].text,'将你传送到霜狼要塞。');
 assert.equal(itemAnchor(item,{...page,itemLevel:30},'zhCN'),null);assert.equal(itemAnchor(item,{...page,quality:3},'zhCN'),null);assert.equal(itemAnchor(item,{...page,name:'different'},'zhCN'),null);
 assert.deepEqual(selectItemEffects(item,{...page,effects:[{id:22563,trigger:1,text:'传送。'}]},'zhCN'),[]);
 assert.deepEqual(selectItemEffects(item,{...page,effects:[{id:22563,trigger:0,text:'恢复 500 点生命。'}]},'zhCN'),[]);
 assert.deepEqual(selectItemEffects(item,{...page,effects:[{id:22563,trigger:0,text:'恢复五点生命。'}]},'zhCN'),[]);
 assert.deepEqual(selectItemEffects({...item,effects:[{id:22563,trigger:0,text:'Existing',unresolved:false}]},page,'zhCN'),[]);
});
test('web references never overwrite the corpus and source links cannot inject active content',()=>{
 const row={version:'legion',id:42,text:{completion:''},textLocales:{completion:null}},reference={edition:'现行正式服',fields:{completion:{text:'欢迎，<name>。',locale:'zhCN',source:{url:'https://www.wowhead.com/cn/quest=42',capturedAt:'2026-10-18T00:00:00Z'}}}};
 const attached=attachReferences([row],{version:'legion',quests:{42:reference}},'quests')[0];assert.equal(row.wowhead,undefined);assert.equal(attached.text.completion,'');
 assert.throws(()=>attachReferences([row],{version:'classic',quests:{42:reference}},'quests'),/version mismatch/);
 assert.equal(globalThis.QuestWowhead.field(attached,'completion').text,'欢迎，<name>。');
 assert.equal(globalThis.QuestWowhead.field({...attached,text:{completion:'original'}},'completion').text,'original');
 assert.match(globalThis.QuestWowhead.provenance(globalThis.QuestWowhead.field(attached,'completion')),/现行正式服/);
 assert.doesNotMatch(globalThis.QuestWowhead.link({url:'javascript:alert(1)'}),/<a/);
 const html=globalThis.QuestReading.html('你好，<name>，<class>。<img src=x>',{name:'林风',className:'法师'});assert.match(html,/>林风<\/span>/);assert.match(html,/>法师<\/span>/);assert.doesNotMatch(html,/<img/);
 assert.equal(globalThis.QuestReading.format('<name>',{mode:'source'}),'<name>');
});
test('recipe text uses the paired learning spell and never borrows the crafted item effect',()=>{
 const page=parseItemTooltip({name:'食谱',quality:1,tooltip:'<!--ilvl-->15<span class="q2">使用: <a href="/wotlk/cn/spell=2543/recipe">教你学会烹制杂味炖肉。</a></span><!--itemEffects:1--><!--useEffect:0:1--><a href="/wotlk/cn/spell=435">恢复生命。</a><!--useEffect:1-->'});
 assert.deepEqual(page.effects.map(e=>e.id),[2543]);
 const item={effects:[{id:483,trigger:0,unresolved:true,mechanics:[{effect:36}]},{id:2543,trigger:6,unresolved:true}]};
 const selected=selectItemEffects(item,page,'zhCN');assert.equal(selected[0].id,483);assert.equal(selected[0].learnedSpellId,2543);assert.equal(selected.length,1);
 assert.deepEqual(selectItemEffects({...item,effects:[item.effects[0]]},page,'zhCN'),[]);
});
test('saved item reference renders offline with edition and preserves original effect',()=>{
 const e={id:22563,trigger:0,text:'',unresolved:true,cooldown:120000},item={wowhead:{edition:'潘达利亚之谜怀旧服',effects:[{id:22563,trigger:0,text:'将你传送到霜狼要塞。',locale:'zhCN',source:{capturedAt:'2026-10-18T00:00:00Z'}}]}};
 const html=globalThis.QuestItems.effectHtml(e,item);assert.match(html,/将你传送到霜狼要塞/);assert.match(html,/冷却 2 分钟/);assert.match(html,/Wowhead 补充 · 潘达利亚之谜怀旧服/);assert.doesNotMatch(html,/https?:|完整效果说明暂未收录/);assert.equal(e.text,'');
});
test('recipe usage is not repeated as flavor text when the source stores the same instruction twice',()=>{
 const text='教你学会烹制杂味炖肉。',item={version:'wotlk',id:728,name:'食谱',quality:1,description:'\u200b'+text,descriptionLocale:'zhCN',effects:[{id:483,trigger:0,unresolved:true},{id:2543,trigger:6,unresolved:true}],wowhead:{edition:'巫妖王之怒怀旧服',effects:[{id:483,trigger:0,learnedSpellId:2543,text,locale:'zhCN',source:{capturedAt:'2026-10-18T00:00:00Z'}}]}};
 const html=globalThis.QuestItems.tooltipHtml(item);assert.equal(html.split(text).length-1,1);assert.doesNotMatch(html,/学会：|item-tip-flavor/);assert.equal(item.description,'\u200b'+text);
});
