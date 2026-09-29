const fs = require('fs');
const {createCanvas}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=__dirname+'/..';
const polygons=[[[58,4],[109,34],[81,77],[60,45],[43,57],[31,48]],[[109,34],[129,56],[126,62],[107,43]]];
const c=createCanvas(160,144),ctx=c.getContext('2d');ctx.fillStyle='white';
for(const p of polygons){ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
fs.writeFileSync(root+'/records/masks/b-roof.png',c.toBuffer('image/png'));
fs.writeFileSync(root+'/records/masks/b-roof-definition.json',JSON.stringify({method:'Manual visible roof polygons traced from registered base before viewing snow output. Includes main tile plane and narrow right roof strip.',polygons},null,2));
