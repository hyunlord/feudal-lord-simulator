const fs=require('fs'),path=require('path');const{createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');const r=path.resolve(__dirname,'..'),ref='references/astra-ui-pilot-reference-files/';
(async()=>{const c=createCanvas(1280,800),ctx=c.getContext('2d'),get=p=>loadImage(path.join(r,p));ctx.drawImage(await get(ref+'01_현재_게임화면_HUD.jpg'),0,0,1280,800);const frames=JSON.parse(fs.readFileSync(path.join(r,'records/frames.json'))),cache={};for(const a of frames)cache[a.id.split('/').pop()]=await get(a.file);const font='sans-serif';
function text(s,x,y,size=16,color='#332d25',bold=false){ctx.font=`${bold?'600 ':''}${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(s,x,y);}
const {renderFrame}=require('./frames-render.cjs');
async function panel(id,x,y,w,h){ctx.drawImage(await loadImage(await renderFrame(id,w,h)),x,y);}
const res=await get('assets/ui/icon_resource_sheet.png'),cat=await get('assets/ui/icon_build_category_sheet.png'),mode=await get('assets/ui/icon_layer_mode_sheet.png');
function ico(im,i,cell,x,y,size){ctx.drawImage(im,i*cell,0,cell,cell,x,y,size,size);}
await panel('frame_panel_dark',0,0,1280,104);
const names=['인구','빵','가용 목재','가용 석재','재정'],vals=['12','859','180','112','0'];for(let i=0;i<5;i++){let x=20+i*174;ico(res,i,96,x,24,32);text(names[i],x+43,35,14,'#e9decb');text(vals[i],x+43,62,22,'#fff7e7',true);}ico(res,5,96,908,17,24);text('1300년 봄',940,36,16,'#fff7e7');text('Ⅱ   ▷   1×   2×',912,68,16,'#fff7e7');await panel('button_primary_base',1120,20,136,46);text('설정',1170,49,16);text('오프라인 HUD 합성 · 아트 후보 / 실제 설치 화면 아님',20,90,12,'#dfd0b7');
ctx.fillStyle='#e1d1ae';ctx.fillRect(928,104,344,206);
await panel('frame_objective',928,110,344,84);text('정착지 목표',950,139,19,'#332d25',true);text('도시 발전 조건   ·   24 / 24 필지',950,166,15);
await panel('frame_objective',928,200,344,110);text('우물과 예배당을 갖추세요',950,231,18,'#332d25',true);text('우물은 집에서 6칸 안에',950,258,16);text('목책 선포 전에 예배당을 완공하세요',950,285,15);
await panel('frame_panel_light',16,142,264,270);text('건물 정보 · 예시',36,178,20,'#332d25',true);text('우물',36,214,18,'#332d25',true);text('가까운 가구에 물을 공급합니다.',36,245,15);text('서비스 반경   6칸',36,279,16);text('수용량          12필지',36,309,16);text('예측 · 도로 없이 이용 가능',36,345,14);await panel('button_primary_base',34,360,222,36);text('지도에서 확인',94,384,15);
await panel('frame_advisor',16,504,470,154);const portrait=await get(ref+'04_초상화_화풍_P1.png');ctx.save();ctx.beginPath();ctx.arc(48,581,20,0,Math.PI*2);ctx.clip();ctx.drawImage(portrait,28,561,40,40);ctx.restore();text('청지기의 조언 · 임시 초상',118,540,18,'#332d25',true);text('우물부터 가까운 집에 닿게 놓으세요.',118,571,16);text('선택한 도구의 예측 줄을 확인하세요.',118,598,16);text('텍스트·수치는 확인판 전용 별도 레이어',118,630,12);
await panel('frame_panel_light',1090,644,190,48);text('정착지는 안정적입니다',1104,674,15);
await panel('frame_panel_dark',0,692,1280,108);const mn=['직접','구역','방향'];for(let i=0;i<3;i++){let x=18+i*104;await panel('button_icon_square_base',x,708,44,44);ico(mode,i,128,x+6,714,32);text(mn[i],x+49,737,15,'#f5ead7');}const cn=['생활','길','생업','저장유통','공공신앙','방어'];for(let i=0;i<6;i++){let x=370+i*144;ico(cat,i,128,x,704,40);text(cn[i],x+45,731,16,'#f5ead7');}text('층위 전환',20,778,13,'#cbbca5');text('길  ·  육지 무료 / 다리 목재 4     |     클릭 설치 · Esc 취소 · 휠 확대',370,778,15,'#efe3ce');
// Use subtle vellum only on the narrow divider area, never behind paragraph text.
ctx.save();ctx.globalAlpha=.10;const pattern=ctx.createPattern(cache.texture_vellum_light,'repeat');ctx.fillStyle=pattern;ctx.fillRect(0,688,1280,4);ctx.restore();
fs.writeFileSync(path.join(r,'proofs/01-hud-composite.png'),c.toBuffer('image/png'));console.log('HUD1280x800 offline composite');})();
