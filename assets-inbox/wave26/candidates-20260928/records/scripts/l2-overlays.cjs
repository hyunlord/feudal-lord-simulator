const fs=require('node:fs');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-wave26-v1';
const regs=JSON.parse(fs.readFileSync(root+'/native/l2/registration.json'));
async function raw(p){return sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
(async()=>{let stats=[];
for(const reg of regs){const id=reg.id,baseNative=await raw(root+'/native/l2/'+id+'-base.png'),base=await raw(root+'/assets/house_l2_'+id+'-v1.png');
for(const state of ['weathered','fresh','snow','boarded']){
const p=root+'/native/l2/'+id+'-'+state+'.png';if(!fs.existsSync(p))continue;let source=await raw(p);
if(source.info.width!==baseNative.info.width||source.info.height!==baseNative.info.height){source={data:await sharp(p).resize(baseNative.info.width,baseNative.info.height).ensureAlpha().raw().toBuffer(),info:baseNative.info};}
for(let i=0;i<source.data.length;i+=4){let r=source.data[i],g=source.data[i+1],b=source.data[i+2],lum=(r+g+b)/3,baseLum=(baseNative.data[i]+baseNative.data[i+1]+baseNative.data[i+2])/3;let diff=Math.max(Math.abs(r-baseNative.data[i]),Math.abs(g-baseNative.data[i+1]),Math.abs(b-baseNative.data[i+2]));
if((r>230&&g<70)||(r>225&&g>210&&b<40)||(Math.max(r,g,b)>220&&Math.min(r,g,b)<45&&Math.max(r,g,b)-Math.min(r,g,b)>180))source.data[i+3]=0;
if(state==='snow'&&!(lum>145&&b>r*.87&&g>r*.87))source.data[i+3]=0;
if(state==='fresh'&&!(lum>baseLum+9&&diff>20))source.data[i+3]=0;
if(state==='weathered'&&!(diff>22&&(lum<baseLum-7||(g>r*.9&&g>b*1.15))))source.data[i+3]=0;
}
let scaled=await sharp(source.data,{raw:{width:source.info.width,height:source.info.height,channels:4}}).extract(reg.crop).resize(reg.target.width,reg.target.height).ensureAlpha().raw().toBuffer();
let out=Buffer.alloc(137*137*4);for(let y=0;y<reg.target.height;y++)for(let x=0;x<reg.target.width;x++){let a=(y*reg.target.width+x)*4,b=((y+reg.target.top)*137+x+reg.target.left)*4;scaled.copy(out,b,a,a+4);}
for(let i=0;i<out.length;i+=4){if(base.data[i+3]===0)out[i+3]=0;else out[i+3]=Math.min(out[i+3],base.data[i+3]);if(out[i+3]<12)out[i+3]=0;}
for(const c of reg.groundContactMask)for(let y=c.yStart;y<137;y++)out[(y*137+c.x)*4+3]=0;
let nonzero=0,baseCount=0,outside=0,contact=0;for(let i=0;i<out.length;i+=4){if(out[i+3]){nonzero++;if(!base.data[i+3])outside++;}if(base.data[i+3])baseCount++;}
for(const c of reg.groundContactMask)for(let y=c.yStart;y<137;y++)if(out[(y*137+c.x)*4+3])contact++;
const name='house_l2_'+id+'_'+state+'-v1.png';await sharp(out,{raw:{width:137,height:137,channels:4}}).png().toFile(root+'/assets/'+name);
await sharp(root+'/assets/house_l2_'+id+'-v1.png').composite([{input:root+'/assets/'+name}]).png().toFile(root+'/native/l2/'+id+'-'+state+'-composite.png');
stats.push({id,state,filename:name,nonzero,baseCount,coverageFraction:nonzero/baseCount,exteriorAlphaNonzero:outside,contactAlphaNonzero:contact});
}}
fs.writeFileSync(root+'/native/l2/overlay-qa.json',JSON.stringify(stats,null,2));})();
