import assert from 'node:assert/strict';

const bit=(value,mask)=>Number.isSafeInteger(value)&&value>=0&&(BigInt(value)&BigInt(mask))!==0n;
const categorySource={label:'同版本任务分类与来源',url:'docs/REGIONS.md'};
const rewardSource={label:'同版本任务奖励字段',url:'docs/REWARDS.md'};
const classCampaigns=new Set(['Death Knight Campaign','Demon Hunter Campaign','Druid Campaign','Hunter Campaign','Monk Campaign','Mage Campaign','Priest Campaign','Paladin Campaign','Shaman Campaign','Rogue Campaign','Warlock Campaign','Warrior Campaign']);

// These are archive annotations, not new facts written into the source corpus.
export function buildQuestImportance(records,regions,definition,deriveTraits){
 const version=regions.version,byId=new Map(records.map(r=>[r.id,r])),categories=new Map(regions.records.filter(r=>r.kind==='category').map(r=>[r.value,r]));
 const curated=new Map();
 for(const group of definition.groups.filter(g=>g.version===version))for(const anchor of group.quests){
  const record=byId.get(anchor.id);assert.ok(record,`Missing importance anchor ${version}:${anchor.id}`);
  assert.equal(record.english.title,anchor.englishTitle,`Importance title changed ${record.key}`);
  const matches=curated.get(anchor.id)||[];matches.push(group);curated.set(anchor.id,matches);
 }
 const quests={};
 for(const r of records){
  assert.equal(r.version,version,'Importance annotations must stay within one version');
  if(r.tags?.includes('community-custom'))continue;
  const reasons=[];
  const add=(rule,category,reason,source,fields)=>{
   assert.ok(definition.categories[category]);
   if(!reasons.some(x=>x.rule===rule&&x.category===category))reasons.push({rule,category,reason,source,fields});
  };
  for(const g of curated.get(r.id)||[])for(const category of g.categories)add(g.id,category,g.reason,g.source,{id:r.id,englishTitle:r.english.title});
  // Avoid hidden tracking rows and unreviewed test/custom records. A reviewed
  // exact-title entry may still cover a real quest misidentified by test tags.
  const visible=!r.tags?.includes('suspected-test')&&!bit(r.flags,1024)&&!(version==='legion'&&bit(r.sourceFields?.flagsex,0x20000));
  if(visible){
   const category=categories.get(r.zoneOrSort),name=category?.english;
   const trait=deriveTraits(r),nonRecurring=trait.repeat.repeatable===false;
   if(r.type===83||name==='Legendary')add('legendary-category','legendary','任务类型或所属分类明确属于传说任务线。',{label:'版本任务类型与分类',url:'docs/IMPORTANCE.md#数据分类规则'},{type:r.type,zoneOrSort:r.zoneOrSort,categoryName:name||null});
   if(name==='Epic')add('epic-category','story','所属分类为史诗任务，作为重要剧情收录。',categorySource,{zoneOrSort:r.zoneOrSort,categoryName:name});
   if(version==='legion'&&(r.type===107||name==='Artifact'))add('artifact-category','class','神器获取、强化或挑战任务线。',categorySource,{type:r.type,zoneOrSort:r.zoneOrSort,categoryName:name||null});
   if(nonRecurring&&name?.endsWith(' Campaign')){
    const categoryId=classCampaigns.has(name)?'class':'story';
    add('campaign-category',categoryId,`属于${category.name}，推进对应战役剧情。`,categorySource,{zoneOrSort:r.zoneOrSort,categoryName:name});
   }
   if(nonRecurring&&trait.classes.restricted)for(const ability of definition.abilityRewards.filter(a=>a.versions.includes(version))){
    const spells=(r.rewards?.spells||[]).filter(s=>ability.spellIds.includes(s.id));
    if(spells.length)add('class-ability-'+ability.spellIds[0],'class',`任务奖励关联${ability.name}的学习或解锁。`,rewardSource,{classMask:r.classMask,spells:spells.map(s=>({id:s.id,role:s.role}))});
   }
  }
  if(reasons.length)quests[r.id]={englishTitle:r.english.title,categories:[...new Set(reasons.map(x=>x.category))],reasons};
 }
 const counts=Object.fromEntries(Object.keys(definition.categories).map(category=>[category,Object.values(quests).filter(q=>q.categories.includes(category)).length]));
 return {schemaVersion:1,policy:definition.policy,version,count:Object.keys(quests).length,counts,quests};
}

export function importanceBrowserData(definition,versions){
 return {schemaVersion:1,policy:definition.policy,categories:definition.categories,versions:Object.fromEntries(versions.map(v=>[v.version,v.quests]))};
}
