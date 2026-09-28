# INSTALL-3 에일 사슬이 화면에 — 헛간 작물 선택·엿기름 가마·가내 양조·에일하우스·Wave 3 그림 — 보고서

관문: 통과 — ① 사람 재생 9단계 세계 → UI 캡처 오류 0(헛간 보리 전환 → 파종 → 익음 → 수확 → 엿기름 → 양조 → 에일하우스 → 판매) · ② 줌 0.6 보리 띠·밀 띠 구별(더미·적재물은 IN7-D1대로 1.0부터 — 사용자 판정) · ③ 스킨 감사 0 / 912(26개 상태) · 면적 1280 5.9 % / 6 %·태블릿 6.5 % / 8 % · 튜토리얼 22 = 22 · B9·TOUCH 14/14 · ④ 병합 전 검사 · 깨끗한 클론 `d288205` 3,370/3,370·build

지시서 INSTALL-3(RENDER_C)과 엔진 C4가 넘긴 것(`docs/verification/c4-ale/REPORT.md` 5절). 세계 절반과 UI 절반은 하위 에이전트 둘이 각자 가지(`claude/i3-world`, `claude/i3-ui`)에서 만들었고, 설치·사람 재생 상태·관문 캡처·검토·DGX·보고는 이 세션이 했다.

## 1. 설치(Wave 3 에일 부분 28장)
- `scripts/installWave3Ale.py`: `assets-inbox/wave3`(확정)에서 에일 사슬 28장을 `public/assets/wave3/<폴더>/`에 — 보리 이랑 띠(자라는·익은 각 둘), 엿기름 가마 a·b, 에일하우스 a·b, 양조장, 더미(보리 자루·엿기름 자루·에일 통 각 3단), 수레 적재물(보리·엿기름·에일 통, 두 방향), 워커(에일 양조 여인·엿기름공), 아이콘 시트 둘. 보리 재작업본(fix-20260926)이 첫 판을 대신한다. 양모·직물 사슬은 설치하지 않았다. C2PA 없음(받은 바이트 = 실행 바이트), 출처 장부 28행·프롬프트 28개, INBOX `installed_by` = INSTALL-3, 매니페스트 `src/render/wave3AleManifest.generated.ts`(출처 검사 목록에 추가).
- 쓰임: 23장. 안 쓰는 것 — 양조장(엔진에 건물이 없다), 건물 아이콘 시트의 가마 외 7칸, 에일 수레 적재물(엔진이 에일을 집 안에만 두어 수레에 실리지 않는다; 그림은 연결돼 있다).

