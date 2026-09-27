import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const work=path.resolve(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'/tmp/astra-portrait-pool3-work');
const out=path.join(work,'deliverable'),raster=process.env.POOL_RASTER??'/tmp/astra-wave10-v2-work/raster';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=(file,obj)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');};
const copy=(source,dest)=>{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const csv=v=>'"'+String(Array.isArray(v)?v.join('; '):v??'').replaceAll('"','""')+'"';
function refreshManifest(){const inv=walk(out).filter(f=>!['inventory.json','SHA256SUMS'].includes(path.basename(f))).sort().map(f=>({file:path.relative(out,f),bytes:fs.statSync(f).size,sha256:hash(f)}));json(path.join(out,'inventory.json'),inv);fs.writeFileSync(path.join(out,'SHA256SUMS'),[...inv,{file:'inventory.json',sha256:hash(path.join(out,'inventory.json'))}].map(p=>`${p.sha256}  ${p.file}`).join('\n')+'\n');return inv.length;}
if(process.argv.includes('--manifest-only')){console.log(JSON.stringify({status:'MANIFEST_REFRESHED',files:refreshManifest()}));process.exit(0);}
const roster=JSON.parse(fs.readFileSync(path.join(work,'roster.json'),'utf8')),identities=roster.identities;
assert(identities.length===24,'Expected 24 identities');
assert(identities.every((p,i)=>p.identity_id===`I${101+i}`),'Expected I101..I124 ordered');
assert(identities.every(p=>p.stages.length===3&&['young','mature','old'].every(s=>p.stages.some(t=>t.stage===s))),'Expected three stages each');
const rows=identities.flatMap(p=>p.stages.map(s=>({...p,...s,id:`${p.identity_id}_${s.stage}`,file:`portraits/${p.identity_id}_${s.stage}.png`})));
assert(rows.length===72&&new Set(rows.map(p=>p.id)).size===72,'Expected 72 unique stages');
const measurements=[];
for(const p of rows){
 for(const field of ['faction','rank','fur_type','heraldry','role','prop','prop_group'])assert(typeof p[field]==='string'&&p[field].trim(),`Missing ${field}: ${p.id}`);
 assert(Number.isInteger(p.period)||typeof p.period==='string'&&p.period.trim(),`Missing period: ${p.id}`);
 const file=path.join(out,p.file),info=JSON.parse(execFileSync(raster,['info',file],{encoding:'utf8'}));
 assert(info.width===256&&info.height===256&&info.transparent_pixels===0&&info.partial_alpha_pixels===0,`256 opaque PNG required: ${p.id}`);
 const record=JSON.parse(fs.readFileSync(path.join(work,'generation-records',p.id+'.json'),'utf8'));
 assert(record.prompt?.length>20&&fs.existsSync(record.source_path),`Invalid generation record: ${p.id}`);
 for(const [key,value] of Object.entries(record.metadata_overrides??{})){assert(['hair_color','skin_tone','features','clothing','headwear_type','marital_status','expression','prop','prop_group','fur_type','heraldry','period'].includes(key),`Unsupported override ${key}`);p[key]=value;}
 p.source_file=`provenance/raw/${p.id}${path.extname(record.source_path)||'.png'}`;copy(record.source_path,path.join(out,p.source_file));p.reference_files=[];
 for(const ref of record.references??[]){const source=typeof ref==='string'?ref:ref.path;assert(fs.existsSync(source),`Missing reference ${source}`);const dest=`provenance/references/${hash(source).slice(0,12)}-${path.basename(source)}`;copy(source,path.join(out,dest));p.reference_files.push(dest);}
 p.prompt=record.prompt;p.sha256=hash(file);p.source_sha256=hash(record.source_path);json(path.join(out,'provenance/generation-records',p.id+'.json'),{...record,packaged_source:p.source_file,packaged_references:p.reference_files});measurements.push({file:p.file,width:256,height:256,sha256:p.sha256});
}
assert(new Set(rows.map(p=>p.sha256)).size===72,'Duplicate portrait bytes');assert(fs.readdirSync(path.join(out,'portraits')).filter(f=>f.endsWith('.png')).length===72,'Expected exactly 72 portraits');
const propCounts=list=>Object.fromEntries(['none','book_scroll','other'].map(k=>[k,list.filter(p=>p.prop_group===k).length]));
const propDistribution={scope:'Selected metadata; actual visual assessment in QA_REPORT.md',identities:{total:24,counts:propCounts(rows.filter(p=>p.stage==='young'))},stages:{total:72,counts:propCounts(rows)},details:[...new Set(rows.map(p=>p.prop))].sort().map(prop=>({prop,identities:rows.filter(p=>p.stage==='young'&&p.prop===prop).length,stages:rows.filter(p=>p.prop===prop).length}))};
assert(propDistribution.stages.counts.book_scroll/72<=0.25,'Books/scrolls exceed 25%');
const checks=path.join(out,'checks'),scenes=path.join(out,'provenance/proof-scenes');fs.mkdirSync(checks,{recursive:true});
const t=(text,x,y,size=18)=>({text,x,y,size,color:'#302c26'}),im=(file,x,y,width,height=width)=>({file:`../../${file}`,x,y,width,height});
const board=(name,scene)=>{const sf=path.join(scenes,name+'.json');json(sf,scene);execFileSync(raster,['board',path.join(checks,name+'.png'),sf]);};
const factionLabels={earl_house:'백작 가문',crown:'왕실',neighbor_a:'인접 영주 A',neighbor_b:'인접 영주 B',diocese:'주교구',benedictine:'베네딕토 수도원',franciscan:'프란치스코 수도원',merchant_a:'상인 가문 A',merchant_b:'상인 가문 B',town:'도시',guild:'길드',rural_community:'농민 공동체',community:'여성 공동체',earl_household:'백작 가신단',town_council:'도시 평의회'};
const proof1={width:1440,height:10000,background:'#d5cbbb',images:[],texts:[t('01 · 세력 수장 24명 × 청년·장년·노년 = 72장',28,20,27),t('왼쪽: 256 px · 오른쪽: 같은 사슬 96 px · 세력별 묶음',28,58,23)]};
let y=110,lastFaction='';
const groupedIdentities=[...new Set(identities.map(p=>p.faction))].flatMap(faction=>identities.filter(p=>p.faction===faction));
for(const p of groupedIdentities){if(p.faction!==lastFaction){proof1.texts.push(t(factionLabels[p.faction]??p.faction,28,y,25));y+=46;lastFaction=p.faction;}proof1.texts.push(t(`${p.identity_id} · ${p.role} · ${p.rank}`,28,y,20));y+=32;['young','mature','old'].forEach((stage,i)=>{proof1.images.push(im(`portraits/${p.identity_id}_${stage}.png`,28+i*276,y,256),im(`portraits/${p.identity_id}_${stage}.png`,880+i*170,y+50,96));proof1.texts.push(t(stage,28+i*276,y+259,16),t(stage,880+i*170,y+150,16));});y+=294;}
const imageBottom=Math.max(...proof1.images.map(p=>p.y+p.height));y=Math.max(y+50,imageBottom+60);proof1.texts.push(t('소지품 분포 · 인물 24명 / 단계 72장',28,y,26));y+=50;
for(const [key,label] of [['none','빈손'],['book_scroll','책·두루마리'],['other','기타']]){const n=propDistribution.identities.counts[key],s=propDistribution.stages.counts[key];proof1.texts.push(t(`${label}: ${n}/24명 (${(n/24*100).toFixed(1)}%) · ${s}/72장 (${(s/72*100).toFixed(1)}%)`,28,y,23));y+=40;}
propDistribution.details.forEach((p,i)=>proof1.texts.push(t(`${p.prop}: ${p.identities}명 / ${p.stages}장`,28+i%3*455,y+Math.floor(i/3)*32,18)));y+=Math.ceil(propDistribution.details.length/3)*32+45;proof1.height=y;board('01-faction-aging-72-256-and-96',proof1);
function parseCSV(text){
 const rows=[];let row=[],value='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(value);value='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
  else value+=ch;
 }
 assert(!quoted,'Unclosed CSV quote');
 if(row.length||value){row.push(value);rows.push(row);}
 const header=rows.shift();assert(header&&new Set(header).size===header.length,'Missing or duplicate CSV columns');
 return rows.map((r,i)=>{assert(r.length===header.length,`CSV width mismatch row ${i+2}`);return Object.fromEntries(header.map((k,j)=>[k,r[j]]));});
}
const pilotMetadataFile='/tmp/astra-portrait-pivot-work/deliverable/portraits.csv';
const pilotMetadata=parseCSV(fs.readFileSync(pilotMetadataFile,'utf8'));
const combined=[];
for(const [batch,start,end] of [[1,37,68],[2,69,100]])for(let n=start;n<=end;n++){const id=`I${String(n).padStart(3,'0')}_young`,dest=`provenance/batch${batch}/${id}.png`;copy(`/tmp/astra-portrait-pool${batch}-work/deliverable/portraits/${id}.png`,path.join(out,dest));combined.push({id,identity_id:`I${String(n).padStart(3,'0')}`,stage:'young',origin:`batch${batch}`,file:dest,source:`/tmp/astra-portrait-pool${batch}-work/deliverable/portraits/${id}.png`});}
combined.push(...identities.map(p=>({id:p.identity_id+'_young',identity_id:p.identity_id,stage:'young',origin:'batch3',file:`portraits/${p.identity_id}_young.png`,source:path.join(out,`portraits/${p.identity_id}_young.png`)})));
for(const id of ['P01','P08','P09','P13','P14','P20','P25','P26','P31','P32','P33','P21']){
 const meta=pilotMetadata.find(p=>p.id===id),exception=['P33','P21'].includes(id);
 assert(meta&&meta.age_group===(exception?'mature':'young'),`Pilot stage mismatch: ${id}`);
 const source=`/tmp/astra-portrait-pivot-work/deliverable/portraits/${id}.png`,dest=`provenance/approved-pilot/${id}.png`;
 assert(hash(source)===meta.sha256,`Approved pilot hash mismatch: ${id}`);copy(source,path.join(out,dest));
 combined.push({id:id+(exception?` · 장년 ${meta.age}`:' · 청년'),identity_id:id,stage:meta.age_group,age:Number(meta.age),origin:'pilot',file:dest,source});
}
assert(combined.length===100&&new Set(combined.map(p=>p.identity_id)).size===100,'Comparison requires100 unique identities');
assert(new Set(combined.map(p=>hash(path.join(out,p.file)))).size===100,'Comparison requires100 unique source hashes');
assert(combined.filter(p=>p.stage==='young').length===98,'Comparison requires98 young');
assert(combined.filter(p=>p.stage==='mature').map(p=>p.identity_id).join(',')==='P33,P21','Only P33/P21 are mature exceptions');
for(const p of combined)assert(hash(p.source)===hash(path.join(out,p.file)),`Comparison source mismatch: ${p.identity_id}`);
copy(pilotMetadataFile,path.join(out,'provenance/approved-pilot/source-portraits.csv'));
json(path.join(out,'provenance/comparison-grid.json'),{count:100,young:98,mature_exceptions:['P33','P21'],items:combined.map(p=>({...p,sha256:hash(path.join(out,p.file))}))});
const comparisonFile=path.join(work,'qa-comparison.json'),comparison=JSON.parse(fs.readFileSync(comparisonFile,'utf8'));
assert(!/AWAITING|PENDING/i.test(comparison.status??''),'Final comparison review is required before packaging');
const similarPairs=comparison.final_most_similar_pairs??comparison.most_similar_pairs;
assert(Array.isArray(similarPairs)&&similarPairs.length===3,'Final comparison must name exactly3 closest pairs');
for(const pair of similarPairs)assert(pair.ids?.length===2&&pair.ids.every(id=>combined.some(p=>p.identity_id===id))&&pair.reason,'Invalid comparison pair');
for(const reviewed of comparison.files??[])assert(fs.existsSync(reviewed.file)&&hash(reviewed.file)===reviewed.sha256,`Stale comparison review: ${reviewed.id}`);
const proof2={width:2200,height:3000,background:'#d5cbbb',images:[],texts:[t('02 · 인물 비교 100명 · 청년 98명 + 장년 예외 2명 · 192 px',28,20,28),t('본제작 청년 88명 + 승인 파일럿 청년 10명 + 장년 P33(35세)·P21(37세) 2명',28,58,22),t('청년 고유 원본은 총 98명뿐임. 마지막 두 칸은 장년 예외 · 가장 닮은 세 쌍은 아래에 명시',28,90,20)]};
combined.forEach((p,i)=>{const x=28+i%10*216,py=140+Math.floor(i/10)*236;proof2.images.push(im(p.file,x,py,192));proof2.texts.push(t(p.id,x,py+198,16));});
let footerY=2530;proof2.texts.push(t('가장 닮은 세 쌍 · 현재 선택본 전체 비교 · 상세 구별점은 QA_REPORT.md',28,footerY,25));footerY+=48;
for(const [i,pair] of similarPairs.entries()){
 proof2.texts.push(t(`${i+1}. ${pair.ids.join(' – ')}`,28,footerY,24));footerY+=34;
 const reason=pair.reason_ko??pair.reason,lines=reason.match(/.{1,125}(?:\s|$)|.{1,125}/gu)??[reason];
 for(const line of lines){proof2.texts.push(t(line.trim(),48,footerY,18));footerY+=26;}footerY+=22;
}
proof2.height=footerY+30;board('02-comparison-100-young',proof2);
const template='provenance/ui-reference/wave19-frame_faction_page.png';copy(path.join(work,'references/wave19-frame_faction_page.png'),path.join(out,template));copy(path.join(work,'references/heraldry.png'),path.join(out,'provenance/ui-reference/heraldry-sheet.png'));
const arms=[{name:'castle',box:[52,121,215,228]},{name:'lion',box:[1478,121,215,228]},{name:'wheel',box:[907,563,215,230]},{name:'wheat',box:[648,562,161,230]}];
for(const arm of arms){arm.file=`provenance/ui-reference/arms-${arm.name}.png`;execFileSync(raster,['crop',path.join(work,'references/heraldry.png'),path.join(out,arm.file),...arm.box.map(String)]);}
const selected=roster.ui_faction_selection??['I101','I107','I115','I121'];assert(selected.length===4&&selected.every(id=>identities.some(p=>p.identity_id===id)),'UI selection requires four valid identities');
const proof3={width:1360,height:1750,background:'#d5cbbb',images:[],texts:[t('03 · Wave 19 세력 페이지 · 승인 틀 + 수장 초상 + 첨부 문장 예',28,20,25),t('문장은 첨부된 창작 문장 견본의 예시 배정이며 역사적·확정 세력 문장이 아닙니다.',28,56,21)]};
selected.forEach((id,i)=>{const p=identities.find(p=>p.identity_id===id),x=24+i%2*672,py=102+Math.floor(i/2)*816;proof3.images.push(im(template,x,py,640,800),im(`portraits/${id}_mature.png`,x+86,py+111,112),im(arms[i].file,x+Math.round(537-43*arms[i].box[2]/arms[i].box[3]),py+107,Math.round(86*arms[i].box[2]/arms[i].box[3]),86));proof3.texts.push(t(p.role,x+250,py+115,24),t(id+' · 장년',x+250,py+160,19),t(factionLabels[p.faction]??p.faction,x+80,py+302,22),t('수장',x+65,py+380,22),t(p.role,x+65,py+420,19),t('지위',x+345,py+380,22),t(p.role,x+345,py+420,19),t('관계 · 권리 · 기록',x+70,py+610,22),t('오프라인 배치 확인용 후보',x+70,py+652,20),t('문장: 첨부 창작 견본 '+arms[i].name,x+70,py+688,18));});board('03-wave19-faction-page-four',proof3);
assert(fs.readdirSync(checks).filter(f=>f.endsWith('.png')).length===3,'Exactly three proof PNG required');
const columns=['identity_id','stage','id','file','sex','age','class','occupation','role','prop','prop_group','body','direction','hair_color','skin_tone','features','clothing','marital_status','expression','headwear_type','faction','rank','period','fur_type','heraldry','source_file','source_sha256','reference_files','prompt','sha256'];
fs.writeFileSync(path.join(out,'portraits.csv'),'\uFEFF'+[columns.map(csv).join(','),...rows.map(p=>columns.map(k=>csv(p[k])).join(','))].join('\r\n')+'\r\n');json(path.join(out,'roster.json'),roster);json(path.join(out,'prop-distribution.json'),propDistribution);
json(path.join(out,'technical-validation.json'),{status:'PASS',scope:'Files and provenance only; visual QA is separate.',identities:24,portrait_png:72,proof_png:3,csv_rows:72,comparison_grid:{total:100,production:88,pilot_added:12,young:98,mature_exceptions:['P33','P21'],reason:'Production 88 plus only 10 unique pilot young exist. Two mature pilot exceptions explicitly labeled.'},prop_distribution:propDistribution,files:measurements});
if(!fs.existsSync(path.join(out,'QA_REPORT.md')))fs.writeFileSync(path.join(out,'QA_REPORT.md'),'# 자체 검수\n\nPENDING_VISUAL_REVIEW\n');
fs.writeFileSync(path.join(out,'README.md'),'# 초상 풀 3차 · 세력 수장\n\n게임에 설치하지 않은 후보입니다.\n\n- portraits/: I101–I124, 청년·장년·노년 72 PNG, 256×256 불투명 완성 초상\n- checks/: 확인 그림 3장. 01 세력별 노화 사슬 256px와96px 및 소지품 분포, 02 청년98명과 장년예외2명, 총100명 한 격자, 03 실제 Wave19 틀에 배치한 세력 페이지 4예\n- 100명 산술: 1차32+2차32+3차24=88명에 승인 파일럿 청년10명과 장년예외 P33(35세)·P21(37세)를 추가했습니다. 기존 고유 청년 원본은 총98명이므로 청년100명 조건은 자료 부족으로 충족하지 못하며 이 예외를 그림에 명시했습니다. 기존 초상은 비교 자료이며 이번 72장 수량에 포함하지 않습니다.\n- portraits.csv: 2차 필드에 faction,rank,period,fur_type,heraldry 추가. 전체 선택 프롬프트와 출처 해시 포함\n- QA_REPORT.md: 동일인 노화, 복식·모피·전령 문장, 닮은 세 쌍 및 한계\n- provenance/: 원본 생성·참조·확인 그림 배치, 승인 이전 초상. Wave19 틀은 기존 후보 ZIP에서 추출. 페이지 문장은 첨부 창작 견본의 예시 배정이며 역사적 확정 문장이 아닙니다.\n\n완성 초상은 레이어 조립이나 좌우반전으로 만들지 않았습니다. 피부톤·체형은 도덕성을 나타내지 않습니다. 오프라인 검수이며 게임 통합·성능 검증이 아닙니다.\n');
copy(new URL(import.meta.url).pathname,path.join(out,'provenance/tools/package-pool3.mjs'));copy(path.join(work,'validate-package-pool3.mjs'),path.join(out,'provenance/tools/validate-package-pool3.mjs'));copy(path.join(path.dirname(raster),'raster.swift'),path.join(out,'provenance/tools/raster.swift'));copy(path.join(work,'commission.md'),path.join(out,'provenance/commission.md'));
console.log(JSON.stringify({status:'PACKAGED',portraits:72,proofs:3,csv_rows:72,inventory_files:refreshManifest()}));
