const fs=require('fs'),path=require('path'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'), defs=[['frame_panel_light',192,192,32],['frame_panel_dark',192,192,24],['frame_objective',256,256,32],['frame_advisor',256,192,32],['button_primary_base',128,72,12],['button_icon_square_base',72,72,12],['texture_vellum_light',256,256,0]];
async function run(){const recs=[];
for(const [id,w,h,c] of defs){const raw=path.join(root,'sources/frames',id+'-raw.png');let {data,info}=await sharp(raw).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});let bg=id==='frame_panel_dark'?[81,67,52]:[225,209,174],side=id==='frame_panel_dark'?5:5;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=(y*w+x)*4;
  if(id==='texture_vellum_light'){const k=Math.round((data[i]-225)*.65);bg=[225+k,209+k,174+k];}
  const corner=(x<c||x>=w-c)&&(y<c||y>=h-c);
  let keep=x<side||x>=w-side||y<side||y>=h-side||corner;
  if(id==='frame_objective')keep=x<5||x>=w-5||y<5||y>=h-5||(x<32&&y<32);
  if(id==='frame_advisor')keep=x<5||x>=w-5||y<5||y>=h-5||(x>=w-32&&y>=h-32);
  if(id==='frame_panel_dark')keep=x<3||x>=w-3||y<5||y>=h-3||((x<24||x>=w-24)&&y<24);
  if(id==='texture_vellum_light'||!keep){data[i]=bg[0];data[i+1]=bg[1];data[i+2]=bg[2];data[i+3]=255;}
 }
 let out=sharp(data,{raw:info});if(id==='frame_advisor'){
  const original=await sharp(raw).metadata(); // actual generated ring bounds measured visually, circle normalized once.
  const ring=await sharp(raw).extract({left:40,top:307,width:436,height:436}).resize(96,96).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){let i=(y*96+x)*4;if(ring.data[i]>130){ring.data[i]=225;ring.data[i+1]=209;ring.data[i+2]=174;}}
  out=out.composite([{input:await sharp(ring.data,{raw:ring.info}).png().toBuffer(),left:16,top:48}]);
 }
 if(id==='texture_vellum_light'){
  for(let y=0;y<h;y++)for(let k=0;k<4;k++)data[(y*w+w-1)*4+k]=data[y*w*4+k];
  for(let x=0;x<w;x++)for(let k=0;k<4;k++)data[((h-1)*w+x)*4+k]=data[x*4+k];
  out=sharp(data,{raw:info});
 }
 await out.png().toFile(path.join(root,'assets/ui',id+'.png'));
 recs.push({id:'ui/'+id,file:'assets/ui/'+id+'.png',width:w,height:h,role:id,status:'candidate',generationRecords:JSON.parse(fs.readFileSync(path.join(root,'records',id+'-generation.json'))),processing:'Generated original preserved; downsample to requested canvas; flat reading field normalized to palette. Generated corner art and edge retained. Vellum contrast compressed and opposing terminal pixel rows/columns matched.',nineSlice:c?{left:c,top:c,right:c,bottom:c,sourceScale:2,renderCapScale:0.5,method:id==='frame_advisor'?'Nine-slice blank body plus fixed 96x96 source circle inserted at 16,48; at logical1x circle48x48. See frames-render.cjs.':'standard'}:null,qa:{text:'none',numbers:'none',barInterior:'none',center:'flat',limitations:id==='frame_advisor'?'Generic nine-slice alone distorts portrait: supplied fixed-circle compositor is required.':''}});
}
fs.writeFileSync(path.join(root,'records/frames.json'),JSON.stringify(recs,null,2));
}
run();
