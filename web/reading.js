/* Shared presentation rules. Text and safe badge markup use the same token boundaries. */
(() => {
 'use strict';
 const defaults=Object.freeze({mode:'player',name:'',race:'',className:'',gender:'both'});
 function normalize(value){
  const input=value&&typeof value==='object'?value:{};
  const text=key=>typeof input[key]==='string'?input[key].replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';
  return {mode:input.mode==='source'?'source':'player',name:text('name'),race:text('race'),className:text('className'),gender:['male','female'].includes(input.gender)?input.gender:'both'};
 }
 function segments(value,options=defaults){
  const source=String(value??''),settings=normalize(options);
  if(settings.mode==='source')return [{text:source}];
  const result=[];
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
    const add=(token,value,label,note)=>{result.push({text:value,token,label,...(note?{note}:{})});cursor+=token.length;};
    if((match=/^(?:\\n|\$[Bb])/.exec(rest))){result.push({text:'\n'});cursor+=match[0].length;continue;}
    if(depth<8&&(match=/^\$([Gg])([^:;\r\n]*):([^:;\r\n]*);/.exec(rest))){
     parse(settings.gender==='male'?match[2]:settings.gender==='female'?match[3]:alternatives(match[2],match[3]),depth+1);cursor+=match[0].length;continue;
    }
    if((match=/^\$[Gg]([^:;\r\n]*):([^:;\r\n]*):([rc]);/i.exec(rest))){
     add(match[0],alternatives(match[1],match[2]),'语法称呼','按玩家'+(match[3].toLowerCase()==='r'?'种族':'职业')+'的语法形式选择。这里并列展示原文分支，不按玩家性别猜选。');continue;
    }
    if((match=/^\$[vVyY][gGqQ]([^:;\r\n]*):([^:;\r\n]*);/.exec(rest))){
     add(match[0],alternatives(match[1],match[2]),'条件称呼','这是原文中的条件分支。所引用的对象及条件尚未核实，因此并列展示，阅读设置中的玩家性别不会改变它。');continue;
    }
    if((match=/^\$[cCrR][tTyY](?![A-Za-z])/.exec(rest))){
     add(match[0],'特殊变量','特殊变量','此完整标记的具体含义尚未核实，不能拆成普通职业或种族变量，也不能代入玩家资料。');continue;
    }
    if((match=/^\$(\d+)[wW](?![A-Za-z])/.exec(rest))){
     add(match[0],'实时数值','世界状态数值',`由游戏中的世界状态 #${match[1]} 提供；离线档案没有实时数值。`);continue;
    }
    if((match=/^\$[Tt][^:;\r\n]*:[^:;\r\n]*;/.exec(rest))){
     add(match[0],'军衔','玩家军衔','由游戏客户端按玩家的 PvP 军衔填写；档案没有玩家的军衔信息。');continue;
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
     add(match[0],'游戏变量','游戏变量','需要客户端上下文或尚未支持的标记；当前档案无法确定其值。原始标记保留在此说明和原文视角中。');continue;
    }
    result.push({text:text[cursor++]});
   }
  }
  parse(source);return result;
 }
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function format(value,options){return segments(value,options).map(part=>part.text+(part.note?`〔${part.token}〕`:'')).join('');}
 function html(value,options){return segments(value,options).map(part=>part.token?`<span class="locale-badge zhCN variable-badge" data-variable="${escape(part.token)}" title="${escape(part.token+' · '+part.label+(part.note?'：'+part.note:''))}"${part.note?' tabindex="0"':''}>${escape(part.text)}</span>`:escape(part.text)).join('');}
 function notes(value,options){return [...new Map(segments(value,options).filter(part=>part.note).map(part=>[part.token,{token:part.token,label:part.label,note:part.note}])).values()];}
 (typeof window==='undefined'?globalThis:window).QuestReading=Object.freeze({defaults,normalize,format,html,notes});
})();
