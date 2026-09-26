import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(process.argv[2] ?? '/tmp/astra-wave10-v2-work');
const raster = path.join(root, 'raster');
const vision = path.join(root, 'landmarks-v2');
const review = path.join(root, 'review');
const rawDir = path.join(review, 'faces-raw256');
const normalizedDir = path.join(review, 'faces-normalized');
await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(normalizedDir, { recursive: true });
function run(binary, args, input) {
  const result = spawnSync(binary, args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(binary)} ${args[0]} failed: ${result.error ?? result.stderr}`);
  return result.stdout;
}
const jsonLines = (text) => text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
async function measure(files) {
  if (!files.length) return new Map();
  const geometry = new Map(jsonLines(run(raster, ['info', ...files])).map((entry) => [entry.path, entry]));
  const observations = jsonLines(run(vision, files));
  return new Map(observations.map((entry) => {
    const bbox = geometry.get(entry.path)?.alpha_thresholds['128'].bbox_xyxy;
    return [entry.path, {
      detection_status: entry.status,
      eye_mean_y: entry.mean_eye_y ?? null,
      near_eye_xy: entry.near_eye_inferred_by_width?.center_xy ?? null,
      far_eye_xy: entry.far_eye_inferred_by_width?.center_xy ?? null,
      chin_xy: entry.chin_xy ?? null,
      chin_y: entry.chin_y ?? null,
      crown_y: bbox?.[1] ?? null,
      neck_bottom_y: bbox?.[3] ?? null,
      alpha128_bbox: bbox ?? null,
      face_confidence: entry.face_confidence ?? null,
      landmark_precision_confidence: null,
      crown_method: 'top of alpha>=128 bounding box',
      chin_method: 'max y of Vision faceContour',
      near_eye_method: 'landmark center of wider eye, inferred',
    }];
  }));
}
function targets(sizeClass) {
  const child = sizeClass === 'child';
  return { crown_y: child ? 56 : 40, eye_mean_y: 112, near_eye_x: child ? 99.84 : 96, chin_y: child ? 160 : 168, neck_bottom_y: child ? 194 : 208, ...(child ? { head_width: 94 } : {}) };
}
function warpFor(measured, target) {
  if (measured?.detection_status !== 'detected' || !measured.alpha128_bbox || !measured.near_eye_xy || measured.chin_y == null) throw new Error('Face landmarks or alpha bounds unavailable');
  const delta = target.near_eye_x - measured.near_eye_xy[0];
  const left = Math.max(1, measured.alpha128_bbox[0] - 8), right = Math.min(255, measured.alpha128_bbox[2] + 8);
  const sourceWidth = measured.alpha128_bbox[2] - measured.alpha128_bbox[0] + 1;
  const horizontalScale = target.head_width ? target.head_width / sourceWidth : 1;
  const translate = (x) => target.near_eye_x + (x - measured.near_eye_xy[0]) * horizontalScale;
  const x = [[0, 0], [left, translate(left)], [right, translate(right)], [256, 256]];

  const y = [[0, 0], [measured.crown_y, target.crown_y], [measured.eye_mean_y, target.eye_mean_y], [measured.chin_y, target.chin_y], [measured.neck_bottom_y, target.neck_bottom_y], [256, 256]];
  for (const knots of [x, y]) for (let i = 1; i < knots.length; i++) {
    if (!(knots[i][0] > knots[i - 1][0] && knots[i][1] > knots[i - 1][1])) throw new Error('Nonmonotonic measured anchors; manual registration required');
  }
  return { x, y };
}
function verdict(measured, target) {
  if (!measured || measured.detection_status !== 'detected') return { pass: false, reason: 'Detection unavailable' };
  const deltas = {
    crown_y: measured.crown_y - target.crown_y,
    eye_mean_y: measured.eye_mean_y - target.eye_mean_y,
    near_eye_x: measured.near_eye_xy[0] - target.near_eye_x,
    chin_y: measured.chin_y - target.chin_y,
    neck_bottom_y: measured.neck_bottom_y - target.neck_bottom_y,
    ...(target.head_width ? { head_width: measured.alpha128_bbox[2] - measured.alpha128_bbox[0] + 1 - target.head_width } : {}),
  };
  return { pass: Math.abs(deltas.crown_y) <= 3 && Math.abs(deltas.eye_mean_y) <= 2 && Math.abs(deltas.chin_y) <= 4 && Math.abs(deltas.near_eye_x) <= 2 && Math.abs(deltas.neck_bottom_y) <= 3 && (!target.head_width || deltas.head_width === 0), deltas, tolerance: { crown_y: 3, eye_mean_y: 2, near_eye_x: 2, chin_y: 4, neck_bottom_y: 3, ...(target.head_width ? { head_width: 0 } : {}) } };
}
const filenames = (await fs.readdir(path.join(root, 'records'))).filter((name) => name.endsWith('.json')).sort();
const records = [];
for (const name of filenames) {
  const record = JSON.parse(await fs.readFile(path.join(root, 'records', name), 'utf8'));
  if (record.kind !== 'face') continue;
  if (!/^pt_face_[fmc]_\d{2}$/.test(record.id) || !['adult', 'child'].includes(record.size_class)) throw new Error(`Invalid face record: ${name}`);
  const raw = path.join(rawDir, `${record.id}.png`), output = path.join(normalizedDir, `${record.id}.png`);
  run(raster, ['resize', record.source, raw, '256', '256']);
  records.push({ id: record.id, size_class: record.size_class, source: record.source, source_sha256: createHash('sha256').update(await fs.readFile(record.source)).digest('hex'), source_revision: record.revision, raw256: raw, normalized: output, target: targets(record.size_class), transformations: [] });
}
const before = await measure(records.map((record) => record.raw256));
for (const record of records) {
  record.source_measured = before.get(record.raw256);
  record.ear = { status: 'NOT_MEASURED', reference: record.size_class === 'adult' ? [150, 120] : null, note: 'virtual reference only; manual ear-center validation required; child ear target not inferred' };
  record.hairline = { status: 'NOT_MEASURED', reference_y: record.size_class === 'adult' ? 70 : null, note: 'bald face has no measurable hairline; virtual reference only' };
  try {
    const warp = warpFor(record.source_measured, record.target);
    run(raster, ['warp', record.raw256, record.normalized, '-'], JSON.stringify(warp));
    record.transformations.push({ stage: 'initial', ...warp });
  } catch (error) { record.error = error.message; }
}
const active = records.filter((record) => !record.error);
const firstPass = await measure(active.map((record) => record.normalized));
const corrected = [];
for (const record of active) {
  record.first_pass_measured = firstPass.get(record.normalized);
  record.first_pass_validation = verdict(record.first_pass_measured, record.target);
  if (!record.first_pass_validation.pass) {
    try {
      const warp = warpFor(record.first_pass_measured, record.target);
      run(raster, ['warp', record.normalized, record.normalized, '-'], JSON.stringify(warp));
      record.transformations.push({ stage: 'single_correction', ...warp });
      corrected.push(record);
    } catch (error) { record.correction_error = error.message; }
  }
}
const secondPass = await measure(corrected.map((record) => record.normalized));
for (const record of records) {
  record.final_measured = secondPass.get(record.normalized) ?? firstPass.get(record.normalized) ?? null;
  record.validation = verdict(record.final_measured, record.target);
}
const manualEarEstimates = { pt_face_m_01: [149,122], pt_face_f_01: [149,124], pt_face_c_01: [149,127], pt_face_c_03: [151,128] };
for (const record of records) if (manualEarEstimates[record.id]) {
  record.ear.manual_observation_before_child_width_adjustment = { xy: manualEarEstimates[record.id], estimated_uncertainty_px: 3, status: 'NOT_VERIFIED', method: 'visual estimate, not calibrated landmark detection' };
}
const report = { generated_at:
 new Date().toISOString(), available_faces: records.length, passing_faces: records.filter((record) => record.validation.pass).length, all_six_anchors_verified: false, limitations: ['Vision provides face confidence, not landmark precision confidence.', 'Ear center and hairline remain NOT_MEASURED; numeric pass covers crown, eyes, chin and alpha neck bottom only.', 'Adult near-eye horizontal translation preserves source face width; child width normalized to exactly94 alpha>=128 pixels around nearEye99.84, faded to canvas edges.', 'No artwork regeneration, skin recoloring, or deliverable asset replacement is performed.'], faces: records };
await fs.writeFile(path.join(root, 'face-registration.json'), JSON.stringify(report, null, 2) + '\n');
await fs.writeFile(path.join(review, 'faces-measured.json'), JSON.stringify(report, null, 2) + '\n');
const columns = 5, cellWidth = 285, cellHeight = 302;
const scene = { width: columns * cellWidth + 24, height: 65 + Math.max(1, Math.ceil(active.length / columns)) * cellHeight, background: '#E8E2D4', images: [], texts: [{ text: `얼굴 정렬 ${active.length}장 / 눈·턱·정수리 측정 / 귀·이마선 NOT_MEASURED`, x: 16, y: 12, size: 19 }] };
for (const [i, record] of active.entries()) {
  const x = 14 + i % columns * cellWidth, y = 55 + Math.floor(i / columns) * cellHeight;
  scene.images.push({ file: record.normalized, x, y, width: 256, height: 256 });
  scene.texts.push({ text: `${record.id} ${record.validation.pass ? 'MEASURED PASS' : 'REVIEW'}`, x, y: y + 260, size: 12 });
  scene.texts.push({ text: `E${record.final_measured?.eye_mean_y?.toFixed(1)} C${record.final_measured?.chin_y?.toFixed(1)} T${record.final_measured?.crown_y}`, x, y: y + 276, size: 11 });
}
const scenePath = path.join(review, 'faces-normalized-board.json');
await fs.writeFile(scenePath, JSON.stringify(scene, null, 2));
run(raster, ['board', path.join(review, 'faces-normalized-board.png'), scenePath]);
console.log(JSON.stringify({ available: records.length, passed_measured_anchors: report.passing_faces, corrected_once: corrected.length, all_six_anchors_verified: false, report: path.join(root, 'face-registration.json'), board: path.join(review, 'faces-normalized-board.png') }));
