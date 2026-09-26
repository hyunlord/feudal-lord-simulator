import{W,D,fs,sharp,pixels,original,svg,label}from'./lib.mjs';
const contract=JSON.parse(await fs.readFile('/tmp/astra-wave20-work-20260926/records/geometry-contract.json'));
const columns=[{era:1300,variant:'ref',text:'1300 (reference)'},{era:1350,variant:'a',text:'1350 a'},{era:1350,variant:'b',text:'1350 b'},{era:1400,variant:'a',text:'1400 a'},{era:1400,variant:'b',text:'1400 b'}];
for(const zoom of[1,.6]){const width=640,height=665,comps=[],title=`WAVE 20 REWORK | game zoom ${zoom.toFixed(1)}`;let decor=label(18,27,title,19,'#fff')+label(18,47,`PNG at 100%: source scale about ${(zoom*.5).toFixed(2)}. Fixed original pivots and 1 x 1 ground footprints.`,11,'#e4e4d7');
for(let c=0;c<5;c++)decor+=label(42+c*119,76,columns[c].text,12,'#fff');
for(let l=0;l<5;l++){const ground=166+l*119;decor+=label(9,ground-20,`L${l}`,12,'#deded1');for(let c=0;c<5;c++){const col=columns[c],file=c===0?original(l):D+`/assets/houses/house_l${l}_${col.era}_${col.variant}-v${l<2?1:2}.png`;try{await fs.access(file);}catch{continue;}const p=await pixels(file),g=contract.houses[l],scale=g.nativeToWorldScale*zoom,cx=88+c*119;comps.push({input:await sharp(file).resize(Math.round(p.w*scale),Math.round(p.h*scale)).png().toBuffer(),left:Math.round(cx-g.runtimeDerivedNativeAnchor[0]*scale),top:Math.round(ground-g.runtimeDerivedNativeAnchor[1]*scale)});}}
await sharp({create:{width,height,channels:4,background:'#757b69'}}).composite([{input:svg(width,height,decor),left:0,top:0},...comps]).png().toFile(D+`/proofs/three_eras_zoom_${zoom===1?'10':'06'}.png`);}
console.log('two matched-layout proof sheets');