## 2. 세계(`claude/i3-world`)
- **보리 띠**: 작물이 보리인 띠는 자랄 때 `ridge_barley_growing_a/b`, 익으면 `ridge_barley_ripe_a/b`(`drawArableFields.ts`). 파종·갈이·휴경·그루터기는 공용 그림. 젖은 여름에는 두 작물 모두 기존 UI-4 규칙대로 병든다.
- **엿기름 가마**: 시설 그림 `malthouse_a/b`를 필지마다 하나(세계 시드 + 필지 해시). 160 × 136 캔버스, Astra 기준점 (80, 128)(buildings-QA.md "storehouse와 같은 캔버스")을 2 × 2 발판 앞 꼭짓점에, 축척은 창고의 게임 속 맞춤 축척 0.80. 연통 연기는 일할 때만(`smoke: "work_fire"`, 방앗간 화덕과 같은 규칙 — 굴뚝 규칙의 예외인 작업 화로), 불 탈 때 방앗간 화덕 소리. 건설 카드 썸네일은 가마 그림, 공사 팻말은 Wave 3 건물 아이콘 시트의 가마 칸.
- **에일하우스 장대**: 에일하우스(`isAlehouse`)이고 양조 슬롯에 에일이 있을 때만, 단칸 필지 L2 집이 `alehouse_a/b`(장대)로 그려진다(Wave 2 변형 경로, house_l2-v2와 같은 137 × 137·기준점). 에일이 없으면 장대 없음. L3~4와 두 칸 필지는 자기 그림을 지키고(잘라 덧댈 장대 조각이 없다) 문 앞 통만 보인다.
- **더미**: 보리 헛간 문 앞 보리 자루, 가마 문 앞 엿기름 자루, 양조하는 집 문 앞 에일 통(슬롯 에일 1 / 3 / 6통에서 1 / 2 / 3단). 마을 생활이 그 문 앞 자리를 비워 둔다. 헛간(용량 1,000)·가마(40)의 자루는 실제로 1단이 보통이다.
- **수레 적재물**: 보리·엿기름·에일을 실은 수레가 Wave 3 적재물(방향 두 가지, Wave 7과 같은 축·크기). 그림이 오기 전에는 Wave 7 자루·상자가 대신한다.
- **워커**: 엔진은 엿기름을 집으로 바로 옮기므로(걷는 워커 없음), 표현 전용 심부름을 더했다(`presentation/residentTrips.ts`) — 양조하는 집의 여인이 가장 가까운 엿기름 창고로 갔다 오며(400틱 양조마다) 에일 양조 여인 옷을 입는다. 가마 일꾼의 출퇴근과 가마 수레꾼은 엿기름공 옷. 틱과 해시로 정해져 저장 0, 멈춤 중에는 멈춘다.
- **헛간 문구**: "밀이나 보리를 곳간에 모읍니다", "거둔 밀이나 보리를 보관".
- **줌 0.6(관문 ②)** — 사용자 판정(2026-09-28): 줌 0.6은 상태 층이라 보리 띠가 밀과 구별되면 충분하고, 더미·적재물을 숨기는 IN7-D1은 그대로 둔다. 띠는 모든 줌에서 그리는 땅 그림이라 0.6에서도 자라는 보리는 초록, 밀은 금빛, 익은 보리는 어두운 흙에 성긴 이삭, 밀은 빽빽한 금빛으로 구별된다([field-barley-growing-z0.6](world/field-barley-growing-z0.6.jpg) · [field-wheat-growing-z0.6](world/field-wheat-growing-z0.6.jpg) · [field-barley-ripe-z0.6](world/field-barley-ripe-z0.6.jpg) · [field-wheat-ripe-z0.6](world/field-wheat-ripe-z0.6.jpg)). 더미·건물 겹칠 그림은 전체 상세에서만(`drawBuildings.ts:126`, 건물·시설 그림 `:157`, 상세 단계 `buildingVisualState.ts:106–107` — 0.7 이하 간단), 수레 적재물은 0.8부터(`drawWalkers.ts:105` `CART_LOAD_MIN_ZOOM`), 워커 그림은 0.7 초과(`drawWalkers.ts:96`). 0.6의 가마·헛간·에일하우스·양조·수레·워커 장면은 [world/](world/)의 `*-z0.6.jpg`.

