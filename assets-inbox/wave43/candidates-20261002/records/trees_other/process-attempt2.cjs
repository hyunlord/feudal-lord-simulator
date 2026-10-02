
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const b=__dirname+'/..';
const defs=[['tree_pine_tall',64,120,.5333333333333333],['tree_pine_short',56,88,.7272727272727273]];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function raw(p){return sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true})}
function bbox(o){let x0=o.info.width,y0=o.info.height,x1=0,y1=0;for(let y=0;y<o.info.height;y++)for(let x=0;x<o.info.width;x++)if(o.data[(y*o.info.width+x)*4+3]>16){x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1)}return {left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}}
(async()=>{let manifest=[];for(const [id,w,h,scale]of defs){
const ref=b+'/references/'+id+'.png',rp=b+'/raw/'+id+'_spring-attempt2.png',winter=b+'/references/'+id+'_winter_snow-v1.png',out=b+'/assets/'+id+'_spring.png';
const o=await raw(ref),g=await raw(rp),ob=bbox(o),gb=bbox(g);
const registered=await sharp(rp).extract(gb).resize(ob.width,ob.height,{kernel:'lanczos3'}).ensureAlpha().raw().toBuffer();
let d=Buffer.from(o.data);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 let i=(y*w+x)*4;
 if(!d[i+3]){d[i]=d[i+1]=d[i+2]=0;continue}
 let xx=x-ob.left,yy=y-ob.top;if(xx<0||yy<0||xx>=ob.width||yy>=ob.height)continue;
 let j=(yy*ob.width+xx)*4;if(registered[j+3]<220)continue;
 const foliage=o.data[i+1]>o.data[i]*.93 && o.data[i+1]>o.data[i+2]*1.1;
 let blend=id==='tree_dead'?.32:(foliage?.94:0);
 // Preserve the original silhouette and internal narrow-branch boundaries.
 let edge=false;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){let nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h||o.data[(ny*w+nx)*4+3]<180)edge=true}
 if(edge)blend*=.8;
 for(let c=0;c<3;c++)d[i+c]=Math.round(o.data[i+c]*(1-blend)+registered[j+c]*blend);
}
await sharp(d,{raw:{width:w,height:h,channels:4}}).png().toFile(out);
const f=await raw(out);let ad=0,tr=0;for(let i=0;i<d.length;i+=4){if(f.data[i+3]!==o.data[i+3])ad++;if(!f.data[i+3]&&(f.data[i]||f.data[i+1]||f.data[i+2]))tr++}
const rec=JSON.parse(fs.readFileSync(b+'/records/'+id+'_spring.json'));
Object.assign(rec,{reference:ref,reference_sha256:sha(ref),winter_reference:winter,winter_sha256:sha(winter),raw_copy:rp,raw_sha256:sha(rp),output:out,output_sha256:sha(out),width:w,height:h,pivot:{x:w/2,y:h},worldRenderScale:scale,manifest_source:'/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/src/render/worldAssetManifest.generated.ts',processing:{method:'Sharp alpha-bbox registration, Lanczos3 resample, selective generated RGB material blend into original RGB, exact summer alpha restoration, transparent RGB zero',source_bbox:ob,generated_bbox:gb,blend:id==='tree_dead'?'32% interior / 8% edge':'94% generated needle RGB / original bark RGB; 80% weight at silhouette edge',geometry:'Original bark RGB fixed; crown material from generation; generated alpha discarded'},qa:{alpha_different_pixels:ad,transparent_rgb_nonzero_pixels:tr},exception:id==='tree_dead'?'Dead remains leafless: no buds, leaves, living shoots. Spring conveyed only by damp bark and restrained moss inside original body.':'Evergreen spring has modest candle-shoot coloring inside original crown; no broadleaf transformation.'});
fs.writeFileSync(b+'/records/'+id+'_spring.json',JSON.stringify(rec,null,2)+'\n');
manifest.push({id:id+'_spring',file:'assets/'+id+'_spring.png',width:w,height:h,pivot:{x:w/2,y:h},worldRenderScale:scale,summer_reference:'references/'+id+'.png',winter_reference:'references/'+id+'_winter_snow-v1.png',status:'candidate'});
for(const zoom of [1,.6,4]){
const cw=zoom===4?300:140,ch=zoom===4?540:180;
const inputs=[];for(const [k,p]of [winter,out,ref].entries()){let iw=Math.round(w*zoom),ih=Math.round(h*zoom);inputs.push({input:await sharp(p).resize(iw,ih,{kernel:zoom===4?'nearest':'lanczos3'}).toBuffer(),left:k*cw+Math.round((cw-iw)/2),top:ch-20-ih})}
const title=Buffer.from('<svg width="'+(cw*3)+'" height="'+ch+'"><style>text{font:14px sans-serif;fill:#ddd}</style><text x="10" y="20">WINTER '+zoom+'x</text><text x="'+(cw+10)+'" y="20">SPRING '+zoom+'x</text><text x="'+(cw*2+10)+'" y="20">SUMMER '+zoom+'x</text></svg>');
inputs.push({input:title,left:0,top:0});
await sharp({create:{width:cw*3,height:ch,channels:4,background:'#686b62'}}).composite(inputs).png().toFile(b+'/proofs/'+id+'-'+zoom+'x.png');
}
}
const old=JSON.parse(fs.readFileSync(b+'/manifest.json'));fs.writeFileSync(b+'/manifest.json',JSON.stringify(old.map(x=>manifest.find(m=>m.id===x.id)||x),null,2)+'\n');console.log(JSON.stringify(manifest));})();

