const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected=JSON.parse(fs.readFileSync(root+'/records/expected-assets.json'));
const laneCounts={'events-early':6,'events-late':6,decisions:5,'chronicle-early':8,'chronicle-late':8,chapters:2};
const stringify=v=>typeof v==='string'?v:JSON.stringify(v??[]);
async function main(){
 const all=Object.entries(laneCounts).flatMap(([lane,n])=>{const a=JSON.parse(fs.readFileSync(`${root}/records/metadata-${lane}.json`));if(a.length!==n)throw Error('lanecount '+lane);return a});
 if(new Set(all.map(a=>a.id)).size!==35)throw Error('35uniqueIDs required');
 const rows=[],checks=[];
 for(const e of expected){
  const a=all.find(x=>x.id===e.id);if(!a||a.file!==e.file)throw Error('missingorwrongfile '+e.id);
  const p=root+'/'+a.file,m=await sharp(p).metadata();if(m.width!==e.width||m.height!==e.height)throw Error('dimensions '+e.id);
  const {data}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]!==255)transparent++;
  if(transparent)throw Error('Illustrationnotopaque '+e.id);
  if(!a.generationRecords?.length)throw Error('missingprovenance '+e.id);
  for(const r of a.generationRecords){if(!r.prompt||!r.rawFile||!fs.existsSync(root+'/'+r.rawFile))throw Error('missingrawprompt '+e.id);const rm=await sharp(root+'/'+r.rawFile).metadata();r.sourceImageDimensions={width:rm.width,height:rm.height};for(const ref of r.referenceImages||[])if(!fs.existsSync(path.isAbsolute(ref)?ref:root+'/'+ref))throw Error('missingreference '+ref);}
  if(!a.sceneDescription||!a.characters||!a.historyNotes)throw Error('missingCSVfields '+e.id);
  checks.push({id:e.id,file:e.file,width:m.width,height:m.height,channels:m.channels,nonOpaquePixels:transparent,sha256:hash(p)});
  rows.push({asset_id:e.id,status:'candidate',file:e.file,width:e.width,height:e.height,group:e.group,scene_description:stringify(a.sceneDescription),characters:stringify(a.characters),history_notes:stringify(a.historyNotes),sha256:hash(p),generation_records:JSON.stringify(a.generationRecords),processing:JSON.stringify(a.processing||{}),readability:JSON.stringify(a.readability||a.qa?.readability||{}),accepted:'pending user review',qa:JSON.stringify(a.qa||{})});
 }
 for(const r of JSON.parse(fs.readFileSync(root+'/records/reference-hashes.json')))if(hash(root+'/references/'+r.file)!==r.sha256)throw Error('referencechanged '+r.file);
 const assetFiles=fs.readdirSync(root+'/assets',{recursive:true}).filter(p=>p.endsWith('.png'));if(assetFiles.length!==35)throw Error('Unexpectedassetcount '+assetFiles.length);
 fs.writeFileSync(root+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(root+'/records/technical-qa.json',JSON.stringify({assets:35,checks},null,2));
 fs.mkdirSync(root+'/records/contacts',{recursive:true});
 for(const group of ['events','decisions','chronicle','chapters']){
  const entries=expected.filter(a=>a.group===group),cols=group==='chapters'?1:group==='chronicle'?4:3,cw=384,ch=group==='chronicle'?420:group==='decisions'?324:252;
  const c=createCanvas(cols*cw,Math.ceil(entries.length/cols)*ch),g=c.getContext('2d');g.fillStyle='#d8cfb8';g.fillRect(0,0,c.width,c.height);
  for(let i=0;i<entries.length;i++){const a=entries[i],im=await loadImage(root+'/'+a.file),s=Math.min(368/a.width,(ch-35)/a.height);const x=i%cols*cw,y=Math.floor(i/cols)*ch;g.drawImage(im,x+8,y+8,a.width*s,a.height*s);g.fillStyle='#302a22';g.font='13px sans-serif';g.fillText(a.id,x+8,y+ch-9);}
  fs.writeFileSync(root+`/records/contacts/${group}.png`,c.toBuffer('image/png'));
 }
 const proofs=fs.readdirSync(root+'/proofs').filter(p=>p.endsWith('.png')).sort();if(proofs.length!==3)throw Error('Need3proofs');
 fs.writeFileSync(root+'/IMAGE_LINKS.md','# Wave16 이미지\n\n'+proofs.map(f=>`- [${f}](proofs/${f})`).join('\n')+'\n\n'+rows.map(a=>`- [${a.asset_id}](${a.file})`).join('\n')+'\n');
 fs.writeFileSync(root+'/index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave16 사건·결정·연대기</title><style>body{background:#d8cfb8;color:#302a22;font:16px sans-serif;margin:28px}a{color:#543927}main{display:flex;flex-wrap:wrap}article{width:360px;padding:12px}img{max-width:360px;max-height:290px}p{overflow-wrap:anywhere}</style><h1>Wave16 후보 35장</h1><p>게임 미설치. 확인 그림은 첨부 틀 위 오프라인 합성입니다.</p><nav><a href="README.md">설명</a> · <a href="검수표.md">검수표</a> · <a href="assets.csv">CSV</a></nav><p>${proofs.map(f=>`<a href="proofs/${f}">${f}</a>`).join(' · ')}</p><main>${rows.map(a=>`<article><a href="${a.file}"><img src="${a.file}" alt="${a.asset_id}"></a><p><a href="${a.file}">${a.asset_id}</a><br>${a.width}×${a.height}<br>${a.scene_description}</p></article>`).join('')}</main></html>`);
 console.log('PASS 35expectedassets dimensions opacity provenance references,3proofs');
}
main().catch(e=>{console.error(e);process.exitCode=1});
