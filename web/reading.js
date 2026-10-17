/* Shared, text-only presentation rules. Source records are never modified. */
(() => {
 'use strict';
 const defaults=Object.freeze({mode:'player',name:'',race:'',className:'',gender:'both'});
 function normalize(value){
  const input=value&&typeof value==='object'?value:{};
  const text=key=>typeof input[key]==='string'?input[key].replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';
  return {mode:input.mode==='source'?'source':'player',name:text('name'),race:text('race'),className:text('className'),gender:['male','female'].includes(input.gender)?input.gender:'both'};
 }
 function format(value,options=defaults){
  const source=String(value??''),settings=normalize(options);
  if(settings.mode==='source')return source;
  // Only the documented two-branch gender form is resolved. Extended or malformed forms stay intact.
  const branched=source.replace(/\$[Gg]([^:;\r\n]*):([^:;\r\n]*);/g,(_,male,female)=>settings.gender==='male'?male:settings.gender==='female'?female:male===female?male:`${male||'（无称呼）'} / ${female||'（无称呼）'}`);
  // A single substitution pass keeps user names such as "$B" literal.
  return branched.replace(/\\n|\$[BbNnCcRr]/g,token=>{
   if(token==='\\n'||/^\$[Bb]$/.test(token))return '\n';
   if(/^\$[Nn]$/.test(token))return settings.name||'玩家名称';
   const key=token[1].toLowerCase(),word=key==='c'?(settings.className||'玩家职业'):(settings.race||'玩家种族');
   return token[1]===key?word.toLowerCase():word.slice(0,1).toUpperCase()+word.slice(1);
  });
 }
 (typeof window==='undefined'?globalThis:window).QuestReading=Object.freeze({defaults,normalize,format});
})();
