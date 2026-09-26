import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const work=path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/astra-portrait-pool2-work');
const out=path.join(work,'deliverable');
const raster=process.env.POOL_RASTER??'/tmp/astra-wave10-v2-work/raster';
const pilot=process.env.POOL_PILOT??'/tmp/astra-portrait-pivot-work/deliverable/portraits';
const batch1=process.env.POOL_BATCH1??'/tmp/astra-portrait-pool1-work/deliverable/portraits';
const roster=JSON.parse(fs.readFileSync(path.join(work,'roster.json'),'utf8'));
const identities=roster.identities;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=(file,obj)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');};
const csv=v=>'"'+String(Array.isArray(v)?v.join('; '):v??'').replaceAll('"','""')+'"';
const copy=(source,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function refreshManifest(){
 const inventory=walk(out).filter(f=>!['SHA256SUMS','inventory.json'].includes(path.basename(f))).sort().map(f=>({file:path.relative(out,f),bytes:fs.statSync(f).size,sha256:hash(f)}));
 json(path.join(out,'inventory.json'),inventory);
 fs.writeFileSync(path.join(out,'SHA256SUMS'),[...inventory,{file:'inventory.json',sha256:hash(path.join(out,'inventory.json'))}].map(p=>`${p.sha256}  ${p.file}`).join('\n')+'\n');
 return inventory.length;
}
if(process.argv.includes('--manifest-only')){console.log(JSON.stringify({status:'MANIFEST_REFRESHED',inventory_files:refreshManifest()}));process.exit(0);}

assert(identities.length===32,'Expected32identities');
assert(new Set(identities.map(p=>p.identity_id)).size===32,'Repeated identity');
const expectedIDs=Array.from({length:32},(_,i)=>`I${String(i+69).padStart(3,'0')}`);
assert(expectedIDs.every(id=>identities.some(p=>p.identity_id===id)),'Expected I069..I100');
const rows=identities.flatMap(p=>p.stages.map(s=>({...p,...s,id:`${p.identity_id}_${s.stage}`,file:`portraits/${p.identity_id}_${s.stage}.png`})));
assert(rows.length===92,'Expected92portrait stages');
for(const p of rows){assert(typeof p.role==='string'&&p.role.trim(),`Missingrole:${p.id}`);assert(typeof p.prop==='string'&&p.prop.trim(),`Missingprop:${p.id}`);assert(['none','book_scroll','other'].includes(p.prop_group),`Invalidpropgroup:${p.id}`);}
const propCounts=list=>Object.fromEntries(['none','book_scroll','other'].map(group=>[group,list.filter(p=>p.prop_group===group).length]));
function countProps(){
 const identityProps=identities.map(p=>rows.find(r=>r.identity_id===p.identity_id&&r.stage==='young'));
 const counts={scope:'Roster metadata counts; visual confirmation recorded separately in QA_REPORT.md',identities:{total:32,counts:propCounts(identityProps)},stages:{total:92,counts:propCounts(rows)}};
 assert(counts.identities.counts.book_scroll/32<=0.25,'Bookscrollidentityshareexceeds25percent');
 assert(counts.stages.counts.book_scroll/92<=0.25,'Bookscrollstageshareexceeds25percent');
 return counts;
}
let propDistribution=countProps();
const adult=identities.filter(p=>p.stages.length===3),children=identities.filter(p=>p.stages.length===2);
assert(adult.length===28&&children.length===4,'Expected28adult×3+4child×2');
for(const p of adult)assert(['young','mature','old'].every(s=>p.stages.some(t=>t.stage===s)),`Incomplete adult chain ${p.identity_id}`);
for(const p of children)assert(['child','young'].every(s=>p.stages.some(t=>t.stage===s)),`Incomplete child chain ${p.identity_id}`);
assert(new Set(rows.map(p=>p.id)).size===92,'Repeated stage ID');
for(const p of rows)assert(fs.existsSync(path.join(out,p.file)),`Missing ${p.file}`);
function render(file,sceneFile,scene){json(sceneFile,scene);execFileSync(raster,['board',file,sceneFile]);}
function blindReview(){
 const folder=path.join(work,'blind-review');fs.mkdirSync(folder,{recursive:true});
 const order=[...rows].sort((a,b)=>crypto.createHash('sha256').update('pool2-blind-20260926:'+a.id).digest('hex').localeCompare(crypto.createHash('sha256').update('pool2-blind-20260926:'+b.id).digest('hex')));
 const scene={width:1712,height:2190,background:'#d5cbbb',images:[],texts:[{text:'옷만 보는 익명 시험 · 아래쪽 80 px · 몸통과 깃 일부',x:28,y:20,size:24}]};
 const key=[];
 order.forEach((p,i)=>{const label=`B${String(i+1).padStart(3,'0')}`,file=path.join(folder,`${label}.png`);execFileSync(raster,['crop',path.join(out,p.file),file,'0','176','256','80']);const x=28+(i%6)*280,y=80+Math.floor(i/6)*128;scene.images.push({file,x,y,width:256,height:80});scene.texts.push({text:label,x,y:y+82,size:17});key.push({label,id:p.id,identity_id:p.identity_id,stage:p.stage,class:p.class,score_eligible:!children.some(c=>c.identity_id===p.identity_id),occupation:p.occupation,source:p.file,source_sha256:hash(path.join(out,p.file))});});
 render(path.join(folder,'clothing-blind.png'),path.join(folder,'scene.json'),scene);
 json(path.join(folder,'answer-key.json'),{crop:[0,176,256,80],scored_adult_portraits:84,unscored_child_identity_portraits:8,limitation:'Lower80pixels: torso and partial collar; occasional chin may remain, eyes and most face excluded. Score adult84 only across six classes; child identity8 not scored. Headwear and high collars may be omitted.',items:key});
}
blindReview();
if(process.argv.includes('--blind-only')){console.log(JSON.stringify({status:'BLIND_BOARD_READY',directory:path.join(work,'blind-review')}));process.exit(0);}
const measurements=[];
for(const p of rows){
 const file=path.join(out,p.file),info=JSON.parse(execFileSync(raster,['info',file],{encoding:'utf8'}));
 assert(info.width===256&&info.height===256,`Not256square:${p.id}`);assert(info.transparent_pixels===0&&info.partial_alpha_pixels===0,`Notopaque:${p.id}`);
 const recordFile=path.join(work,'generation-records',`${p.id}.json`);assert(fs.existsSync(recordFile),`Missingrecord:${p.id}`);const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));
 assert(typeof record.prompt==='string'&&record.prompt.length>20,`Missingfullprompt:${p.id}`);assert(record.source_path&&fs.existsSync(record.source_path),`Missingsource:${p.id}`);
 for(const [k,v] of Object.entries(record.metadata_overrides??{})){assert(['hair_color','skin_tone','features','clothing','headwear_type','marital_status','expression','prop','prop_group'].includes(k),`Unsupportedoverride:${k}`);assert(typeof v==='string'&&v.trim(),`Invalidoverride:${k}`);p[k]=v;}
 p.source_file=`provenance/raw/${p.id}${path.extname(record.source_path)||'.png'}`;copy(record.source_path,path.join(out,p.source_file));p.reference_files=[];
 for(const ref of record.references??[]){const source=typeof ref==='string'?ref:ref.path;assert(source&&fs.existsSync(source),`Missingref:${p.id}`);const dest=`provenance/references/${hash(source).slice(0,12)}-${path.basename(source)}`;copy(source,path.join(out,dest));p.reference_files.push(dest);}
 p.prompt=record.prompt;p.sha256=hash(file);p.source_sha256=hash(record.source_path);
 json(path.join(out,'provenance/generation-records',`${p.id}.json`),{...record,packaged_source:p.source_file,packaged_references:p.reference_files});
 measurements.push({file:p.file,width:info.width,height:info.height,sha256:p.sha256});
}
propDistribution=countProps();
assert(new Set(rows.map(p=>p.sha256)).size===92,'Duplicate portrait bytes');
assert(fs.readdirSync(path.join(out,'portraits')).filter(f=>f.endsWith('.png')).length===92,'UnexpectedportraitPNGcount');
const checks=path.join(out,'checks'),scenes=path.join(out,'provenance/proof-scenes');fs.mkdirSync(checks,{recursive:true});
const t=(text,x,y,size=18)=>({text,x,y,size,color:'#302c26'});
const im=(file,x,y,width,height=width)=>({file:`../../${file}`,x,y,width,height});
const board=(name,scene)=>render(path.join(checks,name+'.png'),path.join(scenes,name+'.json'),scene);
const proof1={width:3360,height:4600,background:'#d5cbbb',images:[],texts:[t('01 · 본 제작 2차 · 32 인물 / 92 단계 · 256 px',28,20,28),t('같은 순서 · 96 px',28,2490,26)]};
rows.forEach((p,i)=>{let x=28+(i%12)*276,y=76+Math.floor(i/12)*300;proof1.images.push(im(p.file,x,y,256));proof1.texts.push(t(p.id,x,y+260,17));x=28+(i%12)*276;y=2544+Math.floor(i/12)*145;proof1.images.push(im(p.file,x,y,96));proof1.texts.push(t(p.id,x+108,y+34,17));});
proof1.texts.push(t('소지품 분포 · 인물 32명 / 단계 92장 · CSV 기준, 실제 그림은 검수표 참조',28,3770,26));
const propLabels={none:'빈손 / 소지품 없음',book_scroll:'두루마리·책',other:'기타 소지품'};
['none','book_scroll','other'].forEach((group,i)=>{const a=propDistribution.identities.counts[group],b=propDistribution.stages.counts[group];proof1.texts.push(t(`${propLabels[group]}: ${a}/32명 (${(a/32*100).toFixed(1)}%) · ${b}/92장 (${(b/92*100).toFixed(1)}%)`,28,3820+i*58,24));});
proof1.texts.push(t('목표: 두루마리·책 25% 이하 · 빈손 약 30% · 계급은 옷·모피·머리쓰개·자세로 판독',28,4025,24));
proof1.texts.push(t('소지품 종류별 상세 분포 · 인물 수 / 단계 PNG 수',28,4100,25));
const detailLabels={none:'빈손',book_scroll:'두루마리·책',grain_measure:'곡물 계량컵',ale_jug:'에일 주전자',measuring_rod:'측량 자',key_ring:'열쇠 꾸러미',coin_purse:'동전 지갑',wool_sample:'양모 견본',shepherd_crook:'목동 지팡이',net_float:'그물 부표',shoe_last:'구두 골',spindle:'방추',washing_cloth:'세탁 천',gloves:'장갑',rosary:'묵주',pilgrim_badge:'순례 배지',walking_cane:'보행 지팡이',wooden_pipe:'나무 피리',small_knife:'작은 칼',wooden_horse:'나무 말 장난감',smooth_pebble:'매끈한 조약돌',ribbon_spool:'리본 실패'};
const propTypes=[...new Set(rows.map(p=>p.prop))].sort((a,b)=>a==='none'?-1:b==='none'?1:a==='book_scroll'?-1:b==='book_scroll'?1:a.localeCompare(b));
const detailedDistribution=propTypes.map(prop=>({prop,label:detailLabels[prop]??prop,identities:rows.filter(p=>p.stage==='young'&&p.prop===prop).length,stages:rows.filter(p=>p.prop===prop).length}));
propDistribution.details=detailedDistribution;
detailedDistribution.forEach((item,i)=>{const x=28+(i%4)*824,y=4160+Math.floor(i/4)*62;proof1.texts.push(t(`${item.label} · ${item.identities}명 / ${item.stages}장`,x,y,23));});
board('01-all-92-256-and-96',proof1);
const combined=[];
for(let i=1;i<=36;i++){const id=`P${String(i).padStart(2,'0')}`,dest=`provenance/approved-pilot/${id}.png`;copy(path.join(pilot,id+'.png'),path.join(out,dest));combined.push({id,file:dest});}
combined.push(...identities.map(p=>({id:p.identity_id+'_young',file:`portraits/${p.identity_id}_young.png`})));assert(combined.length===68,'Combinedgrid68');
const proof2={width:2192,height:3540,background:'#d5cbbb',images:[],texts:[t('02-A · 승인 파일럿 36명 + 이번 청년 32명 · 192 px',28,20,26),t('02-B · 승인 1차 청년 32명 + 이번 청년 32명 · 192 px',28,1780,26)]};
combined.forEach((p,i)=>{const x=28+(i%10)*216,y=76+Math.floor(i/10)*236;proof2.images.push(im(p.file,x,y,192));proof2.texts.push(t(p.id,x,y+198,17));});
const batchComparison=[];
for(let i=37;i<=68;i++){const id=`I${String(i).padStart(3,'0')}_young`,dest=`provenance/batch1/${id}.png`;copy(path.join(batch1,id+'.png'),path.join(out,dest));batchComparison.push({id,file:dest});}
batchComparison.push(...identities.map(p=>({id:p.identity_id+'_young',file:`portraits/${p.identity_id}_young.png`})));
assert(batchComparison.length===64,'Batchcomparisongrid64');
batchComparison.forEach((p,i)=>{const x=28+(i%10)*216,y=1836+Math.floor(i/10)*236;proof2.images.push(im(p.file,x,y,192));proof2.texts.push(t(p.id,x,y+198,17));});
board('02-pilot68-and-batch-comparison64',proof2);
const proof3={width:1816,height:4870,background:'#d5cbbb',images:[],texts:[t('03 · 노화 사슬 32명 · 각 초상 256 px · 아이 사슬은 아이 → 청년',28,20,26)]};
identities.forEach((p,i)=>{const bx=28+Math.floor(i/16)*900,y=82+(i%16)*296;const stages=p.stages.length===2?['child','young']:['young','mature','old'];proof3.texts.push(t(p.identity_id,bx,y-22,17));stages.forEach((stage,col)=>{proof3.images.push(im(`portraits/${p.identity_id}_${stage}.png`,bx+col*276,y,256));proof3.texts.push(t(stage,bx+col*276,y+260,16));});if(stages.length===2)proof3.texts.push(t('아이 사슬: 2단계',bx+552,y+115,19));});board('03-all-32-aging-chains',proof3);
const personIDs=roster.ui_person_selection??identities.filter((_,i)=>[0,4,8,12,16,20,24,28].includes(i)).map(p=>p.identity_id+'_young');
const petitionIDs=roster.ui_petition_selection??identities.filter((_,i)=>[2,10,18,30].includes(i)).map(p=>p.identity_id+'_young');
assert(personIDs.length===8&&petitionIDs.length===4,'UI8+4 required');for(const id of [...personIDs,...petitionIDs])assert(rows.some(p=>p.id===id),`UnknownUI:${id}`);
const proof4={width:1380,height:1190,background:'#e3d9c7',images:[],texts:[t('04 · UI 크기 시험 · 초상 96 px · 오프라인 예시',28,18,26),t('인물 카드 8명',28,65,23),t('청원 카드 4명',718,65,23)]};
personIDs.forEach((id,i)=>{const y=116+i*130;proof4.images.push(im(`portraits/${id}.png`,28,y,96));proof4.texts.push(t(id,142,y+6,20),t(rows.find(p=>p.id===id).role,142,y+40,18),t('가구 · 관계 · 활동',142,y+72,16));});
petitionIDs.forEach((id,i)=>{const y=116+i*260;proof4.images.push(im(`portraits/${id}.png`,718,y,96));proof4.texts.push(t(id,832,y+6,20),t(['제분료 조정을 청합니다.','부서진 다리 수리를 청합니다.','밀린 품삯 지급을 청합니다.','장터 통행 안전을 청합니다.'][i],832,y+40,18),t('청원 확인 · 기록 보기',832,y+72,16));});board('04-ui-96-cards',proof4);
assert(fs.readdirSync(checks).filter(f=>f.endsWith('.png')).length===4,'Exactly4proofPNGrequired');
const columns=['identity_id','stage','id','file','sex','age','class','occupation','role','prop','prop_group','body','direction','hair_color','skin_tone','features','clothing','marital_status','expression','headwear_type','source_file','source_sha256','reference_files','prompt','sha256'];
fs.writeFileSync(path.join(out,'portraits.csv'),'\uFEFF'+[columns.map(csv).join(','),...rows.map(p=>columns.map(k=>csv(p[k])).join(','))].join('\r\n')+'\r\n');json(path.join(out,'roster.json'),roster);
const counts={};for(const key of ['sex','class','body','direction'])counts[key]=identities.reduce((a,p)=>(a[p[key]]=(a[p[key]]??0)+1,a),{});counts.stage=rows.reduce((a,p)=>(a[p.stage]=(a[p.stage]??0)+1,a),{});counts.expression=rows.reduce((a,p)=>(a[p.expression]=(a[p.expression]??0)+1,a),{});
json(path.join(out,'prop-distribution.json'),propDistribution);
json(path.join(out,'technical-validation.json'),{status:'PASS',scope:'File and provenance validation only; metadata distribution is not visual trait verification.',identities:32,adult_identities:28,child_identities:4,portrait_png:92,proof_png:4,csv_rows:92,approved_pilot_reference_png:36,approved_batch1_reference_png:32,prop_distribution:propDistribution,counts,files:measurements});
if(!fs.existsSync(path.join(out,'QA_REPORT.md')))fs.writeFileSync(path.join(out,'QA_REPORT.md'),'# 자체 검수\n\n상태: PENDING_VISUAL_REVIEW\n\n소지품 실제 판독, 계급별 옷 판독, 가장 닮은 세 쌍, 동일인 노화 사슬 및96px UI 판독의 최종 판정을 기록해야 합니다.\n');
fs.writeFileSync(path.join(out,'README.md'),'# 초상 풀 본 제작 2차\n\n게임에 설치하지 않은 완성 초상 후보입니다. 인물마다 얼굴·머리·옷을 통째로 생성했으며, 방향을 만들기 위한 좌우 반전이나 레이어 합성을 하지 않았습니다.\n\n- portraits/: I069–I100, 성인28명×3단계 + 아이4명×2단계 =92 PNG\n- checks/: 확인 그림 정확히4장. 첫 그림에는92장 모두256px와96px 및 소지품 분포표를 배치했습니다. 두 번째 그림은 파일럿36+이번32명과 1차32+2차32명 두 비교 격자입니다. 세 번째 그림은16행씩 두 블록이며 각 초상은256px입니다.\n- portraits.csv:92행의 인물·단계 속성, role·prop·prop_group, 전체 프롬프트, 출처, 해시\n- QA_REPORT.md: 옷만 보고 계급 맞히기, 가장 닮은 세 쌍, 노화와UI 판정\n- provenance/: 생성 원본·프롬프트·참조·배치 기록. approved-pilot36장과 batch1청년32장은 비교용 승인 원본이며 이번92장 수량에 포함하지 않습니다.\n\n피부 톤과 체형은 도덕성의 표지가 아닙니다. 본 파일은 오프라인 후보 산출물이며 게임 통합·성능 검증 결과가 아닙니다.\n');
copy(new URL(import.meta.url).pathname,path.join(out,'provenance/tools/package-pool2.mjs'));
const validatorSource=path.join(work,'validate-package-pool2.mjs');
if(fs.existsSync(validatorSource))copy(validatorSource,path.join(out,'provenance/tools/validate-package-pool2.mjs'));
const gridSource=path.join(work,'make-review-grids.mjs');
if(fs.existsSync(gridSource))copy(gridSource,path.join(out,'provenance/tools/make-review-grids.mjs'));
const rasterSource=path.join(path.dirname(raster),'raster.swift');
if(fs.existsSync(rasterSource))copy(rasterSource,path.join(out,'provenance/tools/raster.swift'));
if(fs.existsSync(path.join(work,'PACKAGING.md')))copy(path.join(work,'PACKAGING.md'),path.join(out,'provenance/tools/PACKAGING.md'));
const inventoryCount=refreshManifest();
console.log(JSON.stringify({status:'PACKAGED',identities:32,portraits:92,proofs:4,csv_rows:92,inventory_files:inventoryCount}));
