const fs=require('fs'),path=require('path'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');const {renderFrame}=require('./frames-render.cjs');const root=path.resolve(__dirname,'..');
const ids=['frame_panel_light','frame_panel_dark','frame_objective','frame_advisor','button_primary_base'];
(async()=>{const composites=[],labels=[];for(let i=0;i<ids.length;i++){let y=70+i*455;
 composites.push({input:await renderFrame(ids[i],200,80),left:30,top:y+35},{input:await renderFrame(ids[i],600,400),left:290,top:y+35});
 labels.push('<text x="30" y="'+(y+20)+'">'+ids[i]+' | 200x80 / 600x400</text>');
}const title='<svg width="920" height="2370"><g font-family="Arial" fill="#332d25" font-size="17"><text x="30" y="30">9-slice proof / native @2x caps rendered at logical 1x</text><text x="30" y="54">Advisor: nine-slice body + fixed 48px circular insert. No corner stretching.</text>'+labels.join('')+'</g></svg>';
composites.unshift({input:Buffer.from(title),left:0,top:0});
await sharp({create:{width:920,height:2370,channels:4,background:'#eee9df'}}).composite(composites).png().toFile(path.join(root,'proofs/03-nine-slice.png'));
let rows=[];
for(const id of ids){const b=await renderFrame(id,200,80),a=await renderFrame(id,600,400);const cap=id==='button_primary_base'?6:(id==='frame_panel_dark'?12:16);
 let result=[];for(let corner=0;corner<4;corner++){const left=corner%2===1,bot=corner>1;let p=await sharp(b).extract({left:left?200-cap:0,top:bot?80-cap:0,width:cap,height:cap}).raw().toBuffer(),q=await sharp(a).extract({left:left?600-cap:0,top:bot?400-cap:0,width:cap,height:cap}).raw().toBuffer();result.push(p.equals(q));}
 rows.push({id,capsLogical:cap,cornerPixelEquality:result});
}
const {data,info}=await sharp(path.join(root,'assets/ui/texture_vellum_light.png')).raw().toBuffer({resolveWithObject:true});let seamX=0,seamY=0,sum=0,sq=0;
for(let y=0;y<256;y++)for(let x=0;x<256;x++){let v=data[(y*256+x)*info.channels];sum+=v;sq+=v*v;}
for(let k=0;k<info.channels;k++)for(let i=0;i<256;i++){seamX=Math.max(seamX,Math.abs(data[(i*256)*info.channels+k]-data[(i*256+255)*info.channels+k]));seamY=Math.max(seamY,Math.abs(data[i*info.channels+k]-data[(255*256+i)*info.channels+k]));}
fs.writeFileSync(path.join(root,'records/frames-validation.json'),JSON.stringify({frames:rows,vellum:{seamX,seamY,redStandardDeviation:Math.sqrt(sq/65536-(sum/65536)**2)},advisor:{circleNative96:true,circleLogical48:true,method:'fixed overlay, no anisotropic scale'},center:'exact flat palette after generated-edge extraction',runtimeIntegration:false},null,2));
})();
