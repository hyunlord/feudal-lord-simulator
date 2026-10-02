'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let sharp;try{sharp=require('sharp');}catch{sharp=require(process.env.MAPKIT_SHARP||'/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');}
sharp.cache(false);sharp.concurrency(1);
function discover(root){const all=[];function walk(p){for(const f of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const full=path.join(p,f.name);if(f.isDirectory())walk(full);else if(/\.png$/i.test(f.name))all.push(full);}}walk(root);return all;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalized=s=>s.toLowerCase().replace(/[-_]/g,'');
function library(root){const all=discover(root);return{root,all,find(...prefixes){for(const p of prefixes){const matches=all.filter(f=>path.basename(f,'.png')===p);if(matches.length)return matches[0];}for(const p of prefixes){const matches=all.filter(f=>normalized(path.basename(f,'.png')).startsWith(normalized(p)));if(matches.length)return matches[0];}throw Error(`Missing required kit PNG: ${prefixes.join(' / ')}`);},many(prefix){return all.filter(f=>normalized(path.basename(f,'.png')).startsWith(normalized(prefix)));}};}
module.exports={sharp,library,hash};
