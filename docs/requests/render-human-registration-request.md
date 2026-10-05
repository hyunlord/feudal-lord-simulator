# HEIGHT 추가 등록 요청 — 신체 기준·군중·운구 접촉

상태: **METADATA REQUEST DRAFT / 등록 미수락**. 좁은 A1(기존 등록 높이16→17.6)의 승인·수락과 분리한다. 이 metadata 요청 자체는 A1을 승인하지 않으며, 기존 runtime 원본과 그 수락 상태는 별도 증거로 유지한다. 이 요청은 기존 door23 요청에 없는 신체 기준·연령 상대비율·군중 사람별 등록·bier 접촉 metadata만 보충한다. 새 그림, 재그림, 원본 PNG 수정, 제품 코드·catalog 설치를 요청하거나 수행하지 않는다. 이 공식 요청의 작성 범위는 docs/requests의 두 문서뿐이며 제품·원본 PNG·설치 장부를 변경하지 않는다.

기준은 격리 HEIGHT AFTER `cd399e4abb26fc04b37dc27b5c61bec270934a7d` + 승인된 A1 patch다. 게시 본선 `90d9b586`·렌더B 작업트리 `db17321a`의 현행값은 `VILLAGER_WORLD_SCALE=0.5`, 등록 높이16이며 bearer scale은16/65다. 격리 A1 후보만 등록 높이17.6(동등 배율0.55), bearer scale17.6/65이며 별도 승인된 향후 이관 전까지 게시 본선 또는 렌더B 작업트리 적용을 뜻하지 않는다. 이전 Graft 기반 `height-next-scope.md` 탐색 결과를 재사용하고 실제 소스·원문 CSV·파일 bytes를 재확인했다. 아래12개 완성본은 각 inbox 원본과 runtime PNG SHA가 동일하다. 이는 **이미 존재하는 파일의 byte 대응**이며 새 runtime/접촉 검증이 아니다. 전체 SHA·정확한 source/runtime 경로·native canvas·기존 frame metadata는 JSON sidecar에 있다.

## 고정 대상

| ID | native canvas | 현재 완성본 SHA256 |
|---|---|---|
| `wk_child_f_01` | 296×148 | `a8ddff1cf198dbac1606f739b450f06969a7a116661f5de112b395942b5a8c40` |
| `wk_child_f_02` | 296×148 | `85f48c179ace72804705910d60d804a12bc6705e4784e3a83a62a853f0830287` |
| `wk_child_m_01` | 296×148 | `7d696a0d530e95b63f91965c5e57843f4abbbea2e3d009c993cec2504bd8089d` |
| `wk_child_m_02` | 296×148 | `d4f23c093d9dea2ee81b9cde6e34c48c72aebc99609610a971d6e7b858e16e6d` |
| `wk_elder_f_01` | 296×148 | `846cfdc955ce5c9f0a4d29bd53e0848a7893694570c7c27ad6c8a62a4d11adc9` |
| `wk_elder_f_02` | 296×148 | `4de53017b97ffba24e91e0d42057c4d9d5a6c78f081ec503e6a1dfbc2923adbc` |
| `wk_elder_m_01` | 296×148 | `6e5a58e4cb9d1413a76b3eb93c557f1fc9a4045c141cc49baed3ea9ed7179a12` |
| `wk_elder_m_02` | 296×148 | `57c60fa33495d0b2182aee495e404eb7094f993446761d29ae7aabfc9f0a90fe` |
| `event_crowd_manor_gate` | 192×128 | `4702bfbc032f2c8d0b7ad94503fe4381704890122a64a699011997cf104939d1` |
| `wk_funeral_bearers` | 296×148 | `8e51b570cd335df31af90ddaff625102d4db57beb31ee04784a17f10c0dcee68` |
| `prop_bier_shroud_ne` | 64×32 | `5726d1eb760a2fe604616766f221b10a63270c7f94a9a7a92c9d2b4974884fa7` |
| `prop_bier_shroud_nw` | 64×32 | `0431d99caf69ce82867f313c214f5751f7090d698b6b36b06b32d15a39393533` |

## 1. 일반 아동·노인8장의 연령 상대 기준

`walkerLook.ts:131–134`는 실제 resident age band에 따라 body를 고른다. `walkerComposer.ts:220–232`의 `32*scale/frame.figureHeight`에는 별도 age 비율이 없다. `buildWalkerSheetManifest.py:166–208`은 child/elder 자신의 alpha≥128 첫 행과 마지막 행으로 높이와 foot을 계산하고, 높이39–61% 범위의 외곽에서 hands를 추정한다. 이는 **현재 사용 중인 측정 알고리즘**이지 맨머리 crown–맨발 sole의 authored 등록은 아니다. 기존16에서도 있던 의미를 A1의 신규 regression이라고 부르지 않는다.

요청할 반환 metadata는 각8장 × 4방향 × 2gait의 bare-head crown, 지지발 sole/ground 및 발의 지지 상태, source pixel 좌표와 검수 근거다. 머리장식·머리카락·신발 높이는 anatomical height와 구분한다. 가려진 점은 원저작 기준이 있을 때만 author-confirmed로 제공하고, 없으면 null/이유를 유지한다. 겉으로 보이는 alpha 끝점을 anatomical 좌표로 이름만 바꾸지 않는다.

