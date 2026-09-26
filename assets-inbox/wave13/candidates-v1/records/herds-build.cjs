const fs=require('fs');const path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const dirs=['ne','se','sw','nw'];
const specs=[
 ['sheep_cluster_moving_a-v1','sheep_single-v1',128,96,[[-28,-20],[24,-14],[-13,8],[30,21]]],
 ['sheep_cluster_moving_b-v1','sheep_single-v1',144,112,[[-35,-28],[17,-24],[-37,-2],[13,4],[36,28]]],
 ['pig_cluster-v1','pig_single-v1',128,96,[[-27,-19],[25,-11],[-13,12],[31,21]]],
 ['goose_flock_a-v1','goose_single-v1',96,74,[[-25,-16],[4,-10],[26,-3],[-12,13],[18,20]]],
 ['goose_flock_b-v1','goose_single-v1',96,74,[[-24,-20],[7,-9],[-19,6],[24,20]]],
 ['cattle_drove-v1','cow_single-v1',192,144,[[-46,-26],[6,-3],[44,27]]],
];
async function run(){
 let records=[];for(const name of ['metadata-large-animals.json','metadata-small-animals.json'])if(fs.existsSync(path.join(root,'records',name)))records.push(...JSON.parse(fs.readFileSync(path.join(root,'records',name))));
 const metadata=[];
 for(const [id,animal,w,h,offsets]of specs){
  const src=records.find(r=>r.id===animal||r.id==='animal_walk/'+animal||r.file?.endsWith('/'+animal+'.png'));if(!src){console.log('Pending '+animal);continue;}
  const source=path.join(root,src.file);const [cw,ch]=src.cell; const pivot=src.pivot||[cw/2,ch-4];
  const origin=[Math.round(w/2),Math.round(h*.66)];const composites=[];const cells=[];
  for(let d=0;d<4;d++){
   const cell=await sharp(source).extract({left:d*cw,top:0,width:cw,height:ch}).png().toBuffer();
   const items=offsets.map(([dx,dy],i)=>({i,x:Math.round(origin[0]+dx-pivot[0]),y:Math.round(origin[1]+dy-pivot[1]),foot:[origin[0]+dx,origin[1]+dy]})).sort((a,b)=>a.foot[1]-b.foot[1]||a.foot[0]-b.foot[0]);
   for(const item of items){if(item.x<0||item.y<0||item.x+cw>w||item.y+ch>h)throw Error(`${id} outside ${JSON.stringify(item)} source${cw}x${ch}`);composites.push({input:cell,left:d*w+item.x,top:item.y});}
   cells.push({direction:dirs[d],sourceCell:[d,0],members:items});
  }
  const file='assets/herd/'+id+'.png';await sharp({create:{width:w*4,height:h,channels:4,background:'#00000000'}}).composite(composites).png().toFile(path.join(root,file));
  metadata.push({id:'herd/'+id,file,cell:[w,h],pivot:origin,sheet:[4,1],role:'object',status:'candidate',generationRecords:src.generationRecords,processing:{mode:'deterministic source-cell composition; no new image generation',source:src.file,sourceCells:cells,depthSort:'ascending visible ground anchor y then x',resize:false,mirror:false,ground:false},qa:{rgba:true,memberCount:offsets.length,staticCluster:true,animation:false}});
 }
 if(metadata.length!==specs.length)throw Error('Incomplete herd dependency set');
 fs.writeFileSync(path.join(root,'records/metadata-herds.json'),JSON.stringify(metadata,null,2));
 console.log('herds: '+metadata.length+' sheets');
}
run().catch(e=>{console.error(e);process.exit(1)});
