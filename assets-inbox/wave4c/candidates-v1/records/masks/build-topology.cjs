const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PNG } = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs/lib/png.js');
const root = '/Users/rexxa/github/feudal-lord-simulator/output/astra-wave4c-v1';
const definitions = [
  { id:'hurdle_gate-v1', size:[128,64], ports:[[32,60],[96,28]], pivot:[64,44], path:[[32,60],[96,28]], gate:true },
  { id:'hurdle_half-v1', size:[64,64], ports:[[16,56],[48,40]], pivot:[32,48], path:[[16,56],[48,40]] },
  { id:'hurdle_corner_e-v1', size:[128,96], ports:[[0,28],[0,92]], pivot:[64,60], path:[[0,28],[64,60],[0,92]] },
  { id:'hurdle_corner_s-v1', size:[128,96], ports:[[0,32],[128,32]], pivot:[64,64], path:[[0,32],[64,64],[128,32]] },
  { id:'hurdle_corner_w-v1', size:[128,96], ports:[[128,28],[128,92]], pivot:[64,60], path:[[128,28],[64,60],[128,92]] },
];
const inside = (x,y,poly) => {
  let value=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])value=!value;
  }
  return value;
};
for(const d of definitions){
  const polygons=[];
  for(let i=1;i<d.path.length;i++){
    const a=d.path[i-1],b=d.path[i];
    for(const top of [24,12]) polygons.push([[a[0],a[1]-top],[b[0],b[1]-top],[b[0],b[1]-top+10],[a[0],a[1]-top+10]]);
    const dx=Math.abs(b[0]-a[0]),dy=Math.abs(b[1]-a[1]);
    assert.equal(dx,2*dy,'2:1 isometric sockets');
    assert.equal(dx,d.id==='hurdle_half-v1'?32:64,'exact half/full world span');
  }
  for(const [x,y] of d.path) polygons.push([[x-5,y-26],[x+5,y-26],[x+5,y],[x-5,y]]);
  if(d.gate) polygons.push([[37,52],[91,6],[91,12],[37,58]]);
  d.polygons=polygons;
  const [width,height]=d.size;
  const image=new PNG({width,height});
  let count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const occupied=polygons.some(p=>inside(x+.5,y+.5,p));
    const k=(y*width+x)*4; image.data[k]=image.data[k+1]=image.data[k+2]=occupied?255:0;image.data[k+3]=255;
    if(occupied)count++;
  }
  assert.ok(count>0);d.occupiedPixels=count;
  fs.writeFileSync(`${root}/masks/${d.id}-topology.png`,PNG.sync.write(image));
  const shapes=polygons.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}" fill="white"/>`).join('');
  fs.writeFileSync(`${root}/masks/${d.id}-topology.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="black"/>${shapes}</svg>\n`);
}
const assembly=[
 {id:'hurdle_end_corner-v1',pivot:[64,56],worldPivot:[320,96]},
 {id:'hurdle_corner_e-v1',pivot:[64,60],worldPivot:[448,160]},
 {id:'hurdle_corner_s-v1',pivot:[64,64],worldPivot:[224,272]},
 {id:'hurdle_corner_w-v1',pivot:[64,60],worldPivot:[96,208]},
 {id:'hurdle_straight-v1',pivot:[32,60],worldPivot:[160,176]},
 {id:'hurdle_half-v1',pivot:[16,56],worldPivot:[224,144]},
 {id:'hurdle_gate-v1',pivot:[32,60],worldPivot:[288,240]},
 {id:'hurdle_half-v1',pivot:[16,56],worldPivot:[352,208]},
];
const registry={...Object.fromEntries(definitions.map(d=>[d.id,d])),
 'hurdle_end_corner-v1':{ports:[[0,88],[128,88]],pivot:[64,56]},
 'hurdle_straight-v1':{ports:[[32,60],[96,28]],pivot:[32,60]}};
const joins=new Map();
for(const a of assembly){for(const p of registry[a.id].ports){const world=[p[0]-a.pivot[0]+a.worldPivot[0],p[1]-a.pivot[1]+a.worldPivot[1]],key=world.join(',');joins.set(key,(joins.get(key)||0)+1);}}
for(const count of joins.values())assert.equal(count,2,'closed assembly each endpoint has two incident modules');
const result={status:'topology preprocessing only; not final art',convention:'pixel ground sockets; occupied white, empty black; exact 2:1 plane; clipped boundary posts intentional',reference:{straight:'/tmp/astra-wave4b-candidates-20260925/records/hurdle_straight-sockets.json',north:'/tmp/astra-wave4b-candidates-20260925/records/hurdle_end_corner-sockets.json',postWidth:10,postHeight:26,railVerticalThickness:10,railTopOffsets:[24,12]},modules:definitions,assembly:{description:'closed 3.5 by 2 tile isometric yard, no mirrored/rotated art; one straight, gate, two half instances and all four corners',placements:assembly,joinPositions:[...joins.keys()].map(k=>k.split(',').map(Number)),verifiedClosed:true},notes:['Corner E and W occupy one half of their 128px-wide canvas to preserve full-tile vectors and exact 96px height. Blank canvas is intentional.','Image generation should paint this topology, never horizontally mirror existing artwork.','Gate diagonal brace is a new structural member; hinge/latch material details must not move its ports.','No physics/game installation verified.']};
fs.writeFileSync(`${root}/records/module-topology.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({modules:definitions.map(d=>({id:d.id,size:d.size,pivot:d.pivot,ports:d.ports,pixels:d.occupiedPixels})),closedJoins:joins.size},null,2));
