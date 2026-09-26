import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(process.argv[2] ?? '/tmp/astra-portrait-pivot-work');
const out = path.join(root, 'deliverable');
const raster = process.env.PIVOT_RASTER ?? '/tmp/astra-wave10-v2-work/raster';
const roster = JSON.parse(fs.readFileSync(path.join(root, 'roster.json'), 'utf8'));
const people = roster.portraits;
const chains = roster.chain_candidates.map(p => typeof p === 'string' ? p : p.id);
const checks = path.join(out, 'checks');
const scenes = path.join(out, 'provenance', 'proof-scenes');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const csvCell = value => `"${String(Array.isArray(value) ? value.join('; ') : value ?? '').replaceAll('"', '""')}"`;
function assert(condition, text) { if (!condition) throw new Error(text); }
assert(people.length === 36 && new Set(people.map(p => p.id)).size === 36, 'Expected 36 distinct portrait IDs');
assert(chains.length === 4 && new Set(chains).size === 4, 'Expected four distinct aging identities');
for (const id of chains) assert(people.some(p => p.id === id && p.age_group === 'young'), `Chain identity must be a young pool portrait: ${id}`);
const expectedAxes={sex:{m:18,f:18},age_group:{child:4,young:10,mature:12,old:10},class:{labour:6,artisan:6,merchant:6,gentry:6,clerical:6,poor_servant:6},body:{thin:12,average:12,fat:12},direction:{left:12,right:12,front:12}};
const axisCounts={};
for(const [axis,expected] of Object.entries(expectedAxes)) {
  const counts=people.reduce((a,p)=>(a[p[axis]]=(a[p[axis]]??0)+1,a),{});
  assert(Object.keys(counts).length===Object.keys(expected).length && Object.entries(expected).every(([value,count])=>counts[value]===count), `Roster axis counts fail: ${axis}: ${JSON.stringify(counts)}`);
  axisCounts[axis]=counts;
}
const recordsDir = path.join(root, 'generation-records');
const files = people.map(p => ({...p, file:`portraits/${p.id}.png`, stage:'pool', identity_id:p.id, record_id:p.id}));
for (const id of chains) {
  const p = people.find(p => p.id === id);
  for (const stage of ['young','mature','old']) files.push({...p, id:`${id}_${stage}`, identity_id:id, stage, age_group:stage, age:stage === 'young' ? p.age : stage === 'mature' ? 45 : 70, file:`aging/${id}_${stage}.png`, record_id:stage === 'young' ? id : `${id}_${stage}`});
}
const dimensions = [];
for (const p of files) {
  const target = path.join(out, p.file);
  assert(fs.existsSync(target), `Missing portrait: ${target}`);
  const info = JSON.parse(execFileSync(raster, ['info',target], {encoding:'utf8'}));
  assert(info.width === 256 && info.height === 256, `Expected 256×256: ${p.file}`);
  assert(info.transparent_pixels === 0 && info.partial_alpha_pixels === 0, `Expected opaque background: ${p.file}`);
  dimensions.push({file:p.file,width:info.width,height:info.height,sha256:hash(target)});
  const recordFile = path.join(recordsDir, `${p.record_id}.json`);
  assert(fs.existsSync(recordFile), `Missing generation record: ${recordFile}`);
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const metadataOverrides = record.metadata_overrides ?? {};
  assert(typeof metadataOverrides === 'object' && !Array.isArray(metadataOverrides), `Invalid metadata overrides: ${p.record_id}`);
  for (const [key,value] of Object.entries(metadataOverrides)) {
    assert(['hair_color','skin_tone','features','clothing'].includes(key), `Unsupported metadata override ${key}: ${p.record_id}`);
    assert(typeof value === 'string' && value.trim().length > 0, `Invalid metadata override ${key}: ${p.record_id}`);
    p[key] = value;
  }
  assert(typeof record.prompt === 'string' && record.prompt.length > 20, `Missing full prompt: ${p.record_id}`);
  assert(record.source_path && fs.existsSync(record.source_path), `Missing source PNG: ${p.record_id}`);
  const sourceRel = `provenance/raw/${p.record_id}${path.extname(record.source_path) || '.png'}`;
  fs.mkdirSync(path.join(out,'provenance/raw'),{recursive:true});
  fs.copyFileSync(record.source_path,path.join(out,sourceRel));
  const refs = (record.references ?? []).map(ref => typeof ref === 'string' ? ref : ref.path).filter(Boolean);
  const packagedRefs = [];
  for (const ref of refs) {
    assert(fs.existsSync(ref), `Missing reference: ${ref}`);
    const dest = `provenance/references/${hash(ref).slice(0,12)}-${path.basename(ref)}`;
    fs.mkdirSync(path.dirname(path.join(out,dest)),{recursive:true});
    fs.copyFileSync(ref,path.join(out,dest)); packagedRefs.push(dest);
  }
  p.prompt = record.prompt; p.source_file = sourceRel; p.reference_files = packagedRefs; p.source_sha256 = hash(record.source_path); p.sha256 = hash(target);
  json(path.join(out,'provenance/generation-records',`${p.record_id}.json`), {...record, packaged_source:sourceRel, packaged_references:packagedRefs});
}
assert(new Set(dimensions.slice(0,36).map(p => p.sha256)).size === 36, 'Pool has byte-identical duplicate portraits');
for (const id of chains) assert(hash(path.join(out,`portraits/${id}.png`)) === hash(path.join(out,`aging/${id}_young.png`)), `Young stage must preserve pool original: ${id}`);
const actualPortraits = ['portraits','aging'].flatMap(folder => fs.readdirSync(path.join(out,folder)).filter(f => f.endsWith('.png')).map(f => `${folder}/${f}`));
assert(actualPortraits.length === 48, `Expected exactly 48 portrait PNG files; got ${actualPortraits.length}`);
fs.mkdirSync(checks,{recursive:true}); fs.mkdirSync(scenes,{recursive:true});
const text = (text,x,y,size=18,color='#302c26') => ({text,x,y,size,color});
const image = (file,x,y,width,height=width) => ({file:`../../${file}`,x,y,width,height});
function board(name,scene) { const f=path.join(scenes,`${name}.json`); json(f,scene); execFileSync(raster,['board',path.join(checks,`${name}.png`),f]); }
const board1={width:1760,height:2640,background:'#d5cbbb',images:[],texts:[text('01 · 완성 초상 36명 · 256 px',36,20,26),text('같은 순서의 96 px 시험 · 이름 없는 인물 식별',36,1900,23)]};
people.forEach((p,i) => { const x=36+(i%6)*282, y=74+Math.floor(i/6)*300; board1.images.push(image(`portraits/${p.id}.png`,x,y,256)); board1.texts.push(text(p.id,x,y+260,18)); const sx=36+(i%12)*142, sy=1954+Math.floor(i/12)*164; board1.images.push(image(`portraits/${p.id}.png`,sx,sy,96)); board1.texts.push(text(p.id,sx,sy+102,17)); });
board1.texts.push(text('가장 닮은 두 쌍과 자체 판정: QA_REPORT.md 참조',36,2500,21));
board(board1Name(),board1);
function board1Name(){return '01-pool-36-256-and-96';}
const board2={width:1220,height:1420,background:'#d5cbbb',images:[],texts:[text('02 · 같은 인물의 청년 → 장년 → 노년',32,20,25),text('256 px',32,62,17),text('96 px',900,62,17)]};
chains.forEach((id,row)=>{ ['young','mature','old'].forEach((stage,col)=>{ const y=112+row*322, x=32+col*282; board2.images.push(image(`aging/${id}_${stage}.png`,x,y,256)); board2.texts.push(text(`${id} · ${stage}`,x,y+264,17)); board2.images.push(image(`aging/${id}_${stage}.png`,900+col*102,y+84,96)); }); });
board(board2Name(),board2);
function board2Name(){return '02-aging-four-chains';}
const uiIDs = roster.ui_selection ?? people.filter((_,i) => [0,5,10,15,20,25,30,35].includes(i)).map(p=>p.id);
assert(uiIDs.length === 8 && new Set(uiIDs).size === 8 && uiIDs.every(id=>people.some(p=>p.id===id)), 'UI selection requires eight distinct pool IDs');
const board3={width:1360,height:1190,background:'#e3d9c7',images:[],texts:[text('03 · UI 크기 시험 · 96 px 초상 · 8명',30,18,26),text('청원 카드',30,65,23),text('인물 카드',710,65,23)]};
const petitions=['공동 우물 수리를 청합니다.','장터의 자리를 청합니다.','겨울 곡물 지원을 청합니다.','길의 보수를 청합니다.'];
uiIDs.forEach((id,i)=>{const y=115+i*130;board3.images.push(image(`portraits/${id}.png`,30,y,96));board3.texts.push(text(id,145,y+4,19),text(petitions[i%4],145,y+37,19),text('청원 확인     ·     기록 보기',145,y+72,15,'#665c4e'));board3.images.push(image(`portraits/${id}.png`,710,y,96));board3.texts.push(text(id,826,y+6,22),text('인물 기록',826,y+42,18),text('가구 · 관계 · 활동',826,y+73,16,'#665c4e'));});
board('03-ui-96-eight-people',board3);
assert(fs.readdirSync(checks).filter(f=>f.endsWith('.png')).length===3,'Expected exactly three check PNGs');
const columns=['id','identity_id','stage','file','sex','age_group','age','class','body','direction','hair_color','skin_tone','features','clothing','marital_status','source_file','source_sha256','reference_files','prompt','sha256'];
fs.writeFileSync(path.join(out,'portraits.csv'),'\uFEFF'+[columns.map(csvCell).join(','),...files.map(p=>columns.map(k=>csvCell(p[k])).join(','))].join('\r\n')+'\r\n');
json(path.join(out,'roster.json'),roster);
json(path.join(out,'technical-validation.json'),{status:'PASS',scope:'File structure, metadata axis counts, opaque 256px format, unique pool file bytes, source and prompt presence. Actual visual traits and quality are separately assessed in QA_REPORT.md.',axis_counts:axisCounts,pool_count:36,aging_count:12,portrait_png_count:48,proof_png_count:3,csv_rows:48,young_stage_exact_copies:chains,ui_selection:uiIDs,files:dimensions});
if(!fs.existsSync(path.join(out,'QA_REPORT.md')))fs.writeFileSync(path.join(out,'QA_REPORT.md'),'# 자체 검수\n\n상태: PENDING_VISUAL_REVIEW\n\n- 가장 닮은 두 쌍: 미판정\n- 36명 인물 구별: 미판정\n- 노화 사슬 4명 동일 인물 판독: 미판정\n- 96 px UI 판독: 미판정\n\n기술 검증은 시각 품질 통과를 뜻하지 않습니다.\n');
fs.writeFileSync(path.join(out,'README.md'),'# 완성 초상 방식 전환 파일럿\n\n이 산출물은 게임에 설치하지 않은 후보입니다. Wave 10 레이어 방식과 별개로 한 사람의 얼굴·머리·복식을 한 장에 생성했습니다. 방향을 만들기 위한 좌우 반전과 얼굴 레이어 합성은 사용하지 않았습니다. 생성 후 256×256 축소와 확인 그림 배치만 수행했습니다.\n\n- portraits/: 완성 초상 36명\n- aging/: 청년 원본 4장과 장년·노년 8장, 총 12장\n- checks/: 확인 그림 정확히 3장. 01에는 256 px와 96 px 격자가 함께 있습니다.\n- portraits.csv: 초상 파일 48행, 인물 속성·전체 프롬프트·출처·해시\n- QA_REPORT.md: 자체 판정과 가장 닮은 두 쌍, 잔여 우려\n- provenance/: 선택된 생성 원본·참조·생성 기록·확인 그림 배치 기록\n\n청년 사슬 4장은 36명 풀의 원본을 그대로 복사한 것입니다. 따라서 인물 PNG는 48개이며 새로 그린 이미지는 44개입니다. 피부 톤이나 체형은 도덕성의 표지가 아니며, 풀 선택 속성으로만 기록했습니다. 기술 검증과 시각 검수 판정은 분리합니다.\n');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const inventory=walk(out).filter(f=>!['SHA256SUMS','inventory.json'].includes(path.basename(f))).sort().map(f=>({file:path.relative(out,f),bytes:fs.statSync(f).size,sha256:hash(f)}));
json(path.join(out,'inventory.json'),inventory);
fs.writeFileSync(path.join(out,'SHA256SUMS'),[...inventory,{file:'inventory.json',sha256:hash(path.join(out,'inventory.json'))}].map(p=>`${p.sha256}  ${p.file}`).join('\n')+'\n');
console.log(JSON.stringify({status:'PACKAGED',portrait_png:48,checks_png:3,csv_rows:48,inventory_files:inventory.length,deliverable:out}));
