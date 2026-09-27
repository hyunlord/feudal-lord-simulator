import fs from 'node:fs/promises';
const W='/tmp/astra-wave20-snow-v4',D=W+'/delivery';
for(const era of [1350,1400])await fs.cp(W+'/records'+era,D+'/provenance/'+era,{recursive:true});
await fs.cp(W+'/roof-audit',D+'/qa/roof-audit',{recursive:true});
for(const f of ['build.mjs','verify.mjs','coverage.mjs','package.mjs','finalize.mjs'])await fs.copyFile(W+'/'+f,D+'/provenance/'+f);
const rows=JSON.parse(await fs.readFile(D+'/qa/asset-metadata.json')),coverage=JSON.parse(await fs.readFile(D+'/qa/roof-coverage.json'));
for(const r of rows){const era=r.era,l=r.level,record=JSON.parse(await fs.readFile(W+`/records${era}/`+(era===1350?`prompt_l${l}.json`:`generation_l${l}.json`)));r.prompt=record.prompt;r.generation_tool='built-in image_gen';r.generation_record=`provenance/${era}/`+(era===1350?`prompt_l${l}.json`:`generation_l${l}.json`);r.replaces=`roof_snow_l${l}_shared-v3.png`;r.coverage_a_percent=coverage.find(x=>x.house===`house_l${l}_${era}_a-v2.png`).coverage_percent;r.coverage_b_percent=coverage.find(x=>x.house===`house_l${l}_${era}_b-v2.png`).coverage_percent;}
const keys=Object.keys(rows[0]),cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';await fs.writeFile(D+'/assets.csv','\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n');
const min=Math.min(...coverage.map(x=>x.coverage_percent)),max=Math.max(...coverage.map(x=>x.coverage_percent));
await fs.writeFile(D+'/README.md',`# Wave20 지붕 눈 v4 후보

양식별 새 눈 오버레이 6장입니다. roof_snow_l{2,3,4}_{1350,1400}-v4.png를 제공합니다. 기존 shared-v3 세 장 대신 양식에 해당하는 v4를 선택합니다. 각 파일은 해당 등급·양식의 a/b 두 변형에 공용입니다.

- 12개 본체 조합의 지붕면 적설 피복률: ${min}~${max}%. 알파 가중 면적 기준이며 모든 조합이 60~80% 범위입니다.
- 불규칙한 눈 가장자리와 군데군데 드러난 기와를 유지했습니다. 1400 L4는 굴뚝 기단에 인접한 눈을 남기고 굴뚝 본체와 입구를 가리지 않았습니다.
- L2 137×137, L3 142×142, L4 161×161px. 원래 본체와 같은 캔버스·피벗에 (0,0), 배율 1로 합성합니다. 피벗과 실제 표시 배율은 assets.csv에 기록했습니다.
- proofs/의 확인 그림 2장은 1300·1350a·1350b·1400a·1400b, L2~L4 배열입니다. 줌 1.0과 0.6은 원본의 약 0.5배와 0.3배입니다. PNG 100% 표시로 확인하십시오.
- references/는 비교에 사용한 승인된 본체와 1300 눈 레이어의 사본입니다. 신규 산출물은 assets/overlays/의 6장입니다. 승인 본체 20장과 빈집 판자 6장은 수정하지 않았으며 이전 납품 SHA-256과 대조했습니다.
- assets.csv: 적용 대상·규격·피벗·대체 파일·프롬프트·해시. roof_coverage.csv: 12조합 피복률. provenance/: 실제 생성 원본·프롬프트·정합 스크립트. qa/: 지붕 마스크·검수 결과.

피복률 분모는 눈 생성물과 독립적으로 원본에서 추적한 주 지붕면입니다. 박공벽·문 캐노피·굴뚝 본체는 제외했습니다. 수작업 경계의 오차는 약 ±2 원본 px이며, 알파값의 합을 해당 지붕면 픽셀 수로 나눴습니다. 개별 판독 수치는 이 마스크 기준 측정값이지 물리적 적설량 측정은 아닙니다.

게임에는 설치하지 않았습니다. 오프라인 합성과 실제 축소 크기에서 확인했습니다. 스크립트의 로컬 절대 경로는 생성 당시 기록이며 다른 환경의 재현에는 경로 조정이 필요합니다.
`);
console.log({coverage_min:min,coverage_max:max,rows:rows.length});
