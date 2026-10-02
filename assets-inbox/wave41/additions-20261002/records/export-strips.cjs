const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const root = path.resolve(__dirname, '..');
const records = JSON.parse(fs.readFileSync(path.join(__dirname, 'strip-generations.json')));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async () => {
const metrics = [];
for (const item of records.assets) {
 const rawcopy = path.join(root, 'raw', item.id+'.png'); fs.copyFileSync(item.raw_source,rawcopy);
 const {data,info} = await sharp(rawcopy).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let top=info.height,bottom=0;
 for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>20){top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const resized=await sharp(rawcopy).extract({left:0,top,width:info.width,height:bottom-top+1}).resize(512,48,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const out=Buffer.alloc(512*64*4);
 for(let y=0;y<48;y++) for(let x=0;x<512;x++){
   const s=(y*512+x)*4,d=((y+8)*512+x)*4;
   for(let c=0;c<3;c++)out[d+c]=resized[s+c];
   const fade=Math.min(1,(y+1)/8,(48-y)/8);
   out[d+3]=Math.round(resized[s+3]*fade);
 }
 // Blend only X seam neighborhoods to a shared endpoint; retain generated interiors.
 for(let y=0;y<64;y++) for(let c=0;c<4;c++){
   const mean=(out[(y*512)*4+c]+out[(y*512+511)*4+c])/2;
   for(let k=0;k<24;k++){
     const w=(1-k/24)**2;
     for(const x of [k,511-k]){const i=(y*512+x)*4+c;out[i]=Math.round(out[i]*(1-w)+mean*w);}
   }
 }
 const dest=path.join(root,'assets/boundary',item.id+'.png');
 await sharp(out,{raw:{width:512,height:64,channels:4}}).png({compressionLevel:9}).toFile(dest);
 item.raw_copy='raw/'+item.id+'.png';item.raw_sha256=sha(rawcopy);item.references=item.references.map(file=>({path:file,sha256:sha(file)}));
 metrics.push({id:item.id,path:'assets/boundary/'+item.id+'.png',width:512,height:64,pivot:[256,32],repeat:'X only',pitch:512,logicalTiles:4,orientation:'top grass; bottom woodland',crop:[0,top,info.width,bottom-top+1],postprocess:'One resize to512x48; centered Y8px transparent, inward8px fade; X24px shared-endpoint blend',sha256:sha(dest),endpointRGBAMax:Math.max(...Array.from({length:64*4},(_,i)=>Math.abs(out[Math.floor(i/4)*512*4+i%4]-out[(Math.floor(i/4)*512+511)*4+i%4]))),Y8pxAlphaMax:0});
 const season=item.id.includes('winter')?'winter':'summer';
 const krill='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill';
 const grass=season==='summer'?krill+'/public/assets/terrain/grass.png':krill+'/public/assets/wave15/terrain/grass_winter_fill-v1.png';
 const forest=krill+'/assets-inbox/wave22/rework-20260927/assets/terrain/woodland_floor_'+season+'_a-v2.png';
 // Proof uses original project fills, tiled without color edits, and 3 native strip repeats.
 const parts=[];
 for(let x=0;x<1536;x+=256){parts.push({input:await sharp(grass).resize(256,128).png().toBuffer(),left:x,top:0});parts.push({input:forest,left:x,top:128});}
 const plain=await sharp({create:{width:1536,height:256,channels:4,background:'#807f60'}}).composite(parts).png().toBuffer();
 const composed=await sharp(plain).composite([0,512,1024].map(left=>({input:dest,left,top:96}))).png().toBuffer();
 await sharp({create:{width:1536,height:512,channels:3,background:'#eee4d0'}}).composite([{input:plain,left:0,top:0},{input:composed,left:0,top:256}]).jpeg({quality:88}).toFile(path.join(root,'proofs','strip-'+season+'-repeat-composite.jpg'));
}
fs.writeFileSync(path.join(__dirname,'strip-generations.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(__dirname,'strip-metrics.json'),JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));
})();
