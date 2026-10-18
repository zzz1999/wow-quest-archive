const number=(v,fallback=0)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):fallback;
const idOf=r=>number(r.id??r.entry);
const locales=['zhCN','zhTW','enUS'];
function pickName(candidates){
 for(const locale of locales){const c=candidates.find(c=>c.locale===locale&&typeof c.text==='string'&&c.text.trim()&&!c.text.includes('\ufffd')&&(locale==='enUS'||/\p{Script=Han}/u.test(c.text)));if(c)return {name:c.text,nameLocale:locale,nameSource:c.source};}
 return {name:'',nameLocale:null,nameSource:null};
}
export function createRewardContext(tables,version,client={version,tables:new Map()}){
 if(client.version!==version)throw Error('Reward data version mismatch');
 const base=new Map((tables.get('item_template')||[]).map(r=>[idOf(r),r])),spellBase=new Map((tables.get('spell_template')||[]).map(r=>[idOf(r),r])),local=new Map(),cache=new Map();
 for(const table of ['locales_item','item_template_locale'])for(const row of tables.get(table)||[]){const id=idOf(row);if(!local.has(id))local.set(id,[]);local.get(id).push({table,row});}
 const tableEntry=(table,locale='enUS')=>client.tables.get(table+':'+locale);
 const tableRow=(table,id)=>tableEntry(table)?.rows.get(id);
 const value=(table,id,index)=>{
  const entry=tableEntry(table),row=entry?.rows.get(id);if(!row)return null;
  const column='difficulty_'+(index+(entry.asset.format==='sql'?1:0));
  return row[column]===undefined?null:{amount:number(row[column]),source:entry.source,table,column,build:entry.build,row:id};
 };
 function entity(kind,id){
  const key=kind+':'+id;if(cache.has(key))return cache.get(key);
  const table=({item:'ItemSparse',faction:'Faction',currency:'CurrencyTypes',spell:'Spell',skill:'SkillLine',title:'CharTitles'})[kind];
  const candidates=[],primary=kind==='item'?base.get(id):kind==='spell'?spellBase.get(id):null;
  if(kind==='item')for(const {table,row}of local.get(id)||[]){
   for(const locale of locales){const suffix=locale==='zhCN'?4:locale==='zhTW'?5:0;
    for(const column of [row.locale===locale?'name':null,suffix?'name_loc'+suffix:null].filter(Boolean))candidates.push({text:row[column],locale,source:{source:version,table,column,build:row.verifiedbuild??null}});
   }
  }
  if(primary){const column=kind==='item'?'name':'spellname';candidates.push({text:primary[column],locale:'enUS',source:{source:version,table:kind==='item'?'item_template':'spell_template',column,build:primary.verifiedbuild??primary.wdbverified??null}});}
  for(const language of locales){
   const entry=tableEntry(table,language),row=entry?.rows.get(id);if(!row)continue;
   if(entry.asset.format?.startsWith('sql')){
    for(const locale of locales)for(const column of ['name_lang_'+locale.toLowerCase(),'displayname_lang_'+locale.toLowerCase()])candidates.push({text:row[column],locale,source:{source:entry.source,table,column,build:entry.build}});
   }else for(const column of ['display_lang','displayname_lang','name_lang','name'])candidates.push({text:row[column],locale:language,source:{source:entry.source,table,column,build:entry.build}});
  }
  const result={id,...pickName(candidates)};
  if(kind==='item'){
   const entry=tableEntry(table),row=primary||entry?.rows.get(id);
   if(row)for(const [field,keys]of Object.entries({quality:['quality','overallqualityid'],itemLevel:['itemlevel'],requiredLevel:['requiredlevel'],inventoryType:['inventorytype'],classMask:['allowableclass']})){
    const key=keys.find(k=>row[k]!==undefined);if(key)result[field]=number(row[key]);
   }
   if(row){result.detailsSource=primary?{source:version,table:'item_template',build:primary.verifiedbuild??primary.wdbverified??null}:{source:entry.source,table,build:entry.build};result.scalesWithLevel=Boolean(number(row.scalingstatdistribution??row.scalingstatdistributionid));}
  }
  cache.set(key,result);return result;
 }
 const packages=new Map();for(const row of tableEntry('QuestPackageItem')?.rows.values()||[]){const id=number(row.packageid);if(!packages.has(id))packages.set(id,[]);packages.get(id).push({rowId:number(row.id),id:number(row.itemid),count:number(row.itemquantity),displayType:number(row.displaytype)});}
 return {version,entity,value,tableRow,packages};
}

