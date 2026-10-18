export function rewardAudit(records){
 const names={},packages=new Set();
 for(const q of records){
  const r=q.rewards;if(!r)throw Error('Missing rewards '+q.key);
  for(const [kind,rows]of [['item',[...r.items,...r.choices,...(r.package?.items||[])]],['faction',r.reputation],['currency',r.currencies],['spell',r.spells],['skill',r.skill?[r.skill]:[]],['title',r.title?[r.title]:[]]]){
   names[kind]??={occurrences:0,zhCN:0,zhTW:0,enUS:0,missing:0,missingIds:new Set()};
   for(const row of rows){names[kind].occurrences++;names[kind][row.nameLocale||'missing']++;if(!row.name)names[kind].missingIds.add(row.id);}
  }
  if(r.package&&!r.package.items.length)packages.add(r.package.id);
 }
 return {version:records[0]?.version,quests:records.length,withFixedItems:records.filter(q=>q.rewards.items.length).length,withChoices:records.filter(q=>q.rewards.choices.length).length,withPackages:records.filter(q=>q.rewards.package).length,unresolvedPackageIds:[...packages].sort((a,b)=>a-b),experienceResolved:records.filter(q=>q.rewards.experience.amount!==null).length,experienceUnresolved:records.filter(q=>q.rewards.experience.amount===null).length,names:Object.fromEntries(Object.entries(names).map(([k,v])=>[k,{...v,missingIds:[...v.missingIds].sort((a,b)=>a-b)}]))};
}