성인 기준은 sidecar에 고정한 civilian man/woman 원본과 명시적으로 대응시킨다. 아동의 성인 대비 비율은 **미정**이며 art/design 담당자가 근거와 함께 정해야 한다. 노인은 성인의 작은 버전이라고 가정하지 않는다. 구부린 자세의 화면상 높이와 동일 인물의 신체 기준 높이를 구분하여, 매 gait의 자세 변화가 강제로 같은 키로 늘어나는 문제를 피할 정책을 제시한다. 현재 derived child/elder template4장의 SHA도 참조에 포함했다. 숫자 비율을 이 초안이 창작하지 않는다.

story child는 `storyWorldProps.ts:75–76,108–109`에서 family와 같은 배율을 써 원본 상대키를 보존한다. 일반 resident와 같은 구현이라고 주장하거나 이번 요청으로 story policy까지 수정하지 않는다. 반환 metadata의 실제 저장 위치/renderer 적용은 이후 별도 검토이며 generated manifest 직접 수정은 금지한다. generator와 원천 등록 소유권을 보존해야 한다.

## 2. manor 군중1장의 사람별 등록

`storyWorldProps.ts:66`의 crowd는 고정0.55이고 A1 정본 상수에 연결되지 않는다. `wave9ArtManifest.generated.ts:19`는192×128, pivot96,64만 제공한다. 후보 CSV prompt에는12명 요청이 있지만 실제 PNG의 인원수나 사람별 기준점을 증명하지 않는다. 이 초안에서 새 인원수 판정을 하지 않았다.

요청: 실제 person별 안정된 region ID와 영역, adult/child/unknown 구분, 각 crown/sole/ground, 가림과 지지면, 앞뒤 순서 및 성인 reference 대응. 완전히 가린 발·머리는 unknown을 허용한다. 군중 전체 bbox, 연결 성분 개수 또는 성분 높이의 중앙값으로 사람 키를 대신하지 않는다. 원본을 잘라 개별 actor로 바꾸거나 새 군중을 생성하는 요청이 아니다. per-person 등록이 부족하면 공통17.6 적용은 계속 미해결로 남긴다.

## 3. funeral bearer1장 + bier2장의 접촉 등록

`plagueWorldProps.ts:211–226`은 실제 arrival/path 조건에서 bearer **한 번**을 draw하고 NE/SE에는NE bier, SW/NW에는NW bier를 고른다. 게시 본선 `90d9b586`·렌더B 작업트리 `db17321a`의 현행 bearer는16/65이고 격리 A1 후보에서는17.6/65다. bier는 두 경우 모두 별도0.65, offset±10,+6이다. CSV generation prompt는 같은 bearer를 두 번 배치하는 의도를 적었지만 현재 draw 구현의 인원수 증거가 아니다. 이 차이를 이번 metadata 요청에서 두 번째 actor 추가로 해결하지 않는다.

요청: bearer의4방향×2gait 각각 손의 실제 grip center 또는 접촉 영역·손바닥/손가락 방향·crown/지지발, 각 bier의 두 pole 축·잡을 수 있는 구간·handle 중심·가림 순서. 단순 canvas pivot32,16은 손잡이 anchor가 아니다. 실제4방향과 bier2그림의 pairing을 표로 반환하고, 현재 한 bearer 구성에서 성립 가능한 접촉인지도 명시한다. 불가능하거나 그림에서 확인할 수 없는 연결은 unsupported/null로 표시한다. 숨겨진 손이 있다는 사실은 geometry 접촉 증거를 대신하지 않는다.

운구 runtime 확인에는 codec/admission을 통과한 실제 plague arrival save와 진행 중인 presentation phase가 필요하다. 기존 조사13개 v48 save에는 arrival witness가 없었다. HEIGHT의 frozen12345ms는 장례 pause 구간이므로 그대로 재사용할 수 없다. 새 engine 사실을 만들거나 plague 상태를 수정하지 말고 실제 checkpoint/진행으로 확보해야 한다. 이 요청에서는 새 tick·캡처·DGX를 실행하지 않았다.

## 반환 규약과 수락 경계

좌표는 native canvas 좌상단 원점, x오른쪽/y아래, source pixel이다. sheet는74×74 cell-local 좌표와 전체 cell origin, 실제 direction/gait를 함께 준다. pixel-center/edge 규약과 inclusive 여부를 선언한다. 각 점은 visible-measured / author-confirmed-hidden / unknown을 구분하고 원본 SHA, 작성자 근거, 오차 또는 불확실성을 보존한다. 미확정 anchor/age ratio는 JSON에서 null이다. 원본 수정이나 등록값을 넣은 제품 변경은 하지 않았다.

