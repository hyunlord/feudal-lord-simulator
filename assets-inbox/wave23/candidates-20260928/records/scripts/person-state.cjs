const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const { createCanvas, loadImage } = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const generation = JSON.parse(fs.readFileSync(path.join(root, 'records/person-state-generation.json')));
const labels = {mourning:'상중',sick:'병',pregnant:'임신',newborn:'새로 태어남',dead:'사망',hunger:'굶주림',injury:'부상',pilgrim:'순례 중',marriage:'혼인',reeve:'Reeve · 막대',bailiff:'Bailiff · 한 열쇠',steward:'청지기 · 열쇠 꾸러미'};
const pool = '/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/assets-inbox/portrait-pool/pool1-20260926/assets/portraits';
const pilot = path.resolve(root, '../astra-people-pilot-v1/assets/portraits');
const portraitIds = ['P6','P3','P2','I068_child','I047_old','P1','P4','I056_mature','P5','I039_mature','I041_young','I042_mature'];
const ids = Object.keys(labels);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const metadata = [], checks = [];
  fs.mkdirSync(path.join(root, 'references/person_state'), {recursive:true});
  fs.mkdirSync(path.join(root, 'proofs'), {recursive:true});
  const canvas = createCanvas(1320, 850), ctx = canvas.getContext('2d');
  ctx.fillStyle='#e5dcc7'; ctx.fillRect(0,0,1320,850);
  ctx.fillStyle='#342d24';ctx.font='25px sans-serif';ctx.fillText('인물 상태 · 기존 초상 12명 / 얼굴 원본 유지',28,40);
  ctx.font='15px sans-serif';ctx.fillText('96px 원본 크기 · 오른쪽 아래 틀 장식 · 아래는 48px 크기 / 후보 합성, 실제 게임 아님',28,68);
  for (let index=0;index<ids.length;index++) {
    const id=ids[index], gen=generation.find(g=>g.id===id); if(!gen)continue;
    const rawRel='raw/person_state/'+id+'.png';
    const icon=await sharp(path.join(root,rawRel)).trim().resize(29,29,{fit:'inside'}).png().toBuffer();
    const sprite = await sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite([{input:icon,left:67,top:67}]).raw().toBuffer();
    let cleared=0;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if((x-47.5)**2+(y-47.5)**2<=31**2){const p=(y*96+x)*4;if(sprite[p+3])cleared++;sprite.fill(0,p,p+4);}
    const file96='assets/person_state/'+id+'_96.png';
    await sharp(sprite,{raw:{width:96,height:96,channels:4}}).png().toFile(path.join(root,file96));
    const file48='assets/person_state/'+id+'_48.png';
    const small=await sharp(sprite,{raw:{width:96,height:96,channels:4}}).resize(48,48).raw().toBuffer();
    for(let y=0;y<48;y++)for(let x=0;x<48;x++)if((x-23.5)**2+(y-23.5)**2<=15.5**2)small.fill(0,(y*48+x)*4,(y*48+x)*4+4);
    await sharp(small,{raw:{width:48,height:48,channels:4}}).png().toFile(path.join(root,file48));
    const rawInfo=await sharp(path.join(root,rawRel)).metadata();
    for(const size of [96,48])metadata.push({id:'person_state/'+id+'_'+size,file:'assets/person_state/'+id+'_'+size+'.png',width:size,height:size,description:labels[id]+' · 초상 틀 바깥 장식',role:'portrait-frame-ornament',blendMode:'source-over',opacityMax:1,frameLayout:{cellWidth:size,cellHeight:size,count:1},pivot:{x:size/2,y:size/2},displayScale:1,qa:{centralFaceDiskRadius:size*31/96,centralFaceAlphaMax:0,facesGenerated:false,limitation:'48px 장식은 축소 표식이며 정확한 상태명은 UI 문구와 병행 권장'},generationRecords:[{prompt:gen.prompt,rawFile:rawRel,referenceImages:['references/icon_cause_family_sheet.png'],tool:'image_gen.imagegen',model:null,seed:null,sourceResolution:{width:rawInfo.width,height:rawInfo.height}}],processing:{method:'Generated ornament alpha trim, one proportional reduction to 29px, place at (67,67) on transparent 96px frame. Clear central disk radius31. 48px derivative resized from 96px; protected disk re-cleared.',clearedProtectionPixels:cleared}});
    const pid=portraitIds[index], src=pid.startsWith('P')?path.join(pilot,'pt_pilot_'+pid+'-v1_96.png'):path.join(pool,pid+'.png');
    const refRel='references/person_state/'+pid+'.png';fs.copyFileSync(src,path.join(root,refRel));
    const base=await sharp(src).resize(96,96).ensureAlpha().raw().toBuffer();
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if((x-47.5)**2+(y-47.5)**2>43**2)base.fill(0,(y*96+x)*4,(y*96+x)*4+4);
    const before=await sharp(base,{raw:{width:96,height:96,channels:4}}).png().toBuffer();
    const after=await sharp(before).composite([{input:path.join(root,file96)}]).ensureAlpha().raw().toBuffer();
    let delta=0, covered=0;for(let y=0;y<96;y++)for(let x=0;x<96;x++)if((x-47.5)**2+(y-47.5)**2<=31**2){let p=(y*96+x)*4;if(sprite[p+3])covered++;if([0,1,2,3].some(k=>base[p+k]!==after[p+k]))delta++;}
    if(delta||covered)throw new Error(id+' face pixels altered');
    checks.push({id,portraitIdentity:pid,reference:refRel,originalSource:src,sourceSHA256:hash(fs.readFileSync(src)),copiedSHA256:hash(fs.readFileSync(path.join(root,refRel))),centralFacePixelsChanged:delta,centralFacePixelsCovered:covered,clearedProtectionPixels:cleared,portraitResize:pid.startsWith('P')?'Existing 96px used directly':'Existing 256px resized once to96px; no repaint/retouch'});
    const x=30+(index%6)*215,y=110+Math.floor(index/6)*350;
    ctx.fillStyle='#342d24';ctx.font='17px sans-serif';ctx.fillText(labels[id],x,y);
    ctx.drawImage(await loadImage(before),x,y+18);ctx.drawImage(await loadImage(path.join(root,file96)),x,y+18);
    ctx.font='12px sans-serif';ctx.fillText(pid+' · 96px',x,y+136);
    ctx.fillStyle='#3f4545';ctx.fillRect(x+112,y+18,96,96);ctx.drawImage(await loadImage(path.join(root,file96)),x+112,y+18);
    ctx.fillStyle='#f1e7d2';ctx.fillRect(x,y+160,96,80);ctx.fillStyle='#343c3c';ctx.fillRect(x+100,y+160,96,80);
    ctx.drawImage(await loadImage(path.join(root,file48)),x+14,y+171);ctx.drawImage(await loadImage(path.join(root,file48)),x+114,y+171);
    ctx.fillStyle='#342d24';ctx.font='12px sans-serif';ctx.fillText('48px / 밝은 배경 · 어두운 배경',x,y+259);
  }
  fs.writeFileSync(path.join(root,'records/metadata-person-state.json'),JSON.stringify(metadata,null,2));
  fs.writeFileSync(path.join(root,'records/person-state-face-qa.json'),JSON.stringify({status:checks.length===12?'PASS':'IN_PROGRESS',distinctPortraitIdentities:new Set(checks.map(c=>c.portraitIdentity)).size,checks},null,2));
  fs.writeFileSync(path.join(root,'proofs/03-portrait-states.png'),canvas.toBuffer('image/png'));
  console.log(JSON.stringify({assets:metadata.length,portraits:checks.length}));
})();
