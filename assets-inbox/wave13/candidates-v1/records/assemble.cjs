const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const { createCanvas, loadImage } = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root = path.resolve('output/astra-wave13-candidates-v1');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected = JSON.parse(fs.readFileSync(root + '/records/expected-assets.json'));
async function main() {
  const names = ['large-animals', 'small-animals', 'workers', 'carts', 'tools', 'herds'];
  const all = names.flatMap(n => JSON.parse(fs.readFileSync(`${root}/records/metadata-${n}.json`)));
  if (all.length !== 34 || new Set(all.map(a => a.file)).size !== 34) throw Error('metadata count/duplicates');
  const rows = [], checks = [];
  const c = createCanvas(1440, Math.ceil(34 / 4) * 240 + 65), g = c.getContext('2d');
  g.fillStyle = '#bab69f'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#22291f'; g.font = '22px sans-serif';
  g.fillText('Wave 13 | 34 candidate files | fit-to-cell inspection, not runtime zoom', 20, 33);
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i], file = `assets/${e.id}.png`, a = all.find(a => a.file === file);
    if (!a) throw Error('missing metadata: ' + file);
    const p = root + '/' + file, m = await sharp(p).metadata();
    if ((e.width && (m.width !== e.width || m.height !== e.height)) || m.channels !== 4) throw Error('dimensions/RGBA: ' + file);
    const { data } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
    let transparent = 0, occupied = 0, border = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const alpha = data[(y * m.width + x) * 4 + 3];
      transparent += alpha === 0; occupied += alpha > 0;
      if ((x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1) && alpha > 0) border++;
    }
    if (!transparent || !occupied) throw Error('empty or opaque: ' + file);
    if (!a.generationRecords?.length) throw Error('provenance: ' + file);
    for (const r of a.generationRecords) if (!r.prompt || !r.rawFile || !fs.existsSync(path.resolve(root, r.rawFile))) throw Error('missing prompt/raw: ' + file);
    checks.push({ id: e.id, width: m.width, height: m.height, channels: m.channels, transparentPixels: transparent, occupiedPixels: occupied, borderOccupiedPixels: border });
    rows.push({ asset_id: e.id, status: 'candidate', file, width: m.width, height: m.height, role: 'object', sha256: hash(p), generation_records: JSON.stringify(a.generationRecords.map(r => ({ tool: 'builtin image_gen', model: 'not supplied', seed: 'not supplied', ...r }))), processing: JSON.stringify(a.processing), pivot_or_attachment: JSON.stringify({ cell: a.cell, pivot: a.pivot, anchors: a.anchors }), accepted: 'pending user review', qa: JSON.stringify(a.qa) });
    const im = await loadImage(p), scale = Math.min(330 / m.width, 178 / m.height, 2);
    const x = (i % 4) * 360, y = Math.floor(i / 4) * 240 + 55;
    g.drawImage(im, x + (360 - m.width * scale) / 2, y, m.width * scale, m.height * scale);
    g.fillStyle = '#22291f'; g.font = '14px sans-serif';
    g.fillText(e.id, x + 8, y + 199); g.fillText(`${m.width} × ${m.height}`, x + 8, y + 220);
  }
  for (const r of JSON.parse(fs.readFileSync(root + '/records/reference-hashes.json'))) if (hash(root + '/references/' + r.file) !== r.sha256) throw Error('reference changed: ' + r.file);
  fs.writeFileSync(root + '/records/asset-rows.json', JSON.stringify(rows, null, 2));
  fs.writeFileSync(root + '/records/technical-qa.json', JSON.stringify({ assets: 34, checks }, null, 2));
  fs.writeFileSync(root + '/records/all-assets-contact.png', c.toBuffer('image/png'));
  const articles = rows.map(a => `<article><a href="${a.file}"><img src="${a.file}" alt="${a.asset_id}"></a><p><a href="${a.file}">${a.asset_id}</a><br>${a.width}×${a.height}</p></article>`).join('');
  fs.writeFileSync(root + '/index.html', `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave13 수레·가축 후보</title><style>body{background:#bab69f;color:#22291f;font:16px sans-serif;margin:28px}main{display:flex;flex-wrap:wrap}article{width:340px;padding:12px}img{max-width:330px;max-height:210px;object-fit:contain}a{color:#173955}p{overflow-wrap:anywhere}</style><h1>Wave13 후보 34파일</h1><p>게임 미설치. 축소 판독·움직임은 확인 그림과 검수표 참조.</p><nav><a href="README.md">설명</a> · <a href="검수표.md">검수표</a> · <a href="assets.csv">CSV</a></nav><main>${articles}</main></html>`);
  fs.writeFileSync(root + '/IMAGE_LINKS.md', '# 개별 이미지\n\n' + rows.map(a => `- [${a.asset_id}](${a.file})`).join('\n') + '\n');
  console.log('34 RGBA files, sizes, provenance, unchanged references verified');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