## 3. UI(`claude/i3-ui`)
- **헛간 작물 선택**: 헛간 카드에 UI-KIT Select 밀/보리 → 게임 명령 `set_farmstead_crop`(`GameCanvas.tsx` → `DiagnosticCard.tsx` `FarmsteadCropSection`, 모델 `farmsteadCropModel.ts`). 엔진 규칙대로: 헛간 작물은 바로 바뀌고(`ale.ts:173`), 띠는 파종이 끝날 때 헛간 작물을 받는다(`arableFields.ts:401`) — 이미 뿌린·자라는·익은 띠는 거둘 때까지 그대로. 헛간에 남은 다른 작물은 먼저 실어 낸다. 카드: 지금 작물, "바꾸면 다음 파종부터 뿌립니다", 다음 파종 때(예: "겨울 중순쯤부터 여름 중순까지"), "아직 밀 이랑 N개 · 거둔 뒤 다음 파종부터 보리", "헛간에 남은 밀 N · 먼저 실어 냅니다". 명령에 장·단계 제한이 없어 선택은 늘 보인다(가마는 장터 도시 단계, 에일 요구는 2장부터).
- **자원 보리·엿기름·에일**: Wave 3 자원 아이콘 시트 칸 0·1·2(`resourceCatalog.ts` `chainCell`, `resourceChainArt.ts`). 장부 서랍 행, 저장소 inspector, 건물 카드 재고 줄, 배치 칩(새 줄 "재료 [보리] · 만듦 [엿기름]" — 모든 생산 건물). 에일은 엔진이 집 양조 슬롯에만 두어 장부 서랍·저장소에는 나오지 않는다.
- **에일 없는 집은 승급이 늦어진다**: 집 카드 진행 줄의 대기 시간이 엔진 값(`aleHoldTicks(next, served)`, 에일 요구일 때 `aleServedHouses`) — "에일이 없어 L3 승급이 늦어집니다 · 조건 유지 10:30 (에일이 있으면 7:00)", 누리는 집은 "에일을 마십니다 · 제때 승급". 2장부터 주택 발전 조건에 에일 줄.
- **결산 원인**: 계절 카드에 "에일이 없어 승급을 더 오래 기다리는 집 N채"와 "지금 영지에 [보리] N [엿기름] N [에일] N"(계절 장부가 빵·밀·목재·돌만 기록해 증감이 아니라 지금 보유; 에일은 집 슬롯의 합). 줄이 늘어 계속 단추가 접히지 않게 단추 줄을 스크롤 밖 아래에 고정했다(1280 × 800에서 44 px, 태블릿 48 px, 스크롤 없이 보임).
- **봇 라벨**: `set_farmstead_crop` → "다음: 헛간 작물을 보리로"(전 "다음: 대기"); 가마 짓기는 기존 건설 라벨 "다음: 엿기름 가마 건설". 다른 새 에일 봇 행동은 없다.
- 엔진 파일 한 줄: `src/population/housing.ts`의 `aleHoldTicks`에 `export`만 붙였다(규칙 변경 없음) — UI가 150 %를 다시 셈하지 않고 엔진의 대기를 읽도록.

## 4. 관문 ① 사람 재생 — 세계 → UI 순서
- 상태: `scripts/install3States.ts` — C4 사람 경로(`tests/humanPathAle.test.ts`)를 그대로 재생: v22 목책 공사 저장을 2장으로, 명령 둘(첫 헛간을 보리로, 헛간 옆에 가마)을 게임 리듀서로, 그 뒤는 세계가 돈다(중간 편집 없음). 틱: 명령 90,976 → 보리 파종 91,505 → 가마 완공 92,258 → 보리 자람 92,500 → 익음 93,500 → 헛간에 보리 93,505(59) → 엿기름 93,574 → 양조·에일하우스 93,600 → 첫 에일 판매 94,000.
- 캡처: `scripts/install3ChainCaptures.ts`, 단계마다 세계(주제 둘레 640 × 400, 줌 1.4) 다음 UI(요소), DGX([chain/](chain/), 17장, [captures.json](chain/captures.json)):
  1. [헛간 — 아직 밀](chain/g01a-world-barn-wheat.jpg) → [카드에서 보리 선택(페이지 클릭, 명령은 스토어로)](chain/g01b-ui-barn-barley-chosen.jpg)
  2. [가마 공사장](chain/g02a-world-kiln-site.jpg) → [가마 배치 칩](chain/g02b-ui-kiln-chip.jpg)
  3. [보리 자람](chain/g03a-world-barley-growing.jpg) → [헛간 카드 보리](chain/g03b-ui-barn-barley.jpg)
  4. [보리 익음](chain/g04a-world-barley-ripe.jpg)(93,500은 젖은 여름이라 두 작물 모두 병든 그림 — 마른 여름의 익은 보리는 [world/barley-ripe-z1.0](world/barley-ripe-z1.0.jpg))
  5. [헛간 보리 자루](chain/g05a-world-barn-barley-sacks.jpg) → [헛간 재고 보리 59](chain/g05b-ui-barn-stock.jpg)
  6. [가마 가동·연통 연기](chain/g06a-world-kiln-working.jpg) → [가마 재고 보리 10·엿기름 1](chain/g06b-ui-kiln-stock.jpg)
  7. [양조하는 집](chain/g07a-world-house-brewing.jpg) → [장부 서랍 보리·엿기름](chain/g07b-ui-ledger.jpg)
  8. [에일하우스](chain/g08a-world-alehouse-stake.jpg) → [집 카드 에일 줄](chain/g08b-ui-house-served.jpg) — 이 순간의 에일하우스들은 두 칸 필지·L3라 장대가 없다; 장대는 94,400틱의 단칸 L2 에일하우스 [world/alehouse-z1.0](world/alehouse-z1.0.jpg)·[z2.0](world/alehouse-z2.0.jpg), 에일 없을 때 [alehouse-dry](world/alehouse-dry-z1.0.jpg)
  9. [첫 판매 순간](chain/g09a-world-ale-sold.jpg) → [계절 카드 "지금 영지에 보리·엿기름·에일"](chain/g09b-ui-season-ale.jpg)
