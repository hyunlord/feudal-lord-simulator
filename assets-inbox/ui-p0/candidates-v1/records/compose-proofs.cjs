const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const colors={paper:'#e1d1ae',ink:'#332d25',oak:'#514334',light:'#f2e7d4',edge:'#b7a47f'};
(async()=>{
 const frames=fs.existsSync(path.join(__dirname,'frames.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'frames.json'))):require('./frames-definitions.json').map(d=>({id:'ui/'+d[0],file:'assets/ui/'+d[0]+'.png'}));
 const entries=[...frames,...['icons','portraits'].flatMap(f=>JSON.parse(fs.readFileSync(path.join(__dirname,f+'.json'))))];
 const images={};for(const e of entries)images[e.id.split('/').pop()]=await loadImage(path.join(root,e.file));
 const {renderFrame}=require('./frames-render.cjs');
 const name=id=>Object.keys(images).find(k=>k===id)||Object.keys(images).find(k=>k===id+'_v2')||Object.keys(images).find(k=>k===id+'_sheet')||id;
 const im=id=>{const a=images[name(id)];if(!a)throw Error('Missing '+id);return a;};
 async function scene(w,h,tablet){
  const c=createCanvas(w,h),g=c.getContext('2d');
  // The same supplied scene is cropped horizontally for tablet, never regenerated.
  const bg=await loadImage(path.join(root,'references/original-game-HUD.jpg'));
  g.drawImage(bg,Math.floor((1280-w)/2),0,w,800,0,0,w,800);
  const text=(s,x,y,size=16,color=colors.ink,bold=false)=>{g.font=`${bold?'600 ':''}${size}px sans-serif`;g.fillStyle=color;g.fillText(s,x,y);};
  const frame=async(id,x,y,ww,hh)=>g.drawImage(await loadImage(await renderFrame(name(id),ww,hh,.5)),x,y);
  const icon=(id,n,x,y,size=24)=>g.drawImage(im(id),n*96,0,96,96,x,y,size,size);
  function divider(id,x,y,ww){const tile=createCanvas(64,8);tile.getContext('2d').drawImage(im(id),0,0,64,8);g.save();g.translate(x,y);g.fillStyle=g.createPattern(tile,'repeat');g.fillRect(0,0,ww,8);g.restore();}
  await frame('frame_hud_strip_top',0,0,w,104);
  const resourceNames=['인구','빵','가용 목재','가용 석재','재정'],values=['12','859','180','112','0'];
  const stride=tablet?132:148;
  for(let i=0;i<5;i++){let x=18+i*stride;icon('icon_resource',i,x,22,32);text(resourceNames[i],x+40,32,13,colors.light);text(values[i],x+40,58,21,colors.light,true);}
  icon('icon_resource',5,w-422,20,28);text('1300년 봄',w-386,40,15,colors.light);
  for(let i=0;i<4;i++)icon('icon_time',i,w-262+i*37,25,24);
  await frame('button_secondary_base',w-99,19,82,44);text('설정',w-72,47,15);
  divider('divider_manuscript_dark',18,65,w-36);
  text('오프라인 합성 · 후보 자산 / 문구와 수치는 별도 시안 레이어',18,88,12,colors.light);
  const rx=w-348;
  // Opaque backing prevents the source objective typography showing in card gaps.
  g.fillStyle=colors.paper;g.fillRect(rx,104,348,223);
  await frame('frame_objective_normal',rx,108,314,92);text('정착지 목표',rx+18,136,18,colors.ink,true);text('생활 기반을 갖추세요',rx+18,161,15);icon('icon_objective_action',0,rx+18,170,20);text('관련 도구 열기',rx+44,186,13);
  await frame('frame_objective_warn',rx,209,314,118);text('다음: 식량 사슬 연결',rx+18,240,18,colors.ink,true);icon('icon_cause_family',1,rx+18,253,24);text('경작지 → 방앗간 → 곡창',rx+50,272,14);text('배치 전 공급 예측을 확인하세요',rx+18,305,14);
  await frame('frame_panel_light',16,134,244,280);text('우물',34,170,20,colors.ink,true);icon('icon_first_session_buildings',1,34,188,48);text('물 공급',94,212,16);text('가까운 집에 물을 공급합니다',34,262,14);text('반경 6칸 · 수용량 12필지',34,291,15);
  divider('divider_manuscript_light',34,274,208);
  await frame('chip_condition_base',32,309,210,31);icon('icon_prediction',1,39,313,22);text('예상 공급 8 / 12필지',67,331,13);
  await frame('button_primary_base',32,353,210,43);text('지도에서 확인',86,380,15);
  await frame('frame_advisor_normal',16,h-277,454,137);
  g.save();g.beginPath();g.arc(60,h-210,31,0,Math.PI*2);g.clip();g.drawImage(im('advisor_steward_portrait_neutral'),29,h-241,62,62);g.restore();g.drawImage(im('advisor_portrait_frame'),24,h-246,72,72);
  text('청지기의 조언',112,h-245,18,colors.ink,true);text('길에서 가까운 곳부터 지어 보세요.',112,h-214,15);text('문제가 생기면 지도 표시를 선택하세요.',112,h-186,14);
  await frame('banner_unlock',290,112,w-650,52);icon('icon_lock_new',1,304,128,22);text('구역 도구를 사용할 수 있습니다',335,144,14);
  await frame('frame_tooltip',490,h-253,242,62);text('원인 표시를 선택하면',505,h-229,14);text('해결 방법을 볼 수 있습니다.',505,h-207,14);
  await frame('toast_small',w-344,h-187,344,57);icon('icon_prediction',1,w-330,h-175,23);text('길이 연결되었습니다',w-295,h-157,14);
  if(tablet){await frame('frame_modal',rx,350,314,157);text('설정 · 표시 예시',rx+20,379,18,colors.ink,true);await frame('frame_panel_dark',rx+18,391,278,42);text('문제만 보기',rx+33,418,15,colors.light);await frame('button_secondary_base',rx+178,447,116,42);text('닫기',rx+220,474,15);}
  await frame('frame_hud_strip_bottom',0,h-130,w,130);
  const modes=['직접','구역','방향'];for(let i=0;i<3;i++){let x=16+i*76;await frame('button_icon_square_base',x,h-114,44,44);icon('icon_layer_mode',i,x+8,h-106,28);text(modes[i],x+8,h-51,13,colors.light);}text('층위 전환',19,h-18,12,colors.light);
  const categories=['생활','길','생업','저장유통','공공신앙','방어'],sx=256,catStep=(w-sx-16)/6;
  for(let i=0;i<6;i++){const x=Math.round(sx+i*catStep);await frame('tab_build_base',x,h-119,Math.floor(catStep-6),35);icon('icon_build_category',i,x+6,h-114,24);text(categories[i],x+35,h-96,13,colors.light);}
  const step=(w-sx-14)/12;for(let i=0;i<12;i++)icon('icon_first_session_buildings',i,Math.round(sx+i*step)+13,h-79,32);
  text('클릭 설치 · Esc 취소 · 휠 확대 · O 문제만 보기',sx,h-18,13,colors.light);
  // Textures appear only in separator strips, away from copy.
  for(const [id,yy] of [['texture_vellum_light',h-134],['texture_vellum_dark',101]]){g.save();g.globalAlpha=.16;g.fillStyle=g.createPattern(im(id),'repeat');g.fillRect(0,yy,w,3);g.restore();}
  return c;
 }
 const desktop=await scene(1280,800,false),tablet=await scene(1180,820,true);
 fs.writeFileSync(path.join(root,'records/hud-desktop-1280x800.png'),desktop.toBuffer('image/png'));fs.writeFileSync(path.join(root,'records/hud-tablet-1180x820.png'),tablet.toBuffer('image/png'));
 const board=createCanvas(2508,884),b=board.getContext('2d');b.fillStyle='#e9e1d1';b.fillRect(0,0,2508,884);b.fillStyle=colors.ink;b.font='18px sans-serif';b.fillText('Desktop 1280 × 800 · offline composite',16,30);b.fillText('Tablet 1180 × 820 · offline composite',1312,30);b.drawImage(desktop,16,48);b.drawImage(tablet,1312,48);fs.writeFileSync(path.join(root,'proofs/01-hud-desktop-tablet.png'),board.toBuffer('image/png'));
 const states=createCanvas(1100,750),s=states.getContext('2d');s.fillStyle='#e9e1d1';s.fillRect(0,0,1100,750);s.font='22px sans-serif';s.fillStyle=colors.ink;s.fillText('목표 카드 3상태 · 같은 청지기 3표정',24,38);
 const labels=['normal / 기본','complete / 완료','warn / 주의'],expr=['neutral','concern','success'];
 for(let i=0;i<3;i++){let x=24+i*360;s.font='16px sans-serif';s.fillText(labels[i],x,83);s.drawImage(await loadImage(await renderFrame(name('frame_objective_'+['normal','complete','warn'][i]),332,150,.5)),x,100);s.fillText('문구는 코드로 배치',x+25,163);s.fillText(expr[i],x,304);s.save();s.beginPath();s.arc(x+166,422,85,0,Math.PI*2);s.clip();s.drawImage(im('advisor_steward_portrait_'+expr[i]),x+70,326,192,192);s.restore();s.drawImage(im('advisor_portrait_frame'),x+70,326,192,192);}
 s.font='15px sans-serif';s.fillText('아래: 조언자 본문은 가변 9-slice, 원형 틀은 고정 크기 별도 합성',24,568);for(let i=0;i<2;i++){let x=24+i*540;s.drawImage(await loadImage(await renderFrame(name('frame_advisor_'+['normal','warn'][i]),512,115,.5)),x,594);s.fillText(['normal','warn'][i],x+28,654);}fs.writeFileSync(path.join(root,'proofs/03-objective-advisor.png'),states.toBuffer('image/png'));
 fs.writeFileSync(path.join(root,'records/composite-layout.json'),JSON.stringify({source:'references/original-game-HUD.jpg',kind:'offline-composite-not-runtime',proof1:{width:2508,height:884,viewports:[{x:16,y:48,width:1280,height:800},{x:1312,y:48,width:1180,height:820}]},textLayer:'temporary canvas text, not in candidate assets'},null,2));
 console.log('proof01 and03 complete');
})();
