const fs=require('fs'),crypto=require('crypto'),sharp=require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const root='output/astra-wave41-landui-20261002/forest';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
const records=JSON.parse(fs.readFileSync(root+'/records/generations.json'));
const grass=await sharp(root+'/references/grass.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const wood=await sharp(root+'/references/woodland_floor_summer_a.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const mean=o=>[0,1,2].map(c=>{let v=0;for(let i=c;i<o.data.length;i+=3)v+=o.data[i];return v/(o.data.length/3)});
const target=[mean(grass),mean(wood)];
let rows=[];
for(const r of records){
 fs.copyFileSync(r.raw_source_path,root+'/raw/'+r.id+'.png');r.raw_copy='raw/'+r.id+'.png';r.references=r.references.map(ref=>{const path=typeof ref==='string'?ref:ref.path;return {path,sha256:hash(path)}});
 const raw=await sharp(r.raw_source_path).ensureAlpha().raw().toBuffer({resolveWithObject:true});let top=raw.info.height,bottom=0;
 for(let y=0;y<raw.info.height;y++){let n=0;for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>240)n++;if(n>raw.info.width*.9){top=Math.min(top,y);bottom=y;}}
 top+=4;bottom-=4;if(r.id==='woodland_edge_a'){top=285;bottom=599;}
 const {data}=await sharp(r.raw_source_path).extract({left:0,top,width:raw.info.width,height:bottom-top+1}).resize(512,64,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const measured=[0,1].map(b=>[0,1,2].map(c=>{let sum=0;for(let y=b?52:0;y<(b?64:12);y++)for(let x=0;x<512;x++)sum+=data[(y*512+x)*4+c];return sum/(512*12)}));
 for(let y=0;y<64;y++)for(let x=0;x<512;x++){const t=y/63,idx=(y*512+x)*4;for(let c=0;c<3;c++)data[idx+c]=Math.max(0,Math.min(255,Math.round(data[idx+c]+(target[0][c]-measured[0][c])*(1-t)+(target[1][c]-measured[1][c])*t)));const edge=Math.min(y,63-y)/13;data[idx+3]=Math.round(255*(edge>=1?1:edge*edge*(3-2*edge)));}
 for(let y=0;y<64;y++)for(let k=0;k<24;k++){const a=(y*512+k)*4,b=(y*512+511-k)*4,w=(1-k/24)**2;for(let c=0;c<4;c++){const avg=(data[a+c]+data[b+c])/2;data[a+c]=Math.round(data[a+c]*(1-w)+avg*w);data[b+c]=Math.round(data[b+c]*(1-w)+avg*w);}}
 for(let i=0;i<data.length;i+=4)if(data[i+3]===0){data[i]=0;data[i+1]=0;data[i+2]=0;}
 const final=root+'/assets/'+r.id+'.png';await sharp(data,{raw:{width:512,height:64,channels:4}}).png().toFile(final);
 const bg=Buffer.alloc(1536*192*3);for(let y=0;y<192;y++)for(let x=0;x<1536;x++){const src=y<96?grass:wood;const si=((y%src.info.height)*src.info.width+(x%src.info.width))*3;for(let c=0;c<3;c++)bg[(y*1536+x)*3+c]=src.data[si+c];}
 const strip=fs.readFileSync(final);const proof=await sharp(bg,{raw:{width:1536,height:192,channels:3}}).composite([0,512,1024].map(left=>({input:strip,left,top:64}))).png().toBuffer();await sharp(proof).png().toFile(root+'/proofs/'+r.id+'-actual-fill-3x.png');rows.push(proof);
 r.postprocessing={crop:{left:0,top,width:raw.info.width,height:bottom-top+1},resize:[512,64],color:'linear vertical RGB offset to actual grass and woodland reference mean; texture retained',alpha:'13px smoothstep feather top/bottom; center opaque',seam:'24px symmetric opposing-edge blend; exact opposing edgeRGBA equality'};
 let max=0;for(let y=0;y<64;y++)for(let c=0;c<4;c++)max=Math.max(max,Math.abs(data[y*512*4+c]-data[(y*512+511)*4+c]));
 r.final={path:'assets/'+r.id+'.png',sha256:hash(final),width:512,height:64,channels:4,pivot:[0,0],repeat:'X',orientation:'top meadow / bottom woodland',edge_rgba_max_delta:max,alpha_min:0,alpha_max:255,status:'candidate_pending_visual_review'};
}
await sharp({create:{width:1536,height:420,channels:3,background:'#eee'}}).composite([{input:rows[0],left:0,top:0},{input:rows[1],left:0,top:228}]).png().toFile(root+'/proofs/AB-actual-fills.png');
fs.writeFileSync(root+'/records/generations.json',JSON.stringify(records,null,2));console.log(records.map(x=>x.final));
})();
