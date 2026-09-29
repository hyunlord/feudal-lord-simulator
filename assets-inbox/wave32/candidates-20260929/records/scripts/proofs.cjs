const fs = require('node:fs');
const path = require('node:path');
const deps = '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { createCanvas, loadImage } = require(deps + '@napi-rs/canvas');
const sharp = require(deps + 'sharp');
const root = path.resolve(__dirname, '..');
const layout = JSON.parse(fs.readFileSync(path.join(root, 'records/city-layout.json')));
const asset = (name) => path.join(root, 'assets', name + '-v1.png');
const read = (p) => loadImage(path.join(root, p));
const states = ['base', 'full', 'half', 'empty', 'snow', 'boarded', 'weathered'];
const variants = ['a', 'b', 'c'];
const placements = [['a','full'], ['b','half'], ['c','empty'], ['a','half'], ['b','empty'], ['c','full']];
function polygon(ctx, points) { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); }
const preserve = {
  large: [[[310,391],[344,365],[376,385],[375,432],[341,448],[310,425]], [[378,377],[408,353],[446,372],[443,414],[402,431]], [[544,592],[568,565],[605,581],[610,617],[582,642],[547,624]]],
  small: [[[294,291],[311,277],[329,288],[329,314],[310,323],[294,311]], [[333,285],[348,271],[370,282],[367,307],[348,316]], [[420,400],[438,386],[457,397],[461,420],[444,435],[425,425]]]
};
async function city(size) {
  const source = await read('references/city-'+size+'.png');
  const generated = await read('native/city-'+size+'-generated-cleanplate.png');
  const barn = await read('references/barn.png');
  const canvas = createCanvas(source.width, source.height), ctx = canvas.getContext('2d');
  const mask = createCanvas(source.width, source.height), m = mask.getContext('2d');
  for (const p of layout.fits[size]) m.drawImage(barn,p.x,p.y,Math.round(160*p.s),Math.round(144*p.s));
  const raw = m.getImageData(0,0,mask.width,mask.height);
  const dilated = m.createImageData(mask.width,mask.height);
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++) {
    let alpha=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<mask.width&&y+dy>=0&&y+dy<mask.height)alpha=Math.max(alpha,raw.data[((y+dy)*mask.width+x+dx)*4+3]);
    const i=(y*mask.width+x)*4;dilated.data[i]=255;dilated.data[i+1]=255;dilated.data[i+2]=255;dilated.data[i+3]=alpha>8?255:0;
  }
  m.putImageData(dilated,0,0);
  const clean = createCanvas(source.width,source.height), cl = clean.getContext('2d');
  cl.drawImage(generated,0,0,source.width,source.height);cl.globalCompositeOperation='destination-in';cl.drawImage(mask,0,0);
  ctx.drawImage(source,0,0);ctx.drawImage(clean,0,0);
  const allowed = createCanvas(source.width,source.height), ac=allowed.getContext('2d');ac.drawImage(mask,0,0);
  for(let i=0;i<layout.fits[size].length;i++){
    const p=layout.fits[size][i], [v,s]=placements[i];
    for(const name of ['granary_'+v,'granary_'+v+'_'+s]){
      if(!fs.existsSync(asset(name))) throw Error('Required asset missing: '+name);
      const im=await loadImage(asset(name));ctx.drawImage(im,p.x,p.y,Math.round(160*p.s),Math.round(144*p.s));ac.drawImage(im,p.x,p.y,Math.round(160*p.s),Math.round(144*p.s));
    }
  }
  for(const points of preserve[size]){ctx.save();polygon(ctx,points);ctx.clip();ctx.drawImage(source,0,0);ctx.restore();}
  const before=createCanvas(source.width,source.height);before.getContext('2d').drawImage(source,0,0);
  const a=before.getContext('2d').getImageData(0,0,source.width,source.height).data,b=ctx.getImageData(0,0,source.width,source.height).data,allowedData=ac.getImageData(0,0,source.width,source.height).data;
  let changed=0,outside=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){changed++;if(allowedData[i+3]===0)outside++;}
  fs.writeFileSync(path.join(root,'native/city-'+size+'-composite.png'),canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(root,'native/city-'+size+'-allowed-mask.png'),allowed.toBuffer('image/png'));
  return {canvas,source,qa:{changedPixels:changed,outsideAuthorizedMaskChangedPixels:outside,placements:placements.map(([variant,state],i)=>({variant,state,...layout.fits[size][i]}))}};
}
function background(w,h){const c=createCanvas(w,h),x=c.getContext('2d');x.fillStyle='#e8dec9';x.fillRect(0,0,w,h);x.fillStyle='#302b22';return[c,x];}
function label(ctx,text,x,y,size=18){ctx.fillStyle='#302b22';ctx.font=`${size}px sans-serif`;ctx.fillText(text,x,y);}
(async()=>{
  const small=await city('small'),large=await city('large');
  const [proof,ctx]=background(2424,1430);
  label(ctx,'Wave 32 | Original Wave 30 city → 6 granaries replaced | OFFLINE COMPOSITE',12,27,23);
  label(ctx,'1.0: approved original (900 × 562)',12,57);label(ctx,'1.0: candidate / a,b,c × 2 sites',1224,57);
  ctx.drawImage(small.source,12,70);ctx.drawImage(small.canvas,1224,70);
  label(ctx,'1.4: approved close view (1200 × 750)',12,659);label(ctx,'1.4: candidate / full, half, empty × 2 sites',1224,659);
  ctx.drawImage(large.source,12,675);ctx.drawImage(large.canvas,1224,675);
  await sharp(proof.toBuffer('image/png')).jpeg({quality:87,mozjpeg:true}).toFile(path.join(root,'proofs/01-city-repetition.jpg'));
  const [grid,g]=background(1450,1120);
  label(g,'Wave 32 | 160 × 144 native + 96 × 86 (0.6×) | base + transparent state overlays',16,29,21);
  const cell=198,start=56,rowHeight=298;
  for(let c=0;c<states.length;c++)label(g,states[c],c*cell+37,58,18);
  for(let r=0;r<3;r++)for(let c=0;c<states.length;c++){
    const v=variants[r],s=states[c],x=18+c*cell,y=72+r*rowHeight;
    g.fillStyle=(r+c)%2?'#b6b6a4':'#c3c0ac';g.fillRect(x,y,186,280);
    const base=await loadImage(asset('granary_'+v));g.drawImage(base,x+13,y+18);g.drawImage(base,x+45,y+177,96,86.4);
    if(s!=='base'){const overlay=await loadImage(asset('granary_'+v+'_'+s));g.drawImage(overlay,x+13,y+18);g.drawImage(overlay,x+45,y+177,96,86.4);}
    label(g,v.toUpperCase(),x+5,y+17,15);
  }
  const props=['pulley_beam','pulley_rope_hook','sack_single','sacks_small','sacks_large'];
  label(g,'Shared props at native pixels',18,990,18);
  for(let i=0;i<props.length;i++){const im=await loadImage(asset('granary_'+props[i]));g.drawImage(im,45+i*275,1005);label(g,props[i],20+i*275,1100,16);}
  await sharp(grid.toBuffer('image/png')).jpeg({quality:88,mozjpeg:true}).toFile(path.join(root,'proofs/02-variants-states.jpg'));
  fs.writeFileSync(path.join(root,'records/city-proof-qa.json'),JSON.stringify({status:'candidate; offline composite; not installed; not runtime evidence',method:'Only old barn alpha silhouettes plus 1px dilation take generated cleanplate pixels. New assets use original full canvas registration. Explicit foreground polygons restore existing Wave30 foreground houses/stalls. Screenshot fit is estimated, not product transform.',sourceZoomLabels:'1.0 and 1.4 are inherited Wave30 capture labels, not magnifications manufactured by this script.',large:large.qa,small:small.qa,stateReadabilityReview:{native:'A full/half/empty are clear. B and C open versus closed doors are visible; exact full versus half needs comparison of small sack groups.',scale06:'Roof materials and snow remain clear. A full versus half is visible on comparison; B/C full versus half is weak at 96x86 and should not be claimed immediately readable in a moving city. Boarded/weathered are subtle at this scale.',verdict:'Candidate art proof passes placement/repetition review; compact inventory readability remains a disclosed limitation.'},repetitionVerdict:'Six identical red roofs become 2 thatch + 2 timber/tile + 2 stone/slab roofs. Largest identical cluster is reduced from 6 to 2; red tile remains on other untouched houses. Inventory differences require close inspection at 0.6 scale and are not a runtime readability claim.',remainingLimits:['Screenshot anchors estimated using original barn template.','Cleanplate is generated only inside old silhouettes; background under removed buildings is inferred.','No runtime occlusion, DPR, camera motion, or all-placement connection validation.','JPEG proofs are lossy; unchanged-pixel count measured from PNG composites before JPEG encoding.']},null,2));
  console.log('Proofs saved; exact outside-authorized-mask changed pixels:',small.qa.outsideAuthorizedMaskChangedPixels,large.qa.outsideAuthorizedMaskChangedPixels);
})();
