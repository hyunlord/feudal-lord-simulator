const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root='/tmp/QA_ROUND_01';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);}
(async()=>{
 const all=files(root);const visuals=all.filter(p=>/\.(jpg|gif)$/i.test(p));
 const broken=[];for(const p of all.filter(p=>p.endsWith('.md'))){const s=fs.readFileSync(p,'utf8');for(const m of s.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(m[1]))continue;const target=path.resolve(path.dirname(p),m[1]);if(!fs.existsSync(target))broken.push({file:path.relative(root,p),target:m[1]});}}
 const gifs=[];for(const p of visuals.filter(p=>p.endsWith('.gif'))){const m=await sharp(p,{animated:true}).metadata();gifs.push({file:path.relative(root,p),frames:m.pages,width:m.width,height:m.pageHeight,delay:m.delay});}
 const imagesBytes=visuals.reduce((n,p)=>n+fs.statSync(p).size,0);
 const result={imagesBytes,limitBytes:30000000,visualCount:visuals.length,gifCount:gifs.length,gifs,brokenLinks:broken,pass:imagesBytes<=30000000&&broken.length===0&&gifs.every(x=>x.frames===20)};
 fs.writeFileSync(root+'/repro/package-audit.json',JSON.stringify(result,null,2));
 const finalFiles=files(root).filter(p=>!p.endsWith('/SHA256SUMS'));
 fs.writeFileSync(root+'/SHA256SUMS',finalFiles.sort().map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')+'  '+path.relative(root,p)).join('\n')+'\n');
 console.log(JSON.stringify({imagesBytes,visualCount:visuals.length,gifCount:gifs.length,brokenLinks:broken,pass:result.pass},null,2));if(!result.pass)process.exitCode=1;
})();
