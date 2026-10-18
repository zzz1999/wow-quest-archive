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
  // Only the documented two-branch gender form is resolved. Extended or malformed forms stay intact.
  const branched=source.replace(/\$[Gg]([^:;\r\n]*):([^:;\r\n]*);/g,(_,male,female)=>settings.gender==='male'?male:settings.gender==='female'?female:male===female?male:`${male||'（无称呼）'} / ${female||'（无称呼）'}`);
  // Tokenize before inserting character values, so tokens or markup in names stay literal.
  const result=[];let cursor=0;
  for(const match of branched.matchAll(/\\n|\$[BbNnCcRr]/g)){
   if(match.index>cursor)result.push({text:branched.slice(cursor,match.index)});
   const token=match[0];cursor=match.index+token.length;
   if(token==='\\n'||/^\$[Bb]$/.test(token)){result.push({text:'\n'});continue;}
   const key=token[1].toLowerCase(),label={n:'名字',c:'职业',r:'种族'}[key];
   let text=settings[{n:'name',c:'className',r:'race'}[key]]||label;
   if(key!=='n')text=token[1]===key?text.toLowerCase():text.slice(0,1).toUpperCase()+text.slice(1);
   result.push({text,token,label});
  }
  if(cursor<branched.length)result.push({text:branched.slice(cursor)});
  return result;
 }
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function format(value,options){return segments(value,options).map(part=>part.text).join('');}
 function html(value,options){return segments(value,options).map(part=>part.token?`<span class="locale-badge zhCN variable-badge" data-variable="${part.token}" title="${part.token} · ${part.label}">${escape(part.text)}</span>`:escape(part.text)).join('');}
 (typeof window==='undefined'?globalThis:window).QuestReading=Object.freeze({defaults,normalize,format,html});
})();
