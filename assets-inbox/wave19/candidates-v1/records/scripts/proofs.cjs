const fs=require('fs'),path=require('path');const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const p=path.resolve(__dirname,'..'),exp=JSON.parse(fs.readFileSync(p+'/records/expected-assets.json'));const cache=new Map();
async function img(id){const f=exp.find(a=>a.id===id)?.file||id;if(!cache.has(f))cache.set(f,await loadImage(p+'/'+f));return cache.get(f);}
function base(w,h){const c=createCanvas(w,h),x=c.getContext('2d');x.fillStyle='#dfd2b0';x.fillRect(0,0,w,h);x.fillStyle='#3c2e23';return[c,x];}
function text(x,s,a,b,size=18){x.fillStyle='#3c2e23';x.font=`${size}px sans-serif`;x.fillText(s,a,b);}
async function draw(x,id,a,b,w,h=w){x.drawImage(await img(id),a,b,w,h);}
function save(c,n){fs.writeFileSync(p+'/proofs/'+n,c.toBuffer('image/png'));}
(async()=>{
let[c,x]=base(1280,800);text(x,'도시 연대기',48,45,28);text(x,'오프라인 합성 · 임시 글자 · 이름을 가린 가장자리 비교 포함',820,42,14);
await draw(x,'timeline_strip_base',128,76,1024,64);const kinds=['decision','event','era','milestone','person'];for(let i=0;i<5;i++){await draw(x,'timeline_marker_'+kinds[i],210+i*176,96,24);text(x,String(1300+i*4),204+i*176,163,16);}await draw(x,'timeline_pin_now',1100,80,32);await draw(x,'timeline_pin_select',565,43,24);
const cardkinds=['decision','event','era','milestone','person','ledger'],labels=['결정 기록','사건 기록','시대 기록','이정표','인물 기록','계절 결산'];const snippets=['새 창고를 짓기로 했다','긴 비가 이어졌다','목책 마을이 되었다','첫 방앗간이 완공되었다','새 장인이 정착했다','한 계절을 돌아본다'];
for(let i=0;i<6;i++){let a=56+(i%3)*376,b=195+Math.floor(i/3)*185;await draw(x,'frame_record_'+cardkinds[i],a,b,320,160);text(x,labels[i],a+90,b+55,21);text(x,snippets[i],a+90,b+89,14);text(x,'관련 기록 보기',a+90,b+121,13);}
text(x,'종류 이름을 가린 비교 · 가장자리만으로 분류',56,610,18);const shuffled=['person','event','ledger','milestone','decision','era'];for(let i=0;i<6;i++)await draw(x,'frame_record_'+shuffled[i],48+i*200,634,184,92);text(x,'원본 320×160 · 아래 비교는 동일 비율 축소',56,763,14);save(c,'01-chronicle-cards.png');
[c,x]=base(1280,1260);text(x,'계절 결산 · 세계 장면 세 칸',40,38,26);text(x,'오프라인 합성 / 아래 24px 전체 비교',820,36,16);
const scenarios=[['인구와 주거','scene_population_up','scene_household_arrival','scene_complete_house'],['식량 위기','scene_poor_harvest','scene_house_hungry','scene_bread_shortage'],['방어 공사','scene_timber_shortage','scene_construction_blocked','scene_complete_defense'],['겨울 뒤 회복','scene_winter_survived','scene_house_fed','scene_market_busy']];
for(let i=0;i<4;i++){const a=48+(i%2)*624,b=58+Math.floor(i/2)*398;await draw(x,'references/frame_season_ledger.png',a,b,512,384);for(let j=0;j<3;j++)await draw(x,scenarios[i][j+1],a+77+j*151,b+56,48);text(x,scenarios[i][0],a+45,b+159,25);text(x,'이 계절에 남은 세 장면',a+45,b+202,18);text(x,'그때 지도 · 관련 인물 · 자세한 기록',a+45,b+243,16);}
text(x,'24px 실제 크기 · 결산 장면 24개',48,890,21);
const snames=['인구 늘음','인구 줄음','가구 입주','가구 이탈','굶은 집','다시 먹음','빵 부족','비축 충분','목재 부족','석재 부족','주택 완공','시설 완공','방어 완공','공공 완공','공사 막힘','화재','흉년','대기근','청원','특허','장날 성황','장날 한산','겨울 넘김','보릿고개'];
const scenes=exp.filter(a=>a.group.startsWith('scenes'));for(let i=0;i<24;i++){let a=48+(i%6)*200,b=925+Math.floor(i/6)*72;await draw(x,scenes[i].id,a,b,24);text(x,snames[i],a+34,b+19,15);}save(c,'03-ledger-scenes.png');
fs.writeFileSync(p+'/records/proof-layout.json',JSON.stringify({status:'offline composite, not runtime',chronicle:{width:1280,height:800,cardNative:[320,160],hiddenNameOrder:shuffled,timelineMarkerPx:24},ledger:{width:1280,height:1260,examples:4,slots:3,exampleIconPx:48,comparisonIconPx:24,sceneOrder:scenes.map(a=>a.id)}},null,2));console.log('Proofs01/03 ready');})();
