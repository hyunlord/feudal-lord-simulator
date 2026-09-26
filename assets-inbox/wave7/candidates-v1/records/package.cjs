const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),groups=['loads','effects','props','piles','overlays','world'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const entries=groups.flatMap(g=>JSON.parse(fs.readFileSync(path.join(__dirname,g+'.json'))));
 if(entries.length!==77)throw Error('Expected77, got'+entries.length);
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'expected-assets.json')));const ids=new Set(),checks=[],rows=[];
 for(const a of entries){if(ids.has(a.id))throw Error('duplicate'+a.id);ids.add(a.id);const p=path.join(root,a.file),meta=await sharp(p).metadata();const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});let zero=0,visible=0,semi=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)zero++;else visible++;if(data[i]>0&&data[i]<255)semi++;}const e=expected.find(v=>path.basename(v.id)+'.png'===path.basename(a.file));if(!e||meta.width!==e.width||meta.height!==e.height)throw Error('brief dimensions '+a.id);if(meta.width!==a.width||meta.height!==a.height||!meta.hasAlpha||!zero||!visible)throw Error('PNG contract '+a.id);if(!a.generationRecords?.length)throw Error('provenance '+a.id);
 checks.push({id:a.id,width:info.width,height:info.height,hasAlpha:meta.hasAlpha,transparentPixels:zero,visiblePixels:visible,semiTransparentPixels:semi,sha256:sha(p)});
 rows.push({asset_id:a.id,status:'candidate',file:a.file,width:a.width,height:a.height,role:a.role,sha256:sha(p),generation_records:JSON.stringify(a.generationRecords),processing:JSON.stringify(a.processing??{}),pivot_or_attachment:JSON.stringify({pivot:a.pivot??null,attachmentPoint:a.attachmentPoint??null,frameSize:a.frameSize??null}),accepted:'',qa:JSON.stringify(a.qa??{})});}
 fs.writeFileSync(path.join(__dirname,'asset-rows.json'),JSON.stringify(rows,null,2));fs.writeFileSync(path.join(__dirname,'technical-validation.json'),JSON.stringify({count:entries.length,pass:true,checks},null,2));
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 let html='<!doctype html><meta charset="utf-8"><title>Wave7 candidates</title><style>body{background:#e4d8bc;color:#302c25;font:16px sans-serif;margin:24px}section{display:flex;flex-wrap:wrap;gap:12px}figure{width:260px;background:#aaa895;padding:14px;margin:0}img{max-width:250px;max-height:180px;object-fit:contain}small{display:block}a{color:#29251d}</style><h1>Wave7 후보77</h1><p>게임 미설치 · <a href="README.md">설명</a> · <a href="QA.md">검수표</a> · <a href="assets.csv">CSV</a></p><section>';
 for(const a of rows)html+=`<figure><a href="${esc(a.file)}"><img src="${esc(a.file)}"><small>${esc(a.asset_id)}</small></a><small>${a.width}×${a.height}</small></figure>`;
 fs.writeFileSync(path.join(root,'index.html'),html+'</section>');console.log('77 assets checked; gallery and CSV source ready');
})();
