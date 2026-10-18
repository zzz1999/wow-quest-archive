import {TEXT_FIELDS} from './normalize.mjs';

const rank={zhCN:0,zhTW:1,enUS:2};
// Comparison only; never rewrite stored text or game variables.
const comparable=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function textCoverage(records){
 const fields={};for(const r of records)for(const [field,locale]of Object.entries(r.textLocales)){fields[field]??={zhCN:0,zhTW:0,enUS:0,missing:0};fields[field][locale||'missing']++;}return fields;
}
export function filterSupplementBuilds(tables,maxVerifiedBuild){
 if(maxVerifiedBuild===undefined)return {tables,excludedBuildRows:{}};
 if(!Number.isSafeInteger(maxVerifiedBuild)||maxVerifiedBuild<=0)throw new Error('Invalid supplement build limit');
 const filtered=new Map(),excludedBuildRows={};
 for(const [name,rows]of tables){
  const kept=rows.filter(row=>{const build=Number(row.verifiedbuild??row.wdbverified??0);return Number.isSafeInteger(build)&&Math.abs(build)<=maxVerifiedBuild;});
  filtered.set(name,kept);if(kept.length!==rows.length)excludedBuildRows[name]=rows.length-kept.length;
 }
 return {tables:filtered,excludedBuildRows};
}
function matchField(primary,candidate,field){
 if(field==='title')return 'english-title';
 const a=comparable(primary.english[field]),b=comparable(candidate.english[field]);
 if(a)return a===b?'english-title-and-field':null;
 // For an absent field, require matching nonempty context as well as the title.
 for(const context of ['description','objectives'])if(comparable(primary.english[context])&&comparable(primary.english[context])===comparable(candidate.english[context]))return 'english-title-and-'+context;
 return null;
}

/** Text-only supplementation. The primary snapshot owns quest identity and gameplay fields. */
export function supplementQuests(primary,sources,version){
 const report={version,policy:'same-version-english-anchor-v1',before:textCoverage(primary),sources:[],changes:[]};
 const sourceIds=new Set();
 const indexed=sources.map(source=>{
  if(source.version!==version)throw new Error('Supplement version mismatch: '+source.id);
  if(!source.id||source.id===version||sourceIds.has(source.id))throw new Error('Invalid supplement ID');
  sourceIds.add(source.id);
  if(source.allowedLocales&&(!source.allowedLocales.length||source.allowedLocales.some(l=>!Object.hasOwn(rank,l))))throw new Error('Invalid supplement locales');
  const byKey=new Map();for(const r of source.records){if(r.version!==version||r.key!==`${version}:${r.id}`||byKey.has(r.key))throw new Error('Invalid supplement quest: '+r.key);byKey.set(r.key,r);}
  const stats={id:source.id,records:byKey.size,matchedQuests:0,unmatchedTitles:0,customQuestsSkipped:0,rejectedFields:0,selectedFields:0};report.sources.push(stats);
  if(source.excludedBuildRows&&Object.keys(source.excludedBuildRows).length)stats.excludedBuildRows=source.excludedBuildRows;
  return {source,byKey,stats};
 });
 const records=primary.map(original=>{
  if(original.version!==version)throw new Error('Primary version mismatch');
  const r={...original,text:{...original.text},textLocales:{...original.textLocales},textColumns:{...original.textColumns},textBuilds:{...original.textBuilds},english:{...original.english},tags:[...original.tags],
   textSources:Object.fromEntries(Object.entries(original.text).map(([key,value])=>[key,value?version:null])),
   englishSources:Object.fromEntries(Object.entries(original.english).map(([key,value])=>[key,value?version:null])),textMatches:{}};
  const changes=new Map();
  for(const {source,byKey,stats}of indexed){
   const candidate=byKey.get(r.key);if(!candidate)continue;
   if(original.tags.includes('community-custom')||candidate.tags.includes('community-custom')){stats.customQuestsSkipped++;continue;}
   if(!comparable(original.english.title)||comparable(original.english.title)!==comparable(candidate.english.title)){stats.unmatchedTitles++;continue;}
   stats.matchedQuests++;
   for(const field of Object.keys(TEXT_FIELDS)){
    if(source.allowedLocales&&!source.allowedLocales.includes(candidate.textLocales[field]))continue;
    if(!candidate.text[field]||(rank[candidate.textLocales[field]]??3)>=(rank[r.textLocales[field]]??3))continue;
    const match=matchField(original,candidate,field);if(!match){stats.rejectedFields++;continue;}
    const change={id:r.id,field,source:source.id,fromLocale:original.textLocales[field],toLocale:candidate.textLocales[field],match};
    for(const property of ['text','textLocales','textColumns','textBuilds'])r[property][field]=candidate[property][field];
    r.textSources[field]=source.id;r.textMatches[field]=match;
    if(!original.english[field]&&candidate.english[field]){r.english[field]=candidate.english[field];r.englishSources[field]=source.id;}
    changes.set(field,change);
   }
  }
  for(const change of changes.values()){report.changes.push(change);indexed.find(s=>s.source.id===change.source).stats.selectedFields++;}
  r.tags=r.tags.filter(tag=>!(tag==='missing-title'&&r.text.title.trim())&&!(tag==='missing-description'&&r.text.description.trim()));
  r.locales=[...new Set(Object.values(r.textLocales).filter(Boolean))];
  return r;
 });
 report.after=textCoverage(records);
 report.changedQuests=new Set(report.changes.map(c=>c.id)).size;
 report.changedFields=report.changes.length;
 return {records,report};
}
