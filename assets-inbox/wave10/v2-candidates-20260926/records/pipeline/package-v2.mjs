import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const catalogPath = path.resolve(process.argv[2] ?? '/tmp/astra-wave10-v2-work/catalog.json');
const root = path.resolve(process.argv[3] ?? '/tmp/astra-wave10-v2-work/deliverable');
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const fail = (message) => { throw new Error(message); };
const text = (value, name) => typeof value === 'string' && value.trim() ? value : fail(`${name}: nonempty text required`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const csv = (rows) => '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
const inside = (relative) => {
  text(relative, 'path');
  if (path.isAbsolute(relative)) fail(`Package-relative path required: ${relative}`);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) fail(`Path outside package: ${relative}`);
  return target;
};
const paeth = (a, b, c) => {
  const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c);
  return x <= y && x <= z ? a : y <= z ? b : c;
};
function inspectPng(bytes, name, isAsset) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail(`Not PNG: ${name}`);
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0, ended = false;
  const chunks = [];
  for (let cursor = 8; cursor + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(cursor);
    const kind = bytes.toString('ascii', cursor + 4, cursor + 8);
    if (cursor + length + 12 > bytes.length) fail(`Truncated PNG: ${name}`);
    const body = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (kind === 'IHDR') {
      if (length !== 13) fail(`Invalid IHDR: ${name}`);
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; type = body[9]; interlace = body[12];
    }
    if (kind === 'IDAT') chunks.push(body);
    if (kind === 'IEND') { ended = true; break; }
    cursor += length + 12;
  }
  if (!ended || !width || !height || !chunks.length) fail(`Incomplete PNG: ${name}`);
  if (isAsset && (width !== 256 || height !== 256 || depth !== 8 || type !== 6 || interlace !== 0)) fail(`Asset must be noninterlaced 256x256 8-bit RGBA: ${name}`);
  const raw = inflateSync(Buffer.concat(chunks));
  let transparentPixels = null, nonzeroAlphaPixels = null;
  if (type === 6 && depth === 8 && interlace === 0) {
    const stride = width * 4;
    if (raw.length !== height * (stride + 1)) fail(`Decoded PNG size mismatch: ${name}`);
    let previous = Buffer.alloc(stride);
    transparentPixels = 0; nonzeroAlphaPixels = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)], row = Buffer.alloc(stride);
      if (filter > 4) fail(`Invalid PNG filter: ${name}`);
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0, b = previous[x], c = x >= 4 ? previous[x - 4] : 0;
        row[x] = (raw[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
        if (x % 4 === 3) { if (row[x] === 0) transparentPixels++; else nonzeroAlphaPixels++; }
      }
      previous = row;
    }
  }
  return { width, height, bit_depth: depth, color_type: type, transparent_pixels: transparentPixels, nonzero_alpha_pixels: nonzeroAlphaPixels };
}
async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(target));
    else if (entry.isFile()) result.push(target);
  }
  return result.sort();
}
if (!Array.isArray(catalog.assets) || !Array.isArray(catalog.proofs)) fail('catalog.assets and catalog.proofs arrays required');
const expectedCounts = { face: 20, age: 8, hair: 18, hair_tucked: 9, hair_child: 6, beard: 19, headwear: 4, garment: 2 };
const actualCounts = catalog.assets.reduce((result, asset) => ({ ...result, [asset.kind]: (result[asset.kind] ?? 0) + 1 }), {});
if (catalog.assets.length !== 86 || Object.keys(actualCounts).some((kind) => !(kind in expectedCounts)) || Object.entries(expectedCounts).some(([kind, count]) => actualCounts[kind] !== count)) fail(`Expected 86 assets with contracted kinds: ${JSON.stringify(actualCounts)}`);
const sources = new Map();
const sourceRecords = Array.isArray(catalog.sources) ? catalog.sources : Object.entries(catalog.sources ?? {}).map(([id, source]) => ({ id, ...source }));
for (const source of sourceRecords) {
  const id = text(source.id, 'source id');
  if (sources.has(id)) fail(`Duplicate source id: ${id}`);
  const bytes = await fs.readFile(inside(source.path));
  const digest = sha256(bytes);
  if (source.sha256 && source.sha256 !== digest) fail(`Source hash mismatch: ${id}`);
  sources.set(id, { ...source, sha256: digest });
}
const anchorColumns = ['crown_x', 'crown_y', 'hairline_x', 'hairline_y', 'eye_line_y', 'ear_x', 'ear_y', 'chin_x', 'chin_y', 'shoulder_y'];
const rows = [['logical_id', 'file', 'kind', 'role', 'part', 'size_class', 'collar', ...anchorColumns, 'source_ids', 'source_paths', 'source_sha256', 'full_prompt', 'processing_json', 'usage_policy', 'status', 'sha256', 'width', 'height', 'transparent_pixels', 'nonzero_alpha_pixels']];
const logicalRows = [['logical_id', 'kind', 'size_class', 'collar', ...anchorColumns, 'code_only', 'files', 'source_ids', 'full_prompt', 'processing_json', 'usage_policy', 'status']];
const seen = new Set(), filePaths = new Set(), checked = [], counts = {};
let codeOnlyCount = 0;
for (const asset of catalog.assets) {
  const id = text(asset.id, 'asset id');
  if (seen.has(id)) fail(`Duplicate asset id: ${id}`);
  seen.add(id);
  text(asset.kind, `${id}.kind`);
  if (asset.status !== 'candidate') fail(`Only candidate status allowed: ${id}`);
  if (!['adult', 'child'].includes(asset.size_class)) fail(`Invalid size_class: ${id}`);
  if (![null, 'fur', 'plain', 'hood'].includes(asset.collar)) fail(`Invalid collar: ${id}`);
  if (!Array.isArray(asset.files) || !Array.isArray(asset.source_ids) || !Array.isArray(asset.processing)) fail(`files/source_ids/processing arrays required: ${id}`);
  const anchors = asset.anchors;
  for (const key of ['crown', 'hairline', 'ear', 'chin']) {
    if (!Array.isArray(anchors?.[key]) || anchors[key].length !== 2 || anchors[key].some((value) => !Number.isFinite(value))) fail(`Invalid anchor ${key}: ${id}`);
  }
  for (const key of ['eye_line_y', 'shoulder_y']) if (!Number.isFinite(anchors[key])) fail(`Invalid anchor ${key}: ${id}`);
  const anchorValues = [...anchors.crown, ...anchors.hairline, anchors.eye_line_y, ...anchors.ear, ...anchors.chin, anchors.shoulder_y];
  const codeOnly = id === 'pt_beard_09';
  const usagePolicy = asset.kind === 'beard' && asset.size_class === 'child' ? 'geometric_fit_test_only; age_inappropriate; excluded_from_random_sampler' : asset.usage_policy ?? '';
  if (codeOnly) { codeOnlyCount++; if (asset.files.length) fail('pt_beard_09 must remain code-only'); }
  else if (!asset.files.length) fail(`Asset has no files: ${id}`);
  if (!codeOnly) text(asset.prompt, `${id}.prompt`);
  const references = asset.source_ids.map((sourceId) => sources.get(sourceId) ?? fail(`Unresolved source_id ${sourceId} on ${id}`));
  if (!codeOnly && references.length === 0) fail(`Missing source provenance: ${id}`);
  if (['garment', 'clothing'].includes(asset.kind) && asset.collar === null) fail(`Garment collar tag required: ${id}`);
  counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
  for (const file of asset.files) {
    if (filePaths.has(file.path)) fail(`Duplicate asset file: ${file.path}`);
    filePaths.add(file.path);
    text(file.role, `${file.path}.role`);
    const bytes = await fs.readFile(inside(file.path));
    const info = inspectPng(bytes, file.path, true);
    const mask = /mask|hairclip|haircolor/.test(file.role) || /_(skinmask|haircolor|hairclip)\.png$/.test(file.path);
    const permittedEmptyRear = id === 'pt_hair_m_06' && file.part === 'rear' && (
      (file.path === 'layers/pt_hair_m_06_rear.png' && file.role === 'layer') ||
      (file.path === 'masks/pt_hair_m_06_rear_haircolor.png' && file.role === 'haircolor')
    );
    if (info.nonzero_alpha_pixels === 0 && !permittedEmptyRear) fail(`Empty asset PNG is not permitted: ${file.path}`);
    if (!mask && info.transparent_pixels === 0) fail(`Layer lacks transparency: ${file.path}`);
    const digest = sha256(bytes);
    checked.push({ id, file: file.path, role: file.role, mask, sha256: digest, ...info, ...(permittedEmptyRear && info.nonzero_alpha_pixels === 0 ? { empty_reason: 'pt_hair_m_06 revision2 single-front stubble ring has no rear artwork; retained transparent rear slot and mask' } : {}) });
    rows.push([id, file.path, asset.kind, file.role, file.part, asset.size_class, asset.collar, ...anchorValues, asset.source_ids.join(';'), references.map((source) => source.path).join(';'), references.map((source) => source.sha256).join(';'), asset.prompt, JSON.stringify(asset.processing), usagePolicy, 'candidate', digest, info.width, info.height, info.transparent_pixels, info.nonzero_alpha_pixels]);
  }
  logicalRows.push([id, asset.kind, asset.size_class, asset.collar, ...anchorValues, codeOnly, asset.files.map((file) => file.path).join(';'), asset.source_ids.join(';'), asset.prompt, JSON.stringify(asset.processing), usagePolicy, 'candidate']);
}
if (codeOnlyCount !== 1) fail('Exactly one pt_beard_09 code-only record required');
const headwear = catalog.assets.filter((asset) => asset.kind === 'headwear');
if (headwear.length !== 4 || headwear.filter((asset) => asset.size_class === 'adult').length !== 2 || headwear.filter((asset) => asset.size_class === 'child').length !== 2) fail('Four headwear sets required: two adult and two child');
if (headwear.some((asset) => !asset.files.some((file) => /hairclip/.test(file.role) || /_hairclip\.png$/.test(file.path)))) fail('Each headwear set needs its hairclip mask');
if (catalog.assets.filter((asset) => ['garment', 'clothing'].includes(asset.kind)).length !== 2) fail('Two garment sets required');
if (catalog.proofs.length !== 5) fail('Five proof groups required');
const proofFiles = [], proofIds = new Set();
for (let index = 0; index < catalog.proofs.length; index++) {
  const group = catalog.proofs[index];
  text(group.id, 'proof id');
  if (proofIds.has(group.id)) fail(`Duplicate proof id: ${group.id}`);
  proofIds.add(group.id);
  if (!Array.isArray(group.files) || group.files.length !== (index === 4 ? 4 : 2)) fail(`Proof group ${group.id} has wrong file count`);
  const combinations = new Set();
  for (const item of group.files) {
    const file = typeof item === 'string' ? { path: item } : item;
    const size = Number(file.size ?? file.path.match(/(?:^|[^0-9])(256|96)(?:[^0-9]|$)/)?.[1]);
    if (![96, 256].includes(size)) fail(`Proof size metadata or filename marker required: ${file.path}`);
    const background = file.background ?? (file.path.includes('dark') ? 'dark' : file.path.includes('light') ? 'light' : null);
    if (index === 4 && !['dark', 'light'].includes(background)) fail(`Edge proof dark/light marker required: ${file.path}`);
    const combination = `${size}:${index === 4 ? background : ''}`;
    if (combinations.has(combination)) fail(`Duplicate proof size/background: ${group.id}`);
    combinations.add(combination);
    if (filePaths.has(file.path)) fail(`Duplicate proof file: ${file.path}`);
    filePaths.add(file.path);
    const bytes = await fs.readFile(inside(file.path));
    proofFiles.push({ group: group.id, file: file.path, portrait_size: size, background, sha256: sha256(bytes), ...inspectPng(bytes, file.path, false) });
  }
}
for (const target of await walk(root)) {
  const relative = path.relative(root, target).split(path.sep).join('/');
  if (/^(layers|masks|checks)\//.test(relative) && relative.endsWith('.png') && !filePaths.has(relative)) fail(`PNG missing from catalog: ${relative}`);
}
const layerCount = checked.filter((file) => !file.mask).length, maskCount = checked.length - layerCount;
const validation = {
  status: 'candidate', technical_result: 'PASS',
  technical_scope: ['catalog_inventory', '256x256_RGBA_assets', 'PNG_decompression', 'layer_alpha_presence', 'declared_anchor_fields', 'source_hashes', 'five_proof_groups_twelve_files'],
  visual_result: 'NOT_EVALUATED_BY_THIS_SCRIPT', game_installation: 'NOT_PERFORMED',
  anchor_note: 'CSV 기준점은 선언/변환 기록이며 픽셀 실측 또는 시각 판정 통과 증거가 아님.',
  logical_count: catalog.assets.length, counts, layer_png_count: layerCount, mask_png_count: maskCount,
  proof_png_count: proofFiles.length, sources: [...sources.values()], files: checked, proofs: proofFiles,
  qa: catalog.qa ?? null,
};
await fs.writeFile(path.join(root, 'assets.csv'), csv(rows));
await fs.writeFile(path.join(root, 'logical-assets.csv'), csv(logicalRows));
await fs.writeFile(path.join(root, 'technical-validation.json'), JSON.stringify(validation, null, 2) + '\n');
await fs.writeFile(path.join(root, 'README.md'), `# ASTRA Wave 10 레이어 결합 규격 v2 후보\n\n상태: **candidate / 후보**. 게임 설치는 수행하지 않았습니다.\n\n- 논리 항목 ${catalog.assets.length}개: ${Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(', ')}.\n- 레이어 PNG ${layerCount}개, 마스크 PNG ${maskCount}개. 레이어·마스크는 256×256 RGBA.\n- 확인 그림 5개 묶음, 총 ${proofFiles.length} PNG: 각 256px·96px, 가장자리 검사는 짙은/밝은 배경 각각 두 크기.\n- pt_beard_09는 깨끗이 면도 코드 상태이며 PNG가 없습니다.\n- pt_hair_m_06은 앞쪽의 짧은 삭발 고리로 구성되어 뒤쪽 PNG와 해당 haircolor 마스크만 의도적으로 완전 투명합니다. 다른 레이어·마스크의 빈 그림은 허용하지 않습니다.\n\n## 합성 규칙\n\n머리와 뒷머리는 해당 머리쓰개의 hairclip으로 자릅니다. 흰색은 머리카락을 보여도 되는 영역입니다. 덮개 아래 변형은 tucked 표기로 구분합니다. adult/child 등급을 맞추며 후드 망토와 collar=fur 의복은 함께 사용하지 않습니다. tucked 9종은 앞·뒤로 분리합니다. 어린이 수염 9종은 성인 원본을 88% 축소·등록한 기하학적 결합 시험 전용이며, 나이에 적절한 캐릭터 표현을 뜻하지 않습니다. 무작위 48명에서 어린이에게 수염이나 나이 overlay를 적용하지 않는 정책입니다. 실제 무작위 선택 기록과 시험 결과는 검수표를 참조하세요.\n\n성인 선언 기준: 정수리 (119,40), 이마선 (105,70), 눈선 y=112, 귀 (150,120), 턱 (98,168), 어깨 y=208. 어린이 선언 기준: 정수리 (120,56), 이마선 (104,82), 눈선 y=112, 귀 (147.36,120), 턱 (101.6,160), 어깨 y=208.\n\nCSV에 정수리·이마선·눈선·귀·턱·어깨의 6개 기준, size_class와 collar를 기록합니다. 좌표는 선언 및 후처리 기록이며 이 도구가 실제 그림의 위치를 실측했다는 뜻은 아닙니다. 원본 파일·SHA256·전체 생성 프롬프트·후처리 내역도 CSV에서 추적할 수 있습니다.\n\n## 검증 범위\n\ntechnical-validation.json의 PASS는 파일 수, PNG 형식·크기·알파 존재, 메타데이터, 원본 해시와 확인 그림 파일 구성을 대상으로 합니다. 헤일로, 머리카락 돌출, 인물 구별, 동일인의 노화, 36칸·48명 결함 0건은 자동 승인하지 않습니다. 실제 시각 판정과 결함 번호·칸은 별도 검수표를 확인하세요. 피부톤·체형·머리색에 계급이나 도덕적 의미를 부여하지 않습니다.\n\nassets.csv는 실제 파일별 기록, logical-assets.csv는 논리 항목별 기록입니다. SHA256SUMS는 자기 자신을 제외한 패키지 내 모든 파일을 기록합니다.\n`);
const sums = [];
for (const target of await walk(root)) {
  const relative = path.relative(root, target).split(path.sep).join('/');
  if (relative !== 'SHA256SUMS') sums.push(`${sha256(await fs.readFile(target))}  ${relative}`);
}
await fs.writeFile(path.join(root, 'SHA256SUMS'), sums.join('\n') + '\n');
console.log(JSON.stringify({ status: 'candidate', technical_result: 'PASS', output: root, logical_count: catalog.assets.length, layer_count: layerCount, mask_count: maskCount, proof_count: proofFiles.length, hashed_files: sums.length }, null, 2));
