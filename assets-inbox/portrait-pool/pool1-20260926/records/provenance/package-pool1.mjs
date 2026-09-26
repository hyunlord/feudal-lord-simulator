import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const work=path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/astra-portrait-pool1-work');
const out=path.join(work,'deliverable');
const raster=process.env.POOL_RASTER??'/tmp/astra-wave10-v2-work/raster';
const pilot=process.env.POOL_PILOT??'/tmp/astra-portrait-pivot-work/deliverable/portraits';
const roster=JSON.parse(fs.readFileSync(path.join(work,'roster.json'),'utf8'));
const identities=roster.identities;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=(file,obj)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');};
const csv=v=>'"'+String(Array.isArray(v)?v.join('; '):v??'').replaceAll('"','""')+'"';
const copy=(source,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(identities.length===32,'Expected32identities');
assert(new Set(identities.map(p=>p.identity_id)).size===32,'Repeated identity');
const expectedIDs=Array.from({length:32},(_,i)=>`I${String(i+37).padStart(3,'0')}`);
assert(expectedIDs.every(id=>identities.some(p=>p.identity_id===id)),'Expected I037..I068');
const rows=identities.flatMap(p=>p.stages.map(s=>({...p,...s,id:`${p.identity_id}_${s.stage}`,file:`portraits/${p.identity_id}_${s.stage}.png`})));
assert(rows.length===92,'Expected92portrait stages');
const adult=identities.filter(p=>p.stages.length===3),children=identities.filter(p=>p.stages.length===2);
assert(adult.length===28&&children.length===4,'Expected28adult×3+4child×2');
for(const p of adult)assert(['young','mature','old'].every(s=>p.stages.some(t=>t.stage===s)),`Incomplete adult chain ${p.identity_id}`);
for(const p of children)assert(['child','young'].every(s=>p.stages.some(t=>t.stage===s)),`Incomplete child chain ${p.identity_id}`);
assert(new Set(rows.map(p=>p.id)).size===92,'Repeated stage ID');
for(const p of rows)assert(fs.existsSync(path.join(out,p.file)),`Missing ${p.file}`);
function render(file,sceneFile,scene){json(sceneFile,scene);execFileSync(raster,['board',file,sceneFile]);}
function blindReview(){
 const folder=path.join(work,'blind-review');fs.mkdirSync(folder,{recursive:true});
 const order=[...rows].sort((a,b)=>crypto.createHash('sha256').update('pool1-blind-20260926:'+a.id).digest('hex').localeCompare(crypto.createHash('sha256').update('pool1-blind-20260926:'+b.id).digest('hex')));
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
 for(const [k,v] of Object.entries(record.metadata_overrides??{})){assert(['hair_color','skin_tone','features','clothing','headwear_type','marital_status','expression'].includes(k),`Unsupportedoverride:${k}`);assert(typeof v==='string'&&v.trim(),`Invalidoverride:${k}`);p[k]=v;}
 p.source_file=`provenance/raw/${p.id}${path.extname(record.source_path)||'.png'}`;copy(record.source_path,path.join(out,p.source_file));p.reference_files=[];
 for(const ref of record.references??[]){const source=typeof ref==='string'?ref:ref.path;assert(source&&fs.existsSync(source),`Missingref:${p.id}`);const dest=`provenance/references/${hash(source).slice(0,12)}-${path.basename(source)}`;copy(source,path.join(out,dest));p.reference_files.push(dest);}
 p.prompt=record.prompt;p.sha256=hash(file);p.source_sha256=hash(record.source_path);
 json(path.join(out,'provenance/generation-records',`${p.id}.json`),{...record,packaged_source:p.source_file,packaged_references:p.reference_files});
 measurements.push({file:p.file,width:info.width,height:info.height,sha256:p.sha256});
}
assert(new Set(rows.map(p=>p.sha256)).size===92,'Duplicate portrait bytes');
assert(fs.readdirSync(path.join(out,'portraits')).filter(f=>f.endsWith('.png')).length===92,'UnexpectedportraitPNGcount');
const checks=path.join(out,'checks'),scenes=path.join(out,'provenance/proof-scenes');fs.mkdirSync(checks,{recursive:true});
const t=(text,x,y,size=18)=>({text,x,y,size,color:'#302c26'});
const im=(file,x,y,width,height=width)=>({file:`../../${file}`,x,y,width,height});
const board=(name,scene)=>render(path.join(checks,name+'.png'),path.join(scenes,name+'.json'),scene);
const proof1={width:3360,height:3780,background:'#d5cbbb',images:[],texts:[t('01 · 본 제작 1차 · 32 인물 / 92 단계 · 256 px',28,20,28),t('같은 순서 · 96 px',28,2490,26)]};
rows.forEach((p,i)=>{let x=28+(i%12)*276,y=76+Math.floor(i/12)*300;proof1.images.push(im(p.file,x,y,256));proof1.texts.push(t(p.id,x,y+260,17));x=28+(i%12)*276;y=2544+Math.floor(i/12)*145;proof1.images.push(im(p.file,x,y,96));proof1.texts.push(t(p.id,x+108,y+34,17));});board('01-all-92-256-and-96',proof1);
const combined=[];
for(let i=1;i<=36;i++){const id=`P${String(i).padStart(2,'0')}`,dest=`provenance/approved-pilot/${id}.png`;copy(path.join(pilot,id+'.png'),path.join(out,dest));combined.push({id,file:dest});}
combined.push(...identities.map(p=>({id:p.identity_id+'_young',file:`portraits/${p.identity_id}_young.png`})));assert(combined.length===68,'Combinedgrid68');
const proof2={width:2192,height:1790,background:'#d5cbbb',images:[],texts:[t('02 · 승인 파일럿 36명 + 이번 청년 32명 · 192 px',28,20,26)]};
combined.forEach((p,i)=>{const x=28+(i%10)*216,y=76+Math.floor(i/10)*236;proof2.images.push(im(p.file,x,y,192));proof2.texts.push(t(p.id,x,y+198,17));});board('02-pilot-and-new-68',proof2);
const proof3={width:1816,height:4870,background:'#d5cbbb',images:[],texts:[t('03 · 노화 사슬 32명 · 각 초상 256 px · 아이 사슬은 아이 → 청년',28,20,26)]};
identities.forEach((p,i)=>{const bx=28+Math.floor(i/16)*900,y=82+(i%16)*296;const stages=p.stages.length===2?['child','young']:['young','mature','old'];proof3.texts.push(t(p.identity_id,bx,y-22,17));stages.forEach((stage,col)=>{proof3.images.push(im(`portraits/${p.identity_id}_${stage}.png`,bx+col*276,y,256));proof3.texts.push(t(stage,bx+col*276,y+260,16));});if(stages.length===2)proof3.texts.push(t('아이 사슬: 2단계',bx+552,y+115,19));});board('03-all-32-aging-chains',proof3);
const personIDs=roster.ui_person_selection??identities.filter((_,i)=>[0,4,8,12,16,20,24,28].includes(i)).map(p=>p.identity_id+'_young');
const petitionIDs=roster.ui_petition_selection??identities.filter((_,i)=>[2,10,18,30].includes(i)).map(p=>p.identity_id+'_young');
assert(personIDs.length===8&&petitionIDs.length===4,'UI8+4 required');for(const id of [...personIDs,...petitionIDs])assert(rows.some(p=>p.id===id),`UnknownUI:${id}`);
const proof4={width:1380,height:1190,background:'#e3d9c7',images:[],texts:[t('04 · UI 크기 시험 · 초상 96 px',28,18,26),t('인물 카드 8명',28,65,23),t('청원 카드 4명',718,65,23)]};
personIDs.forEach((id,i)=>{const y=116+i*130;proof4.images.push(im(`portraits/${id}.png`,28,y,96));proof4.texts.push(t(id,142,y+6,20),t('인물 기록',142,y+40,18),t('가구 · 관계 · 활동',142,y+72,16));});
petitionIDs.forEach((id,i)=>{const y=116+i*260;proof4.images.push(im(`portraits/${id}.png`,718,y,96));proof4.texts.push(t(id,832,y+6,20),t(['공동 우물 수리를 청합니다.','장터의 자리를 청합니다.','겨울 곡물 지원을 청합니다.','길의 보수를 청합니다.'][i],832,y+40,18),t('청원 확인 · 기록 보기',832,y+72,16));});board('04-ui-96-cards',proof4);
assert(fs.readdirSync(checks).filter(f=>f.endsWith('.png')).length===4,'Exactly4proofPNGrequired');
const columns=['identity_id','stage','id','file','sex','age','class','occupation','body','direction','hair_color','skin_tone','features','clothing','marital_status','expression','headwear_type','source_file','source_sha256','reference_files','prompt','sha256'];
fs.writeFileSync(path.join(out,'portraits.csv'),'\uFEFF'+[columns.map(csv).join(','),...rows.map(p=>columns.map(k=>csv(p[k])).join(','))].join('\r\n')+'\r\n');json(path.join(out,'roster.json'),roster);
const counts={};for(const key of ['sex','class','body','direction'])counts[key]=identities.reduce((a,p)=>(a[p[key]]=(a[p[key]]??0)+1,a),{});counts.stage=rows.reduce((a,p)=>(a[p.stage]=(a[p.stage]??0)+1,a),{});counts.expression=rows.reduce((a,p)=>(a[p.expression]=(a[p.expression]??0)+1,a),{});
json(path.join(out,'technical-validation.json'),{status:'PASS',scope:'File and provenance validation only; metadata distribution is not visual trait verification.',identities:32,adult_identities:28,child_identities:4,portrait_png:92,proof_png:4,csv_rows:92,approved_pilot_reference_png:36,counts,files:measurements});
if(!fs.existsSync(path.join(out,'QA_REPORT.md')))fs.writeFileSync(path.join(out,'QA_REPORT.md'),'# 자체 검수\n\n상태: PENDING_VISUAL_REVIEW\n\n계급별 옷 판독, 가장 닮은 세 쌍, 동일인 노화 사슬 및96px UI 판독의 최종 판정을 기록해야 합니다.\n');
fs.writeFileSync(path.join(out,'README.md'),'# 초상 풀 본 제작 1차\n\n게임에 설치하지 않은 완성 초상 후보입니다. 인물마다 얼굴·머리·옷을 통째로 생성했으며, 방향을 만들기 위한 좌우 반전이나 레이어 합성을 하지 않았습니다.\n\n- portraits/: I037–I068, 성인28명×3단계 + 아이4명×2단계 =92 PNG\n- checks/: 확인 그림 정확히4장. 첫 그림에는92장 모두256px와96px로 배치했습니다. 세 번째 그림은16행씩 두 블록이며 각 초상은256px입니다.\n- portraits.csv:92행의 인물·단계 속성, 전체 프롬프트, 출처, 해시\n- QA_REPORT.md: 옷만 보고 계급 맞히기, 가장 닮은 세 쌍, 노화와UI 판정\n- provenance/: 생성 원본·프롬프트·참조·배치 기록. approved-pilot의36장은 비교용 승인 원본이며 이번92장 수량에 포함하지 않습니다.\n\n피부 톤과 체형은 도덕성의 표지가 아닙니다. 본 파일은 오프라인 후보 산출물이며 게임 통합·성능 검증 결과가 아닙니다.\n');
const inventory=walk(out).filter(f=>!['SHA256SUMS','inventory.json'].includes(path.basename(f))).sort().map(f=>({file:path.relative(out,f),bytes:fs.statSync(f).size,sha256:hash(f)}));json(path.join(out,'inventory.json'),inventory);fs.writeFileSync(path.join(out,'SHA256SUMS'),[...inventory,{file:'inventory.json',sha256:hash(path.join(out,'inventory.json'))}].map(p=>`${p.sha256}  ${p.file}`).join('\n')+'\n');
console.log(JSON.stringify({status:'PACKAGED',identities:32,portraits:92,proofs:4,csv_rows:92,inventory_files:inventory.length}));
