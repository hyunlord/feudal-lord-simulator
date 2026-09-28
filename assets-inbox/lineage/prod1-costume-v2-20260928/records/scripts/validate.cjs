const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const entries=JSON.parse(fs.readFileSync(path.join(base,'records/assets.json'),'utf8'));
 const originals=JSON.parse(fs.readFileSync(path.join(base,'records/original-shas.json'),'utf8'));
 for(const[p,h]of Object.entries(originals))if(hash(p)!==h)throw Error('Original changed '+p);
 if(entries.length!==41||new Set(entries.map(x=>x.id)).size!==41)throw Error('Count');
 const checked=[];
 for(const e of entries){const p=path.join(base,e.file),m=await sharp(p).metadata();if(m.width!==256||m.height!==256||m.channels!==4)throw Error('Dimensions '+e.id);if(hash(e.source)!==e.sourceSHA256)throw Error('Source hash '+e.id);if(!fs.existsSync(e.rawFile))throw Error('Missingraw '+e.id);if(!e.prompt||!e.referenceImages.length)throw Error('Provenance '+e.id);for(const ref of e.referenceImages)if(!fs.existsSync(ref))throw Error('Missingref '+ref);checked.push({id:e.id,sha256:hash(p),width:m.width,height:m.height,channels:m.channels});}
 const out={status:'PASS',newPortraits:41,L4:38,L5Mother:3,unchangedOriginals:Object.keys(originals).length,allSourcesAndRawExist:true,checked};
 fs.writeFileSync(path.join(base,'records/integrity.json'),JSON.stringify(out,null,2));
 const links=entries.map(e=>`- [${e.id}](${e.file})`).join('\n');fs.writeFileSync(path.join(base,'IMAGE_LINKS.md'),'# 개별 초상\n\n'+links+'\n');
 const cards=entries.map(e=>`<figure><a href="${e.file}"><img src="${e.file}" width="256" height="256" alt="${e.id}"></a><figcaption>${e.id}</figcaption></figure>`).join('');
 fs.writeFileSync(path.join(base,'index.html'),`<!doctype html><meta charset="utf-8"><title>혈통 복식 교정 41장</title><style>body{background:#e8e5dd;color:#29261f;font:16px sans-serif;margin:24px}.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}img{display:block}figcaption{padding:8px 0}</style><h1>혈통 복식 교정 후보 41장</h1><p>L4 38장 · L5_102 세 연령 3장. 게임 미설치.</p><div class="grid">${cards}</div>`);
 console.log(JSON.stringify({status:out.status,newPortraits:41,unchangedOriginals:160}));
})();
