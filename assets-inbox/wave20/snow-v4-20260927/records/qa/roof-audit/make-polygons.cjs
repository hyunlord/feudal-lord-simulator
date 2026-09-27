const fs=require('fs');const sharp=require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const defs=[
[2,1350,'a',[[5,39],[30,7],[108,43],[82,74]],[]],
[2,1350,'b',[[5,40],[31,7],[109,42],[83,74]],[]],
[2,1400,'a',[[6,40],[19,7],[93,42],[77,74]],[]],
[2,1400,'b',[[9,41],[24,7],[92,42],[77,75]],[]],
[3,1350,'a',[[12,55],[45,8],[116,49],[88,77],[49,24]],[]],
[3,1350,'b',[[13,55],[43,8],[117,49],[88,77],[50,24]],[]],
[3,1400,'a',[[16,49],[34,8],[103,50],[84,84],[43,34],[23,56]],[]],
[3,1400,'b',[[19,49],[38,8],[107,54],[86,87],[48,36],[27,57]],[[[91,29],[99,25],[108,30],[108,53],[100,56],[91,49]]]],
[4,1350,'a',[[27,41],[48,12],[127,53],[101,79]],[]],
[4,1350,'b',[[28,41],[46,12],[127,53],[103,78]],[]],
[4,1400,'a',[[27,45],[44,12],[112,50],[94,82]],[[[98,26],[106,24],[115,29],[115,50],[110,51],[98,44]]]],
[4,1400,'b',[[28,45],[40,12],[110,51],[94,82]],[[[96,29],[104,26],[113,31],[113,52],[108,53],[96,46]]]],
];
const root='/tmp/astra-wave20-snow-v4/roof-audit/';const src='/tmp/astra-wave20-rework-20260927/delivery/assets/houses/';
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))hit=!hit;}return hit;}
(async()=>{const rows=[];for(const[l,e,v,p,ex]of defs){const file=`house_l${l}_${e}_${v}-v2.png`;const {width:n}=await sharp(src+file).metadata();let area=0;let mask=Buffer.alloc(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(inside(x+.5,y+.5,p)&&!ex.some(q=>inside(x+.5,y+.5,q))){mask[y*n+x]=255;area++;}await sharp(mask,{raw:{width:n,height:n,channels:1}}).png().toFile(root+file.replace('.png','-roof-mask.png'));const points=p.map(x=>x.join(',')).join(' ');const svg=Buffer.from(`<svg width="${n}" height="${n}"><polygon points="${points}" fill="#20ffff" fill-opacity=".25" stroke="#00ffff" stroke-width=".4"/>${ex.map(q=>`<polygon points="${q.map(x=>x.join(',')).join(' ')}" fill="#ff0099" fill-opacity=".4"/>`).join('')}</svg>`);await sharp(await sharp(src+file).composite([{input:svg}]).png().toBuffer()).resize(n*4,n*4,{kernel:'nearest'}).png().toFile(root+file.replace('.png','-roof-annotated.png'));rows.push({file,level:l,era:e,variant:v,canvas:[n,n],roofPolygons:[p],chimneyExclusionPolygons:ex,mainRoofAreaPixels:area,method:'Independent manual tracing of original house, pixel-center polygon fill, chimney exclusion. Door canopies, gable walls and roof fascia excluded. Not adjusted using snow coverage.',boundaryUncertaintyNativePx:2,maskFile:file.replace('.png','-roof-mask.png')});}fs.writeFileSync(root+'roof-polygons.json',JSON.stringify(rows,null,2));console.log(rows.map(r=>`${r.file}: ${r.mainRoofAreaPixels}`).join('\n'));})();
