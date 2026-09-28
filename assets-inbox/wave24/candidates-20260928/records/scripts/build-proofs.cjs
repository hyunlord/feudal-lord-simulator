const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas, loadImage, GlobalFonts} = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Georgia.ttf','ProofSerif');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Georgia Bold.ttf','ProofSerifBold');
GlobalFonts.registerFromPath('/System/Library/Fonts/AppleSDGothicNeo.ttc','ProofKorean');
const root=path.resolve(__dirname,'..');
const specs=[
 ['steam_header_capsule',920,430,[.6,.04,.38,.87],'logo'],
 ['steam_small_capsule',462,174,[.4,.08,.58,.8],'logo'],
 ['steam_main_capsule',1232,706,[.25,.035,.7,.26],'logo'],
 ['steam_vertical_capsule',748,896,[.08,.035,.84,.23],'logo'],
 ['steam_library_capsule',600,900,[.08,.035,.84,.23],'logo'],
 ['steam_library_hero',3840,1240,[1/3,2/3,1/3,1/3],'steam_ui_occlusion_not_logo'],
 ['steam_library_logo_emblem',1280,720,[.21,.07,.58,.86],'emblem_content_not_title'],
 ['steam_page_background',1438,810,[.18,.08,.64,.84],'page_content_not_logo'],
 ['steam_app_icon',184,184,[.043,.043,.914,.914],'icon_content_not_title'],
 ['steam_shortcut_icon',256,256,[.031,.031,.938,.938],'icon_content_not_title'],
];
const assets={};
function label(ctx,text,x,y,size=23,color='#e4dac6'){ctx.fillStyle=color;ctx.font=`${size}px ProofKorean`;ctx.textAlign='left';ctx.fillText(text,x,y);}
function title(ctx,rect,lang='en'){
 const[x,y,w,h]=rect;const lines=lang==='en'?['FEUDAL LORD','SIMULATOR']:['봉건 영주','시뮬레이터'];
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#302018';
 let size=Math.min(w/(lang==='en'?7.5:5),h*.36);
 for(let i=0;i<lines.length;i++){
  const s=size*(i===1?.72:1);ctx.font=`${s}px ${lang==='en'?'ProofSerif':'ProofKorean'}`;
  while(ctx.measureText(lines[i]).width>w*.95){size*=.98;ctx.font=`${size*(i===1?.72:1)}px ${lang==='en'?'ProofSerif':'ProofKorean'}`;}
  ctx.fillText(lines[i],x+w/2,y+h*(i===0?.38:.72));
 }
 ctx.restore();
}
function titled(id,lang='en'){
 const s=specs.find(s=>s[0]===id); const c=createCanvas(s[1],s[2]);const ctx=c.getContext('2d');ctx.drawImage(assets[id],0,0);
 if(id==='steam_small_capsule'&&lang==='en'){
  // Stacked temporary font lettering keeps the title legible at 120x45.
  // This is proof-only typography; no title is baked into the deliverable art.
  const x=s[1]*.69;ctx.fillStyle='#302018';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const[text,y,size]of[['FEUDAL',47,46],['LORD',94,46],['SIMULATOR',134,26]]){ctx.font=`${size}px ProofSerifBold`;ctx.fillText(text,x,y);}
  return c;
 }
 title(ctx,[s[3][0]*s[1],s[3][1]*s[2],s[3][2]*s[1],s[3][3]*s[2]],lang);return c;
}
async function main(){
 await fs.mkdir(path.join(root,'exports'),{recursive:true});
 for(const[id,w,h,box,type]of specs){
  assets[id]=await loadImage(path.join(root,`assets/${id}.png`));
  const c=createCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(assets[id],0,0,w,h);
  const r=box.map((n,i)=>n*(i%2===0?w:h));ctx.fillStyle=type==='logo'?'rgba(50,167,181,0.24)':'rgba(233,171,80,0.24)';ctx.fillRect(...r);
  ctx.strokeStyle=type==='logo'?'#287d89':'#b57e34';ctx.lineWidth=Math.max(2,w/480);ctx.strokeRect(...r);
  await fs.writeFile(path.join(root,`guides/${id}_safe_zone.png`),c.toBuffer('image/png'));
 }
 await fs.writeFile(path.join(root,'records/safe-zones.json'),JSON.stringify({coordinates:'normalized x,y,width,height; top-left origin',note:'Project composition boxes, not official Steam crop templates. Only type=logo reserves title space. Hero/UI and icon guides never request baked-in title.',assets:specs.map(([id,w,h,box,type])=>({id,width:w,height:h,box,type}))},null,2));
 await sharp(path.join(root,'assets/steam_app_icon.png')).flatten({background:'#272421'}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(root,'exports/steam_app_icon.jpg'));
 const c=createCanvas(2400,1940),ctx=c.getContext('2d');ctx.fillStyle='#242b30';ctx.fillRect(0,0,2400,1940);
 label(ctx,'WAVE 24 · 캡슐 실제 크기 / 작은 화면 검수',40,49,34);
 label(ctx,'원화에는 글자 없음 · 이 확인판에만 글꼴로 임시 제목 합성 · PNG를 100% 배율로 열어 검수',40,89,24);
 for(const[id,x,y]of[['steam_main_capsule',40,140],['steam_header_capsule',1320,140],['steam_small_capsule',1320,650],['steam_vertical_capsule',40,930],['steam_library_capsule',828,930]]){
  const s=specs.find(s=>s[0]===id);label(ctx,`${id}  ${s[1]} × ${s[2]}  1:1`,x,y-12,21);ctx.drawImage(titled(id),x,y);
 }
 label(ctx,'검색 목록 축소 · 각 칸은 표기된 실제 픽셀',1490,934,26);
 const smallRaw=assets.steam_small_capsule,smallEN=titled('steam_small_capsule'),smallKO=titled('steam_small_capsule','ko');
 let y=987;
 for(const[w,h]of[[231,87],[184,69],[120,45]]){
  label(ctx,`${w} × ${h}`,1490,y-16,21);
  for(const[img,j]of[[smallRaw,0],[smallEN,1],[smallKO,2]])ctx.drawImage(img,1490+j*280,y,w,h);
  y+=h+70;
 }
 label(ctx,'그림만',1490,1427,20);label(ctx,'영문 임시 제목',1770,1427,20);label(ctx,'한글 임시 제목',2050,1427,20);
 label(ctx,'같은 엠블럼 · 앱 / 바로가기',1490,1515,25);
 ctx.drawImage(assets.steam_app_icon,1490,1540);ctx.drawImage(assets.steam_shortcut_icon,1740,1540);
 label(ctx,'120×45: 탑·도시와 영주 실루엣, 제목의 분리 여부를 확인.',40,1882,25);
 label(ctx,'선택 사항인 시대 변주 3장은 제외. 가이드 PNG는 납품 원화와 별도.',40,1918,23);
 await fs.writeFile(path.join(root,'proofs/01-capsules-size-check.png'),c.toBuffer('image/png'));
 // Offline composition only; no Steam client or game runtime was changed.
 const p=createCanvas(1920,1510),pc=p.getContext('2d');pc.fillStyle='#17202b';pc.fillRect(0,0,1920,1510);
 label(pc,'WAVE 24 · 라이브러리 오프라인 모의',30,45,28);label(pc,'실제 Steam 실행 화면 아님 · 제목과 UI는 확인용 스크립트 합성',30,82,21,'#9facbb');
 pc.fillStyle='#1f2935';pc.fillRect(0,112,238,1398);label(pc,'라이브러리',24,151,23);label(pc,'Feudal Lord Simulator',24,196,17);
 pc.drawImage(titled('steam_library_capsule'),24,230,190,285);
 const hx=238,hy=112,hw=1682,hh=Math.round(hw*1240/3840);
 pc.drawImage(assets.steam_library_hero,hx,hy,hw,hh);
 const shadow=pc.createLinearGradient(0,hy+hh*.52,0,hy+hh);shadow.addColorStop(0,'rgba(18,26,35,0)');shadow.addColorStop(1,'rgba(18,26,35,0.94)');pc.fillStyle=shadow;pc.fillRect(hx,hy,hw,hh);
 pc.drawImage(assets.steam_library_logo_emblem,280,119,230,129);
 pc.save();pc.fillStyle='#302018';pc.font='48px ProofSerif';pc.fillText('FEUDAL LORD',503,167);pc.font='29px ProofSerif';pc.fillText('SIMULATOR',505,211);pc.restore();
 const ux=hx+hw/3,uy=hy+hh*2/3,uw=hw/3,uh=hh/3;
 pc.fillStyle='rgba(7,12,19,.42)';pc.fillRect(ux,uy,uw,uh);pc.strokeStyle='#dabd84';pc.lineWidth=2;pc.setLineDash([7,7]);pc.strokeRect(ux,uy,uw,uh);pc.setLineDash([]);
 label(pc,'중앙 아래 1/3 · UI 가림 확인',ux+22,uy+40,22);
 pc.fillStyle='#56792d';pc.fillRect(282,hy+hh-65,181,48);label(pc,'플레이',333,hy+hh-33,25,'#fff');
 label(pc,'활동',283,hy+hh+65,28);pc.fillStyle='#25313e';pc.fillRect(282,hy+hh+87,1120,176);label(pc,'라이브러리 UI 자리',310,hy+hh+131,23,'#b2bdc7');
 label(pc,'원본 히어로 3840 × 1240 · 아래는 가림 없는 전체 파노라마',282,hy+hh+318,23);
 pc.drawImage(assets.steam_library_hero,282,hy+hh+340,1410,Math.round(1410*1240/3840));
 await fs.writeFile(path.join(root,'proofs/02-library-mock.png'),p.toBuffer('image/png'));
 // Inspect these crops separately at native pixel sizes; not additional deliverable proof boards.
 await sharp(path.join(root,'proofs/01-capsules-size-check.png')).extract({left:1480,top:948,width:900,height:500}).png().toFile(path.join(root,'records/small-proof-crop.png'));
 await sharp(path.join(root,'assets/steam_small_capsule.png')).resize(120,45,{fit:'fill'}).png().toFile(path.join(root,'records/small-120x45.png'));
 console.log(JSON.stringify({assets:specs.length,guides:specs.length,proofs:2,exportJpg:1}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
