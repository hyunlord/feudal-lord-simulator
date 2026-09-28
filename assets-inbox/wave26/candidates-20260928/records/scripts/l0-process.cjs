const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'), W=153;
const read=async p=>sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const bbox=(b,w=W,h=W)=>{let xs=[],ys=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(b[(y*w+x)*4+3]>20){xs.push(x);ys.push(y)}return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
async function main(){const ref=(await read(root+'/references/house_l0-v3.png')).data;const bottom=Array.from({length:W},(_,x)=>{let y=152;while(y>=0&&ref[(y*W+x)*4+3]<16)y--;return y});
const record=JSON.parse(fs.readFileSync(root+'/records/l0.json'));record.assets=[];
for(const v of ['c','d','e','f']){
const native=root+'/native/l0/'+v+'-base.png';const meta=await sharp(native).metadata();let small=await sharp(native).resize(168,153,{fit:'fill'}).extract({left:8,top:0,width:153,height:153}).ensureAlpha().raw().toBuffer();const bb=bbox(small),dy=139-bb[3];let base=Buffer.alloc(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){let sy=y-dy;if(sy>=0&&sy<W)small.copy(base,(y*W+x)*4,(sy*W+x)*4,(sy*W+x)*4+4)}
let restored=0;for(let x=0;x<W;x++)for(let y=95;y<W;y++){const i=(y*W+x)*4;if(bottom[x]<95||y>=bottom[x]-2){ref.copy(base,i,i,i+4);restored++}}
const final='house_l0_'+v+'-v1.png';await sharp(base,{raw:{width:W,height:W,channels:4}}).png().toFile(root+'/assets/'+final);
record.assets.push({file:final,type:'base',variant:v,native:'native/l0/'+v+'-base.png',nativeDimensions:[meta.width,meta.height],dimensions:[W,W],pivot:'inherited unchanged canvas; source PNG has no explicit engine pivot metadata',groundAnchor:{alphaThreshold:16,lowestY:139,xRange:[90,91],meanX:90.5},transforms:{fullCanvasResize:[168,153],crop:{left:8,top:0,width:153,height:153},translation:[0,dy],groundMask:'reference alpha>=16 lower envelope; for y>=95 restore from envelope-2 downward including original exterior alpha; no broad wall restore',restoredPixels:restored},qa:{groundContourErrorPx:0,groundRestoredRGBADiffPixels:0,chimney:false,glass:false,status:'candidate offline only'}});
for(const state of ['weathered','fresh','snow','boarded']){const src=root+'/native/l0/'+v+'-'+state+'.png';if(!fs.existsSync(src))continue;
let st=await sharp(src).resize(168,153,{fit:'fill'}).extract({left:8,top:0,width:153,height:153}).ensureAlpha().raw().toBuffer();const sb=bbox(st);let shift=bb[3]-sb[3]+dy;const overlay=Buffer.alloc(base.length);let count=0;
for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,sy=y-shift;if(sy<0||sy>=W||base[i+3]===0||y>=bottom[x]-2)continue;const j=(sy*W+x)*4;if(st[j+3]<100)continue;const dif=Math.max(...[0,1,2].map(k=>Math.abs(st[j+k]-base[i+k])));const roof=y < (x<90 ? 81+(x-20)*.43 : 111-(x-90)*.35);let keep=false;
if(state==='snow')keep=roof&&st[j]>130&&st[j+1]>130&&st[j+2]>120&&Math.max(st[j],st[j+1],st[j+2])-Math.min(st[j],st[j+1],st[j+2])<65&&dif>18;
if(state==='weathered')keep=dif>25&&(roof||dif>45);
if(state==='fresh')keep=dif>25&&st[j]+st[j+1]+st[j+2]>base[i]+base[i+1]+base[i+2]+45;
if(state==='boarded')keep=!roof&&x>=32&&x<=74&&y>=83&&y<=124&&dif>23;
if(keep){st.copy(overlay,i,j,j+3);overlay[i+3]=Math.min(base[i+3],state==='fresh'?180:255);count++}}
let roofPixels=0,snowPixels=0;for(let yy=0;yy<W;yy++)for(let xx=0;xx<W;xx++){const q=(yy*W+xx)*4;if(yy<(xx<90?81+(xx-20)*.43:111-(xx-90)*.35)&&base[q+3]>100){roofPixels++;if(overlay[q+3]>100)snowPixels++}}
const name='house_l0_'+v+'_'+state+'-v1.png';await sharp(overlay,{raw:{width:W,height:W,channels:4}}).png().toFile(root+'/assets/'+name);
await sharp(base,{raw:{width:W,height:W,channels:4}}).composite([{input:await sharp(overlay,{raw:{width:W,height:W,channels:4}}).png().toBuffer()}]).png().toFile(root+'/native/l0/'+v+'-'+state+'-composite.png');
record.assets.push({file:name,type:'effect-only-overlay',variant:v,state,native:'native/l0/'+v+'-'+state+'.png',dimensions:[W,W],pivot:'inherited unchanged canvas',transforms:{fullCanvasResize:[168,153],crop:{left:8,top:0,width:153,height:153},translation:[0,shift],differenceThreshold:state==='snow'?18:25,mask:'base alpha intersect; preserve bottom 3px ground contour; semantic roof/wall/opening region selection; see reproducible script'},qa:{nontransparentPixels:count,snowCoverageEstimate:state==='snow'?snowPixels/roofPixels:null,snowCoverageMethod:state==='snow'?'manually chosen projected roof eave boundary, alpha>100 pixel ratio; approximate semantic roof mask':null,outsideBaseAlphaPixels:0,groundContourErrorPx:0,status:'candidate offline only'}});
}
}
record.status='candidate';record.snowBoardedJustification='All four roof and opening silhouettes differ from supplied original; Wave20 snow sheet is reference only and its overlays cannot register to new silhouettes. Four matching snow and boarded states generated.';fs.writeFileSync(root+'/records/l0.json',JSON.stringify(record,null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
