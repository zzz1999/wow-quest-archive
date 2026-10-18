/** Read MySQL dump DATA without executing SQL or requiring a database. */
import {createReadStream} from 'node:fs';

export async function* statements(file) {
  const stream=createReadStream(file,{encoding:'utf8',highWaterMark:1024*1024});
  // Retain line endings inside strings. DELIMITER belongs to the dump client,
  // not its data; routine bodies must remain one ignored CREATE statement.
  async function* lines(){let pending=[];for await(const chunk of stream){let start=0,end;while((end=chunk.indexOf('\n',start))!==-1){pending.push(chunk.slice(start,end+1));yield pending.join('');pending=[];start=end+1;}if(start<chunk.length)pending.push(chunk.slice(start));}if(pending.length)yield pending.join('');}
  let parts=[],quote='',escaped=false,comment='',delimiter=';';
  for await (const data of lines()) {
    const directive=!quote&&!comment&&/^\s*DELIMITER\s+(\S+)\s*$/i.exec(data);
    if(directive){delimiter=directive[1];continue;}
    let start=0;
    for(let i=0;i<data.length;i++) {
      const c=data[i];
      if(comment==='line'){if(c==='\n')comment='';}
      else if(comment==='block'){if(c==='*'&&data[i+1]==='/'){comment='';i++;}}
      else if(quote) {
        if(escaped)escaped=false;
        else if(c==='\\')escaped=true;
        else if(c===quote)quote='';
      } else if(c===delimiter[0]&&data.startsWith(delimiter,i)){const end=i+delimiter.length;parts.push(data.slice(start,i)+';');yield parts.join('');parts=[];start=end;i=end-1;}
      else if(c==="'"||c==='"'||c==='`')quote=c;
      else if(c==='-'&&data[i+1]==='-'&&/\s/.test(data[i+2]))comment='line';
      else if(c==='#')comment='line';
      else if(c==='/'&&data[i+1]==='*'){comment='block';i++;}
    }
    if(start<data.length)parts.push(data.slice(start));
  }
  if(parts.join('').trim())yield parts.join('');
}

