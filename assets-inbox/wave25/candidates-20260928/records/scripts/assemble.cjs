const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),A=path.join(root,'assets'),R=path.join(root,'records');
const native='/Users/rexxa/Library/Application Support/orca/codex-accounts/54be5844-95fd-4c46-925c-75327ccd186a/home/generated_images/01a0bfce-1c2e-7111-9a4a-0cbb7435d757/';
(async()=>{
fs.copyFileSync(native+'exec-e3bf779a-b63c-4590-b3de-01f86475782a.png',R+'/line-native.png');fs.copyFileSync(native+'exec-7a751139-2a97-495e-81d8-8f484c1b3a98.png',R+'/marriage-native.png');
const src=await sharp(R+'/line-native.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
let ys=[];for(let y=0;y<src.info.height;y++){let sum=0;for(let x=Math.floor(src.info.width*.25);x<src.info.width*.75;x++)sum+=src.data[(y*src.info.width+x)*4+3];ys.push(sum)}
let peak=ys.indexOf(Math.max(...ys)),lo=peak,hi=peak;while(lo>0&&ys[lo]>Math.max(...ys)*.02)lo--;while(hi<ys.length-1&&ys[hi]>Math.max(...ys)*.02)hi++;
const line=await sharp(R+'/line-native.png').extract({left:Math.floor(src.info.width*.25),top:lo,width:Math.floor(src.info.width*.5),height:hi-lo+1}).resize(64,6,{fit:'fill'}).extend({top:1,bottom:1,left:0,right:0,background:'#00000000'}).ensureAlpha().raw().toBuffer();
// Every port uses one common ink cross-section; orientation derives from this generated source.
const profile=Array.from({length:8},(_,y)=>Array.from(line.subarray((y*64+32)*4,(y*64+32)*4+4)));
for(let i=0;i<4;i++){const q=profile[i].map((v,k)=>Math.round((v+profile[7-i][k])/2));profile[i]=q;profile[7-i]=q;}
for(let y=0;y<8;y++)for(let x=0;x<64;x++)for(let k=0;k<4;k++)line[(y*64+x)*4+k]=profile[y][k];
await sharp(line,{raw:{width:64,height:8,channels:4}}).png().toFile(A+'/tree_line_h.png');await sharp(A+'/tree_line_h.png').rotate(90).flop().png().toFile(A+'/tree_line_v.png');
const shapes={tl:['r','b'],tr:['l','b'],bl:['r','t'],br:['l','t'],junction_t:['l','r','b']};
for(const [id,dirs]of Object.entries(shapes)){let buf=Buffer.alloc(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const ds=dirs.map(d=>{const ax=7.5,ay=7.5,bx=d==='l'?0:d==='r'?15:7.5,by=d==='t'?0:d==='b'?15:7.5;let t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay));});const dist=Math.min(...ds),p=dist<=3.5?profile[Math.round(3.5+dist)]:[0,0,0,0];for(let k=0;k<4;k++)buf[(y*16+x)*4+k]=p[k]}
await sharp(buf,{raw:{width:16,height:16,channels:4}}).png().toFile(A+'/tree_line_'+(id==='junction_t'?id:'corner_'+id)+'.png')}
const marriage=await sharp(R+'/marriage-native.png').trim().resize(48,16,{fit:'contain',background:'#00000000'}).png().toBuffer();await sharp(marriage).png().toFile(A+'/tree_marriage_link.png');
fs.writeFileSync(R+'/lines.json',JSON.stringify({source:'line-native.png',method:'Generated ink cross-section normalized to shared 8px ports; horizontal/vertical/corners/T are deterministic technical connector derivatives, not separate generations.',profile,marriage:'Generated two rings; alpha crop and exact target normalization',status:'candidate'},null,2));
const C=createCanvas(1280,800),ctx=C.getContext('2d');ctx.fillStyle='#e5d7b6';ctx.fillRect(0,0,1280,800);
const imgs={};for(const f of fs.readdirSync(A))if(f.endsWith('.png'))imgs[f.slice(0,-4)]=await loadImage(A+'/'+f);
function nine(id,x,y,w,h,l=12,t=12,r=12,b=12){let im=imgs[id],sx=[0,l,im.width-r,im.width],sy=[0,t,im.height-b,im.height],dx=[x,x+l,x+w-r,x+w],dy=[y,y+t,y+h-b,y+h];for(let j=0;j<3;j++)for(let i=0;i<3;i++)ctx.drawImage(im,sx[i],sy[j],sx[i+1]-sx[i],sy[j+1]-sy[j],dx[i],dy[j],dx[i+1]-dx[i],dy[j+1]-dy[j]);}
function h(x1,x2,y){for(let x=x1;x<x2;x+=64)ctx.drawImage(imgs.tree_line_h,0,0,Math.min(64,x2-x),8,x,y-4,Math.min(64,x2-x),8)}function v(x,y1,y2){for(let y=y1;y<y2;y+=64)ctx.drawImage(imgs.tree_line_v,0,0,8,Math.min(64,y2-y),x-4,y,8,Math.min(64,y2-y))}
function label(text,x,y){ctx.font='14px sans-serif';ctx.fillStyle='#493a2b';ctx.textAlign='center';ctx.fillText(text,x,y)}
nine('tree_lineage_banner',480,10,320,72,24,10,24,10);label('L3 · 영주 가문',656,48);
// Parent branches join only the four children. Marriage branches connect outside spouses separately.
v(640,190,294);h(140,1140,294);for(const x of[140,540,740,1140])v(x,294,330);
h(548,732,190);ctx.drawImage(imgs.tree_marriage_link,616,182);
v(140,510,524);v(340,510,524);h(140,340,524);ctx.drawImage(imgs.tree_marriage_link,216,516);v(240,524,550);h(140,340,550);v(140,550,590);v(340,550,590);
v(940,510,524);v(1140,510,524);h(940,1140,524);ctx.drawImage(imgs.tree_marriage_link,1016,516);v(1040,524,550);h(940,1140,550);v(940,550,590);v(1140,550,590);
function join(id,x,y,up=false){ctx.fillStyle='#e5d7b6';ctx.fillRect(x-8,y-8,16,16);ctx.save();ctx.translate(x,y);if(up)ctx.scale(1,-1);ctx.drawImage(imgs[id],-8,-8);ctx.restore()}
for(const [x,y,id,up]of[[140,294,'corner_tl'],[1140,294,'corner_tr'],[540,294,'junction_t'],[740,294,'junction_t'],[640,294,'junction_t',true],[140,550,'corner_tl'],[340,550,'corner_tr'],[240,550,'junction_t',true],[940,550,'corner_tl'],[1140,550,'corner_tr'],[1040,550,'junction_t',true],[140,524,'corner_bl'],[340,524,'corner_br'],[940,524,'corner_bl'],[1140,524,'corner_br']])join('tree_line_'+id,x,y,up);
const portraits=await loadImage(root+'/references/혈통초상_예.jpg'),family=await loadImage(root+'/references/혈통_가계도_구성예.jpg');
function node(id,x,y,idx,state='',outside=false){nine('tree_node_frame'+state,x,y,176,180,...(state==='_deceased'?[20,20,20,20]:[12,12,12,12]));ctx.save();ctx.beginPath();ctx.arc(x+88,y+66,48,0,Math.PI*2);ctx.clip();if(idx>=0)ctx.drawImage(portraits,20+idx*164,78,144,144,x+40,y+18,96,96);else ctx.drawImage(family,idx===-1?293:1128,242,65,65,x+40,y+18,96,96);ctx.restore();label(id,x+88,y+138);label(outside?'바깥 배우자':state==='_deceased'?'고인':state==='_selected'?'선택됨':'영주 가문',x+88,y+159);if(outside)ctx.drawImage(imgs.tree_outside_spouse_marker,x+142,y+12);}
node('L3_101',372,92,0,'_deceased');node('L3_102',732,92,1);
node('L3_201',52,330,2,'_selected');node('L3_205',252,330,-1,'',true);node('L3_202',452,330,3);node('L3_204',652,330,5);node('L3_206',852,330,-2,'',true);node('L3_203',1052,330,4);
node('L3_301',52,590,6);node('L3_302',252,590,7);node('L3_303',852,590,8);node('L3_304',1052,590,9);
v(540,510,518);ctx.drawImage(imgs.tree_expand,524,514);label('가지 접힘',540,566);ctx.drawImage(imgs.tree_collapse,624,278);
for(const[y,n]of[[96,'창시 부부'],[336,'자녀 · 배우자'],[596,'손자녀']]){nine('tree_generation_label',4,y-34,120,32,10,8,10,8);label(n,64,y-13)}
fs.writeFileSync(root+'/proofs/01-lineage-1280x800.png',C.toBuffer('image/png'));
console.log('assembled',fs.readdirSync(A).length);
})();
