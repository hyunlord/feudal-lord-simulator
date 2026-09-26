import {W,D,fs,path,csv,sha} from './lib.mjs';
const report=JSON.parse(await fs.readFile(W+'/records/overlay-rework-verdict.json','utf8'));
for(const row of report.cases){for(const k of ['old_overlay','selected_overlay'])if(row[k].includes('/delivery/'))row[k]=row[k].split('/delivery/')[1];for(const [p,h]of [['house_file','house_sha256'],['selected_overlay','selected_overlay_sha256']])if(await sha(D+'/'+row[p])!==row[h])throw Error('Stale overlay case '+row.house);}
await fs.writeFile(D+'/overlay_compatibility.csv',csv(report.cases));
await fs.writeFile(D+'/qa/overlay-verdict.json',JSON.stringify(report,null,2));
for(const file of ['overlay-rework-provenance.json','overlay-rework-retarget.mjs','overlay-rework-provenance-finalize.mjs','register-houses.cjs'])await fs.copyFile(W+'/records/'+file,D+'/provenance/'+file);
await fs.copyFile(W+'/records/overlay-rework-zoom03.png',D+'/qa/overlay_game_zoom06.png');
for(const f of ['lib.mjs','proofs.mjs','catalog.mjs','validate.mjs'])await fs.copyFile(W+'/'+f,D+'/provenance/'+f);
await fs.mkdir(D+'/qa/isolated_era_probe',{recursive:true});
for(const f of ['samples.png','key.json','classifier.json','score.json'])await fs.copyFile(W+'/records/blind/'+f,D+'/qa/isolated_era_probe/'+f);
await fs.writeFile(D+'/README.md',`# Wave 20 주택 시대 변화 재작업

게임 미설치 후보 묶음입니다. L2·L3·L4 재작업 12장(v2), 승인된 L0·L1 8장(v1, 바이트 동일)을 함께 제공합니다.

- 1350: 깊은 돌출층, 노출 브래킷·들보 끝, 굵은 상자 골조, 넓은 수평 창. 굴뚝 없음.
- 1400: 촘촘한 세로 골조, 하부 석조, 격자 유리창, 큰 문 캐노피. L3b·L4a·L4b만 벽돌 굴뚝. 연기 기준점은 assets.csv.
- proofs/: 같은 5열(1300·1350a·1350b·1400a·1400b), 5행(L0~L4) 구도의 줌 1.0과 0.6 확인 그림 2장. PNG를 100%로 보십시오. 원본 PNG 대비 각각 약 0.5배와 0.3배입니다.
- assets.csv: 20장 목록, 실제 캔버스·피벗·배율·1×1칸 지상 발판·굴뚝 좌표·전체 생성 프롬프트·해시.
- assets/overlays/: 새 창·지붕 위치에 맞춘 대체 9장(판자 6, 눈 3). overlay_compatibility.csv는 전체 40조합과 적용 경로를 기록합니다. 원래 승인된 L0·L1은 references/overlays/의 기존 파일을 사용합니다.
- qa/: 검수표 근거, 수치검증, 오버레이 합성. provenance/: 실제 생성 원본·프롬프트·정합 및 후처리 기록.

캔버스 크기, 원래의 소수점 피벗, 표시 배율, 지상 발판은 고정했습니다. 새 상층부 외곽과 알파 모양은 의도적으로 바꿨습니다. 알파 바운딩박스로 재크롭하거나 새 외곽 폭으로 표시 배율을 다시 계산하지 말고, CSV의 전체 캔버스·피벗·배율을 사용하십시오. 오버레이는 같은 캔버스에 (0,0), 배율 1로 합성합니다.

수작업으로 지정한 바닥 접점 3개를 정합했습니다. 좌표 변환의 수치 잔차는 0에 가깝지만, 접점 판독 자체는 약 ±2px의 시각적 오차를 가집니다. 바닥 픽셀 전체가 원본과 동일하다는 뜻은 아닙니다. 돌출층은 지상 발판을 늘리지 않는 상층 투영으로, 화면상 약 13 원본 px입니다.

공유 눈 오버레이는 새 지붕들의 공통 내부에 쌓인 부분 적설입니다. 처마 전체를 덮는 형태는 아닙니다. 판자는 A/B의 공통 본체 알파 안으로 제한했습니다.

검수는 오프라인 PNG 합성과 실제 표시 크기로 실시했습니다. 게임 설치·런타임 동작·충돌 판정은 수행하지 않았습니다. 재현 스크립트의 절대 경로는 당시 작업 환경 기록이므로 다른 환경에서는 경로 조정이 필요합니다.
`);
await fs.writeFile(D+'/QA_CHECKLIST.md',`# 검수표

| 항목 | 결과 | 근거 |
|---|---|---|
| L2·L3·L4 × 2시대 × A/B = 12장 | 통과 | assets.csv, 각 v2 PNG |
| 승인 L0·L1 8장 무변경 | 통과 | 이전 승인본과 SHA-256 일치 |
| 캔버스·소수점 피벗·배율·1×1 발판 | 통과 | 원본 계약 대조, registration 기록 |
| 1350 돌출층·굵은 골조·넓은 창 | 통과 | 두 비교 시트, 독립 시각검수 93/100 |
| 1400 세로 골조·석조·격자창·캐노피 | 통과 | 두 비교 시트 |
| 굴뚝 3장만 존재, 연기 기준점 | 통과 | L3b·L4a·L4b, CSV 좌표 |
| 본체 투명 여백·하단 잘림 | 통과 | 재작업 12장 가장자리 알파 0 |
| 오버레이 40조합 | 통과 | 기존 16 유지, 새 24 재정합, overlay_compatibility.csv |
| 새 판자 본체 밖 부유 픽셀 | 0 | 12개 합성 모두 0 |
| 수치검증 | 311/311 통과 | qa/validation.json |
| 게임 설치 | 하지 않음 | 후보 전용 |

요청된 비교 시트에서는 동일 등급의 시대별 구조 차이를 확인했습니다. 추가 탐색으로 수행한, 등급·시대 표기를 숨긴 단독 이미지 시대 추측은 15개 중 11개(새 그림 12개 중 10개) 일치했습니다. 이 실험은 원본 1300도 3개 중 2개를 오인했으며, 단독 그림만으로 연도를 완벽히 식별한다는 보장은 아닙니다. 원본 응답과 채점은 qa/isolated_era_probe/에 보존했습니다.

접점 판독의 시각적 허용 오차와 부분 적설 범위는 README에 명시했습니다. ZIP은 작성 후 모든 항목의 CRC 및 SHA-256을 다시 검증합니다.
`);
console.log('Final metadata written; 40 case hashes verified.');
