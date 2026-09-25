const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const path=require('path');
const root=path.resolve(__dirname,'..');
const defs=require('./frames-definitions.json');
const caps=Object.fromEntries(defs.map(d=>[d[0],d[5]]));
async function nine(input,w,h,c,scale=.5){
 const m=await sharp(input).metadata(),sw=m.width,sh=m.height;
 const s=[0,c,sw-c,sw],v=[0,c,sh-c,sh],d=Math.round(c*scale),xx=[0,d,w-d,w],yy=[0,d,h-d,h],comp=[];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  const dw=xx[x+1]-xx[x],dh=yy[y+1]-yy[y];
  if(dw<=0||dh<=0)throw new Error('Target too small for fixed caps');
  comp.push({input:await sharp(input).extract({left:s[x],top:v[y],width:s[x+1]-s[x],height:v[y+1]-v[y]}).resize(dw,dh,{fit:'fill'}).png().toBuffer(),left:xx[x],top:yy[y]});
 }
 return sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite(comp).png().toBuffer();
}
async function renderFrame(id,w,h,scale=.5){
 const file=path.join(root,'assets/ui',id.replace(/^ui\//,'')+'.png');
 const cap=caps[id.replace(/^ui\//,'')];
 return cap?nine(file,w,h,cap,scale):sharp(file).resize(w,h,{fit:'fill'}).png().toBuffer();
}
module.exports={renderFrame,nine,caps};
