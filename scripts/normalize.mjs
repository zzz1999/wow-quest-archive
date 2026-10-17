export const TEXT_FIELDS={
 title:['logtitle','title'],objectives:['logdescription','objectives'],description:['questdescription','details'],
 progress:['requestitemstext','completiontext'],completion:['offerrewardtext','rewardtext'],
 end:['areadescription','endtext'],completed:['questcompletionlog','completedtext'],
 giverWindow:['questgivertextwindow','portraitgivertext'],giverTarget:['questgivertargetname','portraitgivername'],
 turninWindow:['questturntextwindow','portraitturnintext'],turninTarget:['questturntargetname','portraitturninname'],
 ...Object.fromEntries([1,2,3,4].map(n=>['objective'+n,['objectivetext'+n]]))
};
const idOf=r=>Number(r.id??r.entry);
const index=rows=>new Map((rows||[]).map(r=>[idOf(r),r]));
const usable=v=>typeof v==='string'&&v.trim().length>0&&!v.includes('\ufffd');
export function chooseText(candidates){
 for(const locale of ['zhCN','zhTW','enUS']){
  const c=candidates.find(c=>c.locale===locale&&usable(c.text)&&(locale==='enUS'||/\p{Script=Han}/u.test(c.text)));
  if(c)return c;
 }
 // Some community locale rows contain untranslated English. Do not count those as Chinese.
 const untranslated=candidates.find(c=>usable(c.text));
 if(untranslated)return {...untranslated,locale:'enUS'};
 return {text:'',locale:null,column:null,table:null};
}
const field=(o,keys)=>{for(const k of keys)if(o[k]!==undefined&&o[k]!==null)return o[k];return 0;};
function localizedIndex(tables,names){
 const result=new Map();
 for(const name of names)for(const r of tables.get(name)||[]){const id=idOf(r);if(!result.has(id))result.set(id,[]);result.get(id).push({name,r});}
 return result;
}
export function normalize(tables,version,{customQuestIds=[],translationWarnings={}}={}){
 const bases=index(tables.get('quest_template')),addons=index(tables.get('quest_template_addon'));
 const localeRows=localizedIndex(tables,['locales_quest','quest_template_locale']);
 const progress=index(tables.get('quest_request_items')),completion=index(tables.get('quest_offer_reward'));
 const progressLoc=localizedIndex(tables,['quest_request_items_locale']),completionLoc=localizedIndex(tables,['quest_offer_reward_locale']);
 const creatures=index(tables.get('creature_template')),objects=index(tables.get('gameobject_template'));
 const creatureLoc=localizedIndex(tables,['locales_creature','creature_template_locale']),objectLoc=localizedIndex(tables,['locales_gameobject','gameobject_template_locale']);
 const objectives=new Map(), objectiveLocales=localizedIndex(tables,['quest_objective_locale','quest_objectives_locale','locales_quest_objective']);
 for(const t of ['quest_objective','quest_objectives'])for(const o of tables.get(t)||[]){const id=Number(o.questid);if(!objectives.has(id))objectives.set(id,[]);objectives.get(id).push({table:t,row:o});}
 function candidates(rows,keys){const out=[];for(const {name,r} of rows){
   for(const key of keys){if(r.locale&&['zhCN','zhTW','enUS'].includes(r.locale))out.push({text:r[key],locale:r.locale,table:name,column:key,verifiedBuild:r.verifiedbuild??null});
     for(const [locale,suffix]of [['zhCN','4'],['zhTW','5']])out.push({text:r[key+'_loc'+suffix],locale,table:name,column:key+'_loc'+suffix,verifiedBuild:r.verifiedbuild??null});
   }
 }return out;}
 function entity(kind,id){const table=kind==='creature'?creatures:objects,loc=kind==='creature'?creatureLoc:objectLoc;
  const chosen=chooseText([...candidates(loc.get(id)||[],['name']),{text:table.get(id)?.name,locale:'enUS'}]);return {kind,id,name:chosen.text,nameLocale:chosen.locale};}
 const starters=new Map(),enders=new Map();
 for(const [dest,suffixes]of [[starters,['queststarter','questrelation']],[enders,['questender','involvedrelation']]])for(const kind of ['creature','gameobject'])for(const suffix of suffixes){
  for(const r of tables.get(kind+'_'+suffix)||[]){const quest=Number(r.quest);if(!dest.has(quest))dest.set(quest,[]);dest.get(quest).push(entity(kind,Number(r.id)));}
 }
 for(const r of tables.get('quest_relations')||[]){
  if(![0,1].includes(r.actor)||![0,1].includes(r.role))continue;
  const dest=r.role===0?starters:enders;const quest=Number(r.quest);if(!dest.has(quest))dest.set(quest,[]);
  dest.get(quest).push(entity(r.actor===0?'creature':'gameobject',Number(r.entry)));
 }
 const records=[];
 for(const [id,b]of bases){
  const a=addons.get(id)||{},text={},textLocales={},textColumns={},textBuilds={},textIssues={},english={};
  for(const [name,keys]of Object.entries(TEXT_FIELDS)){
   const extra=name==='progress'?progress.get(id):name==='completion'?completion.get(id):null;
   const extraTable=name==='progress'?'quest_request_items':'quest_offer_reward';
   const en=[];for(const key of keys){en.push({text:b[key],locale:'enUS',table:'quest_template',column:key,verifiedBuild:b.verifiedbuild??b.wdbverified??null});if(extra)en.push({text:extra[key],locale:'enUS',table:extraTable,column:key,verifiedBuild:extra.verifiedbuild??null});}
   const local=[...(localeRows.get(id)||[]),...(name==='progress'?progressLoc.get(id)||[]:name==='completion'?completionLoc.get(id)||[]:[])];
   const allCandidates=[...candidates(local,keys),...en];
   const broken=allCandidates.filter(c=>typeof c.text==='string'&&c.text.includes('\ufffd')).map(c=>`${c.locale}:${c.table}.${c.column}:replacement-character`);
   if(broken.length)textIssues[name]=[...new Set(broken)];
   const chosen=chooseText(allCandidates);
   text[name]=chosen.text;textLocales[name]=chosen.locale;textColumns[name]=chosen.table?chosen.table+'.'+chosen.column:null;
   textBuilds[name]=chosen.verifiedBuild??null;
   english[name]=chooseText([...en,...candidates(local,keys).filter(c=>c.locale==='enUS')]).text;
  }
  const tags=[];const allTitle=text.title+' '+english.title;
  if(customQuestIds.includes(id))tags.push('community-custom');
  if(Object.keys(textIssues).length)tags.push('source-encoding-issue');
  if(translationWarnings[id])tags.push('translation-review');
  if(/(?:\b(?:test|deprecated|obsolete|unused|debug|placeholder)\b|\[ph\]|\(old\)|\[old\]|测试|废弃|占位)/i.test(allTitle))tags.push('suspected-test');
  if(!text.title.trim())tags.push('missing-title');if(!text.description.trim())tags.push('missing-description');
  const available=Object.values(textLocales).filter(Boolean);const localeSet=[...new Set(available)];
  const record={schemaVersion:1,key:version+':'+id,version,id,text,textLocales,textColumns,textBuilds,textIssues,qualityNotes:translationWarnings[id]||[],english,
   level:field(b,['questlevel','level']),minLevel:field(b,['minlevel']),zoneOrSort:field(b,['questsortid','zoneorsort']),type:field(b,['questinfoid','type']),
   suggestedPlayers:field(b,['suggestedgroupnum','suggestedplayers']),raceMask:field({...b,...a},['allowableraces','requiredraces']),classMask:field({...b,...a},['allowableclasses','requiredclasses']),
   flags:field(b,['flags','questflags']),specialFlags:field({...b,...a},['specialflags']),
   links:{prevQuestId:field({...b,...a},['prevquestid']),nextQuestId:field({...b,...a},['nextquestid']),nextQuestInChain:field(b,['nextquestinchain','nextquestidchain']),rewardNextQuest:field(b,['rewardnextquest']),exclusiveGroup:field({...b,...a},['exclusivegroup']),breadcrumbForQuestId:field({...b,...a},['breadcrumbforquestid'])},
   starters:starters.get(id)||[],enders:enders.get(id)||[],objectiveDetails:[],tags,locales:localeSet,
   source:version,sourceFields:Object.fromEntries(Object.entries({...b,...a}).filter(([k,v])=>v!==null&&v!==0&&v!==''&&!Object.values(TEXT_FIELDS).flat().includes(k)))};
  for(const {table,row:o}of objectives.get(id)||[]){
    const oid=Number(o.id);const locRows=(objectiveLocales.get(oid)||[]).map(x=>({...x,r:{...x.r,locale:({4:'zhCN',5:'zhTW',0:'enUS'}[x.r.locale]??x.r.locale)}}));
    const chosen=chooseText([...candidates(locRows,['description']),{text:o.description,locale:'enUS',table,column:'description'}]);
    record.objectiveDetails.push({id:oid,type:o.type,objectId:o.objectid,amount:o.amount,order:o.storageindex??o.index??0,description:chosen.text,locale:chosen.locale});
  }
  records.push(record);
 }
 return records.sort((a,b)=>a.id-b.id);
}
