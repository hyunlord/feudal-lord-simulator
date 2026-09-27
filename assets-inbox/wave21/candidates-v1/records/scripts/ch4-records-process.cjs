const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.resolve(__dirname, '..');
async function main() {
  const rows = JSON.parse(fs.readFileSync(path.join(base, 'records/metadata-ch4-records.json'), 'utf8'));
  for (const row of rows) {
    const last = row.generationRecords.at(-1);
    await sharp(path.join(base, last.rawFile)).resize(row.width, row.height, {fit:'cover',position:'centre',kernel:'lanczos3'}).ensureAlpha().png().toFile(path.join(base,row.file));
    const meta = await sharp(path.join(base,row.file)).metadata();
    if (meta.width !== row.width || meta.height !== row.height || meta.channels !== 4) throw new Error(row.id);
  }
  const tiles = await Promise.all(rows.map(async (row,i)=>({input:await sharp(path.join(base,row.file)).resize(240,180,{fit:'contain',background:'#d5cec1'}).png().toBuffer(),left:(i%2)*240,top:Math.floor(i/2)*180})));
  await sharp({create:{width:480,height:Math.ceil(rows.length/2)*180,channels:4,background:'#d5cec1'}}).composite(tiles).png().toFile(path.join(base,'raw/ch4_records/contact.png'));
  console.log('Processed '+rows.length+' illustrations');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
