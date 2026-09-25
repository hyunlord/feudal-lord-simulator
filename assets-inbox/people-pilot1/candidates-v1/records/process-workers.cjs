const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const directions=['NE','SE','SW','NW'];
(async()=>{fs.mkdirSync(path.join(root,'masters'),{recursive:true});const records=[];
for(let person=1;person<=6;person++){
 const id=`wk_pilot_P${person}-v1`,source=`sources/${id}.png`,im=await loadImage(path.join(root,source));const raw=createCanvas(im.width,im.height),rx=raw.getContext('2d');rx.drawImage(im,0,0);const d=rx.getImageData(0,0,im.width,im.height).data;const frames=[];
 for(let row=0;row<2;row++)for(let col=0;col<4;col++){
 const x0=Math.round(col*im.width/4),x1=Math.round((col+1)*im.width/4),y0=Math.round(row*im.height/2),y1=Math.round((row+1)*im.height/2);let l=x1,t=y1,r=x0,b=y0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*im.width+x)*4+3]>12){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 let sum=0,n=0;for(let y=b-2;y<=b;y++)for(let x=l;x<=r;x++)if(d[(y*im.width+x)*4+3]>32){sum+=x;n++;}
 frames.push({direction:directions[col],frame:row,col,row,crop:[l,t,r-l+1,b-t+1],sourceFoot:[n?sum/n:(l+r)/2,b+1]});
 }
 const scale=Math.min(120/Math.max(...frames.map(f=>f.crop[3])),118/Math.max(...frames.map(f=>f.crop[2])));
 const master=createCanvas(592,296),mx=master.getContext('2d');mx.imageSmoothingEnabled=true;mx.imageSmoothingQuality='high';
 for(const f of frames){const [l,t,w,h]=f.crop;const dx=f.col*148+74-(f.sourceFoot[0]-l)*scale,dy=f.row*148+134-(f.sourceFoot[1]-t)*scale;f.masterRect=[dx,dy,w*scale,h*scale];f.masterFoot=[f.col*148+74,f.row*148+134];mx.drawImage(im,l,t,w,h,...f.masterRect);}
 const final=createCanvas(296,148),fx=final.getContext('2d');fx.imageSmoothingEnabled=true;fx.imageSmoothingQuality='high';fx.drawImage(master,0,0,296,148);
 const target=`assets/workers/${id}.png`,masterPath=`masters/${id}-148.png`;fs.writeFileSync(path.join(root,target),final.toBuffer('image/png'));fs.writeFileSync(path.join(root,masterPath),master.toBuffer('image/png'));
 const alpha=fx.getImageData(0,0,296,148).data;const metrics=frames.map(f=>{let min=255,max=0,nonzero=0;for(let y=f.row*74;y<(f.row+1)*74;y++)for(let x=f.col*74;x<(f.col+1)*74;x++){const a=alpha[(y*296+x)*4+3];min=Math.min(min,a);max=Math.max(max,a);if(a>0)nonzero++;}return {direction:f.direction,frame:f.frame,alphaMin:min,alphaMax:max,nonzero};});
 records.push({id,source,nativeSize:[im.width,im.height],sourceSha256:hash(path.join(root,source)),masterPath,masterSize:[592,296],target,targetSize:[296,148],sha256:hash(path.join(root,target)),directionOrder:directions,rows:[0,1],cell:[74,74],anchor:[37,67],masterCell:[148,148],masterAnchor:[74,134],uniformPersonScale:scale,method:'Extract 8 regular-grid alpha bounds. Same uniform scale for all8 frames per person; translate actual bottom sole anchor. Native->148master then exactly50% final. No mirror, no anatomy/prop/clothing edits; original directional inconsistencies retained.',frames,metrics});
}
fs.writeFileSync(path.join(root,'records/worker-processing.json'),JSON.stringify({assets:records},null,2));console.log('6 workers registered, 48 frames.');
})();
