import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from '../scripts/normalize.mjs';
import {supplementQuests} from '../scripts/supplements.mjs';
const rows=(version,base,local=[])=>normalize(new Map([['quest_template',base],['locales_quest',local]]),version);
const base={entry:7,title:'A quest',details:'Original story. $N',objectives:'Collect 3 items',rewardtext:'Well done',nextquestid:8};
const merge=(primary,records,version='classic')=>supplementQuests(primary,[{id:'second',version,records}],version);

test('same-version Chinese supplement improves individual fields with complete provenance',()=>{
 const primary=rows('classic',[base],[{entry:7,title_loc4:'原有标题'}]);
 const secondary=rows('classic',[{...base,nextquestid:999}],[{entry:7,title_loc4:'另一个标题',details_loc4:'补充正文 $N',objectives_loc5:'收集三件物品'}]);
 const {records:[r],report}=merge(primary,secondary);
 assert.equal(r.text.title,'原有标题');assert.equal(r.textSources.title,'classic');
 assert.equal(r.text.description,'补充正文 $N');assert.equal(r.textSources.description,'second');
 assert.equal(r.textColumns.description,'locales_quest.details_loc4');assert.equal(r.textMatches.description,'english-title-and-field');
 assert.equal(r.textLocales.objectives,'zhTW');assert.equal(r.links.nextQuestId,8);assert.deepEqual(r.sourceFields,primary[0].sourceFields);
 assert.equal(primary[0].text.description,base.details);assert.equal(r.english.description,base.details);assert.equal(r.englishSources.description,'classic');
 assert.equal(report.changedQuests,1);assert.equal(report.changedFields,2);
});
test('missing fields require an English context anchor and can fall back to English',()=>{
 const primary=rows('classic',[{...base,requestitemstext:''}]);
 const secondary=rows('classic',[{...base,requestitemstext:'Ready, $N?'}]);
 const {records:[r]}=merge(primary,secondary);
 assert.equal(r.text.progress,'Ready, $N?');assert.equal(r.english.progress,'Ready, $N?');assert.equal(r.englishSources.progress,'second');
 assert.equal(r.textMatches.progress,'english-title-and-description');
 const noContext=rows('classic',[{...base,details:'Different',objectives:'Different',requestitemstext:'Wrong'}]);
 assert.equal(merge(primary,noContext).records[0].text.progress,'');
});
test('matching IDs never override version, title or differing English prose',()=>{
 const primary=rows('classic',[base]);
 assert.throws(()=>supplementQuests(primary,[{id:'wrong',version:'wotlk',records:rows('wotlk',[base])}],'classic'),/version mismatch/);
 const mismatch=rows('classic',[{...base,details:'Changed story'}],[{entry:7,details_loc4:'对应另一版故事'}]);
 assert.equal(merge(primary,mismatch).records[0].text.description,base.details);
 const renamed=rows('classic',[{...base,title:'Different quest'}],[{entry:7,title_loc4:'不同任务'}]);
 assert.equal(merge(primary,renamed).report.changedFields,0);
 assert.equal(merge(primary,rows('classic',[{...base,entry:99}])).records.length,1);
});
test('Chinese preference crosses sources, same-language primary and earlier source win',()=>{
 const primary=rows('classic',[base],[{entry:7,details_loc5:'繁體描述'}]);
 const first=rows('classic',[base],[{entry:7,details_loc4:'简中描述'}]);
 const later=rows('classic',[base],[{entry:7,details_loc4:'另一份简中描述'}]);
 const {records:[r]}=supplementQuests(primary,[{id:'first',version:'classic',records:first},{id:'later',version:'classic',records:later}],'classic');
 assert.equal(r.text.description,'简中描述');assert.equal(r.textSources.description,'first');
 const broken=rows('classic',[base],[{entry:7,details_loc4:'坏\ufffd字'}]);
 assert.equal(merge(primary,broken).records[0].text.description,'繁體描述');
});
test('known custom quests and empty titles cannot be matched by number alone',()=>{
 const primary=rows('classic',[base]);primary[0].tags.push('community-custom');
 const second=rows('classic',[base],[{entry:7,details_loc4:'正文'}]);
 assert.equal(merge(primary,second).report.changedFields,0);
 const empty=rows('classic',[{...base,title:''}]);
 assert.equal(merge(empty,second).report.changedFields,0);
});
test('several supplemental locales report only the final adopted field',()=>{
 const primary=rows('classic',[base]),tw=rows('classic',[base],[{entry:7,details_loc5:'繁體描述'}]),cn=rows('classic',[base],[{entry:7,details_loc4:'简中描述'}]);
 const sources=[{id:'tw-source',version:'classic',records:tw},{id:'cn-source',version:'classic',records:cn}];
 const {records:[r],report}=supplementQuests(primary,sources,'classic');
 assert.equal(r.text.description,'简中描述');assert.equal(report.changes.length,1);assert.equal(report.changes[0].fromLocale,'enUS');
 assert.equal(report.sources[0].selectedFields,0);assert.equal(report.sources[1].selectedFields,1);
 assert.throws(()=>supplementQuests(primary,[sources[0],sources[0]],'classic'),/Invalid supplement ID/);
});
