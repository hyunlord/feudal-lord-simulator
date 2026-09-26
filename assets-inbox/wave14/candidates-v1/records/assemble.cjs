const fs=require('fs'), path=require('path'), crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const lanes={heraldry:22,charges:12,merchants:14,seals:7,frames:5,icons:11};
async function main(){
 const all=[];
 for(const [lane,count] of Object.entries(lanes)){
  const doc=JSON.parse(fs.readFileSync(`${root}/records/metadata-${lane}.json`));
  const list=Array.isArray(doc)?doc:doc.assets;
  if(list.length!==count)throw Error(`${lane}: ${list.length} != ${count}`);
  all.push(...list.map(a=>({...a,lane})));
 }
 if(new Set(all.map(a=>a.file)).size!==71)throw Error('duplicate/missing file');
 const rows=[],checks=[];
 for(const a of all){
  const p=path.resolve(root,a.file),m=await sharp(p).metadata();
  if(m.channels!==4||m.width!==a.width||m.height!==a.height)throw Error('RGBA/size '+a.file);
  const {data}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let invisible=0,visible=0,colored=0,partial=0;
  for(let i=0;i<data.length;i+=4){
   if(data[i+3]===0)invisible++;else{visible++;if(data[i]!==data[i+1]||data[i+1]!==data[i+2])colored++;}
   if(data[i+3]>0&&data[i+3]<255)partial++;
  }
  const mask=['charges','merchants'].includes(a.lane)||(a.lane==='heraldry'&&!/texture|overlay/.test(a.id));
  if(mask&&colored)throw Error('colored mask '+a.file);
  if(!visible)throw Error('empty '+a.file);
  if(!a.generationRecords?.length&&!a.generator&&!a.procedural)throw Error('provenance '+a.file);
  for(const r of a.generationRecords||[]){
   if(!r.prompt)throw Error('missing actual prompt/spec '+a.file);
   if(/image_gen/.test(r.tool)&&(!r.rawFile||!fs.existsSync(path.resolve(root,r.rawFile))))throw Error('missing generated raw '+a.file);
   if(r.sourceFile&&!fs.existsSync(path.resolve(root,r.sourceFile)))throw Error('missing procedural source '+a.file);
  }
  checks.push({id:a.id,file:a.file,width:m.width,height:m.height,channels:4,mask,visiblePixels:visible,transparentPixels:invisible,partialAlphaPixels:partial,coloredPixels:colored,sha256:hash(p)});
  rows.push({asset_id:a.id,status:'candidate',file:a.file,width:m.width,height:m.height,role:a.lane,sha256:hash(p),generation_records:JSON.stringify(a.generationRecords||a.generator||a.procedural),processing:JSON.stringify(a.processing||{}),pivot_or_attachment:JSON.stringify({pivot:a.pivot,anchors:a.anchors,sliceInsets:a.sliceInsets,nineSlice:a.nineSlice,channelContract:a.channelContract}),accepted:'pending user review',qa:JSON.stringify(a.qa||{})});
 }
 const files=fs.readdirSync(root+'/assets',{recursive:true}).filter(p=>p.endsWith('.png'));
 if(files.length!==71)throw Error('asset file count '+files.length);
 for(const r of JSON.parse(fs.readFileSync(root+'/records/reference-hashes.json')))if(hash(root+'/references/'+r.file)!==r.sha256)throw Error('reference altered '+r.file);
 fs.writeFileSync(root+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(root+'/records/technical-qa.json',JSON.stringify({assets:71,lanes,checks},null,2));
 const c=createCanvas(1440,Math.ceil(all.length/6)*218+60),g=c.getContext('2d');g.fillStyle='#817e72';g.fillRect(0,0,c.width,c.height);g.fillStyle='#fff4d9';g.font='22px sans-serif';g.fillText('Wave14 | 71 candidates | asset contact sheet (fit to cell)',20,35);
 for(let i=0;i<all.length;i++){const a=all[i],im=await loadImage(root+'/'+a.file),s=Math.min(220/a.width,170/a.height,1);const x=i%6*240,y=Math.floor(i/6)*218+55;g.drawImage(im,x+(240-a.width*s)/2,y,a.width*s,a.height*s);g.fillStyle='#fff4d9';g.font='11px sans-serif';g.fillText(a.id.replace(/^.*\//,''),x+8,y+186);g.fillText(`${a.width} × ${a.height}`,x+8,y+201);}
 fs.writeFileSync(root+'/records/all-assets-contact.png',c.toBuffer('image/png'));
 const proofs=fs.readdirSync(root+'/proofs').filter(f=>f.endsWith('.png')).sort();
 if(proofs.length!==4)throw Error('proof count '+proofs.length);
 fs.writeFileSync(root+'/IMAGE_LINKS.md','# 개별 이미지\n\n'+proofs.map(f=>`- [${f}](proofs/${f})`).join('\n')+'\n\n'+rows.map(a=>`- [${a.asset_id}](${a.file})`).join('\n')+'\n');
 fs.writeFileSync(root+'/index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave14 후보</title><style>body{background:#817e72;color:#fff4d9;font:16px sans-serif;margin:24px}a{color:#fff4d9}main{display:flex;flex-wrap:wrap}article{width:220px;padding:10px}img{max-width:220px;max-height:190px;object-fit:contain}p{overflow-wrap:anywhere}</style><h1>Wave14 문장·표식·권리 UI 후보 71파일</h1><p>게임 미설치. 확인 그림은 오프라인 합성입니다.</p><nav><a href="README.md">설명</a> · <a href="검수표.md">검수표</a> · <a href="assets.csv">CSV</a></nav><h2>확인 그림</h2>${proofs.map(f=>`<a href="proofs/${f}">${f}</a> · `).join('')}<main>${rows.map(a=>`<article><a href="${a.file}"><img src="${a.file}" alt="${a.asset_id}"></a><p><a href="${a.file}">${a.asset_id}</a><br>${a.width}×${a.height}</p></article>`).join('')}</main></html>`);
 console.log('PASS: 71 RGBA assets, BW masks, references, 4 proofs; generated inventory and links');
}
main().catch(e=>{console.error(e);process.exitCode=1});
