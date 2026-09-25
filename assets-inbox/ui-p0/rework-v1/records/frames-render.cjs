const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
async function renderFrame(id,w,h,scale=1){const r=JSON.parse(fs.readFileSync(path.join(__dirname,'frames.json'))).find(r=>r.id==='ui/'+id||r.id===id);if(!r)throw Error('Unknown '+id);const im=await loadImage(path.join(root,r.file)),c=createCanvas(w,h),g=c.getContext('2d'),n=r.nineSlice;const sx=[0,n.left,im.width-n.right,im.width],sy=[0,n.top,im.height-n.bottom,im.height],dx=[0,n.left*scale,w-n.right*scale,w],dy=[0,n.top*scale,h-n.bottom*scale,h];for(let y=0;y<3;y++)for(let x=0;x<3;x++)g.drawImage(im,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);return c.toBuffer('image/png');}
module.exports={renderFrame};