- 가까이 본 세계 그림(줌 1.0·2.0, 필요하면 재생을 이어서 — `ranOn`): [world/](world/)([captures.json](world/captures.json)) — 가마·보리 자루·엿기름 자루·양조 문 앞 통·수레(보리·엿기름)·에일 양조 여인·엿기름공. UI는 [ui/](ui/)(u01~u12, 계절 카드 계속 단추 1280 44 px·태블릿 48 px 스크롤 없이).

## 5. 검증
- 로컬: typecheck, lint, 관련 시험(새 `aleWorldArt` 8·`aleScreens` 6, 렌더 원천 검사·C25 그대로·`humanPathAle`·출처 등) 모두 통과, `check:merge` 통과(한글 문자열 새 0).
- DGX 전체 회귀 `87fa663`: 3,369/3,370, 실패 1 — 엔진 시험 `autoplayMaterialOpportunity`의 자식 프로세스가 고정 3 초 제한에 걸림(`spawnSync … ETIMEDOUT`; 그 실행 전체가 885 초로 보통 540 초보다 느렸다 — DGX 부하). 로컬에서 330 ms로 통과, 이 가지와 무관한 엔진 시험이라 손대지 않았다. 깨끗한 클론 `d288205`에서 그 시험을 포함해 3,370/3,370·build.
- DGX 관문 `fc6f14c`, 본선 대비(`scripts/install3Verification.sh`, 21분): UI-6 묶음 [gates.json](gates/gates.json) 통과, 스킨 감사 [0 / 912](audit/audit.json)(본선 0 / 791), 사람 재생 상태·세계·UI 캡처 오류 0. 사슬 캡처는 알맞은 카드를 여는지 고친 뒤 `2b4dea5`에서 다시 찍었다(에일하우스 칸의 목책 공사장이 클릭을 가져가 집 카드 대신 공사장 카드가 떴던 것, 지나가는 워커가 클릭을 가져가는 것, 재고 줄이 카드 아래로 접힌 것).
- 증거 1.9 MB(사슬 17장·세계 31장·UI 12장·스킨 감사 시트 960 px; UI-6 캡처 묶음·재생 폴더·로그는 뺐다).

## 6. 판정 대기·넘길 것
- 에일이 집 안에만 있어 장부 서랍·저장소·수레에 나오지 않는다(엔진 설계). 에일을 시장·창고로 옮기는 규칙이 생기면 적재물·아이콘은 이미 연결돼 있다.
- 헛간 작물 명령에 장·단계 제한이 없다(엔진). 1장에서도 보리로 바꿀 수 있다.
- 봇 라벨 캡처와 곡창 저장소 캡처는 재생 상태에 그 장면이 없어 시험으로만 확인했다(`tests/aleScreens.test.ts`).
