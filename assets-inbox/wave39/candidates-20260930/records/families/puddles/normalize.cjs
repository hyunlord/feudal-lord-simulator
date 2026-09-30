const fs=require('fs');
const crypto=require('crypto');
const {createCanvas,loadImage}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {PNG}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const dir='/tmp/astra-wave39-work-20260930/puddles';
const out='/tmp/astra-wave39-candidates-20260930/assets/puddles';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const rows=JSON.parse(fs.readFileSync(dir+'/sources.json','utf8'));
 const board=createCanvas(960,720),b=board.getContext('2d');b.fillStyle='#6c7051';b.fillRect(0,0,960,720);
 for(let i=0;i<rows.length;i++){
  const r=rows[i],data=PNG.sync.read(fs.readFileSync(r.sourcePath));let x0=data.width,y0=data.height,x1=-1,y1=-1;
  for(let y=0;y<data.height;y++)for(let x=0;x<data.width;x++){if(data.data[(y*data.width+x)*4+3]>4){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  if(x1<0)throw Error('Empty source '+r.assetId);
  const c=createCanvas(r.width,r.height),g=c.getContext('2d'),im=await loadImage(r.sourcePath);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const sw=x1-x0+1,sh=y1-y0+1,scale=Math.min((r.width-2)/sw,(r.height-2)/sh);
  const dw=Math.round(sw*scale),dh=Math.round(sh*scale);
  g.drawImage(im,x0,y0,sw,sh,Math.floor((r.width-dw)/2),Math.floor((r.height-dh)/2),dw,dh);
  r.outputPath=out+'/'+r.assetId+'.png';fs.writeFileSync(r.outputPath,c.toBuffer('image/png'));
  r.sourceSha256=hash(r.sourcePath);r.outputSha256=hash(r.outputPath);r.crop=[x0,y0,x1-x0+1,y1-y0+1];
  r.pivot=[r.width/2,r.height/2];r.frames=1;r.recommendedAlpha=r.assetId.startsWith('puddle')?0.65:0.55;r.recommendedSpeed=0;r.windTilt=0;r.status='candidate';r.repeat='none';
  r.manualEdits='Mechanical alpha-bbox crop at alpha>4; high-quality resize into 1px transparent runtime margin; no repaint, color change, or synthesized content.';
  const bx=(i%2)*480,by=Math.floor(i/2)*180;b.fillStyle='#f0eddc';b.font='15px sans-serif';b.fillText(r.assetId+' '+r.width+'x'+r.height,bx+15,by+22);
  b.drawImage(c,bx+25,by+65);b.drawImage(c,bx+140,by+60,Math.round(r.width*.6),Math.round(r.height*.6));
  b.imageSmoothingEnabled=false;b.drawImage(c,bx+255,by+40,r.width*2,r.height*2);b.imageSmoothingEnabled=true;
 }
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify(rows,null,2));fs.writeFileSync(dir+'/qa-contactsheet.png',board.toBuffer('image/png'));
 console.log(JSON.stringify(rows.map(r=>({id:r.assetId,size:[r.width,r.height],crop:r.crop})),null,2));
})();
