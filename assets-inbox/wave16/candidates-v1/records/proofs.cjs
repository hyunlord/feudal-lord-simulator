const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),expected=JSON.parse(fs.readFileSync(__dirname+'/expected-assets.json'));
function panel(g,im,x,y,w,h,p){const xs=[0,p,im.width-p,im.width],ys=[0,p,im.height-p,im.height],dx=[x,x+p,x+w-p,x+w],dy=[y,y+p,y+h-p,y+h];for(let j=0;j<3;j++)for(let i=0;i<3;i++)g.drawImage(im,xs[i],ys[j],xs[i+1]-xs[i],ys[j+1]-ys[j],dx[i],dy[j],dx[i+1]-dx[i],dy[j+1]-dy[j]);}
function board(w,h){const c=createCanvas(w,h),g=c.getContext('2d');g.fillStyle='#a59c88';g.fillRect(0,0,w,h);return[c,g]}
async function main(){
 fs.mkdirSync(root+'/proofs',{recursive:true});
 const objective=await loadImage(root+'/references/frame_objective_normal.png'),modal=await loadImage(root+'/references/frame_modal.png'),page=await loadImage(root+'/references/frame_chronicle_page.png');
 const [a,ga]=board(1632,1368),events=expected.filter(a=>a.group==='events');
 for(let i=0;i<events.length;i++){const x=24+i%3*536,y=24+Math.floor(i/3)*336;panel(ga,objective,x,y,512,312,12);ga.drawImage(await loadImage(root+'/'+events[i].file),x+16,y+18,480,270);}
 fs.writeFileSync(root+'/proofs/01-event-cards.png',a.toBuffer('image/png'));
 const [b,gb]=board(1416,888),decisions=expected.filter(a=>a.group==='decisions');
 for(let i=0;i<decisions.length;i++){const col=i<3?i:i-3,x=24+col*464+(i>=3?232:0),y=24+(i>=3?432:0);panel(gb,modal,x,y,432,408,18);gb.drawImage(await loadImage(root+'/'+decisions[i].file),x+16,y+20,400,300);}
 fs.writeFileSync(root+'/proofs/02-decision-modals.png',b.toBuffer('image/png'));
 const [c,gc]=board(1096,1352),chronicle=expected.filter(a=>a.group==='chronicle');
 for(let j=0;j<4;j++){const px=24+j%2*536,py=24+Math.floor(j/2)*664;gc.drawImage(page,px,py,512,640);for(let k=0;k<4;k++)gc.drawImage(await loadImage(root+'/'+chronicle[j*4+k].file),px+38+(k%2)*234,py+105+Math.floor(k/2)*246,216,216);}
 fs.writeFileSync(root+'/proofs/03-chronicle-pages.png',c.toBuffer('image/png'));
 fs.writeFileSync(root+'/records/proof-layout.json',JSON.stringify({captions:'none: scene-readability review without labels or numbers',events:{file:'proofs/01-event-cards.png',order:events.map(a=>a.id),layout:'3columns4rows',displayImage:[480,270],frame:'references/frame_objective_normal.png'},decisions:{file:'proofs/02-decision-modals.png',order:decisions.map(a=>a.id),layout:'3top2bottom',displayImage:[400,300],blankChoiceArea:true,frame:'references/frame_modal.png'},chronicle:{file:'proofs/03-chronicle-pages.png',order:chronicle.map(a=>a.id),layout:'4pages in2x2; eachpage4images in2x2',displayImage:[216,216],frame:'references/frame_chronicle_page.png'}},null,2));
 console.log('3 uncaptioned framed proof sheets rendered');
}
main().catch(e=>{console.error(e);process.exitCode=1});
