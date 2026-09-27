const fs=require('fs'),path=require('path');
const p=path.resolve(__dirname,'..'),rows=JSON.parse(fs.readFileSync(p+'/records/asset-rows.json'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const proofs=['01-ch3-ending-before-after.png','02-chapter4-unlabelled.png','03-chapter5-unlabelled.png'];
fs.writeFileSync(p+'/index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave21 재작업 후보</title><style>body{background:#28231e;color:#eee4d3;font:16px system-ui;margin:24px}a{color:#eac68d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}img{width:100%;height:240px;object-fit:contain;background:#3c332a}small{display:block}section{margin:24px 0}</style><h1>Wave21 재작업 후보</h1><p>24장 교체 · 34장 원본 그대로 · 게임 미설치</p><section>${proofs.map(f=>`<a href="proofs/${f}">${f}</a>`).join(' · ')}</section><main>${rows.map(r=>`<article><a href="${r.file}"><img loading="lazy" src="${r.file}" alt="${esc(r.description)}"></a><p>${r.asset_id} · ${r.revision==='reworked'?'재작업':'원본 유지'}</p><small>${esc(r.description)}</small></article>`).join('')}</main></html>`);
fs.writeFileSync(p+'/IMAGE_LINKS.md','# 개별 이미지\n\n'+proofs.map(f=>`- [${f}](${p}/proofs/${f})`).join('\n')+'\n\n'+rows.map(r=>`- [${r.asset_id} · ${r.revision}](${p}/${r.file})`).join('\n')+'\n');
fs.writeFileSync(p+'/README.md',`# Wave21 장면 재작업 후보

24장을 다시 그리고 34장은 기존 납품과 바이트 단위로 동일하게 보존했습니다. 최종 게임용 후보 PNG는 58장입니다. 게임에 설치하지 않았습니다.

## 달라진 장면

- ch3_ending: 빈 골목·닫힌 덧창·뜨문뜨문 남은 집들이 지배하는 저녁. 두 곳의 작은 지붕 수선만 진행됩니다.
- 4장 9장: 행진, 성문 기마 사절, 시장 십자가 낭독, 아케이드 헌장 게시, 문간 징수, 생산 경관 갈림길, 청원 투입구, 도구를 든 서약, 성문 열쇠 사슬.
- 5장 14장: 계단 군중, 다리 사절단, 임종 침상, 인장 조각, 매달린 밀랍 인장, 벽장 기록 보관, 성벽 위 대면, 마당의 후계 방패, 나루 과세 응답, 언덕 유산 선택, 청동 인장, 발코니 헌장, 출발하는 후계자, 기록함 봉인.
- 실내 회의뿐 아니라 반복적인 탁자 구도와 명시된 예시도 함께 교체했습니다. 전체 대상·사유·새 구도는 rework.csv 24행에 있습니다.
- ch3-records-contact 및 ch5-events-contact는 게임 에셋에서 제외했고 이번 ZIP에도 넣지 않았습니다. 제작 중 비교판은 raw/ 아래 검수 자료로만 있습니다.

## 확인 그림

1. proofs/01-ch3-ending-before-after.png: 위 원본, 아래 새 그림. 비율 유지.
2. proofs/02-chapter4-unlabelled.png: 4장 전체 19장, 제목 없이 순서를 섞었습니다.
3. proofs/03-chapter5-unlabelled.png: 5장 전체 20장, 제목 없이 순서를 섞었습니다.

확인 그림의 배치 정답은 records/proof-layout.json입니다. 독립 검수자는 먼저 그림만 보고 각 칸의 행동을 기록한 뒤 정답과 대조합니다. 장소·행동의 구분과 정확한 제도명 해석은 별개입니다. 그림만으로 특허 협상/자치의 법적 차이까지 단정할 수는 없습니다.

## 파일과 기록

- assets/: 최종 후보 58장. assets.csv: 전체 58행. rework.csv: 재작업 24행.
- index.html: 전체 갤러리. IMAGE_LINKS.md: 개별 PNG 직접 링크.
- raw/rework-*/: 새 생성 원본·교정 이력. raw/previous/: 이전 제작 원본.
- references/previous/: 교체 전 그림 24장. records/previous/: 이전 생성 기록.
- records/technical-qa.json: 규격·원본 보존·변경 SHA 확인.
- records/csv-validation.json: CSV 작성·재입력 모든 셀 비교.
- records/independent-rework-review.json: 제목 없는 독립 시각 검수.
- SHA256SUMS: 패키지 파일 해시. 생성 도구가 제공하지 않은 모델 버전·seed는 null입니다.

후처리는 비례 리사이즈와 확인판 합성입니다. 원본 생성 크기와 최종 출력 크기는 다를 수 있으며 각 생성 기록에 기재했습니다. 게임 안 렌더링·성능·UI 읽힘은 검증하지 않았습니다.
`);
console.log('delivery docs and gallery');
