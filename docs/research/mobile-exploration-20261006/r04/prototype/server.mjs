import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env['PORT']??4179);
if(!Number.isInteger(port)||port<1024||port>65535)throw new RangeError('PORT must be 1024..65535');
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json']]);
createServer(async(request,response)=>{
 try{
  const url=new URL(request.url??'/', 'http://localhost');
  const path=resolve(root,`.${decodeURIComponent(url.pathname).replace(/\/$/,'/index.html')}`);
  if(!path.startsWith(root+sep)){response.writeHead(403).end('Forbidden');return;}
  const data=await readFile(path);response.setHeader('Content-Type',mime.get(extname(path))??'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(data);
 }catch(error){
  if(error instanceof URIError){response.writeHead(400).end('Invalid path');return;}
  if(error instanceof Error&&'code'in error&&error.code==='ENOENT'){response.writeHead(404).end('Not found');return;}
  response.writeHead(500).end('Read failed');console.error(error);
 }
}).listen(port,'127.0.0.1',()=>console.log(`저마다의 영지 http://127.0.0.1:${port}`));
