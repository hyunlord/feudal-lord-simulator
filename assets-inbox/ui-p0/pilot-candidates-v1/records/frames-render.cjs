const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const path=require('path');const root=path.resolve(__dirname,'..');
const caps={frame_panel_light:32,frame_panel_dark:24,frame_objective:32,frame_advisor:32,button_primary_base:12,button_icon_square_base:12};
async function nine(input,w,h,c,scale=.5){
 const m=await sharp(input).metadata(),sw=m.width,sh=m.height;
 const s=[0,c,sw-c,sw],v=[0,c,sh-c,sh],d=Math.round(c*scale),xx=[0,d,w-d,w],yy=[0,d,h-d,h],comp=[];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)comp.push({input:await sharp(input).extract({left:s[x],top:v[y],width:s[x+1]-s[x],height:v[y+1]-v[y]}).resize(xx[x+1]-xx[x],yy[y+1]-yy[y],{fit:'fill'}).png().toBuffer(),left:xx[x],top:yy[y]});
 return sharp({create:{width:w,height:h,channels:4,background:'#e1d1ae'}}).composite(comp).png().toBuffer();
}
async function renderFrame(id,w,h,scale=.5){
 const file=path.join(root,'assets/ui',id+'.png');
 if(id!=='frame_advisor')return nine(file,w,h,caps[id]||12,scale);
 const m=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});const p=m.data;
 // Ring is separate fixed-size insert: a single nine-slice grid would distort it.
 const ring=await sharp(file).extract({left:16,top:48,width:96,height:96}).resize(Math.round(96*scale),Math.round(96*scale)).png().toBuffer();
 for(let y=40;y<152;y++)for(let x=8;x<120;x++){let i=(y*256+x)*4;p[i]=225;p[i+1]=209;p[i+2]=174;p[i+3]=255;}
 const body=await sharp(p,{raw:m.info}).png().toBuffer(),res=await nine(body,w,h,32,scale);
 return sharp(res).composite([{input:ring,left:Math.round(16*scale),top:Math.round((h-96*scale)/2)}]).png().toBuffer();
}
module.exports={renderFrame,nine,caps};
