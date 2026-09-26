const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const descriptions={scene_population_up:'인구 증가: 시민과 위 화살표',scene_population_down:'인구 감소: 시민과 아래 화살표',scene_household_arrival:'가구 입주: 가족이 문 안으로',scene_household_departure:'가구 이탈: 가족이 문 밖으로',scene_house_hungry:'굶은 집: 집과 빈 그릇',scene_house_fed:'다시 먹는 집: 집과 가득 찬 그릇',scene_bread_shortage:'빵 부족: 거의 빈 빵 바구니',scene_bread_reserve:'빵 비축: 가득 찬 빵 바구니'};
(async()=>{const rows=[],composites=[];let i=0;for(const [id,description] of Object.entries(descriptions)){
 const rawFile=`raw/scenes_people/${id}-v1.png`,file=`assets/scenes_people/${id}.png`;
 const input=sharp(path.join(root,rawFile)).ensureAlpha();const raw=await input.raw().toBuffer({resolveWithObject:true});
 let x0=raw.info.width,y0=raw.info.height,x1=0,y1=0;for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)};
 const crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
 const content=await sharp(path.join(root,rawFile)).extract(crop).resize(84,84,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 await sharp(content).extend({top:6,bottom:6,left:6,right:6,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(root,file));
 const meta=await sharp(path.join(root,file)).metadata();if(meta.width!==96||meta.height!==96||meta.channels!==4)throw Error(id+' invalid');
 const prompt=fs.readFileSync(path.join(root,`raw/scenes_people/${id}-prompt.txt`),'utf8').trim();
 rows.push({id,file,width:96,height:96,description,generationRecords:[{prompt,rawFile,referenceImages:['references/scenes-people-p0-resources.png','references/scenes-people-p0-causes.png'],tool:'image_gen.imagegen',model:null,seed:null}],processing:{method:'Alpha bounds threshold8 then contain84x84 transparent plus6px margins; original alpha retained.',crop,rawWidth:raw.info.width,rawHeight:raw.info.height},qa:{dimensions:true,rgba:true,visualReview:'pass_with_24px_detail_limits',reviewSizes:[24,32,48,96],noText:true,candidateOnly:true,notes:id.includes('household')?'24px family-door position distinguishes arrival/departure; small curved arrows clearer at32px.':id.includes('house_')?'24px empty/full bowls and X/check distinguish; no chimney.':'24px arrow direction or empty/full basket silhouette distinguishes.',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}});
 for(const [j,size] of [24,32,48,96].entries())composites.push({input:await sharp(path.join(root,file)).resize(size,size).png().toBuffer(),left:20+j*125,top:20+i*116}); i++;
 }
 await sharp({create:{width:520,height:950,channels:4,background:'#e4d5b3'}}).composite(composites).png().toFile(path.join(root,'raw/scenes_people/contact-24-32-48-96.png'));
 fs.writeFileSync(path.join(root,'records/metadata-scenes-people.json'),JSON.stringify(rows,null,2)+'\n');console.log('Processed',rows.length);
})();
