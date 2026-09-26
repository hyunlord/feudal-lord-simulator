const fs = require('fs');
const path = require('path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('output/astra-wave13-candidates-v1');
const specs = [
  ['ox',96,74,'large'],['horse_draught',96,80,'large'],['horse_riding',96,80,'large'],['cow_single',80,64,'large'],
  ['sheep_single',48,40,'small'],['pig_single',48,40,'small'],['goose_single',32,32,'small'],['dog_herding',40,32,'small']
];
async function main() {
  const results = [];
  for (const [id,w,h,family] of specs) {
    const img = await sharp(`${root}/assets/animal_walk/${id}-v1.png`).ensureAlpha().raw().toBuffer();
    const alias = { sheep_single:'sheep', pig_single:'pig', goose_single:'goose', dog_herding:'dog' }[id] || id;
    for (let d=0;d<4;d++) {
      const maskFile = family==='large' ? `records/large-animals-${id}-${d}-protected-mask.png` : `records/small-animals-${alias}-protected-${d}.png`;
      const mask = await sharp(root+'/'+maskFile).greyscale().removeAlpha().raw().toBuffer();
      if (mask.length!==w*h) throw Error('mask size '+maskFile);
      let protectedPixels=0, protectedDifferences=0, changedLegPixels=0;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const a=(y*w*4+d*w+x)*4,b=((y+h)*w*4+d*w+x)*4;
        const different=[0,1,2,3].some(k=>img[a+k]!==img[b+k]);
        if(mask[y*w+x]>127){protectedPixels++;if(different)protectedDifferences++;}
        else if(different)changedLegPixels++;
      }
      if(protectedDifferences!==0||changedLegPixels===0) throw Error(`${id}/${d} protected:${protectedDifferences} legs:${changedLegPixels}`);
      results.push({id,direction:['NE','SE','SW','NW'][d],mask:maskFile,protectedPixels,protectedDifferences,changedLegPixels});
    }
  }
  fs.writeFileSync(root+'/records/independent-motion-check.json',JSON.stringify({method:'Direct comparison of final PNG RGBA bytes under saved protected masks; mask anatomical validity separately inspected visually.',pairs:32,results},null,2));
  console.log('32 animal direction pairs: protected RGBA identical, nonzero leg changes');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
