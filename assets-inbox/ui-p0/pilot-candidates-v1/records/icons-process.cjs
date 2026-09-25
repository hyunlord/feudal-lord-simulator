const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
const specs=JSON.parse(fs.readFileSync(path.join(root,'records/icons-specs.json')));const rows=[];
for(const s of specs){
 const [id,n,cell,order]=s;const cols=n===8?4:n===4?2:3,rs=Math.ceil(n/cols);
 const src=path.join(root,'sources/icons',id+'.png');const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});let parts=[],transforms=[];
 for(let i=0;i<n;i++){
 const x0=Math.floor(i%cols*info.width/cols),y0=Math.floor(Math.floor(i/cols)*info.height/rs),ww=Math.floor(info.width/cols),hh=Math.floor(info.height/rs);
 let l=ww,t=hh,r=-1,b=-1;for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const a=data[((y+y0)*info.width+x+x0)*4+3];if(a>128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
 if(r<l)throw Error('empty '+id+i);l=Math.max(0,l-3);t=Math.max(0,t-3);r=Math.min(ww-1,r+3);b=Math.min(hh-1,b+3);
 const crop=await sharp(src).extract({left:x0+l,top:y0+t,width:r-l+1,height:b-t+1}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let z=3;z<crop.data.length;z+=4)crop.data[z]=crop.data[z]<32?0:Math.round((crop.data[z]-32)*255/223);
 const w=crop.info.width,h=crop.info.height,seen=new Uint8Array(w*h),components=[];
 for(let p=0;p<w*h;p++){if(seen[p]||crop.data[p*4+3]<64)continue;const comp=[],queue=[p];seen[p]=1;for(let qi=0;qi<queue.length;qi++){const a=queue[qi];comp.push(a);const x=a%w,y=Math.floor(a/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,pp=yy*w+xx;if(xx<0||yy<0||xx>=w||yy>=h||seen[pp]||crop.data[pp*4+3]<64)continue;seen[pp]=1;queue.push(pp);}}components.push(comp);}
 const largest=Math.max(...components.map(c=>c.length));for(const c of components)if(c.length<largest*.005)for(const p of c){const x=p%w,y=Math.floor(p/w);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h)crop.data[(yy*w+xx)*4+3]=0;}}
 const size=Math.round(cell*.84);const buf=await sharp(crop.data,{raw:crop.info}).resize(size,size,{fit:'inside'}).png().toBuffer();const m=await sharp(buf).metadata();parts.push({input:buf,left:i*cell+Math.floor((cell-m.width)/2),top:Math.floor((cell-m.height)/2)});transforms.push({cell:i,sourceRect:[x0+l,y0+t,r-l+1,b-t+1],destination:[parts.at(-1).left,parts.at(-1).top,m.width,m.height]});
 }
 const file='assets/ui/'+id+'.png';await sharp({create:{width:n*cell,height:cell,channels:4,background:'#00000000'}}).composite(parts).png().toFile(path.join(root,file));
 const gen=JSON.parse(fs.readFileSync(path.join(root,'records/icons-'+id+'-generation.json')));
 rows.push({id:'ui/'+id,file,width:n*cell,height:cell,role:id,cellSize:cell,cellOrder:order,generationRecords:[gen],processing:{method:'Equal-grid extraction; alpha >128 content bounds plus3px, discard alpha below32 and remap32..255, proportional Lanczos3 resize into84%cell then center, remove disconnected alpha specks smaller than0.5%largest component; no new pictogram drawing.',transforms},qa:{status:'candidate',native24pxReview:'pending',gameInstalled:false}});
}
fs.writeFileSync(path.join(root,'records/icons.json'),JSON.stringify(rows,null,2));
let parts=[],labels=[],row=0;for(const r of rows.filter(x=>!x.id.includes('cursor'))){for(let i=0;i<r.cellOrder.length;i++){
 const y=86+row*120;labels.push(`<text x="24" y="${y+50}" font-size="17">${r.id.replace('ui/icon_','').replace('_sheet','')} · ${r.cellOrder[i]}</text>`);
 for(const [j,size]of [96,32,24].entries()){const pic=await sharp(path.join(root,r.file)).extract({left:i*r.cellSize,top:0,width:r.cellSize,height:r.cellSize}).resize(size,size).png().toBuffer();parts.push({input:pic,left:460+j*175,top:y+Math.floor((96-size)/2)});}
 row++;
}}
const h=100+row*120;const svg=`<svg width="1040" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="1040" height="${h}" fill="#e9dfc9"/><g font-family="Arial, sans-serif" fill="#30251c"><text x="24" y="32" font-size="23">Icon candidate proof · literal PNG sizes</text><text x="460" y="65" font-size="18">96px</text><text x="635" y="65" font-size="18">32px</text><text x="810" y="65" font-size="18">24px</text>${labels.join('')}</g></svg>`;
await sharp(Buffer.from(svg)).composite(parts).png().toFile(path.join(root,'proofs/02-icon-sizes.png'));
console.log(rows.map(x=>({id:x.id,width:x.width,height:x.height})))
})().catch(e=>{console.error(e);process.exit(1)});
