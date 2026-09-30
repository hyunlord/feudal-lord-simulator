const fs = require('fs');
const path = require('path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const asset = (group, id) => path.join(root, 'assets', group, id + '.png');
const layers = [];
const label = (value, x, y, size = 18, fill = '#473621') => `<text x="${x}" y="${y}" font-family="Apple SD Gothic Neo,Arial,sans-serif" font-size="${size}" fill="${fill}">${value}</text>`;
async function place(file, left, top, width, height) {
  layers.push({ input: await sharp(file).resize(width, height, { fit: 'contain', background: '#00000000' }).png().toBuffer(), left, top });
}
async function nineSlice(file, left, top, width, height, margin) {
  const { width: sw, height: sh } = await sharp(file).metadata();
  const [l, t, r, b] = margin;
  const xs = [0, l, sw - r, sw], ys = [0, t, sh - b, sh];
  const dx = [0, l, width - r, width], dy = [0, t, height - b, height];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const input = await sharp(file).extract({ left: xs[x], top: ys[y], width: xs[x + 1] - xs[x], height: ys[y + 1] - ys[y] }).resize(dx[x + 1] - dx[x], dy[y + 1] - dy[y], { fit: 'fill' }).png().toBuffer();
    layers.push({ input, left: left + dx[x], top: top + dy[y] });
  }
}
async function run() {
  const cards = [['estate_ordinary', '평범한 장원'], ['estate_moated', '해자 너머 이웃 영지'], ['estate_riverside_mill', '강가 방앗간 영지'], ['estate_declining', '늙은 영주의 장원']];
  let text = label('영지와 약속', 30, 39, 26) + label('오프라인 조립 확인 · 임시 문구 · 실제 게임 화면 아님', 770, 36, 15);
  for (let i = 0; i < 4; i++) {
    const [id, title] = cards[i];
    const x = 24 + (i % 2) * 410, y = 64 + Math.floor(i / 2) * 221;
    await place(asset('A_estates', id), x, y, 388, 190);
    text += label(title, x + 20, y + 210, 17);
  }
  await nineSlice(asset('C_promises', 'ledger_book'), 24, 522, 824, 244, [72, 72, 72, 72]);
  layers.push({ input: await sharp(asset('C_promises', 'ledger_spine')).resize(24, 192, { fit: 'fill' }).png().toBuffer(), left: 424, top: 548 });
  text += label('약속 장부', 81, 566, 22) + label('이행과 기한', 489, 566, 22);
  const promises = [['promise_active', '겨울 곡물 공급', '진행 중'], ['promise_kept', '통행권 보장', '지킴'], ['promise_broken', '담장 보수 지원', '어김'], ['promise_due', '차입금 상환', '기한 임박']];
  for (let i = 0; i < promises.length; i++) {
    const [id, title, state] = promises[i], x = i < 2 ? 78 : 488, y = 585 + (i % 2) * 74;
    await place(asset('C_promises', id), x, y, 48, 48);
    text += label(title, x + 57, y + 20, 17) + label(state, x + 57, y + 43, 15, '#76513c');
  }
  await nineSlice(asset('E_receipts', 'receipt_frame'), 872, 64, 384, 702, [40, 190, 40, 110]);
  await place(asset('A_estates', 'estate_riverside_mill'), 918, 120, 290, 102);
  text += label('왜 이곳에 들어섰나?', 912, 276, 21) + label('방앗간 곁의 작은 창고', 912, 316, 18)
    + label('가까운 운송로', 930, 374, 18) + label('곡물 수요 증가', 930, 421, 18) + label('영주의 하역 허가', 930, 468, 18)
    + label('목격과 기한', 930, 529, 17) + label('청지기 입회 · 다음 감사일', 930, 571, 16)
    + label('당신의 결정', 912, 700, 17) + label('하역 권리와 장려금 승인', 912, 732, 16);
  await place(asset('C_promises', 'witness_seal'), 912, 592, 38, 38);
  await place(asset('C_promises', 'deadline_marker'), 970, 592, 38, 38);
  layers.push({ input: Buffer.from(`<svg width="1280" height="800" xmlns="http://www.w3.org/2000/svg">${text}</svg>`), left: 0, top: 0 });
  fs.mkdirSync(path.join(root, 'proofs'), { recursive: true });
  const output = path.join(root, 'proofs/02-estates-ledger-receipt.jpg');
  await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#c9b58d' } }).composite(layers).flatten({ background: '#c9b58d' }).jpeg({ quality: 92, mozjpeg: true }).toFile(output);
  console.log(output);
}
run().catch(error => { console.error(error); process.exit(1); });