export function* tuples(text,start=0,tail=null) {
  let i=start;
  const ws=()=>{while(i<text.length){
    if(/\s/.test(text[i])){i++;continue;}
    if(text[i]==='#'||(text.startsWith('--',i)&&/\s/.test(text[i+2]||''))){const end=text.indexOf('\n',i);i=end<0?text.length:end+1;continue;}
    if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)throw new Error('Unclosed SQL comment');i=end+2;continue;}
    break;
  }};
  while(i<text.length){
    ws();if(text[i]===','||text[i]===';'){i++;continue;}if(i>=text.length)break;
    if(tail&&/^ON\s+DUPLICATE\s+KEY\s+UPDATE\s+/i.test(text.slice(i))){
      const assignments=text.slice(i).replace(/^ON\s+DUPLICATE\s+KEY\s+UPDATE\s+/i,'').replace(/;\s*$/,'').split(',');
      tail.upsert=assignments.map(value=>{
        const match=/^\s*`([^`]+)`\s*=\s*VALUES\s*\(\s*`\1`\s*\)\s*$/i.exec(value);
        if(!match)throw new Error('Unsupported ON DUPLICATE KEY UPDATE assignment');
        return match[1].toLowerCase();
      });
      return;
    }
    if(text[i++]!=='(')throw new Error('Unsupported SQL tuple near '+text.slice(i-1,i+60));
    const row=[];
    for(;;){
      ws();let value;
      if(text[i]==="'"||text[i]==='"'){
        const quote=text[i++];let s='';
        for(;;){
          if(i>=text.length)throw new Error('Unclosed SQL string');
          const c=text[i++];
          if(c==='\\'){
            const e=text[i++];s+=({'0':'\0',n:'\n',r:'\r',t:'\t',b:'\b',Z:'\x1a'}[e]??e);
          }else if(c===quote){if(text[i]===quote){s+=quote;i++;}else break;}
          else s+=c;
        }
        value=s;
      }else{
        const from=i;while(i<text.length&&text[i]!==','&&text[i]!==')')i++;
        const s=text.slice(from,i).trim();
        if(/^NULL$/i.test(s))value=null;
        else if(/^-?\d+(?:\.\d+)?$/.test(s))value=Number.isSafeInteger(Number(s))||s.includes('.')?Number(s):s;
        else if(/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(s)&&Number.isFinite(Number(s)))value=Number.isSafeInteger(Number(s))||!Number.isInteger(Number(s))?Number(s):s;
        else if(/^0x[\da-f]+$/i.test(s))value=s;
        else throw new Error('Unsupported SQL value: '+s.slice(0,100));
      }
      row.push(value);ws();const sep=text[i++];if(sep===')')break;if(sep!==',')throw new Error('Bad tuple separator');
    }
    yield row;
  }
}

export async function readTables(files,wanted,{onTable}={}) {
  const tables=new Map(),schemas=new Map(),updateIndexes=new Map();
  for(const file of files){
    for await(const original of statements(file)){
      const statement=original.replace(/^(?:\s|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[^]*?\*\/)+/,'');
      const create=/^CREATE TABLE(?: IF NOT EXISTS)?\s+`([^`]+)`\s*\(/i.exec(statement);
      if(create&&wanted.has(create[1])){
        const columns=[...statement.slice(create[0].length).matchAll(/^\s*`([^`]+)`\s+/gm)].map(x=>x[1]);
        schemas.set(create[1],columns);if(!tables.has(create[1]))tables.set(create[1],[]);
      }
      const update=/^UPDATE\s+`([^`]+)`\s+SET\s+([^]*)\s+WHERE\s*\(?\s*`?(entry|id)`?\s*=\s*'?(\d+)'?(?:\s+AND\s+`?locale`?\s*=\s*'([A-Za-z0-9]+)')?\s*\)?\s*;?\s*$/i.exec(statement);
      if(update&&wanted.has(update[1])){
        const [,table,set,primary,id,locale]=update;const record={[primary.toLowerCase()]:Number(id),...(locale?{locale}:{})};
        if(locale&&!['enUS','zhCN','zhTW','4','5'].includes(locale))continue;
        let i=0;
        while(i<set.length){
          const column=/^\s*,?\s*`([^`]+)`\s*=\s*/.exec(set.slice(i));if(!column)throw new Error('Unsupported UPDATE assignment in '+file);
          i+=column[0].length;const begin=i;let quote='',escape=false;
          for(;i<set.length;i++){const c=set[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';}else if(c==="'"||c==='"')quote=c;else if(c===',')break;}
          record[column[1].toLowerCase()]=[...tuples('('+set.slice(begin,i).trim()+')')][0][0];
        }
        if(!tables.has(table))tables.set(table,[]);
        const rowKey=r=>`${r.entry??r.id}:${r.locale??''}`;
        if(!updateIndexes.has(table))updateIndexes.set(table,new Map(tables.get(table).map(r=>[rowKey(r),r])));
        const rows=updateIndexes.get(table),key=rowKey(record),existing=rows.get(key);
        if(existing)Object.assign(existing,record);else{tables.get(table).push(record);rows.set(key,record);}
        continue;
      }
      const unknownUpdate=/^UPDATE\s+`([^`]+)`/i.exec(statement);
      if(unknownUpdate&&wanted.has(unknownUpdate[1]))throw new Error('Unsupported UPDATE in '+file);
      const insert=/^(?:INSERT(?:\s+IGNORE)?|REPLACE)\s+INTO\s+`([^`]+)`\s*(\([^]*?\))?\s*VALUES\s*/i.exec(statement);
      if(!insert||!wanted.has(insert[1]))continue;
      const name=insert[1];const cols=insert[2]?[...insert[2].matchAll(/`([^`]+)`/g)].map(x=>x[1]):schemas.get(name);
      if(!cols?.length)throw new Error(`Missing schema for ${name} in ${file}`);
      if(!tables.has(name))tables.set(name,[]);
      updateIndexes.delete(name);
      const tail={},rows=[...tuples(statement,insert.index+insert[0].length,tail)];
      if(tail.upsert?.some(column=>!cols.some(c=>c.toLowerCase()===column)))throw new Error('Unknown upsert column in '+file);
      const rowKey=r=>`${r.entry??r.id}:${r.locale??''}`;
      const existing=tail.upsert?new Map(tables.get(name).map(r=>[rowKey(r),r])):null;
      for(const values of rows){
        if(values.length!==cols.length)throw new Error(`${name}: ${values.length} values, ${cols.length} columns`);
        const record=Object.fromEntries(cols.map((key,i)=>[key.toLowerCase(),values[i]]));
        if(record.locale&&!['enUS','zhCN','zhTW',4,5,'4','5'].includes(record.locale))continue;
        if(existing?.has(rowKey(record))){const prior=existing.get(rowKey(record));for(const column of tail.upsert)prior[column]=record[column];}
        else{tables.get(name).push(record);existing?.set(rowKey(record),record);}
      }
    }
    onTable?.(file,tables);
  }
  return tables;
}