반환 후 검증은 (1) SHA/canvas/direction 및 기존 pixels 보존, (2) metadata 완전성·불확실성 검토, (3) 현재 transform에서 실제 diagnostic body/contact 비교, (4) 실제 admitted world witness와 BEFORE/AFTER 동일 state/camera/readiness 확인 순서다. 그 전에는 **등록 PASS/맨발17.6 실측/모든 접촉 완료**를 선언하지 않는다. 알려지지 않은 인체 기준 때문에 별도로 검토된 좁은 A1 runtime·가시성 증거를 소급 실패 처리하지도 않는다.

기존 `docs/requests/render-human-scale-art-request.md/.json`은23개 문 개구부·건물 레이어 호환 요청이다. 위12개 신체/소품 metadata 요청과 서로 대체하지 않는다. 문 아트 C, authored 등록 B, story 저배율 정책 A2는 각 별도 미완료 범위다.

검증:12쌍 source/runtime SHA equality, PNG header native canvas, source/참조20개 파일 hash, JSON parse 및 frame4×2 완전성을 offline 확인했다. 새로운 시각 검수·landmark 실측·제품 테스트·runtime은 실행하지 않았다.

## 공식 요청의 출처와 재현

[JSON sidecar](render-human-registration-request.json)는 실제 검토한 sourceRoot 절대경로를 출처로 보존한다. 이는 다른 기계가 같은 경로를 만들어야 한다는 요구가 아니다. 나머지 paths는 repository root 기준 상대경로다. 격리 composer는 base commit `cd399e4abb26fc04b37dc27b5c61bec270934a7d`에 당시 A1 working-tree patch를 적용한 파일이며, base commit만으로 재현된다고 주장하지 않는다. 해당 patch와 고정 SHA256이 모두 일치할 때만 같은 snapshot으로 취급한다. 게시 본선 또는 렌더B 작업트리의 현행 파일로 조용히 대체하지 않는다.

기존 [문23 요청](render-human-scale-art-request.md)과 [문23 JSON](render-human-scale-art-request.json)은 별도 건물 개구부·레이어 호환 범위다. 이 신체 등록 요청은 그 요청이나 기존 runtime 원본 영수증을 대체하지 않으며, A1 승인·아트 설치·실제 가시성 승인은 여전히 이 문서의 범위 밖이다.


## 작업 가지 현행 배율 보충 — 등록 요청 범위 유지

2026-10-05 작업 가지 상태 보충. Render B 작업 가지 `astra/renderB-region-cloud-height`의 기준은 `f03bde017f914123a373a6e2f62382c2312e110d`, runtime 기준은 `718dce4b60c5cb0c5be0178284034ed49bfc67f7`이다. 보호 본선 `d169d3fa`는 여전히 `VILLAGER_WORLD_SCALE=0.5`, `WALKER_FIGURE_PX=32*VILLAGER_WORLD_SCALE`로 등록 높이16을 사용한다. 작업 가지17.6은 본선 게시 상태가 아니다. HEIGHT/REGION/CLOUD 통합17 실제 검증은 대기 중이며 수락 완료가 아니다. 앞 절의 a392/90d9/db173 본선16 및 cd399+A1 격리17.6 설명은 해당 시점의 역사 기록이다. 이 작업 가지의 `src/render/walkerComposer.ts:32–35`는 `WALKER_FIGURE_PX=17.6`, `VILLAGER_WORLD_SCALE=17.6/32`를 사용한다. 이전 snapshot·패치·SHA·런타임 영수증을 현재 파일로 바꾸거나 기존 좁은 A1 증거를 소급 실패 처리하지 않는다.

이는 등록 figure height의 적용 상태이며 모자·신발을 제외한 맨발 정수리–발바닥17.6 실측 증명이 아니다. 개별 story 인물은 같은 상수를 소비하지만 `storyWorldProps.ts:66`의 정적 manor 군중 전체는 독립0.55이며 사람별 등록이 미완료다. `plagueWorldProps.ts:211–226`의 bearer는17.6/65, bier는 별도0.65와 기존 offset±10/+6이다. 운구 손잡이 접촉, child/elder 상대 신체 기준, 실제 가림은 별도 미해결이다. ordinary 저줌 floor와 story의 기존 정책을 이 보충으로 변경하지 않는다.

동반 JSON의12개 ID(일반 child/elder8·manor 군중1·bearer1·bier2), 원본/공개 SHA와 등록 요청은 변경하지 않는다. 해당 JSON의 historical snapshot·sourceRoot·A1 patch 재현 정보는 그대로 보존하며 현재 snapshot이라고 재표기하지 않는다. bare-head crown/sole/ground·지지 상태·연령 상대 기준·군중 사람별 region/가림·bier pole/grip 요청과 visible-measured/author-confirmed-hidden/unknown 구분도 유지한다. 미확정 점/비율은 null이며 alpha 끝점이나 prompt 인원수를 해부학/실제 인원 근거로 치환하지 않는다.

이번 보충은 현행 배율 설명만 추가한다. 새 그림·원본 수정·두 번째 bearer·엔진 actor·제품 등록을 요청하지 않는다. 12개 authored 등록 B와23개 문 아트 C, story 저줌 정책 A2는 각각 별도이며 완료로 표시하지 않는다. 기존 좁은 A1 수락과 전체 신체/문/접촉 수락을 구분한다.
