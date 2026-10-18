// Version-local item normalization. Never execute client description expressions.
export const LOCALES=['zhCN','zhTW','enUS'];
const n=x=>Number(x)||0;
const han=s=>/\p{Script=Han}/u.test(s);
export function choose(candidates){for(const locale of LOCALES)for(const c of candidates){if(c.locale===locale&&typeof c.text==='string'&&c.text.trim()&&!c.text.includes('\ufffd')&&(locale==='enUS'||han(c.text)))return c;}return {text:'',locale:null,source:null};}
export const statNames={0:'法力值',1:'生命值',3:'敏捷',4:'力量',5:'智力',6:'精神',7:'耐力',12:'防御等级',13:'躲闪等级',14:'招架等级',15:'格挡等级',16:'近战命中等级',17:'远程命中等级',18:'法术命中等级',19:'近战暴击等级',20:'远程暴击等级',21:'法术暴击等级',28:'近战急速等级',29:'远程急速等级',30:'法术急速等级',31:'命中等级',32:'暴击等级',35:'韧性等级',36:'急速等级',37:'精准等级',38:'攻击强度',39:'远程攻击强度',41:'治疗效果',42:'法术伤害',43:'每 5 秒法力回复',44:'护甲穿透等级',45:'法术强度',46:'每 5 秒生命回复',47:'法术穿透',48:'格挡值',49:'精通等级',50:'护甲加成',51:'火焰抗性',52:'冰霜抗性',53:'神圣抗性',54:'暗影抗性',55:'自然抗性',56:'奥术抗性',57:'PvP 强度',59:'速度',61:'吸血',62:'闪避',63:'坚不可摧',71:'力量／敏捷／智力',72:'力量／敏捷',73:'敏捷／智力',74:'力量／智力',40:'全能'};
export function armorValue(item,get){
 if(item.classId!==4)return null;const q=item.quality===7?3:item.quality,l=item.itemLevel;if(q<0||q>6)return null;
 if(item.subclassId===6){const r=get('ItemArmorShield',l);return r?Math.floor(n(r['quality_'+q])+.5):null;}
 const material=['','cloth','leather','mail','plate'][item.subclassId];if(!material)return null;
 const a=get('ItemArmorQuality',l),b=get('ItemArmorTotal',l),c=get('ArmorLocation',item.inventoryType===20?5:item.inventoryType);
 return a&&b&&c?Math.floor(n(a['qualitymod_'+q])*n(b[material])*n(c[(material==='mail'?'chain':material)+'modifier'])+.5):null;
}
export function damageValue(item,raw,get){
 if(item.classId!==2||!item.delay)return [];
 if(raw.dmg_min1!==undefined)return Array.from({length:5},(_,i)=>({min:n(raw['dmg_min'+(i+1)]),max:n(raw['dmg_max'+(i+1)]),school:n(raw['dmg_type'+(i+1)])})).filter(d=>d.max>0);
 const caster=n(raw.flags_1??raw.flags2??raw.flagsextra)&512,q=item.quality===7?3:item.quality;
 let table=null;const inv=item.inventoryType,sub=item.subclassId;
 if([13,21,22].includes(inv))table='ItemDamageOneHand'+(caster?'Caster':'');
 if(inv===17)table='ItemDamageTwoHand'+(caster?'Caster':'');
 if([15,25,26].includes(inv))table=item.version==='legion'?(sub===19?'ItemDamageOneHandCaster':[2,3,18].includes(sub)?'ItemDamageTwoHand'+(caster?'Caster':''):null):(sub===19?'ItemDamageWand':sub===16?'ItemDamageThrown':[2,3,18].includes(sub)?'ItemDamageRanged':null);
 const r=table&&get(table,item.itemLevel);if(!r||q<0||q>6)return [];
 const dps=n(r['quality_'+q]),avg=dps*item.delay/1000,variance=n(raw.dmgvariance??raw.statscalingfactor);
 return dps?[{min:Math.floor((1-variance/2)*avg),max:Math.floor((1+variance/2)*avg+.5),school:n(raw.damage_damagetype??raw.damagetype),dps:Math.round(dps*100)/100,basis:{table,row:item.itemLevel,column:'quality_'+q,rule:'base-damage-v1'}}]:[];
}
export function legionStat(item,raw,index,get){
 const type=n(raw['statmodifier_bonusstat_'+index]),allocation=n(raw['statpercenteditor_'+index]),base=n(raw['statmodifier_bonusamount_'+index]);if(type<0)return null;
 const inv=item.inventoryType,sub=item.subclassId,q=item.quality,kind=q===2?'good':[3,7].includes(q)?'superior':[4,5,6].includes(q)?'epic':null;
 const slot=[1,4,5,7,15,17,20,25].includes(inv)?0:inv===26?(sub===19?3:0):[13,21,22].includes(inv)?3:[3,6,8,10,12].includes(inv)?1:[2,9,11,14,16,23].includes(inv)?2:null;
 const points=kind&&slot!==null?n(get('RandPropPoints',item.itemLevel)?.[kind+'_'+slot]):0;
 const amount=points?(n(raw['statpercentageofsocket_'+index])?null:Math.floor(allocation*points/10000+.5)):(allocation&&!base?null:base);
 if(amount===0&&!allocation)return null;
 return {type,label:statNames[type]||'属性 #'+type,amount,basis:points?{table:'RandPropPoints',row:item.itemLevel,column:kind+'_'+slot,allocation,rule:'base-stat-allocation-v1',socketCostMissing:amount===null}:{table:'ItemSparse',column:'statmodifier_bonusamount_'+index}};
}
const fmt=x=>String(Math.round(x*100)/100);
const time=(ms,locale)=>ms===-1?(locale==='enUS'?'until cancelled':'直到取消'):ms%3600000===0?(fmt(ms/3600000)+(locale==='enUS'?' hours':' 小时')):ms%60000===0?(fmt(ms/60000)+(locale==='enUS'?' min':' 分钟')):(fmt(ms/1000)+(locale==='enUS'?' sec':' 秒'));
export function effectAmount(effect){
 if(!effect||effect.scaling||n(effect.effectrealpointsperlevel)||n(effect.coefficient)||n(effect.effectpointsperresource))return null;
 const b=n(effect.effectbasepoints),d=n(effect.effectdiesides),min=b+(d?Math.min(1,d):0),max=b+(d?Math.max(1,d):0);return {min,max};
}
export function renderSpellText(raw,spell,lookup,locale='enUS',depth=0){
 if(!raw||depth>3)return {text:'',unresolved:Boolean(raw)};
 let missing=false;
 const unknown=()=>{missing=true;return locale==='enUS'?'[value depends on character or spell context]':'〔数值取决于角色或法术条件〕';};
 let text=String(raw).replace(/\$@spelldesc(\d+)/gi,(_,id)=>{const s=lookup(n(id));if(!s||s.id===spell.id||s.descriptionLocale!==locale)return unknown();const r=renderSpellText(s.description,s,lookup,locale,depth+1);missing||=r.unresolved;return r.text||unknown();});
 // Unknown formulas/conditionals must not become plausible but incorrect numbers.
 if(/\$\{|\$\?|\$<|\$\[/.test(text))return {text:'',unresolved:true};
 text=text.replace(/\$(\d*)([sSmMoOtTaAdDhHnNuU])(\d*)(?![A-Za-z0-9_])/g,(token,id,code,index)=>{
  const s=id?lookup(n(id)):spell;if(!s)return unknown();const e=s.effects?.[n(index||1)-1],amount=effectAmount(e);
  switch(code.toLowerCase()){
   case 's':case 'm':if(!amount)return unknown();if(code==='m')return fmt(Math.abs(amount.min));if(code==='M')return fmt(Math.abs(amount.max));return amount.min===amount.max?fmt(Math.abs(amount.min)):fmt(Math.abs(amount.min))+'–'+fmt(Math.abs(amount.max));
   case 'd':return s.duration!=null?time(s.duration,locale):unknown();
   case 't':return e&&n(e.effectauraperiod)>0?fmt(n(e.effectauraperiod)/1000):unknown();
   case 'o':return amount&&amount.min===amount.max&&s.duration>0&&n(e.effectauraperiod)>0?fmt(Math.abs(amount.min)*Math.floor(s.duration/n(e.effectauraperiod))):unknown();
   case 'a':return e?.radius!=null?fmt(e.radius):unknown();
   case 'h':return s.procChance!=null?fmt(s.procChance):unknown();
   case 'n':return e?fmt(n(e.effectchaintargets)):unknown();
   case 'u':return s.stacks!=null?fmt(s.stacks):unknown();
   default:return unknown();
  }
 });
 text=text.replace(/\$l([^:;]*):([^;]*);/g,'$2').replace(/\$[bB]/g,'\n').replace(/\|c[0-9a-f]{8}|\|r/gi,'');
 if(/\$|\|[HTA]/.test(text))return {text:'',unresolved:true};
 return {text:text.trim(),unresolved:missing};
}
export function createSpellLookup(version,tables,sql){
 const table=name=>tables.get(name+':enUS')||tables.get(name+':ruRU');
 const get=(name,id)=>table(name)?.rows.get(n(id));
 const grouped=new Map(),misc=new Map(),cache=new Map();
 for(const row of table('SpellEffect')?.rows.values()||[])if(!n(row.difficultyid)){const id=n(row.spellid);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id)[n(row.effectindex)]=row;}
 for(const row of table('SpellMisc')?.rows.values()||[])if(!n(row.difficultyid))misc.set(n(row.spellid),row);
 const classic=tables.get('client:enUS')?.rows,classicText=new Map((classic?.spell_text||[]).map(r=>[r.entry,r]));
 const classicSpells=new Map((sql.get('spell_template')||[]).map(r=>[n(r.id),r]));
 const lookups=tables.get('lookups:enUS')?.rows;
 const localized=(id,column)=>choose(LOCALES.flatMap(locale=>{const t=tables.get('Spell:'+locale),r=t?.rows.get(id),v=r?.[column];return v?[{text:typeof v==='object'?v[locale]:v,locale,source:{...t.source,column,row:id}}]:[]}));
 const lookup=id=>{
  id=n(id);if(cache.has(id))return cache.get(id);const row=version==='classic'?classicSpells.get(id):get('Spell',id);if(!row){cache.set(id,null);return null;}
  let name=version==='classic'?{text:row.spellname,locale:'enUS',source:{source:version,table:'spell_template',column:'spellname',row:id}}:localized(id,'name_lang');
  if(!name.text&&sql.get('_spellNames')?.has(id))name=sql.get('_spellNames').get(id);
  const desc=version==='classic'?{text:classicText.get(id)?.description||'',locale:'enUS',source:{...tables.get('client:enUS').source,column:'spell_text.description',row:id}}:localized(id,'description_lang');
  const effects=version==='classic'||version==='wotlk'?Array.from({length:3},(_,i)=>{const e={},old=version==='classic';for(const key of ['effect','effectbasepoints','effectdiesides','effectrealpointsperlevel','effecttriggerspell','effectitemtype','effectbonuscoefficient'])e[key]=n(row[key+(old?i+1:'_'+i)]);e.effectaura=n(row[(old?'effectapplyauraname':'effectaura')+(old?i+1:'_'+i)]);e.effectauraperiod=n(row[(old?'effectamplitude':'effectauraperiod')+(old?i+1:'_'+i)]);e.effectmiscvalue_0=n(row['effectmiscvalue'+(old?i+1:'_'+i)]);e.effectchaintargets=n(row[(old?'effectchaintarget':'effectchaintargets')+(old?i+1:'_'+i)]);e.radiusIndex=n(row['effectradiusindex'+(old?i+1:'_'+i)]);return e;}):(grouped.get(id)||[]).map(e=>({...e,scaling:n(row.scalingid)>0||n(e.coefficient)!==0,radiusIndex:n(e.effectradiusindex_0)}));
  for(const e of effects)if(e){const radius=get('SpellRadius',e.radiusIndex);e.radius=radius?n(radius.radius??radius.radiusmin):version==='classic'?lookups?.radius?.[e.radiusIndex]??null:null;}
  const meta=version==='pandaria'?get('SpellMisc',row.miscid):version==='legion'?misc.get(id):row;
  const d=get('SpellDuration',meta?.durationindex);let duration=version==='classic'?lookups?.duration?.[row.durationindex]??null:d?(n(d.durationperlevel)?null:n(d.maxduration)>0?Math.min(n(d.duration),n(d.maxduration)):n(d.duration)):null;
  const out={id,name:name.text||'',nameLocale:name.locale,nameSource:name.source,description:desc.text||'',descriptionLocale:desc.text?desc.locale:null,descriptionSource:desc.text?desc.source:null,effects,duration,procChance:row.procchance!==undefined?n(row.procchance):null,stacks:row.cumulativeaura!==undefined?n(row.cumulativeaura):null,raw:row,meta};cache.set(id,out);return out;
 };
 return {lookup,get};
}
export function normalizeItem(version,ref,raw,tables,sql,iconNames,spells){
 const modern=version==='legion',get=spells.get,primary={source:version,table:modern?'ItemSparse':'item_template',row:ref.id};
 const item={schemaVersion:1,version,id:ref.id,key:version+':item:'+ref.id,name:ref.name,nameLocale:ref.nameLocale,nameSource:ref.nameSource,templatePresent:Boolean(raw),icon:null,stats:[],damage:[],effects:[],sockets:[],notes:[],sources:{primary,fields:{}}};
 if(!raw){item.notes.push('物品属性暂未收录。');return item;}
 const fields={classId:modern?'classid':'class',subclassId:modern?'subclassid':'subclass',quality:modern?'overallqualityid':'quality',inventoryType:'inventorytype',itemLevel:'itemlevel',requiredLevel:'requiredlevel',binding:'bonding',sellPrice:'sellprice',durability:'maxdurability',delay:modern?'itemdelay':'delay',bagSlots:'containerslots',maxCount:'maxcount',stackable:'stackable',classMask:'allowableclass',raceMask:'allowablerace',requiredSkill:'requiredskill',requiredSkillRank:'requiredskillrank',requiredSpell:modern?'requiredability':'requiredspell',requiredFaction:modern?'minfactionid':'requiredreputationfaction',requiredReputation:modern?'minreputation':'requiredreputationrank',itemSet:'itemset'};
 for(const [field,column]of Object.entries(fields)){item[field]=raw[column]===undefined?null:n(raw[column]);item.sources.fields[field]={...primary,column,...(modern?tables.get((['classid','subclassid'].includes(column)?'Item':'ItemSparse')+':enUS')?.source:{})};}
 const localeRows=sql.get('_localeItems')?.get(ref.id)||[];
 const descriptions=[{text:raw.description??raw.description_lang,locale:'enUS',source:{...primary,column:modern?'description_lang':'description'}}];
 for(const locale of LOCALES){if(modern){const t=tables.get('ItemSparse:'+locale);descriptions.push({text:t?.rows.get(ref.id)?.description_lang,locale,source:{...t?.source,column:'description_lang',row:ref.id}});}else for(const r of localeRows){const column=r.locale?'description':'description_loc'+({zhCN:4,zhTW:5,enUS:0}[locale]);if(!r.locale||r.locale===locale)descriptions.push({text:r[column],locale,source:{source:version,table:sql.has('item_template_locale')?'item_template_locale':'locales_item',column,row:ref.id,build:r.verifiedbuild??null}});}}
 const desc=choose(descriptions);item.description=desc.text;item.descriptionLocale=desc.locale;item.sources.fields.description=desc.source;
 let icon='';if(version==='classic'){const c=tables.get('client:enUS');icon=iconNames.get(n(raw.displayid))||'';item.sources.fields.icon={...c.source,column:'item_display_info.icon',row:n(raw.displayid)};}else if(modern){icon=iconNames.get(n(raw.iconfiledataid))||'';item.sources.fields.icon={...tables.get('Item:enUS').source,column:'iconfiledataid',row:ref.id,fileDataId:n(raw.iconfiledataid),mapping:'shared/listfile-enUS.csv'};}else{icon=get('ItemDisplayInfo',raw.displayid)?.inventoryicon_0||'';item.sources.fields.icon={...(tables.get('ItemDisplayInfo:enUS')||tables.get('ItemDisplayInfo:ruRU')).source,column:'inventoryicon_0',row:n(raw.displayid)};}
 icon=String(icon).replace(/^.*[\\/]/,'').replace(/\.blp$/i,'').toLowerCase();if(/^[a-z0-9_-]+$/.test(icon))item.icon=icon;
 item.armor=raw.armor!==undefined?n(raw.armor):armorValue(item,get);
 item.sources.fields.armor=raw.armor!==undefined?{...primary,column:'armor'}:{rule:'base-armor-v1',tables:['ItemArmorTotal','ItemArmorQuality','ArmorLocation','ItemArmorShield'],itemLevel:item.itemLevel};
 item.damage=damageValue(item,raw,get);
 for(let i=0;i<10;i++){if(modern){const stat=legionStat(item,raw,i,get);if(stat)item.stats.push(stat);}else{const type=n(raw['stat_type'+(i+1)]),amount=n(raw['stat_value'+(i+1)]);if(amount)item.stats.push({type,label:statNames[type]||'属性 #'+type,amount,basis:{...primary,columns:['stat_type'+(i+1),'stat_value'+(i+1)]}});}}
 item.resistances=['holy','fire','nature','frost','shadow','arcane'].map((school,i)=>({school:i+1,amount:n(raw[school+'_res'])})).filter(r=>r.amount);
 item.block=n(raw.block);
 const bindings=modern?(sql.get('_itemEffects')?.get(ref.id)||[]).map(e=>({id:n(e.spellid),trigger:n(e.triggertype),charges:n(e.charges),cooldown:n(e.cooldownmsec),categoryCooldown:n(e.categorycooldownmsec),source:{...tables.get('ItemEffect:enUS').source,row:n(e.id),column:'spellid'}})):Array.from({length:5},(_,i)=>({id:n(raw['spellid_'+(i+1)]),trigger:n(raw['spelltrigger_'+(i+1)]),charges:n(raw['spellcharges_'+(i+1)]),cooldown:n(raw['spellcooldown_'+(i+1)]),categoryCooldown:n(raw['spellcategorycooldown_'+(i+1)]),source:{...primary,column:'spellid_'+(i+1)}})).filter(e=>e.id>0);
 for(const b of bindings){const s=spells.lookup(b.id);if(!s){item.effects.push({...b,name:'',text:'',unresolved:true});continue;}const rendered=renderSpellText(s.description,s,spells.lookup,s.descriptionLocale);item.effects.push({...b,name:s.name,nameLocale:s.nameLocale,nameSource:s.nameSource,text:rendered.text,textLocale:s.descriptionLocale,unresolved:rendered.unresolved||!rendered.text,rawDescription:s.description,descriptionSource:s.descriptionSource,mechanics:s.effects.filter(Boolean),duration:s.duration});}
 for(let i=0;i<3;i++){const type=n(raw[(modern?'sockettype_':'socketcolor_')+(modern?i:i+1)]);if(type)item.sockets.push({type,encoding:modern?'index':'mask'});}
 const bonusId=n(raw.socket_match_enchantment_id??raw.socketbonus);if(bonusId){const choices=[];for(const locale of LOCALES){const t=tables.get('SpellItemEnchantment:'+locale),r=t?.rows.get(bonusId),v=r?.name_lang;if(v)choices.push({text:(typeof v==='object'?v[locale]:v)?.replace(/\$k([123])/g,(_,i)=>String(n(r['effectpointsmin_'+(n(i)-1)]))),locale,source:{...t.source,column:'name_lang',row:bonusId}});}const bonus=choose(choices);item.socketBonus={id:bonusId,text:bonus.text,locale:bonus.locale,source:bonus.source};}
 if(n(raw.randomproperty??raw.randomselect)||n(raw.randomsuffix??raw.itemrandomsuffixgroupid))item.notes.push('可能带有随机属性；此处只显示固定的基础属性。');
 if(n(raw.scalingstatdistribution??raw.scalingstatdistributionid))item.notes.push('物品会随角色等级变化；此处为档案的基础等级。');
 if(item.stats.some(s=>s.amount===null))item.notes.push('部分属性取决于等级缩放或尚缺换算数据，暂不显示固定数值。');
 if(item.itemSet)item.notes.push('属于套装；套装组合效果暂未收录。');
 if(item.classId===2&&!item.damage.length)item.notes.push('武器伤害数值暂未收录。');
 if(item.requiredSpell||item.requiredFaction)item.notes.push('另有法术或声望使用条件，详见原始物品档案。');
 item.raw=Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==''&&v!==0&&v!=='0'&&v!=null));
 item.sources.clientManifest='sources/items/manifest.json';
 return item;
}
