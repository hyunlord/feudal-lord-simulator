const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage,GlobalFonts}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const R=path.resolve(__dirname,'..'),expected=JSON.parse(fs.readFileSync(R+'/records/expected-assets.json'));
const ink='#453627',paper='#ded0a9',oak='#665138';
const images={};
function panel(g,x,y,w,h){g.fillStyle=paper;g.fillRect(x,y,w,h);g.strokeStyle=oak;g.lineWidth=2;g.strokeRect(x+1,y+1,w-2,h-2);}
function icon(g,id,x,y,size){const im=images[id];if(!im)throw Error(id);g.drawImage(im,0,0,Math.min(im.width,96),im.height,x,y,size,size);}
function label(g,t,x,y,size=14){g.fillStyle=ink;g.font=`${size}px sans-serif`;g.fillText(t,x,y);}
async function main(){
 for(const a of expected)images[a.id]=await loadImage(R+'/'+a.file);
 const original=await loadImage(R+'/references/현재_첫화면.jpg'),edited=await loadImage(R+'/raw/proofs/backdrop-ui-removal.png');
 const bg=createCanvas(896,560),b=bg.getContext('2d');b.drawImage(edited,0,0,896,560);
 const rects=[];
 for(const [x,y,w,h]of rects){b.save();b.beginPath();b.rect(x,y,w,h);b.clip();b.drawImage(edited,0,0,896,560);b.restore();}
 fs.writeFileSync(R+'/records/proof-backdrop.png',bg.toBuffer('image/png'));
 // Overview: native UI sizes, no upscaling disguised as a small-size check.
 const c=createCanvas(1600,1460),g=c.getContext('2d');g.fillStyle='#cbc2ad';g.fillRect(0,0,c.width,c.height);label(g,'WAVE 18 · 24 / 32 / 48 px · candidate',24,30,22);
 for(let i=0;i<expected.length;i++){const a=expected[i],x=20+i%5*316,y=50+Math.floor(i/5)*132;panel(g,x,y,300,122);label(g,a.id,x+10,y+21,13);const sizes=[24,32,48];for(let j=0;j<3;j++){const s=sizes[j],px=x+30+j*85,py=y+40;if(a.group==='patterns')g.drawImage(images[a.id],px,py,s,s*a.height/a.width);else icon(g,a.id,px,py,s);label(g,String(s),px,y+108,11);}}
 label(g,'P0 reference motifs · direct / direction / rights / labour / chronicle / resources',24,1270,18);
 const specs=[['icon_layer_mode_sheet.png',0],['icon_layer_mode_sheet.png',2],['icon_cause_family_sheet.png',6],['icon_cause_family_sheet.png',3],['icon_objective_action_sheet.png',2],['icon_resource_sheet.png',0],['icon_resource_sheet.png',1],['icon_resource_sheet.png',4]];
 for(let i=0;i<specs.length;i++){const [file,cell]=specs[i],im=await loadImage(R+'/references/'+file),x=26+i*194;panel(g,x,1284,178,130);for(let j=0;j<3;j++){const s=[24,32,48][j];g.drawImage(im,cell*96,0,96,96,x+10+j*52,1306,s,s);}}
 fs.writeFileSync(R+'/proofs/01-icons-scale-comparison.png',c.toBuffer('image/png'));
 // Two exact-size offline viewports in one atlas.
 const layer=await loadImage(R+'/references/icon_layer_mode_sheet.png');
 const layout=[];
 function hud(w,h){const cc=createCanvas(w,h),gg=cc.getContext('2d');gg.drawImage(bg,0,0,w,h);let x=12;const pillW=[128,104,146,112],texts=['1300년 봄','인구 12','식량 14일','재정 0'],ids=['pill_season_spring','pill_population','pill_food_days','pill_money'];const boxes=[];for(let i=0;i<4;i++){panel(gg,x,12,pillW[i],48);icon(gg,ids[i],x+7,20,32);label(gg,texts[i],x+44,41,15);boxes.push([x,12,pillW[i],48]);x+=pillW[i]+6;}
 for(let i=0;i<3;i++){const sx=w-166+i*50;panel(gg,sx,12,48,48);gg.fillStyle=ink;if(i===0){gg.fillRect(sx+15,26,6,19);gg.fillRect(sx+27,26,6,19);}else{for(let k=0;k<i;k++){gg.beginPath();gg.moveTo(sx+12+k*13,25);gg.lineTo(sx+12+k*13,46);gg.lineTo(sx+24+k*13,35.5);gg.fill();}}boxes.push([sx,12,48,48]);}
 panel(gg,12,70,194,48);label(gg,'집 가까이에 우물 설치     ›',24,100,14);boxes.push([12,70,194,48]);
 const ly=h-60;for(let i=0;i<3;i++){const xx=12+i*108;panel(gg,xx,ly,102,48);gg.drawImage(layer,i*96,0,96,96,xx+5,ly+7,34,34);label(gg,['직접','구역','방향'][i],xx+42,ly+30,14);if(i>0)icon(gg,'layer_lock_badge',xx+80,ly+6,16);boxes.push([xx,ly,102,48]);}
 for(let i=0;i<3;i++){const dx=w-168+i*52;panel(gg,dx,ly,48,48);icon(gg,['dock_build','dock_ledger','dock_steward'][i],dx+4,ly+4,40);boxes.push([dx,ly,48,48]);}
 layout.push({viewport:[w,h],syntheticDisplayedValues:true,rectangles:boxes,rectangleCoveragePercent:boxes.reduce((s,r)=>s+r[2]*r[3],0)/(w*h)*100,note:'Offline drawn rectangles only; not runtime HUD coverage gate.'});return cc;}
 const pc=hud(1280,800),tablet=hud(1180,820),atlas=createCanvas(1280,1668),ag=atlas.getContext('2d');ag.fillStyle='#cbc2ad';ag.fillRect(0,0,1280,1668);label(ag,'PC 1280×800 · offline HUD mockup',12,18,14);ag.drawImage(pc,0,24);label(ag,'TABLET 1180×820 · 48px touch targets · offline',12,840,14);ag.drawImage(tablet,50,848);fs.writeFileSync(R+'/proofs/02-minimal-hud-pc-tablet.png',atlas.toBuffer('image/png'));
 // Placement: equal fill luminance so the grayscale distinction must come from pattern and glyph.
 const p=createCanvas(1280,700),pg=p.getContext('2d');pg.drawImage(bg,0,0,1280,800);const hut=await loadImage(R+'/references/project-house-l0.png');
 const testCells=[];function diamond(cx,cy,w,h,fill,pattern,reason){pg.save();pg.beginPath();pg.moveTo(cx,cy-h/2);pg.lineTo(cx+w/2,cy);pg.lineTo(cx,cy+h/2);pg.lineTo(cx-w/2,cy);pg.closePath();pg.fillStyle=fill;pg.fill();pg.strokeStyle='#ede2c3';pg.lineWidth=2;pg.stroke();pg.clip();pg.drawImage(images[pattern],cx-w/2,cy-h/2,w,h);pg.restore();if(reason)icon(pg,reason,cx-12,cy-12,24);testCells.push({center:[cx,cy],size:[w,h],pattern,reason});}
 const cellW=96,cellH=48,baseX=610,baseY=416;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){let cx=baseX+(i-j)*48,cy=baseY+(i+j)*24;const blocked=(i===1&&j===0)||(i===1&&j===1)||(i===0&&j===-1);const reason=i===1&&j===1?'reason_no_road':i===1?'reason_tree':'reason_water';diamond(cx,cy,cellW,cellH,blocked?'rgba(166,117,80,0.73)':'rgba(98,150,114,0.73)',blocked?(i===1&&j===1?'pattern_blocked_cross':'pattern_blocked_hatch'):'pattern_ok',blocked?reason:null);}
 pg.globalAlpha=.42;pg.drawImage(hut,baseX-60,baseY-116,120,120);pg.globalAlpha=1;
 panel(pg,760,335,320,110);label(pg,'오두막 · 목재 6',776,364,18);label(pg,'보유 11 · 배치 후 5',776,392,16);icon(pg,'reason_tree',776,405,24);label(pg,'나무 — 먼저 벌목',807,425,16);
 panel(pg,1080,594,56,56);icon(pg,'confirm_check_touch',1084,598,48);panel(pg,1148,594,56,56);icon(pg,'cancel_touch',1152,598,48);
 // Larger side-by-side pattern swatches stay inside this proof, not extra delivery files.
 diamond(180,560,192,96,'rgba(98,150,114,0.80)','pattern_ok',null);diamond(415,560,192,96,'rgba(166,117,80,0.80)','pattern_blocked_hatch','reason_tree');label(pg,'가능 · 점 격자',115,640,18);label(pg,'불가 · 사선 + 이유',333,640,18);
 const pb=p.toBuffer('image/png'),gray=await sharp(pb).grayscale().png().toBuffer(),grayIm=await loadImage(gray),pa=createCanvas(1280,1448),paG=pa.getContext('2d');paG.fillStyle='#cbc2ad';paG.fillRect(0,0,1280,1448);label(paG,'COLOUR · placement fixture, not a live game state',12,18,14);paG.drawImage(p,0,24);label(paG,'GRAYSCALE · same pixels; dots versus diagonal strokes + reason glyph',12,742,14);paG.drawImage(grayIm,0,748);fs.writeFileSync(R+'/proofs/03-placement-colour-grayscale.png',pa.toBuffer('image/png'));
 fs.writeFileSync(R+'/records/proof-layout.json',JSON.stringify({hud:layout,backdrop:{source:'references/현재_첫화면.jpg',edit:'raw/proofs/backdrop-ui-removal.png',replacementRectangles:rects,visiblePixelsOutsideRectanglesPreserved:false,notes:"Full source-screenshot edit, not a pixel-identical or live-game backdrop; partial patch method rejected for visible seams"},placement:{synthetic:true,screen: [1280,700],testCells,ghost:'references/project-house-l0.png',grayscale:'sharp.grayscale same colour proof, no redesign'},proofs:3},null,2));console.log('3 proof atlases rendered',layout.map(l=>l.rectangleCoveragePercent));
}
main().catch(e=>{console.error(e);process.exitCode=1});
