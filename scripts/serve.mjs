import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!target.startsWith(root+path.sep)||/(?:^|[\\/])\.git(?:[\\/]|$)/.test(target)){res.writeHead(403).end();return;}
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jsonl':'application/x-ndjson; charset=utf-8','.md':'text/plain; charset=utf-8'}[path.extname(target)]||'application/octet-stream';
 const stream=fs.createReadStream(target);stream.on('error',()=>res.writeHead(404).end('Not found'));stream.on('open',()=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});stream.pipe(res);});
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
