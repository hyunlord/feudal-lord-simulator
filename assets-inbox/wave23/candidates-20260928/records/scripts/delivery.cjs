const fs=require('fs'),path=require('path');
const p=path.resolve(__dirname,'..'),rows=JSON.parse(fs.readFileSync(p+'/records/asset-rows.json'));
const proofs=fs.readdirSync(p+'/proofs').filter(f=>f.endsWith('.png')).sort();
if(proofs.length!==4)throw Error('Expected4proofs');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
fs.writeFileSync(p+'/index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave23 후보</title><style>body{background:#29231c;color:#eee4d3;font:16px system-ui;margin:24px}a{color:#eac68d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}img{width:100%;height:220px;object-fit:contain;background:#9b998b}small{display:block}article{padding:12px;background:#393128}</style><h1>Wave23 후보</h1><p>82 PNG · 확인 그림4 · 게임 미설치</p><p>${proofs.map(f=>`<a href="proofs/${f}">${f}</a>`).join(' · ')}</p><main>${rows.map(r=>`<article><a href="${r.file}"><img loading="lazy" src="${r.file}" alt="${esc(r.description)}"></a><p>${esc(r.asset_id)}</p><small>${r.width}×${r.height} · ${esc(r.description)}</small><small>${esc(r.blend_mode)} · opacity cap ${r.opacity_max}</small></article>`).join('')}</main></html>`);
fs.writeFileSync(p+'/IMAGE_LINKS.md','# 개별 PNG 링크\n\n'+proofs.map(f=>`- [${f}](${p}/proofs/${f})`).join('\n')+'\n\n'+rows.map(r=>`- [${r.asset_id}](${p}/${r.file})`).join('\n')+'\n');
fs.writeFileSync(p+'/README.md',`# Wave23 날씨·마을 생활·인물 상태·왕실 문장·패드 후보

게임 미설치 후보입니다. 첨부 의뢰서의 모든 크기를 개별 PNG로 내보냈습니다.

| 계열 | 디자인/시트 | PNG |
|---|---:|---:|
| 날씨 |14|14|
| 마을 생활 |20|20|
| 인물 상태 |12, 96/48px|24|
| 왕실 문장 |2, 256/96px|4|
| 패드 |10, 48/32px|20|
| 합계 |58개 디자인/시트|82|

패드 L/R 어깨와 L/R 트리거는 각각 두 셀을 가진 시트입니다. 그 외는 한 셀입니다. 확인 그림은4장, assets.csv는PNG당1행으로82행입니다. 원본 참조·이전 납품은 수정하지 않았습니다.

## 사용 계약

- 날씨: assets.csv의 blend_mode와 opacity_max를 함께 사용합니다. 상한은 정적인 오프라인 확인 합성에서 검토한 값이며 게임 렌더러의 보장값은 아닙니다. 여러 효과의 중첩 한도와 HUD 보호는 weather 검수 기록을 따릅니다.
- 생활: 소 한 마리 몸통의 표기 좌표(56,49)→(28,63), 길이31.30px ×0.24를 기준으로 신종의 상대 크기를 계산했습니다. 쌍 그림 전체128px 폭을 한 마리의 몸길이로 쓰지 않습니다. 손으로 고른 해부학적 기준점의 근사치입니다.
- 걷기: 닭·개는4방향×2프레임. 몸통·머리·꼬리 보호 영역과 다리 변화 검수 기록을 함께 제공합니다. 새 날기4프레임은 날개 움직임이며 이 다리 제한과 구분됩니다.
- 인물: 장식만 제공합니다. 초상 얼굴 흑백화나 얼굴 수정은 하지 않았습니다. 중앙 얼굴 보호 영역과 확인판 픽셀 비교는 인물 검수 기록에 있습니다.
- 왕실: 완성 채색2판입니다. 1340년판은 파랑 바탕에 여러 금백합을 흩뿌린 France ancien이며 후기 세 백합 문장이 아닙니다. 고증 출처는 왕실 기록을 참조합니다.
- 패드: 중립 잉크·양피지색, A/B/X/Y와 L/R 문자 및 기능 모양만. 상표 로고·브랜드별 색상 없음.

## 확인 그림과 자료

${proofs.map((f,i)=>`${i+1}. [${f}](proofs/${f})`).join('\n')}

확인 그림은 첨부 게임 화면과 기존 초상에 새 후보를 오프라인 합성한 것입니다. 실제 게임 적용 화면이나 카메라 배율 검증이 아닙니다. 작은 동물은 기존 소 비례를 지키면 축소 화면에서 종과 다리 교대 판독이 제한될 수 있습니다. 검수표에 실제 관찰 결과를 기재했습니다.

- index.html: 전체 갤러리. IMAGE_LINKS.md: 개별 이미지 직접 링크.
- assets.csv: 크기·레이어·불투명도·프레임·피벗·표시배율·생성 기록·후처리·QA·SHA256.
- raw/: 생성 원본과 수정 이력. references/: 제공 자료와 실제 추가 사용한 프로젝트 참조.
- records/: 원본 보존 해시, 계열별 검수와 생성 기록, 통합 기술 검사.
- scripts/: 후처리·합성·기록 생성 절차. 새 그림 생성 자체의 모델/seed가 제공되지 않은 경우 null.
- SHA256SUMS: 납품 파일 해시. ZIP CRC 및 내부 파일과 폴더의 바이트 일치를 별도로 확인합니다.
`);
console.log('delivery docs/gallery4proofs82links');
