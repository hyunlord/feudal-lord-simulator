import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const L='/tmp/astra-wave29-work/lanes/currents';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const mod=(v,n)=>((v%n)+n)%n;
function sample(p,w,h,x,y){x=mod(x,w);y=mod(y,h);const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;const out=[0,0,0,0];for(let j=0;j<2;j++)for(let i=0;i<2;i++){const q=(mod(y0+j,h)*w+mod(x0+i,w))*4;const f=(i?fx:1-fx)*(j?fy:1-fy);for(let c=0;c<4;c++)out[c]+=p[q+c]*f;}return out;}
async function base(kind){
 const source=L+'/masters/'+kind+'.png'; const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<raw.data.length;i+=4){const r=raw.data[i],g=raw.data[i+1],b=raw.data[i+2],a=raw.data[i+3];if(a<80||Math.max(r,g,b)-Math.min(r,g,b)>65){raw.data.fill(0,i,i+4);} }
 const size=kind==='current'?430:600;
 const p=await sharp(raw.data,{raw:raw.info}).extract({left:300,top:300,width:size,height:size}).resize(32,32,{fit:'fill'}).raw().toBuffer();
 // Periodicize generated raster by broad opposing-edge crossfades; preserve painted detail.
 for(let y=0;y<32;y++)for(let d=0;d<5;d++)for(let c=0;c<4;c++){const i=(y*32+d)*4+c,j=(y*32+31-d)*4+c,a=(p[i]+p[j])/2,f=(5-d)/5;p[i]=Math.round(p[i]*(1-f)+a*f);p[j]=Math.round(p[j]*(1-f)+a*f);}
 for(let x=0;x<32;x++)for(let d=0;d<5;d++)for(let c=0;c<4;c++){const i=(d*32+x)*4+c,j=((31-d)*32+x)*4+c,a=(p[i]+p[j])/2,f=(5-d)/5;p[i]=Math.round(p[i]*(1-f)+a*f);p[j]=Math.round(p[j]*(1-f)+a*f);}
 for(let i=0;i<p.length;i+=4){const alpha=p[i+3]/255; // Premultiply for correct periodic interpolation.
 p[i+3]=Math.round(p[i+3]*(kind==='current'?.5:.72));if(p[i+3]<3){p.fill(0,i,i+4);continue;}for(let c=0;c<3;c++)p[i+c]=Math.round(Math.min(255,p[i+c]+(kind==='current'?42:0))*p[i+3]/255);
 }
 return {p,source,sha:sha(await fs.readFile(source))};
}
const current=await base('current'),mill=await base('mill');
const specs=[['current_arrows_ne_sheet',1,-1,false],['current_arrows_nw_sheet',-1,-1,false],['current_arrows_se_sheet',1,1,false],['current_arrows_sw_sheet',-1,1,false],['mill_race_sheet',1,-1,true]];
const index=[],qa=[];
for(const [id,dx,dy,isMill] of specs){const b=isMill?mill:current;const periodX=isMill?63.5:31.75,periodY=isMill?31.5:15.75; const frames=[];
 for(let k=0;k<7;k++){const t=(k%6)/6,out=Buffer.alloc(128*64*4);for(let y=0;y<64;y++)for(let x=0;x<128;x++){
  // Generated base runs NE; mirrors retain painted streak direction for each iso axis.
  const u=(x/periodX-dx*t)*32,v=(y/periodY-dy*t)*32;const q=sample(b.p,32,32,dx<0?-u:u,dy>0?-v:v);const a=Math.round(q[3]),o=(y*128+x)*4;
  if(a>0){for(let c=0;c<3;c++)out[o+c]=Math.max(0,Math.min(255,Math.round(q[c]*255/q[3])));out[o+3]=a;}
 }
 // Exact opposite-edge RGBA identity independent of floating precision.
 for(let y=0;y<64;y++)out.copy(out,(y*128+127)*4,(y*128)*4,(y*128+1)*4);
 out.copy(out,63*128*4,0,128*4);
 frames.push(out);if(k<6)await sharp(out,{raw:{width:128,height:64,channels:4}}).png().toFile(L+'/frames/'+id+'_'+k+'.png');
 }
 const sheet=L+'/assets/'+id+'-v1.png';await sharp({create:{width:768,height:64,channels:4,background:'#00000000'}}).composite(await Promise.all(frames.slice(0,6).map(async(p,k)=>({input:await sharp(p,{raw:{width:128,height:64,channels:4}}).png().toBuffer(),left:k*128,top:0})))).png().toFile(sheet);
 const diff=(a,b)=>{let sum=0;for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)sum+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);sum+=Math.abs(a[i+3]-b[i+3]);}return sum/a.length;};
 const steps=frames.slice(0,6).map((f,i)=>diff(f,frames[(i+1)%6]));const loopClosure=Buffer.compare(frames[0],frames[6])===0;
 const prompt=await fs.readFile(L+'/records/'+(isMill?'mill':'current')+'-prompt.txt','utf8');
 const entry={id,file:'assets/'+id+'-v1.png',frame_width:128,frame_height:64,frame_count:6,sheet_width:768,sheet_height:64,layout:'horizontal',fps:isMill?8:6,loop:true,repeat_x:true,repeat_y:true,alpha_baked_max:Math.max(...frames[0].filter((_,i)=>i%4===3)),recommended_alpha:1,blend:'source-over',anchor_x:64,anchor_y:32,preview_frame:0,prompt,generation_source:b.source,source_sha256:b.sha,sha256:sha(await fs.readFile(sheet)),notes:'Painterly water streaks, never graphical arrows. Iso flow is screen-space '+dx+','+dy+'. Apply inside water/channel mask. Direction derived by raster mirroring from one coherent painted source.',processing:{source_crop:{left:300,top:300,size:isMill?600:430},base_size:[32,32],alpha_cleanup:'remove alpha < 80 or RGB saturation range > 65, scale alpha '+(isMill?.72:.5),periodic_edge_blend_px:5,period_screen_px:[periodX,periodY],flow_pixels_per_frame:[dx*periodX/6,dy*periodY/6],mirror_x:dx<0,mirror_y:dy>0,temporal_formula:'t=k/6, translated periodic generated raster, not independent frames; t=1 equals t=0'},status:'candidate'};
 index.push(entry);qa.push({id,steps,last_to_first:steps[5],max_interior:Math.max(...steps.slice(0,5)),boundary_pass:steps[5]<=Math.max(...steps.slice(0,5))*1.15+.05,analytical_closure_equal:loopClosure,actual_flow_per_frame:entry.processing.flow_pixels_per_frame,edges_exact:true});
}
await fs.writeFile(L+'/index.json',JSON.stringify(index,null,2));await fs.writeFile(L+'/records/qa.json',JSON.stringify(qa,null,2));
// Native contact sheet with four-by-four repetitions for visible seam audit.
const panes=[];for(let z=0;z<5;z++){const id=specs[z][0],input=await fs.readFile(L+'/frames/'+id+'_0.png');for(let y=0;y<4;y++)for(let x=0;x<4;x++)panes.push({input,left:x*128,top:z*272+y*64});}
await sharp({create:{width:512,height:1360,channels:4,background:'#557879'}}).composite(panes).png().toFile(L+'/records/tile-inspection.png');
console.log(JSON.stringify(qa,null,2));
