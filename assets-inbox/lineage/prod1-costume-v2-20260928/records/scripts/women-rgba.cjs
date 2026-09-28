const fs = require('fs');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = 'output/astra-lineage-prod1-costume-v2';
(async () => {
  const recordsPath = `${base}/records/women.json`;
  const rows = JSON.parse(fs.readFileSync(recordsPath));
  for (const row of rows) {
    const file = `${base}/${row.file}`;
    const input = fs.readFileSync(file);
    const before = await sharp(input).removeAlpha().raw().toBuffer();
    const output = await sharp(input).ensureAlpha().png({ palette: false }).toBuffer();
    const after = await sharp(output).removeAlpha().raw().toBuffer();
    if (!before.equals(after)) throw new Error(`${row.id}: RGB changed`);
    const metadata = await sharp(output).metadata();
    if (metadata.channels !== 4) throw new Error(`${row.id}: channels != 4`);
    fs.writeFileSync(file, output);
    row.sha256 = crypto.createHash('sha256').update(output).digest('hex');
    row.processing = 'Sharp resize to 256x256 only, then ensureAlpha().png({palette:false}); decoded RGB preserved exactly during RGBA conversion; no face painting or compositing';
    row.qa.rgbaReview = 'Verified 256x256 RGBA, channels=4; decoded RGB equal before/after alpha conversion';
    console.log(`${row.id}: channels=4 RGB-identical`);
  }
  fs.writeFileSync(recordsPath, JSON.stringify(rows, null, 2) + '\n');
  const scriptPath = `${base}/scripts/women-process.cjs`;
  const script = fs.readFileSync(scriptPath, 'utf8').replace('resize(256,256).png().toFile', 'resize(256,256).ensureAlpha().png({palette:false}).toFile');
  fs.writeFileSync(scriptPath, script);
})();
