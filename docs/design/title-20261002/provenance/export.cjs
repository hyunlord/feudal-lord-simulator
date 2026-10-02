const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const records = ['en', 'ko'].flatMap(lang => JSON.parse(fs.readFileSync(path.join(__dirname, `generation-${lang}.json`))));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function main() {
  fs.mkdirSync(path.join(root, 'proofs'), {recursive:true});
  const report = [];
  for (const r of records) {
    const raw = fs.readFileSync(r.source);
    const {data,info} = await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let minX=info.width,minY=info.height,maxX=-1,maxY=-1,zero=0,solid=0;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      const a=data[(y*info.width+x)*4+3];
      if(a===0) zero++;
      if(a>=250) solid++;
      if(a>0){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    }
    if(zero<info.width*info.height*.1 || solid<100) throw Error('Alpha invalid: '+r.slug);
    const crop={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
    const logoName=`${r.slug}-${r.language}.png`;
    await sharp(raw).extract(crop).resize({width:1024,height:768,fit:'inside',withoutEnlargement:true}).extend({top:24,bottom:24,left:24,right:24,background:'#00000000'}).png({compressionLevel:9}).toFile(path.join(root,'logos',logoName));
    const variants=[];
    for(const format of ['header','capsule']) {
      const header=format==='header';
      const width=header?460:616,height=header?215:353;
      const src=header?'/tmp/astra-title-header.png':'/tmp/astra-title-main.png';
      const box=header?{left:247,top:24,width:198,height:165}:{left:315,top:12,width:285,height:200};
      const overlay=await sharp(raw).extract(crop).resize({width:box.width,height:box.height,fit:'inside'}).png().toBuffer();
      const meta=await sharp(overlay).metadata();
      for(const tone of ['light','dark']) {
        let base=sharp(src).resize(width,height);
        if(tone==='dark') base=base.modulate({brightness:.43,saturation:.75});
        const file=`${r.slug}-${r.language}-${format}-${width}x${height}-${tone}.jpg`;
        await base.composite([{input:overlay,left:box.left+Math.floor((box.width-meta.width)/2),top:box.top+Math.floor((box.height-meta.height)/2)}]).jpeg({quality:88,chromaSubsampling:'4:4:4'}).toFile(path.join(root,'logos',file));
        variants.push({file,width,height,tone,backgroundSource:src,logoBox:box});
      }
    }
    report.push({slug:r.slug,language:r.language,status:'candidate',source:r.source,sourceSha256:hash(raw),sourceSize:[info.width,info.height],transparentPixels:zero,nearOpaquePixels:solid,alphaBounds:crop,output:logoName,variants});
  }
  // All mockups are placed at their actual native size on review sheets.
  for(const format of ['header','capsule']) for(const lang of ['en','ko']) {
    const w=format==='header'?460:616,h=format==='header'?215:353;
    const gap=18,margin=20,label=28;
    const overlays=[];
    const rs=records.filter(r=>r.language===lang);
    for(let row=0;row<rs.length;row++) for(let col=0;col<2;col++) {
      const tone=col?'dark':'light';
      const file=`${rs[row].slug}-${lang}-${format}-${w}x${h}-${tone}.jpg`;
      const left=margin+col*(w+gap),top=margin+label+row*(h+gap+label);
      overlays.push({input:path.join(root,'logos',file),left,top});
      const text=`${rs[row].slug.slice(0,2)} / ${lang.toUpperCase()} / ${tone} / ${w} x ${h}`;
      overlays.push({input:Buffer.from(`<svg width="${w}" height="24"><text x="0" y="17" fill="#e5d7be" font-family="sans-serif" font-size="13">${text}</text></svg>`),left,top:top-label});
    }
    await sharp({create:{width:margin*2+w*2+gap,height:margin*2+4*(h+label)+3*gap,channels:3,background:'#25231f'}}).composite(overlays).jpeg({quality:90}).toFile(path.join(root,'proofs',`${format}-${lang}-actual-size.jpg`));
  }
  fs.writeFileSync(path.join(__dirname,'export-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({logos:records.length,mockups:records.length*4,proofs:4}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
