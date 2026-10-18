import fs from 'node:fs/promises';
import '../web/reading-data.js';
import '../web/reading.js';
const root=new URL('../',import.meta.url),report={schemaVersion:1,note:'Counts are token occurrences in selected quest text fields, excluding ordinary N/C/R/G/B tokens. Class-dependent values use no user profile here.',versions:{}};
for(const version of ['classic','wotlk','cataclysm','pandaria','legion']){
 const stats={resolved:0,unresolved:0,tokens:{},unresolvedExamples:[]};
 for(const file of await fs.readdir(new URL('data/'+version+'/',root))){
  if(!file.endsWith('.jsonl'))continue;
  for(const line of (await fs.readFile(new URL('data/'+version+'/'+file,root),'utf8')).trim().split('\n')){
   const quest=JSON.parse(line);
   for(const [field,value]of Object.entries(quest.text))for(const n of globalThis.QuestReading.notes(value,{}, {quest})){
    const count=n.occurrences,status=n.resolved?'resolved':'unresolved';
    stats[status]+=count;
    const token=stats.tokens[n.token]??={resolved:0,unresolved:0};token[status]+=count;
    if(!n.resolved)stats.unresolvedExamples.push({key:quest.key,field,token:n.token});
   }
  }
 }
 report.versions[version]=stats;console.log(version,stats.resolved,'resolved,',stats.unresolved,'need context or review');
}
await fs.writeFile(new URL('reports/reading-audit.json',root),JSON.stringify(report,null,2)+'\n');
