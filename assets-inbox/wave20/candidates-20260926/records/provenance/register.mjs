import{W,D,R,fs,path,sharp,pixels,bounds,original,save,sheet}from'./lib.mjs';
const geometry=JSON.parse(await fs.readFile(W+'/records/geometry-contract.json'));
const roofPolygons=JSON.parse(await fs.readFile(W+'/records/roof-polygons.json'));
const chimneyRegions=JSON.parse(await fs.readFile(W+'/records/chimney-regions.json'));
function inside(x,y,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){if((poly[i][1]>y)!==(poly[j][1]>y)&&x<(poly[j][0]-poly[i][0])*(y-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])result=!result;}return result;}
const rows=[];
for(const era of[1350,1400])for(let l=0;l<5;l++)for(const v of['a','b']){
const id=`house_l${l}_${era}_${v}-v1`;let record;try{record=JSON.parse(await fs.readFile(W+`/records/${era}/${id}.json`));}catch{continue;}
const source=record.source??record.generated_source,ref=await pixels(original(l)),raw=await pixels(source);const crop=bounds(raw,240),target=bounds(ref,8);
for(let i=3;i<raw.data.length;i+=4)raw.data[i]=raw.data[i]>=240?255:0;
const resized=await sharp(raw.data,{raw:{width:raw.w,height:raw.h,channels:4}}).extract(crop).resize(target.width,target.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
const out={w:ref.w,h:ref.h,data:Buffer.from(ref.data)},bottoms=new Int16Array(ref.w).fill(-1);for(let y=0;y<ref.h;y++)for(let x=0;x<ref.w;x++)if(ref.data[(y*ref.w+x)*4+3]>0)bottoms[x]=y;
const chimney=era===1400&&(l===4||(l===3&&v==='b'));
// A separate registered chimney area is set after native visual inspection.
const chimneyRegion=chimney?(l===4?[101,23,123,52]:[93,20,121,55]):null;
const chimneySpec=chimneyRegions[id];
const mapPoint=([x,y])=>[target.left+(x-crop.left)*target.width/crop.width,target.top+(y-crop.top)*target.height/crop.height];
const chimneyPolygon=chimneySpec?.source_polygon.map(mapPoint);
const smokeOrigin=chimneySpec?mapPoint(chimneySpec.source_smoke_origin).map(Math.round):null;
let changed=0,groundDrift=0;
for(let y=0;y<ref.h;y++)for(let x=0;x<ref.w;x++){
const i=(y*ref.w+x)*4,gx=x-target.left,gy=y-target.top;if(gx<0||gy<0||gx>=target.width||gy>=target.height)continue;
const j=(gy*target.width+gx)*4;
if(y>=bottoms[x]-3&&bottoms[x]>=0)continue;
const roof=roofPolygons[l].some(poly=>inside(x+.5,y+.5,poly));
if(!roof&&ref.data[i+3]>0&&resized[j+3]>120){for(let c=0;c<3;c++)out.data[i+c]=resized[j+c];changed++;}
if(chimneyPolygon&&inside(x+.5,y+.5,chimneyPolygon)&&resized[j+3]>8){out.data.set(resized.subarray(j,j+4),i);}
}
await fs.mkdir(D+'/assets/houses',{recursive:true});const file=`assets/houses/${id}.png`;await save(out,D+'/'+file);
for(let x=0;x<ref.w;x++)for(let y=Math.max(0,bottoms[x]-3);y<ref.h;y++){const i=(y*ref.w+x)*4;if(ref.data[i+3]&&out.data.subarray(i,i+4).compare(ref.data.subarray(i,i+4)))groundDrift++;}
rows.push({id,era,level:l,variant:v,file,source,record,crop,target,canvas:[ref.w,ref.h],pivot:geometry.houses[l].runtimeDerivedNativeAnchor,footprint:[1,1],scale:geometry.houses[l].nativeToWorldScale,chimney,chimneyRegion,chimneyPolygon,smokeOrigin,groundDrift,changed});
}
await fs.writeFile(W+'/registered.json',JSON.stringify(rows,null,2));await sheet(rows.map(r=>({file:D+'/'+r.file,name:r.id})),W+'/registered-contact.png',{columns:5,width:330,height:400,scale:2});console.log(rows.map(r=>[r.id,r.groundDrift]));
