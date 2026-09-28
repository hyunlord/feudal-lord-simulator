import fs from 'node:fs/promises';import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const W='/tmp/astra-wave27-work',D=W+'/delivery',R=W+'/reference/astra-wave27-reference-files';
const house='/tmp/astra-wave20-rework-20260927/delivery/references/houses/house_l1-v2.png';
const order=['tanner','farmer','merchant','baker','fisher','weaver','miller','carpenter','brewer','shepherd','dyer','blacksmith'];
const width=1080,height=740,scale=.5;
const text=(x,y,s,size=14)=>`<text x="${x}" y="${y}" font-size="${size}" font-family="Arial,sans-serif" fill="#f4eedc">${s}</text>`;
const svg=t=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${t}</svg>`);
const hs=await sharp(house).resize(70,70).png().toBuffer(),fence=await sharp(R+'/hurdle_gate-v1.png').resize(64,32).png().toBuffer();
const grass=await sharp(R+'/Wave23_마을생활_규격.jpg').extract({left:70,top:450,width:128,height:128}).png().toBuffer();
async function scene({state=null,labels=false}){const layers=[];for(let y=0;y<height;y+=128)for(let x=0;x<width;x+=128)layers.push({input:await sharp(grass).extract({left:0,top:0,width:Math.min(128,width-x),height:Math.min(128,height-y)}).png().toBuffer(),left:x,top:y});
let marks='<path d="M 46 253 L 825 642" stroke="#867752" stroke-width="38" fill="none"/><path d="M 46 253 L 825 642" stroke="#aa9169" stroke-width="27" fill="none"/>';
let labelsSvg=text(20,30,state?`WAVE 27 | ${state.toUpperCase()}`:'WAVE 27 | 12 occupational backyards',22)+text(20,53,'Offline parcel reconstruction | game zoom 1.0 | native asset scale 0.5 | PNG at 100%',13);
const objects=[];
for(let i=0;i<12;i++){const x=84+65*i,y=230+32.5*i,variant=i%2?'b':'a',slug=state||order[i],name=`yard_${slug}_${variant}-v1.png`,file=D+'/assets/yards/'+name;const native=await sharp(file).metadata(),decal=await sharp(file).resize(Math.round(native.width*scale),Math.round(native.height*scale)).png().toBuffer();
// Ground yard pivot sits up-right behind street-front dwelling. Sparse low fence along rear edge.
objects.push({input:decal,left:Math.round(x+70-128*scale),top:Math.round(y-38-104*scale),depth:y-38});
marks+=`<path d="M ${x-22} ${y-14} L ${x+82} ${y-66} L ${x+142} ${y-36} L ${x+38} ${y+16}" stroke="#817c56" stroke-opacity=".7" stroke-width="1.5" fill="none"/>`;
objects.push({input:fence,left:Math.round(x+52),top:Math.round(y-83),depth:y-65});
objects.push({input:hs,left:Math.round(x-36),top:Math.round(y-63),depth:y});
labelsSvg+=text(x-7,y+33,String(i+1).padStart(2,'0'),13);
}
objects.sort((a,b)=>a.depth-b.depth);layers.push({input:svg(marks),left:0,top:0},...objects.map(({depth,...r})=>r));
if(labels&&!state){for(let i=0;i<12;i++){const col=i%6,row=Math.floor(i/6);labelsSvg+=text(18+col*174,689+row*20,`${String(i+1).padStart(2,'0')} ${order[i]}`,13);}}
layers.push({input:svg(labelsSvg),left:0,top:0});return sharp({create:{width,height,channels:4,background:'#64734a'}}).composite(layers).png().toBuffer();}
await fs.mkdir(D+'/proofs',{recursive:true});await fs.mkdir(W+'/qa',{recursive:true});
await fs.writeFile(W+'/qa/occupation_blind.png',await scene({labels:false}));await fs.writeFile(D+'/proofs/01_twelve_occupations_zoom10.png',await scene({labels:true}));
if(process.env.OCCUPATIONS_ONLY==='1'){await fs.writeFile(W+'/qa/occupation_key.json',JSON.stringify(order.map((occupation,i)=>({number:i+1,occupation,variant:i%2?'b':'a'})),null,2));console.log('occupations only');process.exit(0);}
const states=['prosperous','strained','hungry','vacant'],panels=[];for(let i=0;i<4;i++)panels.push({input:await scene({state:states[i]}),left:(i%2)*width,top:Math.floor(i/2)*height});await sharp({create:{width:width*2,height:height*2,channels:4,background:'#64734a'}}).composite(panels).png().toFile(D+'/proofs/02_same_parcels_four_states.png');
await fs.writeFile(W+'/qa/occupation_key.json',JSON.stringify(order.map((occupation,i)=>({number:i+1,occupation,variant:i%2?'b':'a'})),null,2));
console.log('2 final proofs and unlabelled occupation test, scale0.5');
