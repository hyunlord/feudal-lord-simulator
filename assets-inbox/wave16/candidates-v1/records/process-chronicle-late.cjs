const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'chronicle-late-prompts.json'), 'utf8'));
async function main() {
  const sourceMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'chronicle-late-generated.json'), 'utf8'));
  const rows=[];
  for (const item of prompts) {
    const source = sourceMap[item.id];
    if (!source) throw new Error(`Missing generated source: ${item.id}`);
    const rawFile = `raw/chronicle-late/${item.id}.png`;
    fs.copyFileSync(source, path.join(root, rawFile));
    const raw = await sharp(path.join(root, rawFile)).metadata();
    const file = `assets/chronicle/${item.id}.png`;
    await sharp(path.join(root, rawFile)).resize(384,384,{fit:'cover',position:'centre',kernel:'lanczos3'}).ensureAlpha().png().toFile(path.join(root,file));
    rows.push({id:item.id,file,width:384,height:384,sceneDescription:item.sceneDescription,characters:item.characters,historyNotes:'1300–1318 잉글랜드 남부. 참조의 문 X표식은 배제. 무문자·무숫자, 주택 굴뚝·홉·육각 관·흑사병 장면 없음. 연대기는 약한 채식 구도만 차용.',generationRecords:[{tool:'builtin image_gen',prompt:item.prompt,rawFile,referenceImages:item.referenceImages,model:'not supplied',seed:'not supplied'}],processing:{sourceWidth:raw.width,sourceHeight:raw.height,output:'384×384 RGBA PNG',operation:'Lanczos3 fit-cover centre resize, no stretching, no drawn additions'},qa:{visualReview:'pending'}});
  }
  fs.writeFileSync(path.join(__dirname,'metadata-chronicle-late.json'),JSON.stringify(rows,null,2));
  const panels=await Promise.all(rows.map(async(r,i)=>({input:await sharp(path.join(root,r.file)).resize(192,192).toBuffer(),left:(i%4)*192,top:Math.floor(i/4)*192})));
  await sharp({create:{width:768,height:384,channels:4,background:'#ddd4bd'}}).composite(panels).png().toFile(path.join(__dirname,'contact-chronicle-late.png'));
}
main().catch(e=>{console.error(e);process.exit(1);});
