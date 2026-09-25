const fs=require('fs'),path=require('path');
const{createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const R=path.resolve(__dirname,'..');
(async()=>{
 const names={ridge:'references/ridge_growing_a-v1.png',house:'references/house_l2-v2.png',mill:'references/mill-v2.png',cart:'references/cart_hand-v4.png',worker:'references/actor_civilian_man-v1.png',load:'assets/cart_load_grainsack_nw-v1.png',sheaves:'assets/pile/sheaves_2-v1.png',bread:'assets/pile/bread_2-v1.png',sacks:'assets/pile/sacks_2-v1.png',basket:'assets/work/work_breadbasket_sw-v1.png',smoke:'assets/fx/roof_smoke_sheet-v1.png',oven:'assets/fx/oven_smoke_sheet-v1.png'};
 const im={};for(const[k,p]of Object.entries(names))im[k]=await loadImage(path.join(R,p));
 // 12x12 ground: source tile128x64, building/actor references are already small runtime art.
 const scene=createCanvas(1536,768),c=scene.getContext('2d');c.fillStyle='#9b9f77';c.fillRect(0,0,1536,768);
 c.fillStyle='#b6a486';c.beginPath();c.moveTo(150,540);c.lineTo(1250,240);c.lineTo(1320,276);c.lineTo(220,576);c.closePath();c.fill();
 // Farm, stock, loaded cart, actual project post mill+oven, carrier, inhabited house.
 for(let i=0;i<5;i++)c.drawImage(im.ridge,0,0,512,64,100+i*16,390+i*33,410,51);
 c.drawImage(im.sheaves,490,552);c.drawImage(im.sacks,560,465);
 // Cart frame1 NW and load share template coordinates, with source-to-runtime factor2.
 c.drawImage(im.cart,80,0,80,128,620,330,160,256);
 c.drawImage(im.load,620+(29-48)*2,330+(68-48)*2,192,128);
 const millBox=[800,155,300,300];c.drawImage(im.mill,...millBox);
 // Oven mouth is right-hand masonry dome in project mill reference (not the windmill roof).
 const ovenAnchor=[millBox[0]+millBox[2]*.85,millBox[1]+millBox[3]*.75];
 c.drawImage(im.oven,0,0,64,96,ovenAnchor[0]-32,ovenAnchor[1]-92,64,96);
 c.drawImage(im.bread,1050,436);
 // SW walker frame2, first pose. Native cell74x72 is doubled to share128px worldtile.
 c.drawImage(im.worker,148,0,74,72,1090,405,148,144);
 c.drawImage(im.basket,1090+(29-13)*2,405+(35-5)*2,64,64);
 c.drawImage(im.house,1220,280,274,274);
 const roofAnchor=[1220+63*2,280+22*2];c.drawImage(im.smoke,0,0,48,80,roofAnchor[0]-24,roofAnchor[1]-76,48,80);
 const out=createCanvas(1350,1050),x=out.getContext('2d');x.fillStyle='#e6ddc8';x.fillRect(0,0,1350,1050);x.fillStyle='#302d26';x.font='24px sans-serif';x.fillText('밀 → 빵 → 집 · 독립 합성 확인 (실제 게임 실행 아님)',28,38);
 x.font='17px sans-serif';x.fillText('1.0줌: 새 소품 원본 ×0.5 · 작은 주택/워커 참조는 세계 비례에 맞춰 별도 배율',28,72);x.drawImage(scene,28,90,768,384);
 x.fillText('0.6줌: 같은 장면 ×0.3 · 확대하지 않은 실제 판독 크기',28,516);x.drawImage(scene,28,538,460.8,230.4);
 const steps=['수확 볏단','곡물 자루 수레','기둥풍차 + 빵 화덕','빵 바구니 배급','굴뚝 없는 지붕 연기'];
 x.font='18px sans-serif';steps.forEach((s,i)=>x.fillText((i+1)+'. '+s,835,120+i*38));
 x.font='16px sans-serif';x.fillText('합성은 원인·운반·가동의 시각 관계만 보여 줍니다. 상태·물류 연결은 아직 미설치입니다.',28,830);
 x.fillText('바구니 내부 빵과 세부 적재물은 작은 크기에서 약할 수 있으며 검수표에 별도 판정합니다.',28,862);
 x.fillText('새 레이어 엄격 원본×0.3: 볏단 / 자루 / 빵 더미 / 수레 적재물 / 손 바구니',28,924);
 ['sheaves','sacks','bread','load','basket'].forEach((k,i)=>x.drawImage(im[k],40+i*130,946,im[k].width*.3,im[k].height*.3));
 fs.writeFileSync(path.join(R,'proofs/01-wheat-bread-home-chain.png'),out.toBuffer('image/png'));
 fs.writeFileSync(path.join(__dirname,'chain-proof.json'),JSON.stringify({synthetic:true,sourceWorldTile:[128,64],sceneTiles:[12,12],zoom1:.5,zoom06:.3,references:names,houseReferenceScaleAtSource:2,cartReferenceScaleAtSource:2,workerReferenceScaleAtSource:2,loadScaleAtSource:2,otherNewPropsScaleAtSource:1,roofSmokeAnchor:roofAnchor,ovenSmokeAnchor:ovenAnchor,caveat:'Attached runtime carts/actors are normalized x2; cart loads and held props likewise x2 for attachment. Their strict original0.3 readability is checked separately in proofs02/04 and lane records.'},null,2));
})();
