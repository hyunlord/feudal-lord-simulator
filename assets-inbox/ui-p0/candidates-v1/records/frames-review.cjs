const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const {renderFrame}=require('./frames-render.cjs');
const root=path.resolve(__dirname,'..'),defs=require('./frames-definitions.json');
async function main(){
 const canvas=createCanvas(1440,Math.ceil(defs.length/4)*230),ctx=canvas.getContext('2d');
 ctx.fillStyle='#aaa397';ctx.fillRect(0,0,canvas.width,canvas.height);const tests=[];
 for(let i=0;i<defs.length;i++){
  const [id,w,h,,ref,cap]=defs[i],x=(i%4)*360,y=Math.floor(i/4)*230;
  ctx.fillStyle='#211d18';ctx.font='15px sans-serif';ctx.fillText(id,x+12,y+20);
  const file=path.join(root,'assets/ui',id+'.png');
  const image=await loadImage(file),s=Math.min(320/w,176/h,1);ctx.drawImage(image,x+16,y+32,w*s,h*s);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const center=((Math.floor(h/2)*w)+Math.floor(w/2))*4;
  const test={id,width:info.width,height:info.height,alphaCenter:data[center+3]};
  if(cap){
   const small=await renderFrame(id,200,80),large=await renderFrame(id,600,400),d=Math.round(cap*.5);
   const a=await sharp(small).extract({left:0,top:0,width:d,height:d}).raw().toBuffer(),b=await sharp(large).extract({left:0,top:0,width:d,height:d}).raw().toBuffer();
   test.fixedCornerEqual=a.equals(b);test.allFourCornersEqual=true;for(const [right,bottom] of [[false,false],[true,false],[false,true],[true,true]]){const aa=await sharp(small).extract({left:right?200-d:0,top:bottom?80-d:0,width:d,height:d}).raw().toBuffer();const bb=await sharp(large).extract({left:right?600-d:0,top:bottom?400-d:0,width:d,height:d}).raw().toBuffer();test.allFourCornersEqual&&=aa.equals(bb);}
  }
  if(id.includes('texture')||id.includes('divider')){
   let sx=0,sy=0;
   for(let yy=0;yy<h;yy++)for(let k=0;k<4;k++)sx=Math.max(sx,Math.abs(data[(yy*w)*4+k]-data[(yy*w+w-1)*4+k]));
   for(let xx=0;xx<w;xx++)for(let k=0;k<4;k++)sy=Math.max(sy,Math.abs(data[xx*4+k]-data[((h-1)*w+xx)*4+k]));
   test.seamMaximumRGBA={x:sx,y:sy};
  }
  tests.push(test);
 }
 fs.writeFileSync(path.join(root,'records/frames-review.png'),canvas.toBuffer('image/png'));
 fs.writeFileSync(path.join(root,'records/frames-checks.json'),JSON.stringify(tests,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
