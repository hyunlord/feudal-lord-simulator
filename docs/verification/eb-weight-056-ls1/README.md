# ID 056과 LS1-4

판정: **실제 허가·거절의 LS1-4 칩 포착 2/2. 결과 카드 접근 0/2, 전체 화면 관문 미통과.** DGX `engineB-weight-056-admit-732c946`, 도구 `732c946b0`, 제품 `0eddc146c`(v55), clean 실험 슬롯 2, 종료 1. 실패를 통과로 바꾸지 않는다.

| 실제 화면에서 누른 답 | 실제 상태 변화 | 답 ID | LS1-4 |
|---|---|---|---|
| 수리비를 나눠 맡는다 (`grant`) | 금고 10→−46 (−56d), 도시 관계 8→13 (+5) | `h-001322` | `results:1308`, “올해 당신의 결정이 낳은 일 1”, relation +5 행 포함 |
| 도시가 고치게 둔다 (`refuse`) | 도시 관계 8→3 (−5) | `h-001322` | `results:1308`, 같은 칩 1건, relation −5 행 포함 |

두 답은 **같은 원본을 각각 새로 연 별도 분기**이므로 답 ID가 같다. 각 분기에서 실제 버튼·영수증을 거쳤고 시간은 32000에서 진행하지 않았다. 답 전 카드 제목 **“장날 수레가 빠지는 길”**과 본문을 `ck_evt_056` 변형 모델과 대조했다. v55가 변형 ID를 저장했다고 주장하지 않는다.

영수증의 확인을 누르면 이미 열려 있던 **092 “큰 부담을 거두는 작은 시장”** 결정 모달이 나온다. 그 backdrop이 LS1-4 칩 클릭을 가로막아 두 분기 모두 10초 뒤 실패했다. 칩 DOM·읽기 모델에는 정확한 답과 관계 행이 있지만, 결과 카드 본문까지 확인하지 못했다. 원인은 trace 누락이 아니라 다음 결정 모달에 의한 접근 차단이다. 다른 결정을 대신 답하거나 강제로 닫아 통과시키지 않았다. 화면 변경은 렌더 A의 영역이며 이번 작업에서 고치지 않았다.

원인 분류 한 줄: **봇 자동답 문제가 아니라 화면 접근 순서에서 막혔다**. `story-delay=0`에서 영수증 뒤 열린 092 모달이 칩 클릭을 차단했으며, 하네스는 후속 카드의 ‘나중에’ 동선을 시도하지 않았으므로 영구 접근 불가 결함은 미확정이다. [렌더 A 요청서](../../requests/engine-B-visible-results.md)에 검토로 넘기고 고치지 않는다.

하네스는 일시정지한 실제 UI의 선택 버튼과 영수증 확인을 눌렀다(`actions=[choose, close-answer-receipt]`, 양쪽 `failureTick=32000`, 답 직후/실패 시 상태 SHA 동일). 실제 ‘나중에’ 경로는 `src/ui/decisionCard/DecisionCard.tsx:68` → `src/ui/screens/AppModals.tsx:160`에 있다. 이 경로를 거친 카드 접근은 이번 실행에서 검증하지 않았다.

입력과 검증:

- 원본: DGX `/home/hyunlord/fls-variant-states/home-056.json`, SHA `00c8eeab4b4c17443e3b3c53f0a6a2af639e7fc3bf1c23ea8de6a56fd181405c`. 원본 바이트를 [056-source.bare.json.gz](056-source.bare.json.gz)에 보존했다.
- `docs/verification/variants/states.json`: seed 3, 1308년 봄, `estate-petition-19`, `prepared:false`. 생성기는 정상 상시 방침을 “영주에게”로 고른 뒤 봇 판에서 자연 발생한 첫 056을 저장했다. 기본 방침의 자연 빈도 증거는 아니다.
- 처음 `decodeSave`에 bare 입력을 넣은 실행 `engineB-weight-056-LS1-e2b8205`는 v0 이행에서 거부됐다. v5→v6가 `nextZoneOrdinal`을 1로 되돌리고 기존 undo의 2를 남겼기 때문이다. **검증 도구가 입력 형식을 잘못 처리한 실패**로 [원본 기록](../eb-weight-ls1/056-v0-rejected/event056.json)을 보존했다.
- 수정은 기존 `scripts/sceneState.ts`의 `admitSceneState` 경로만 사용했다. 누락 필드와 원본 유효성을 검사하고 원본을 그대로 반환하는 RES-REG 계약이다. 원본, 허용된 state, 현재 v55 encode/decode state의 SHA가 모두 위 SHA와 같고 `admissionChanges=[]`다. v0 이행 성공이나 원본 상태 수정이 아니다.

증거: [event056.json.gz](event056.json.gz)에 실제 값·답 ID·trace 행·DOM·오류·전체 상태 차이가 있다. `056-admitted.save.json.gz`와 선택별 answered/failure 상태도 보존했다. [허가 전 카드](056-grant-offered.webp), [허가 영수증](056-grant-receipt.webp), [거절 영수증](056-refuse-receipt.webp), [칩을 가린 092 모달](056-grant-failure.webp)은 원본 PNG와 픽셀이 같은 lossless WebP다. 원본 PNG 전부는 kept DGX 실행에 있고 [screenshots.json](screenshots.json)에 SHA를 남겼다.

남은 확인: 092를 정상 플레이에서 해결한 뒤 056의 연간 결과 카드 항목 접근, 향후 결과, 다른 해상도. 이번 두 선택의 즉시 칩 포착과 별개다. 원칙 P-C3(실제 원인), A5(실패·원본 보존), P-T3(영주에게 올린 실제 방침 입력 구분)를 지켰다.

사용자 판정에 따라 이번 056 대조는 위 미통과 상태로 보존하고 EB-WEIGHT 024로 돌아간다. Mac에서는 압축 복원·체크섬·도구 문법만 검증했으며 게임/브라우저 실행은 전부 DGX에서 했다. 폴더의 모든 보존 파일은 `SHA256SUMS`로 확인한다.
