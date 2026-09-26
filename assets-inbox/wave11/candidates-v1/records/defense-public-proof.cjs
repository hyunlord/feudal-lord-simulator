const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),refs=path.resolve('references/astra-wave11/astra-wave11-reference-files');
async function main(){
const face=await loadImage(path.join(refs,'stone_face_a-v2.png'));
const c=createCanvas(1200,1460),x=c.getContext('2d');x.fillStyle='#c0c3ae';x.fillRect(0,0,c.width,c.height);x.fillStyle='#2e3028';x.font='bold 24px sans-serif';x.fillText('03  석문 공사 · 기존 석벽 띠 사이의 3단계',32,38);x.font='15px sans-serif';x.fillText('오프라인 후보 합성 · 실제 설치 아님 · 원본 512×384 / 표시 0.9배',32,66);
for(let i=0;i<3;i++){const stage=['foundation','frame','roof'][i],y=180+i*400;x.save();x.translate(370,y);x.scale(.9,.9);
// Existing face strip is affine-projected along the same NW-SE wall axis, outside gate endpoints only.
x.save();x.transform(240/512,120/512,0,96/128,-214,-55);x.drawImage(face,0,0);x.restore();
x.save();x.transform(240/512,120/512,0,96/128,460,237);x.drawImage(face,0,0);x.restore();
x.drawImage(await loadImage(path.join(root,`assets/kit_defense/stage_${stage}_gate-v1.png`)),0,0);x.restore();x.fillStyle='#2e3028';x.font='bold 18px sans-serif';x.fillText(['기초: 두 교각 자리','골조: 목재 홍예틀 위의 미완성 아치','지붕틀: 완성 아치 위의 서까래'][i],32,y-50);}
fs.writeFileSync(path.join(root,'proofs/03-gate-stages.png'),c.toBuffer('image/png'));
const stages=['plot','foundation','frame','roof'],kinds=['gate','tower','church','keep'];const out=createCanvas(1400,1200),ctx=out.getContext('2d');ctx.fillStyle='#808d77';ctx.fillRect(0,0,1400,1200);const A=JSON.parse(fs.readFileSync(path.join(__dirname,'defense-public-anchors.json')));
for(let row=0;row<4;row++){const kind=kinds[row],family=row<2?'defense':'public',ref=await loadImage(path.join(refs,kind==='gate'||kind==='tower'?'stone_gate_v3_nwse-v1.png':`${kind}-v2.png`));for(let col=0;col<4;col++){const im=await loadImage(path.join(root,`assets/kit_${family}/stage_${stages[col]}_${kind}-v1.png`));const scale=row<2?.6:1;ctx.save();ctx.translate(col*350+12,row*280+40);ctx.scale(scale,scale);if(kind!=='tower'){ctx.globalAlpha=.28;ctx.drawImage(ref,0,0);ctx.globalAlpha=1;}ctx.drawImage(im,0,0);ctx.strokeStyle='#fff';ctx.lineWidth=1/scale;for(const p of A.targets[kind]){ctx.beginPath();ctx.moveTo(p[0]-4,p[1]);ctx.lineTo(p[0]+4,p[1]);ctx.moveTo(p[0],p[1]-4);ctx.lineTo(p[0],p[1]+4);ctx.stroke();}ctx.restore();ctx.fillStyle='#fff';ctx.font='16px sans-serif';ctx.fillText(`${kind} / ${stages[col]} · reference 28%`,col*350+12,row*280+22);}}
fs.writeFileSync(path.join(root,'records/defense-public-registration.png'),out.toBuffer('image/png'));
}
main();
