const fs=require('fs'),path=require('path'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'),{slice}=require('./proof-treaty.cjs');
const root=path.resolve(__dirname,'..'),spec=require('../records/nine-slice.json'),audit=require('../qa/pixel-audit.json');
async function main(){const results=[];for(const [id,m] of Object.entries(spec.margins)){const row=audit.find(r=>r.id===id),file=path.join(root,row.file),src=await sharp(file).ensureAlpha().raw().toBuffer();for(const [w,h] of [[row.width,row.height],[row.width+240,row.height+80]]){const resized=await slice(file,w,h,m),dst=await sharp(resized).ensureAlpha().raw().toBuffer(),[l,t,r,b]=m;let maxDelta=0,diff=0;
const corners=[[0,0,0,0,l,t],[row.width-r,0,w-r,0,r,t],[0,row.height-b,0,h-b,l,b],[row.width-r,row.height-b,w-r,h-b,r,b]];
for(const[sx,sy,dx,dy,cw,ch]of corners)for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)for(let c=0;c<4;c++){const d=Math.abs(src[((sy+y)*row.width+sx+x)*4+c]-dst[((dy+y)*w+dx+x)*4+c]);maxDelta=Math.max(maxDelta,d);if(d)diff++;}
results.push({id,width:w,height:h,corner_max_channel_delta:maxDelta,corner_different_channels:diff,pass:maxDelta<=1});}}
fs.writeFileSync(path.join(root,'qa/nine-slice-check.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,pass:results.filter(r=>r.pass).length,maxDelta:Math.max(...results.map(r=>r.corner_max_channel_delta))}));}
main().catch(e=>{console.error(e);process.exit(1)});
