import {createHash} from 'node:crypto';
export const versions=['classic','wotlk','cataclysm','pandaria','legion'];
export const editions={classic:{path:'classic/',env:4,label:'经典怀旧服'},wotlk:{path:'wotlk/',env:8,label:'巫妖王之怒怀旧服'},cataclysm:{path:'cata/',env:11,label:'大地的裂变怀旧服'},pandaria:{path:'mop-classic/',env:15,label:'潘达利亚之谜怀旧服'},legion:{path:'',env:1,label:'现行正式服'}};
export const locales={zhCN:{path:'cn/',id:4},zhTW:{path:'tw/',id:10},enUS:{path:'',id:0}};
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const pageUrl=(version,kind,id,locale='zhCN')=>`https://www.wowhead.com/${editions[version].path}${locales[locale].path}${kind}=${id}`;
export const tooltipUrl=(version,id,locale)=>`https://nether.wowhead.com/tooltip/item/${id}?dataEnv=${editions[version].env}&locale=${locales[locale].id}`;
export function plainHtml(html){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
 return String(html||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<br\s*\/?\s*>|<\/p\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(m,e)=>{if(e[0]!=='#')return entities[e]??m;const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;}).replace(/[\u200b\ufeff]/g,'').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function divContent(html,id){
 const start=new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`,'i').exec(html);if(!start)return '';
 const body=html.slice(start.index+start[0].length);let depth=1;for(const token of body.matchAll(/<\/?div\b[^>]*>/gi)){depth+=token[0][1]==='/'?-1:1;if(!depth)return body.slice(0,token.index);}return '';
}
export function parseQuest(html,id){
 if(!new RegExp(`\\$\\.extend\\(g_quests\\[${id}\\],`).test(html))return null;
 const heading=/<h1\b[^>]*class=["'][^"']*heading-size-1[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html);if(!heading)return null;
 const body=html.slice(heading.index+heading[0].length).split(/<h2\b[^>]*>\s*(?:Related|相关|相關)\s*<\/h2>/i)[0];
 const intro=body.split(/<script\b|<table\b|<h2\b|<div\b/i)[0];
 let description='';for(const h of body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)){if(['Description','描述','敘述','叙述'].includes(plainHtml(h[1]))){description=body.slice(h.index+h[0].length).split(/<h2\b|<script\b|<div\b/i)[0];break;}}
 return {title:plainHtml(heading[1]),objectives:plainHtml(intro),description:plainHtml(description),progress:plainHtml(divContent(body,'lknlksndgg-progress')),completion:plainHtml(divContent(body,'lknlksndgg-completion'))};
}
// Comparison only: saved source strings retain their original placeholders.
export const comparable=s=>String(s||'').normalize('NFKC').replace(/\$(?:B|b)|\\n/g,' ').replace(/<(?:name|名字|姓名)>|\$[Nn]/gi,'{name}').replace(/<(?:class|职业|職業)>|\$[Cc]/gi,'{class}').replace(/<(?:race|种族|種族)>|\$[Rr]/gi,'{race}').replace(/\s+/g,'').toLowerCase();
export function questAnchor(quest,page,locale){
 const source=locale==='enUS'?quest.english:Object.fromEntries(Object.entries(quest.text).filter(([k])=>quest.textLocales[k]===locale));
 if(!source.title||comparable(source.title)!==comparable(page.title))return null;
 for(const field of ['description','objectives'])if(source[field]&&comparable(source[field])===comparable(page[field]))return {locale,field,titleSha256:sha(comparable(source.title)),contextSha256:sha(comparable(source[field]))};
 return null;
}
export const realLocale=(text,locale)=>Boolean(text?.trim())&&!/\ufffd|\[(?:PH|NYI|DNT)\]|(?:placeholder|zzold|reuse me)/i.test(text)&&(locale==='enUS'||/\p{Script=Han}/u.test(text));
export function parseItemTooltip(data){
 if(!data?.tooltip||!data.name)return null;
 const effects=[],ownTooltip=data.tooltip.split('<!--itemEffects:1-->')[0];
 for(const m of ownTooltip.matchAll(/<!--(use|equip)Effect:0:(\d+)-->([\s\S]*?)<!--\1Effect:\2-->/g)){
  const a=/<a\b[^>]*href=["'][^"']*\/spell=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(m[3]);
  if(a)effects.push({id:Number(a[1]),trigger:m[1]==='use'?0:1,text:plainHtml(a[2])});
 }
 // Recipe tooltips have an unmarked learning link, followed by a second
 // complete tooltip for the produced item. Never import that item's effects.
 for(const m of ownTooltip.matchAll(/<span\b[^>]*class=["']q2["'][^>]*>([\s\S]*?)<\/span>/g)){
  const label=plainHtml(m[1]).match(/^(使用|Use|装备|裝備|Equip):/i),a=/<a\b[^>]*href=["'][^"']*\/spell=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(m[1]);
  if(label&&a&&!effects.some(e=>e.id===Number(a[1])))effects.push({id:Number(a[1]),trigger:/^(装备|裝備|Equip)$/i.test(label[1])?1:0,text:plainHtml(a[2])});
 }
 return {name:data.name,quality:data.quality,itemLevel:Number(data.tooltip.match(/<!--ilvl-->\s*(\d+)/)?.[1])||null,effects};
}
export function itemAnchor(item,page,locale){
 const name=locale===item.nameLocale?item.name:locale==='enUS'?(item.raw?.name||item.raw?.display_lang_enus):null;
 if(!name||comparable(name)!==comparable(page.name)||item.quality!==page.quality||!item.itemLevel||item.itemLevel!==page.itemLevel)return null;
 return {locale,nameSha256:sha(comparable(name)),quality:item.quality,itemLevel:item.itemLevel};
}
export function selectItemEffects(item,page,locale){
 const matches=[];
 for(const effect of item.effects){
  if(effect.text&&!effect.unresolved)continue;
  const learned=effect.id===483&&effect.trigger===0&&effect.mechanics?.some(e=>Number(e.effect)===36)?item.effects.filter(e=>e.trigger===6):[];
  const candidate=page.effects.find(e=>(e.id===effect.id||learned.some(l=>l.id===e.id))&&(e.trigger===effect.trigger||(e.trigger===0&&effect.trigger===5)));
  if(!candidate||!realLocale(candidate.text,locale)||/\$|\ufffd/.test(candidate.text))continue;
  // Only text without numeric tuning can cross from a current website edition.
  // Existing historical stats, charges, duration and cooldown remain authoritative.
  if(/[\d%％]|[一二三四五六七八九十百千万亿兩两]+(?:点|點|秒|分钟|分鐘|小时|小時|码|碼|米|次|层|層)/.test(candidate.text))continue;
  matches.push({id:effect.id,trigger:effect.trigger,...(candidate.id!==effect.id?{learnedSpellId:candidate.id}:{}),text:candidate.text,locale});
 }
 return matches;
}
export function attachReferences(rows,references,kind){return rows.map(r=>{if(r.version!==references.version)throw Error('Wowhead reference version mismatch');return references[kind]?.[r.id]?{...r,wowhead:references[kind][r.id]}:r;});}
