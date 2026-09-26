const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const metadataPath = path.join(root, 'records/metadata-cards.json');
const insets = {
  decision: {left:50, top:90, right:32, bottom:55},
  event: {left:28, top:64, right:64, bottom:44},
  era: {left:30, top:38, right:30, bottom:30},
  milestone: {left:30, top:30, right:30, bottom:30},
  person: {left:90, top:96, right:28, bottom:32},
  ledger: {left:32, top:30, right:40, bottom:40}
};
async function expand(input, s) {
  const xs=[0,s.left,320-s.right,320], ys=[0,s.top,160-s.bottom,160];
  const dx=[0,s.left,640-s.right,640], dy=[0,s.top,240-s.bottom,240];
  const canvas=Buffer.alloc(640*240*4);
  for(let y=0;y<3;y++) for(let x=0;x<3;x++) {
    const data=await sharp(input).extract({left:xs[x],top:ys[y],width:xs[x+1]-xs[x],height:ys[y+1]-ys[y]}).resize(dx[x+1]-dx[x],dy[y+1]-dy[y],{fit:'fill'}).ensureAlpha().raw().toBuffer();
    const width=dx[x+1]-dx[x], height=dy[y+1]-dy[y];
    for(let row=0;row<height;row++) data.copy(canvas,((dy[y]+row)*640+dx[x])*4,row*width*4,(row+1)*width*4);
  }
  return sharp(canvas,{raw:{width:640,height:240,channels:4}}).png().toBuffer();
}
(async()=>{
  const rows=JSON.parse(fs.readFileSync(metadataPath,'utf8'));
  for(const r of rows){
    const source=path.join(root,r.generationRecords.at(-1).rawFile);
    if(!fs.existsSync(source)) fs.copyFileSync(r.generationRecords.at(-1).sourcePath,source);
    const file=path.join(root,r.file);
    await sharp(source).resize(320,160,{fit:'fill'}).ensureAlpha().png().toFile(file);
    const kind=r.id.replace('frame_record_','');const s=insets[kind];
    const expanded=await expand(file,s);
    fs.writeFileSync(path.join(root,`raw/cards/${r.id}-expanded.png`),expanded);
    const corners=[[0,0,s.left,s.top,0,0],[320-s.right,0,s.right,s.top,640-s.right,0],[0,160-s.bottom,s.left,s.bottom,0,240-s.bottom],[320-s.right,160-s.bottom,s.right,s.bottom,640-s.right,240-s.bottom]];
    let differences=0;
    for(const [left,top,width,height,el,et] of corners){
      const a=await sharp(file).extract({left,top,width,height}).raw().toBuffer();
      const b=await sharp(expanded).extract({left:el,top:et,width,height}).raw().toBuffer();
      for(let i=0;i<a.length;i++) if(a[i]!==b[i]) differences++;
    }
    const m=await sharp(file).metadata();
    const alpha=(await sharp(file).ensureAlpha().raw().toBuffer()).filter((_,i)=>i%4===3);
    if(m.width!==320||m.height!==160||m.channels!==4||!alpha.includes(0)||differences!==0)throw Error(`QA failed ${r.id}`);
    r.processing='Generated artwork resized to exact 320x160 using Sharp fill, alpha preserved. No procedural replacement of artwork. Expanded QA uses nine extracted slices.';
    r.nineSlice={insets:s,minimumSize:{width:320,height:160},testedExpandedSize:{width:640,height:240},cornerDifferentBytes:differences,center:'Opaque blank parchment; stretch center and straight edge strips, keep all four corners fixed.'};
    r.qa={dimensionsPass:true,rgbaPass:true,transparentOutsidePass:true,noTextVisualPass:true,edgeIdentityPass:true,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),note:'Six identities judged without names at native 320x160. Seal has ribbon; portrait recess is larger and ribbonless. Era wood and milestone gold remain distinct in grayscale by border thickness.'};
  }
  rows.find(r=>r.id==='frame_record_person').qa.note+=' Person v2 shortens left foliage above center stretch band. Center stretch band32px; native320x160 and640x240 reviewed.';
  fs.writeFileSync(metadataPath,JSON.stringify(rows,null,2)+'\n');
  await sharp({create:{width:640,height:480,channels:4,background:'#777777'}}).composite(rows.map((r,i)=>({input:path.join(root,r.file),left:(i%2)*320,top:Math.floor(i/2)*160}))).png().toFile(path.join(root,'raw/cards/contact.png'));
  await sharp({create:{width:640,height:1440,channels:4,background:'#777777'}}).composite(rows.map((r,i)=>({input:path.join(root,`raw/cards/${r.id}-expanded.png`),left:0,top:i*240}))).png().toFile(path.join(root,'raw/cards/contact-expanded.png'));
  console.log('PASS six RGBA frames and 24 corner comparisons with zero differing bytes');
})();
