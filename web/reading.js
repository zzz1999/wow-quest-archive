/* Shared presentation rules. Text and safe badge markup use the same token boundaries. */
(() => {
 'use strict';
 const defaults=Object.freeze({mode:'player',name:'',race:'',className:'',gender:'both'});
 function normalize(value){
  const input=value&&typeof value==='object'?value:{};
  const text=key=>typeof input[key]==='string'?input[key].replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';
  return {mode:input.mode==='source'?'source':'player',name:text('name'),race:text('race'),className:text('className'),gender:['male','female'].includes(input.gender)?input.gender:'both'};
 }
 const alias=value=>String(value).toLowerCase().replace(/[\s_-]+/g,'');
 function character(options,context){
  const data=globalThis.QuestReadingData,quest=context.quest;
  if(!data||quest?.version!==data.version)return null;
  if(options.className)return data.classes.find(c=>c.aliases.some(a=>alias(a)===alias(options.className)))||null;
  // A single allowed class is evidence; a multi-class mask is not a profile.
  return data.classes.find(c=>quest.classMask===2**(c.id-1))||null;
 }
 function objectiveAmount(context,index){
  const all=context.quest?.objectiveDetails;
  if(!Array.isArray(all)||!all.length)return null;
  let selected;
  if(index===null){
   selected=context.objective&&all.find(o=>o.id===context.objective.id);
   if(!selected&&all.length===1)selected=all[0];
  }else if(index>0&&index<=all.length){
   const sorted=[...all].sort((a,b)=>a.order-b.order);
   if(sorted.every((o,i)=>o.order===i))selected=sorted[index-1];
   // Single/currency objectives can use -1. Identical amounts are also
   // unambiguous even when storage indices have gaps or start at one.
   else if(all.every(o=>o.amount===all[0].amount))selected=all[0];
  }
  return selected&&Number.isSafeInteger(selected.amount)&&selected.amount>=0?selected:null;
 }
 function segments(value,options=defaults,context={}){
  const source=String(value??''),settings=normalize(options);
  if(settings.mode==='source')return [{text:source}];
  const result=[],playerClass=character(settings,context),build=globalThis.QuestReadingData?.build;
  const alternatives=(a,b)=>a===b?a:`${a||'（无称呼）'} / ${b||'（无称呼）'}`;
  // Long forms must be consumed before one-letter variables. Parse only source
  // text, never character values inserted by the reader.
  function parse(text,depth=0){
   let cursor=0;
   while(cursor<text.length){
    const start=text.slice(cursor).search(/\$|\\n/);
    if(start<0){result.push({text:text.slice(cursor)});break;}
    if(start)result.push({text:text.slice(cursor,cursor+start)});cursor+=start;
    const rest=text.slice(cursor);let match;
    const add=(token,value,label,note,unresolved=false)=>{result.push({text:value,token,label,...(note?{note}:{}),unresolved});cursor+=token.length;};
    if((match=/^(?:\\n|\$[Bb])/.exec(rest))){result.push({text:'\n'});cursor+=match[0].length;continue;}
    if(depth<8&&(match=/^\$([Gg])([^:;\r\n]*):([^:;\r\n]*);/.exec(rest))){
     parse(settings.gender==='male'?match[2]:settings.gender==='female'?match[3]:alternatives(match[2],match[3]),depth+1);cursor+=match[0].length;continue;
    }
    if((match=/^\$[Gg]([^:;\r\n]*):([^:;\r\n]*):([rc]);/i.exec(rest))){
     add(match[0],alternatives(match[1],match[2]),'语法称呼','按玩家'+(match[3].toLowerCase()==='r'?'种族':'职业')+'的语法形式选择。这里并列展示原文分支，不按玩家性别猜选。',true);continue;
    }
    if((match=/^\$[vV][gG]([^:;\r\n]*):([^:;\r\n]*);/.exec(rest))){
     const villain=playerClass?.villain;
     add(match[0],villain?(villain.gender==='male'?match[1]:match[2]):alternatives(match[1],match[2]),'职业敌人的性别称呼',villain?`按${villain.text}的性别选择，来自 ${build} ChrClassVillain。`:'按职业对应敌人的性别选择；请在阅读设置中选择职业。缺少对应版本的数据时并列显示。',!villain);continue;
    }
    if((match=/^\$[cC][tT](?![A-Za-z])/.exec(rest))){
     const title=playerClass?.title,value=title?(settings.gender==='female'?title.female.text||title.male.text:settings.gender==='male'?title.male.text:alternatives(title.male.text,title.female.text||title.male.text)):null;
     add(match[0],value||'职业头衔','职业头衔',value?`${playerClass.name.text}的职业领袖称号，来自 ${build} ChrClassTitle；职业依据${settings.className?'阅读设置':'该任务的单一职业限制'}。`:'例如法师对应“大法师”。请在阅读设置中选择职业；目前只收录军团 7.3.5 的称号表。',!value);continue;
    }
    if((match=/^\$[vV][nN](?![A-Za-z])/.exec(rest))){
     const villain=playerClass?.villain;
     add(match[0],villain?.text||'职业对应的敌人','职业对应的敌人',villain?`${playerClass.name.text}对应${villain.text}，来自 ${build} ChrClassVillain。`:'敌人的名字随玩家职业变化。请在阅读设置中选择职业；目前只收录军团 7.3.5 的对应表。',!villain);continue;
    }
    if((match=/^\$(\d*)[oO][aA](?![A-Za-z])/.exec(rest))){
     const index=match[1]?Number(match[1]):null,objective=objectiveAmount(context,index),label=index===null?'当前目标所需数量':`第 ${index} 项目标所需数量`;
     add(match[0],objective?String(objective.amount):label,label,objective?`读取本版本任务目标的 Amount（${objective.amount}），不是玩家已完成的数量。`:'当前档案没有可唯一对应的目标数量，不能从其他版本或相邻目标猜填。',!objective);continue;
    }
    if((match=/^\$[pP](?![A-Za-z])/.exec(rest))){
     add(match[0],settings.name||'名字','玩家名字','按任务对白中的玩家称呼使用阅读设置中的名字。');continue;
    }
    if((match=/^\$[vVyY][gGqQ]([^:;\r\n]*):([^:;\r\n]*);/.exec(rest))){
     add(match[0],alternatives(match[1],match[2]),'待核实的条件称呼','尚未确定条件对应的对象，并列保留原文分支。',true);continue;
    }
    if((match=/^\$[cCrR][tTyY](?![A-Za-z])/.exec(rest))){
     add(match[0],'待核实：'+match[0],'待核实标记','没有找到足以确定其值的同版本依据，保留完整标记供核对。',true);continue;
    }
    if((match=/^\$(\d+)[wW](?![A-Za-z])/.exec(rest))){
     add(match[0],'服务器实时数值','世界状态数值',`由游戏中的世界状态 #${match[1]} 提供；离线档案没有实时数值。`,true);continue;
    }
    if((match=/^\$[Tt][^:;\r\n]*:[^:;\r\n]*;/.exec(rest))){
     add(match[0],'玩家军衔','玩家军衔','由游戏客户端按玩家的 PvP 军衔填写；档案没有玩家的军衔信息。',true);continue;
    }
    if((match=/^\$[NnCcRr]/.exec(rest))){
     const token=match[0],key=token[1].toLowerCase(),label={n:'名字',c:'职业',r:'种族'}[key];
     let value=settings[{n:'name',c:'className',r:'race'}[key]]||label;
     if(key!=='n')value=token[1]===key?value.toLowerCase():value.slice(0,1).toUpperCase()+value.slice(1);
     add(token,value,label);continue;
    }
    // Keep malformed gender expressions intact, including their punctuation.
    if((match=/^\$[Gg][^\r\n;]*(?:;|$)/.exec(rest))){result.push({text:match[0]});cursor+=match[0].length;continue;}
    if((match=/^\$[A-Za-z0-9]+/.exec(rest))){
     add(match[0],'待核实：'+match[0],'待核实标记','当前档案无法确定此标记的含义和取值。原始标记保留供核对。',true);continue;
    }
    result.push({text:text[cursor++]});
   }
  }
  parse(source);return result;
 }
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function format(value,options,context){return segments(value,options,context).map(part=>part.text+(part.unresolved&&!part.text.includes(part.token)?`〔${part.token}〕`:'')).join('');}
 function html(value,options,context){return segments(value,options,context).map(part=>part.token?`<span class="locale-badge zhCN variable-badge" data-variable="${escape(part.token)}" title="${escape(part.token+' · '+part.label+(part.note?'：'+part.note:''))}"${part.note?' tabindex="0"':''}>${escape(part.text)}</span>`:escape(part.text)).join('');}
 function notes(value,options,context){
  const unique=new Map();
  for(const part of segments(value,options,context).filter(part=>part.note)){
   if(unique.has(part.token))unique.get(part.token).occurrences++;
   else unique.set(part.token,{token:part.token,label:part.label,note:part.note,resolved:!part.unresolved,occurrences:1});
  }
  return [...unique.values()];
 }
 (typeof window==='undefined'?globalThis:window).QuestReading=Object.freeze({defaults,normalize,format,html,notes});
})();