export function roundQuestXP(xp){xp=Math.trunc(xp);return xp<=100?5*Math.floor((xp+2)/5):xp<=500?10*Math.floor((xp+5)/10):xp<=1000?25*Math.floor((xp+12)/25):50*Math.floor((xp+25)/50);}

export function normalizeRewards(base,addon,version,context){
 if(context.version!==version)throw Error('Reward context version mismatch');
 const row={...base,...addon},columns={};
 const read=(label,keys,fallback=0)=>{const key=keys.find(k=>row[k]!==undefined&&row[k]!==null);if(key){columns[label]=(addon[key]!==undefined?'quest_template_addon.':'quest_template.')+key;return number(row[key],fallback);}return fallback;};
 const reward={schemaVersion:1,source:version,items:[],choices:[],currencies:[],reputation:[],spells:[]};
 function items(field,idKeys,countKeys,max,kind='item'){
  for(let i=1;i<=max;i++){
   const id=read(`${field}.${i}.id`,idKeys.map(k=>k+i));if(id<=0)continue;
   const count=read(`${field}.${i}.count`,countKeys.map(k=>k+i),null);
   reward[field].push({...context.entity(kind,id),count,slot:i});
  }
 }
 items('items',['rewitemid','rewarditemid','rewarditem'],['rewitemcount','rewarditemcount','rewardamount'],4);
 items('choices',['rewchoiceitemid','rewardchoiceitemid'],['rewchoiceitemcount','rewardchoiceitemcount','rewardchoiceitemquantity'],6);
 items('currencies',['rewcurrencyid','rewardcurrencyid'],['rewcurrencycount','rewardcurrencycount','rewardcurrencyqty'],4,'currency');
 const packageId=read('package',['questpackageid','rewardpackageitemid']);
 if(packageId)reward.package={id:packageId,items:(context.packages.get(packageId)||[]).map(item=>({...context.entity('item',item.id),count:item.count,displayType:item.displayType,rowId:item.rowId})),source:context.packages.has(packageId)?{source:'rewards-'+version,table:'QuestPackageItem',build:'7.3.5.26972'}:null};

 const level=read('level',['questlevel','level'],null),fixedLevel=level>0?level:null;
 const difficulty=read('experience.difficulty',['rewardxpdifficulty','rewxpid','rewardxpid'],null),xpMultiplier=read('experience.multiplier',['rewardxpmultiplier'],1),bonus=read('money.maxLevelBonus',['rewmoneymaxlevel','rewardmoneymaxlevel','rewardbonusmoney'],null);
 const xp={amount:null,level:fixedLevel,dynamic:level===-1,difficulty,multiplier:xpMultiplier,basis:null};
 if(version==='classic'&&bonus!==null&&fixedLevel){
  const divisor=level>=65?6:level===64?4.8:level===63?3.6:level===62?2.4:level===61?1.2:0.6;
  xp.amount=Math.ceil(bonus/divisor);xp.basis={method:'classic-money-conversion',column:columns['money.maxLevelBonus'],divisor};
 }else if(difficulty===0||xpMultiplier===0){xp.amount=0;}
 else if(fixedLevel&&difficulty!==null){const lookup=context.value('QuestXP',fixedLevel,difficulty);if(lookup){xp.amount=roundQuestXP(lookup.amount*xpMultiplier);xp.basis=lookup;}}
 reward.experience=xp;

 const captured=read('money.captured',['reworreqmoney','rewardorrequiredmoney','rewardmoney'],null),moneyDifficulty=read('money.difficulty',['rewardmoneydifficulty'],0),moneyMultiplier=read('money.multiplier',['rewardmoneymultiplier'],1);
 reward.money={copper:captured,capturedCopper:captured,level:fixedLevel,dynamic:false,basis:null,maxLevelBonus:bonus};
 if(version==='legion'){
  reward.money.dynamic=level===-1;
  const lookup=fixedLevel?context.value('QuestMoneyReward',fixedLevel,moneyDifficulty):null;
  reward.money.copper=lookup?Math.trunc(lookup.amount*moneyMultiplier):moneyDifficulty===0||moneyMultiplier===0?0:null;
  if(lookup)reward.money.basis=lookup;
 }else if(version==='wotlk'&&moneyDifficulty&&captured>=0){
  // This community source scales the reward by PLAYER level, not quest level.
  reward.money.dynamic=true;reward.money.level=null;
 }
 if(number(base.flags??base.questflags)&0x20000)reward.money.maxLevelBonus=0;

 for(let i=1;i<=5;i++){
  const id=read(`reputation.${i}.id`,['rewrepfaction'+i,'rewardfactionid'+i]);if(!id)continue;
  const result={...context.entity('faction',id),slot:i,amount:null,basis:null};
  if(version==='classic'){result.amount=read(`reputation.${i}.amount`,['rewrepvalue'+i]);result.basis={column:columns[`reputation.${i}.amount`]};}
  else{
   const override=read(`reputation.${i}.override`,['rewardfactionoverride'+i,'rewardfactionvalueidoverride'+i,'rewrepvalue'+i]);
   const difficulty=read(`reputation.${i}.difficulty`,['rewardfactionvalue'+i,'rewardfactionvalueid'+i,'rewrepvalueid'+i]);
   result.difficulty=difficulty;
   if(override){result.amount=Math.trunc(override/100);result.basis={column:columns[`reputation.${i}.override`],divisor:100};}
   else{const lookup=context.value('QuestFactionReward',difficulty<0?2:1,Math.abs(difficulty));if(lookup){result.amount=lookup.amount;result.basis=lookup;}else if(difficulty===0)result.amount=0;}
  }
  reward.reputation.push(result);
 }
 const displayKeys=version==='legion'?['rewarddisplayspell1','rewarddisplayspell2','rewarddisplayspell3']:version==='wotlk'?['rewarddisplayspell']:['rewspell','rewardspell'];
 for(const key of displayKeys){const id=read('spells.display.'+key,[key]);if(id)reward.spells.push({...context.entity('spell',Math.abs(id)),role:'display',rawId:id});}
 const cast=read('spells.cast',version==='legion'||version==='wotlk'?['rewardspell']:['rewspellcast','rewardspellcast']);
 if(cast){const shown=reward.spells.find(s=>s.id===Math.abs(cast));if(shown)shown.role='display-and-cast';else reward.spells.push({...context.entity('spell',Math.abs(cast)),role:'cast',rawId:cast});}
 const title=read('title',['rewardtitle','rewardtitleid','chartitleid']);if(title)reward.title=context.entity('title',title);
 const skill=read('skill.id',['rewardskilllineid','rewardskillid','rewskill']);if(skill)reward.skill={...context.entity('skill',skill),points:read('skill.points',['rewardnumskillups','rewardskillpoints','rewskillvalue'])};
 const honor=read('honor.points',['rewardhonor','rewhonoraddition']),honorMultiplier=read('honor.multiplier',['rewardkillhonor','rewardhonormultiplier','rewhonormultiplier']);
 if(honor||honorMultiplier)reward.honor={points:honor,multiplier:honorMultiplier,dynamic:Boolean(honorMultiplier)};
 const talents=read('talents',['rewardtalents','bonustalents']),arena=read('arena',['rewardarenapoints']);if(talents)reward.talentPoints=talents;if(arena)reward.arenaPoints=arena;
 const mail=read('mail.id',['rewmailtemplateid','rewardmailtemplateid']);if(mail)reward.mail={templateId:mail,delaySeconds:read('mail.delay',['rewmaildelaysecs','rewardmaildelay'])};
 const dynamicId=read('dynamicRewardId',['questrewardid']);if(dynamicId)reward.dynamicRewardId=dynamicId;
 const artifact=read('artifact.difficulty',['rewardartifactxpdifficulty']);if(artifact)reward.artifactPower={difficulty:artifact,multiplier:read('artifact.multiplier',['rewardartifactxpmultiplier'],1),amount:null};
 // Columns retain zero/missing distinctions without repeating unrelated raw fields.
 reward.columns=Object.fromEntries(Object.entries(columns).filter(([key])=>{const [field,slot]=key.split('.');return !['items','choices','currencies','reputation'].includes(field)||reward[field].some(x=>x.slot===Number(slot));}));
 return reward;
}
