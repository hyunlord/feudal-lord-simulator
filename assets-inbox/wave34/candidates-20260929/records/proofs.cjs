const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const W='/tmp/astra-wave34-work-20260929',O='/tmp/astra-wave34-candidates-20260929',R=W+'/astra-wave34-reference-files',P='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/public/assets',A='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/assets-inbox/wave22/rework-20260927/assets';
const inputs=[],imgs={};async function img(p){if(!imgs[p]){imgs[p]=await loadImage(p);const bytes=fs.readFileSync(p),hash=crypto.createHash('sha256').update(bytes).digest('hex');const packaged='records/proof-inputs/'+hash.slice(0,8)+'-'+path.basename(p);fs.mkdirSync(O+'/records/proof-inputs',{recursive:true});if(!p.startsWith(O+'/'))fs.copyFileSync(p,O+'/'+packaged);inputs.push({path:p,sha256:hash,packaged:p.startsWith(O+'/')?path.relative(O,p):packaged});}return imgs[p]}
function component(im,bounds){const tmp=can(im.width,im.height),cx=tmp.getContext('2d');cx.drawImage(im,0,0);const d=cx.getImageData(0,0,im.width,im.height),seen=new Uint8Array(im.width*im.height);let best=[];for(let y=bounds[1];y<bounds[1]+bounds[3];y++)for(let x=bounds[0];x<bounds[0]+bounds[2];x++){let k=y*im.width+x;if(seen[k]||!d.data[k*4+3])continue;let q=[k],pts=[];seen[k]=1;while(q.length){let a=q.pop(),xx=a%im.width,yy=Math.floor(a/im.width);pts.push(a);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xxx=xx+dx,yyy=yy+dy,b=yyy*im.width+xxx;if(xxx<0||xxx>=im.width||yyy<0||yyy>=im.height||seen[b]||!d.data[b*4+3])continue;seen[b]=1;q.push(b)}}const inside=pts.filter(k=>{const x=k%im.width,y=Math.floor(k/im.width);return x>=bounds[0]&&x<bounds[0]+bounds[2]&&y>=bounds[1]&&y<bounds[1]+bounds[3]}).length;if(inside/pts.length>.9&&pts.length>best.length)best=pts}const out=can(bounds[2],bounds[3]),oc=out.getContext('2d'),od=oc.createImageData(bounds[2],bounds[3]);for(const k of best){let x=k%im.width-bounds[0],y=Math.floor(k/im.width)-bounds[1];if(x<0||x>=bounds[2]||y<0||y>=bounds[3])continue;for(let c=0;c<4;c++)od.data[(y*bounds[2]+x)*4+c]=d.data[k*4+c]}oc.putImageData(od,0,0);return out}function can(w,h){return createCanvas(w,h)}function text(c,s,x,y,size=17){c.fillStyle='#343c35';c.font=`${size}px sans-serif`;c.fillText(s,x,y)}
function proj(u,v){return[(u+v)*64,(v-u)*32]};function poly(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath()}
async function ground(c,texture,pts){c.save();poly(c,pts);c.clip();c.transform(1,-.5,1,.5,0,0);const im=await img(texture),pa=c.createPattern(im,'repeat');c.fillStyle=pa;c.fillRect(-2048,-2048,4096,4096);c.restore()}
function piece(c,im,u,v,scale=1){const [x,y]=proj(u,v);c.drawImage(im,x-im.width*scale/2,y-im.height*scale/2,im.width*scale,im.height*scale)}
function labelSheet(w,h,title,sub){let a=can(w,h),c=a.getContext('2d');c.fillStyle='#e9e7dc';c.fillRect(0,0,w,h);text(c,title,24,35,24);text(c,sub,24,61,14);return[a,c]}
function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}function riverCenter(v){return .35*Math.sin(v*.6)}function boundaryWidth(v){return 2+smooth(2,3.8,v)+smooth(6.8,8.2,v)}
async function proofRiver(){
 const scene=can(1680,1080),c=scene.getContext('2d');c.translate(470,350);
 await ground(c,P+'/terrain/grass.png',[proj(-4,-2),proj(5,-2),proj(5,13),proj(-4,13)]);
 const river=[];for(let v=-2;v<=13;v+=.25)river.push(proj(riverCenter(v)-boundaryWidth(v)/2,v));for(let v=13;v>=-2;v-=.25)river.push(proj(riverCenter(v)+boundaryWidth(v)/2,v));
 await ground(c,P+'/water/deep_a-v1.png',river);
 const ff=['ford/ford_w2_ne_summer-v1.png','ford/ford_w3_ne_summer-v1.png','ford/ford_w4_ne_summer-v1.png'];const placements=[];
 for(let k=0;k<3;k++){const v=[.5,4.5,9][k],f=await img(O+'/'+ff[k]);piece(c,f,riverCenter(v),v);placements.push({asset:ff[k],worldUV:[riverCenter(v),v],widthTiles:k+2,pivot:[256,128],screenScale:.5});}
 const atlas=await img(R+'/bridge_wood_ne_sw-v2.png'),bridge=can(180,115),bc=bridge.getContext('2d');
 // Middle atlas column: back rail, deck, front rail cropped independently.
 bc.drawImage(component(atlas,[205,93,122,78]),25,1);bc.drawImage(component(atlas,[190,13,143,89]),10,17);bc.drawImage(component(atlas,[205,162,124,79]),25,24);
 const [bx,by]=proj(riverCenter(6.6),6.6);c.drawImage(bridge,bx-132.845,by-84.76,293.4,187.45);
 const flow=await img(P+'/wave29/water/current_arrows_se_sheet.png');for(const v of[1.8,5.4,10]){let [x,y]=proj(riverCenter(v),v);c.globalAlpha=.45;c.drawImage(flow,0,0,128,64,x-64,y-32,128,64);}c.globalAlpha=1;
 const [out,oc]=labelSheet(1500,1120,'WAVE 34 / 01 River crossings','Offline isometric reconstruction of attached river archetype; not a game screenshot. 64 x 32 px/tile at zoom 1.0.');
 text(oc,'Zoom 1.0 / ford width 2, 3, 4 tiles + existing timber bridge',24,94,17);oc.drawImage(scene,20,100,840,540);
 text(oc,'Zoom 0.6',875,94,17);oc.drawImage(scene,875,160,504,324);
 const map=await img(R+'/새땅_지형.jpg');oc.drawImage(map,396,132,128,128,1120,680,256,256);text(oc,'Attached map: row 2 / column 4',1000,965,15);
 text(oc,'Water under ford stays visible; Wave 29 flow sample is composited above it.',24,685,17);text(oc,'W2 / W3 / W4 span = 2 / 3 / 4 logical tiles. Bridge uses deck + both railing parts.',24,714,16);
 text(oc,'Map crop is source context. Crossing widths and local bank geometry are reconstructed for asset review.',24,746,15);
 fs.writeFileSync(O+'/checks/01-river-crossings.png',out.toBuffer('image/png'));return{placements,bridge:{source:R+'/bridge_wood_ne_sw-v2.png',column:1,deckCrop:[190,13,143,89],backRailCrop:[205,93,122,78],frontRailCrop:[205,162,124,79],extraction:"connected alpha component within each bounding box",worldUV:[riverCenter(6.6),6.6],assembledPivot:[81.5,52],sourceScale:1.63,bankOverlapTiles:0.2},mapCrop:[396,132,128,128]};
}
async function proofDrain(){
 const [out,oc]=labelSheet(1500,1140,'WAVE 34 / 02 Fen drainage sequence','Same 5 x 5 plot. Original Wave 22 fen stays under stages 1–3; grass replaces the ground only on completion.');
 const records=[];
 for(let seasonIndex=0;seasonIndex<2;seasonIndex++){
 const season=['summer','winter'][seasonIndex],rowY=100+seasonIndex*510;text(oc,season.toUpperCase()+' / zoom 1.0',24,rowY,18);
 for(let stage=0;stage<4;stage++){
 const cell=can(680,400),c=cell.getContext('2d');c.translate(340,195);
 const fill=stage===3?(season==='summer'?P+'/terrain/grass.png':P+'/wave15/terrain/grass_winter_fill-v1.png'):A+'/terrain/fen_'+season+'_a-v2.png';
 await ground(c,fill,[proj(-2.5,-2.5),proj(2.5,-2.5),proj(2.5,2.5),proj(-2.5,2.5)]);
 const pools=[[-1.5,-1.4],[1.3,-1],[.2,.1],[-1.1,1.5],[1.4,1.2]],count=[5,3,0,0][stage];
 for(let n=0;n<count;n++){const pool=await img(A+'/decals/fen_pool_'+['c','b','c','b','c'][n]+'-v1.png');piece(c,pool,...pools[n],stage===1?.7:1.1)}
 if(stage<3){const overlay=await img(O+'/drain/drain_stage'+(stage+1)+'_'+['staked','ditched','drying'][stage]+'_'+season+'-v1.png');for(let u=-2;u<=2;u++)for(let v=-2;v<=2;v++){if(stage===0&&Math.abs(u)!==2&&Math.abs(v)!==2)continue;if(stage===1&&v!==-1&&v!==1)continue;if(stage===0&&Math.abs(u)===2&&Math.abs(v)!==2){const [px,py]=proj(u,v);c.save();c.translate(px,py);c.scale(-1,1);c.drawImage(overlay,-64,-32);c.restore();}else piece(c,overlay,u,v);}}
 else{const edge=await img(O+'/drain/drain_done_edge_'+season+'-v1.png'),corners=[proj(-2.5,-2.5),proj(2.5,-2.5),proj(2.5,2.5),proj(-2.5,2.5)];for(let n=0;n<4;n++){const p=corners[n],q=corners[(n+1)%4],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);c.save();c.transform(dx/edge.width,dy/edge.width,-dy/len*.6,dx/len*.6,p[0],p[1]);c.drawImage(edge,0,-edge.height/2);c.restore()}}
 const propList=stage===0?[['drain_earth_cart',-1.6,1.6],['drain_soil_heap',-.8,2]]:stage===1?[['drain_sluice',2,0]]:stage===3?[['drain_plank_bridge',2.5,0]]:[];for(const [name,u,v] of propList){const im=await img(O+'/props/'+name+'-v1.png'),[px,py]=proj(u,v);c.drawImage(im,px-im.width/2,py-(im.height-8)+(name==='drain_plank_bridge'?24:0));}
 const x=20+stage*365; text(oc,['1 / staked','2 / ditched','3 / drying','4 / grass + perimeter ditch'][stage],x,rowY+32,16);oc.drawImage(cell,x,rowY+45,340,200);text(oc,'0.6',x,rowY+270,14);oc.drawImage(cell,x+68,rowY+275,204,120);
 records.push({season,stage:stage+1,fill,pondCount:count,pondScale:stage===1?.7:1.1,overlayTiles:[16,10,25,0][stage],plotTiles:[5,5],screenScale:[.5,.3]});
 }
 }
 fs.writeFileSync(O+'/checks/02-fen-drainage.png',out.toBuffer('image/png'));return records;
}

(async()=>{fs.mkdirSync(O+'/checks',{recursive:true});const mode=process.argv[2]||'all';let result={};if(mode==='bridge'){const atlas=await img(R+'/bridge_wood_ne_sw-v2.png'),b=can(180,115),bc=b.getContext('2d');bc.drawImage(component(atlas,[205,93,122,78]),25,1);bc.drawImage(component(atlas,[190,13,143,89]),10,17);bc.drawImage(component(atlas,[205,162,124,79]),25,24);fs.writeFileSync(W+'/proofs-bridge-final.png',b.toBuffer('image/png'));}if(mode==='river'||mode==='all')result.river=await proofRiver();if(mode==='drain'||mode==='all')result.drain=await proofDrain();fs.writeFileSync(W+'/proofs-provenance-'+mode+'.json',JSON.stringify({inputs,result},null,2))})().catch(e=>{console.error(e.message);process.exit(1)});
