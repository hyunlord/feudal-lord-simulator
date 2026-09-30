const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const asset=(g,id)=>path.join(root,'assets',g,id+'.png');
async function slice(file,w,h,m){const meta=await sharp(file).metadata();const [l,t,r,b]=m,x=[0,l,meta.width-r,meta.width],y=[0,t,meta.height-b,meta.height],dx=[0,l,w-r,w],dy=[0,t,h-b,h],parts=[];
for(let j=0;j<3;j++)for(let i=0;i<3;i++)parts.push({input:await sharp(file).extract({left:x[i],top:y[j],width:x[i+1]-x[i],height:y[j+1]-y[j]}).resize(dx[i+1]-dx[i],dy[j+1]-dy[j],{fit:'fill'}).png().toBuffer(),left:dx[i],top:dy[j]});
return sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite(parts).png().toBuffer();}
async function main(){const layers=[];const add=async(g,id,x,y,w,h,m)=>layers.push({input:m?await slice(asset(g,id),w,h,m):await sharp(asset(g,id)).resize(w,h,{fit:'fill'}).toBuffer(),left:x,top:y});
await add('B_negotiation','treaty_frame',40,35,1200,730,[128,160,128,112]);
await add('B_negotiation','treaty_divider',632,180,16,355);
const rowNames=['clause_row','clause_row_changed','clause_row_rejected'];
for(let c=0;c<2;c++)for(let r=0;r<3;r++)await add('B_negotiation',rowNames[(r+c)%3],175+c*485,210+r*88,445,70,[48,18,48,18]);
for(let i=0;i<5;i++)await add('B_negotiation',i===3?'reason_chip_minus':'reason_chip_plus',175+i*188,510,176,48,[44,14,24,14]);
await add('B_negotiation','acceptance_scale',320,574,640,128);
await add('B_negotiation','seal_stamped',65,656,80,80);
await add('B_negotiation','seal_empty',1135,656,80,80);
const lines=[['영지 협상 · 역제안',640,115,26],['그들이 얻는 것',390,185,21],['내가 얻는 것',880,185,21],['통행 수입의 일부',390,253,18],['혼인 약속 · 변경',390,341,18],['추가 징수 · 거절',390,429,18],['방앗간 사용권 · 변경',880,253,18],['병역 부담 · 거절',880,341,18],['장터 보호 약속',880,429,18],['신뢰',263,540,16],['혼인 관계',451,540,16],['공동 이익',639,540,16],['부담 증가',827,540,16],['증인 동의',1015,540,16]];
const svg='<svg width="1280" height="800" xmlns="http://www.w3.org/2000/svg"><g fill="#392d20" font-family="Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" text-anchor="middle">'+lines.map(([s,x,y,f])=>'<text x="'+x+'" y="'+y+'" font-size="'+f+'">'+s+'</text>').join('')+'</g></svg>';
layers.push({input:Buffer.from(svg),left:0,top:0});await sharp({create:{width:1280,height:800,channels:3,background:'#353a30'}}).composite(layers).jpeg({quality:90}).toFile(path.join(root,'proofs/01-treaty-1280x800.jpg'));}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});module.exports={slice};
