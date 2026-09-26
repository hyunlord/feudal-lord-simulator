const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
 const metadataPath = path.join(root, 'records/metadata-zone.json');
 const records = JSON.parse(fs.readFileSync(metadataPath));
 const verification = [];
 for (const record of records) {
  // The final generation record selects the approved correction; earlier originals remain intact.
  const selected = record.generationRecords.at(-1);
  const input = path.join(root, selected.rawFile);
  const output = path.join(root, record.file);
  const before = fs.existsSync(output) ? hash(output) : null;
  const target = record.id === 'zone_size_small' ? 30 : record.id === 'zone_size_large' ? 72 : 80;
  const icon = await sharp(input).trim({background:'#00000000', threshold:8})
   .resize(target, target, {fit:'inside', kernel:'lanczos3'}).toBuffer();
  const dimensions = await sharp(icon).metadata();
  await sharp({create:{width:96,height:96,channels:4,background:'#00000000'}})
   .composite([{input:icon,left:Math.floor((96-dimensions.width)/2),top:Math.floor((96-dimensions.height)/2)}])
   .png().toFile(output);
  verification.push({id:record.id,selectedRawFile:selected.rawFile,beforeSha256:before,afterSha256:hash(output),identical:before===hash(output)});
 }
 const composites = [];
 for (let row=0;row<records.length;row++) for (let col=0;col<3;col++) {
  const size = [24,32,48][col];
  composites.push({input:await sharp(path.join(root,records[row].file)).resize(size,size).toBuffer(),left:col*96+(96-size)/2,top:row*72+(72-size)/2});
 }
 await sharp({create:{width:288,height:records.length*72,channels:4,background:'#e6d6b5'}})
  .composite(composites).png().toFile(path.join(root,'raw/zone/contact-24-32-48.png'));
 fs.writeFileSync(path.join(root,'records/zone-reproduction-check.json'),JSON.stringify(verification,null,2));
 console.log(JSON.stringify(verification));
})().catch(error => {console.error(error);process.exitCode=1;});
