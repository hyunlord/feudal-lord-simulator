import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {Workbook} from '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const require=createRequire(import.meta.url);
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const zones=JSON.parse(await fs.readFile(path.join(root,'records/safe-zones.json'),'utf8')).assets;
const headers=['id','file','role','width','height','format','has_alpha','status','source_record','parent_asset','native_dimensions','processing','safe_zone_type','safe_zone_xywh','tool','model','seed','qa_note','sha256'];
const sourceRecords={steam_main_capsule:'records/wave24-root.json',steam_library_logo_emblem:'records/wave24-root.json',steam_header_capsule:'records/wave24-horizontal.json',steam_small_capsule:'records/wave24-horizontal.json',steam_vertical_capsule:'records/wave24-vertical.json',steam_library_capsule:'records/wave24-vertical.json',steam_library_hero:'records/wave24-panorama.json',steam_page_background:'records/wave24-panorama.json'};
const notes={steam_header_capsule:'오른쪽 40% 여백; 독립 재구도',steam_small_capsule:'120×45에서 탑·도시·영주 실루엣; 세부 건물 묘사는 축소 소실',steam_main_capsule:'상단 1/3 제목; 굴뚝 교정판',steam_vertical_capsule:'전신 영주와 아래 도시; 상단 여백',steam_library_capsule:'가문 문장 깃발을 든 영주; 상단 여백',steam_library_hero:'중앙 아래 1/3 UI 가림 시험; 생성 원본에서 확대',steam_library_logo_emblem:'문장 부품; 최종 게임 제목 로고는 아님; 진짜 투명 RGBA',steam_page_background:'어두운 양피지; 낮은 대비 지도',steam_app_icon:'같은 엠블럼 파생; 공식 업로드 JPG 별도',steam_shortcut_icon:'같은 엠블럼; 투명 PNG'};
const rows=[];
const selectedNative={steam_main_capsule:'main-native-v2.png',steam_header_capsule:'header-native-v3.png',steam_small_capsule:'small-native-v4.png',steam_vertical_capsule:'vertical-native.png',steam_library_capsule:'library-correction5-native.png',steam_library_hero:'hero-native-v4.png',steam_page_background:'page-background-native.png',steam_library_logo_emblem:'emblem-native.png',steam_app_icon:'emblem-native.png',steam_shortcut_icon:'emblem-native.png'};
for(const z of zones){
 const nativeMeta=await sharp(path.join(root,'records',selectedNative[z.id])).metadata();
 for(const guide of [false,true]){
  const id=z.id+(guide?'_safe_zone':'');const file=guide?`guides/${id}.png`:`assets/${id}.png`;
  const bytes=await fs.readFile(path.join(root,file)),m=await sharp(bytes).metadata();
  if(m.width!==z.width||m.height!==z.height)throw Error(`Size mismatch: ${file}`);
  const icon=['steam_app_icon','steam_shortcut_icon'].includes(z.id);
  rows.push([id,file,guide?'guide':'art',m.width,m.height,m.format,Boolean(m.hasAlpha),guide?'review_only':'candidate',guide?'scripts/build-proofs.cjs':sourceRecords[z.id]??'records/root-export.json',guide?z.id:icon?'steam_library_logo_emblem':'',guide?`${z.width}×${z.height}`:`${nativeMeta.width}×${nativeMeta.height}`,guide?'original + translucent box':icon?'alpha-bound trim + fit + transparent padding':'independent composition + exact-size normalization',z.type,z.box.join(';'),guide||icon?'deterministic composition':'builtin image_gen',guide||icon?'not applicable':'not supplied',guide||icon?'not applicable':'not supplied',guide?'확인 전용. Steam 업로드 파일 아님.':notes[z.id],crypto.createHash('sha256').update(bytes).digest('hex')]);
 }
}
const jpg=await fs.readFile(path.join(root,'exports/steam_app_icon.jpg'));
rows.push(['steam_app_icon_jpg','exports/steam_app_icon.jpg','compatibility_export',184,184,'jpeg',false,'candidate','scripts/build-proofs.cjs','steam_app_icon','184×184','dark neutral matte; JPEG quality95 4:4:4','icon_content_not_title','0.043;0.043;0.914;0.914','deterministic conversion','not applicable','not applicable','Steam 공식 앱 아이콘 JPG 요구용',crypto.createHash('sha256').update(jpg).digest('hex')]);
const wb=Workbook.create(),sheet=wb.worksheets.add('Assets');
sheet.getRange(`A1:S${rows.length+1}`).values=[headers,...rows];
sheet.getRange(`A1:S${rows.length+1}`).format.font={name:'Arial',size:11};
sheet.getRange('A1:S1').format.fill='#314f5a';sheet.getRange('A1:S1').format.font={name:'Arial',size:11,color:'#ffffff',bold:true};
sheet.getRange('A1:B22').format.columnWidthPx=350;sheet.getRange('C1:F22').format.columnWidthPx=100;
sheet.getRange('C1:C22').format.columnWidthPx=150;
sheet.getRange('A1:S22').format.rowHeightPx=25;sheet.freezePanes.freezeRows(1);
const matrix=sheet.getRange(`A1:S${rows.length+1}`).values;
// No CSV export is documented by artifact-tool help; serialize the authored
// workbook values as RFC4180 CSV. No XLSX variant is part of this delivery.
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
await fs.writeFile(path.join(root,'generation-records.csv'),'\uFEFF'+matrix.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n');
const inspect=await wb.inspect({kind:'region',sheetId:'Assets',range:'A1:F6',maxChars:2000});
await fs.writeFile(path.join(root,'records/csv-inspect.json'),JSON.stringify(inspect,null,2));
const preview=await wb.render({sheetName:'Assets',range:'A1:F22',scale:1,format:'png'});
await fs.writeFile(path.join(root,'records/csv-preview.png'),new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({rows:rows.length,columns:headers.length,uniqueIds:new Set(rows.map(r=>r[0])).size}));
