# Engine B 선택 문구 교정

정본 59사건의 선택 문구 157필드를 교정했다. [필드별 원문·교정문](wording-changes.json)에 전부 기록했다. 사건·선택 ID, 명령·비용·천분율 수치와 실행용 생성 자료는 바꾸지 않았다. 제품 변경은 `11eada352a40d3dc745c1aee08c0378713a7ffb0`, 화면 측정은 문서 후속을 합친 clean `bc4241c2fe969bbf17eac4cb6fdde42977fa922a`다.

## 실제 문구 화면

공식 DGX `EB-WORDS-choices-bc4241c`는 Node24.21.0, 1280×800, 동시 페이지1, 명령38.6초·종료0이다. 기존 `eventArtAutoCapture.mjs`의 준비 occurrence 경로를 재사용하고, 005:a와042:light의 실제 카드/선택 ID·제목 문자열·화면 안 위치·hit-test 노출을 검사했다. 기존 스크립트와 외부 보조 스크립트 해시는 [provenance.json](provenance.json), 실제 기록은 [captures.json](captures.json), 재현 명령은 [command.sh](command.sh)다. 보조 스크립트는 제품 트리의 파일을 수정하지 않았다.

- [005 실제 PNG](wording-ck_evt_005.png): **시장 좌판세를 기본의 4분의 3으로 낮춘다** — 15px, 한 줄, 잘림 없이 읽힘.
- [042 실제 PNG](wording-ck_evt_042.png): **시장 좌판세를 기본의 3분의 2쯤으로 낮춘다** — 15px, 두 줄, 잘림 없이 읽힘.

실행 담당자와 별도 부모 검토자가 원본 PNG 두 장을 각각 직접 확인했다. 원본 PNG 해시는 SHA256SUMS에 보존한다. 실행 scope inactive/dead 및 할당 포트4306의 listener 없음도 확인했다.

**한계:** 두 장은 기존 도구가 새 게임에 넣은 준비 occurrence이며 자연 발생한 사건이 아니다. 실제 카드가 표시한 선택은 바인딩 부재로 비활성이었다. 문구 소비와 가독성만 입증하며, 선택 실행·자연 적격성·게임 효과·빈도·10배속 가시성을 입증하지 않는다. 게임 명령을 답하지 않았고 엔진 사실이나 어댑터를 수정하지 않았다.

## 수정 전 비교

clean `bff5c936048c7942677e69c6137cbeb675826c73`에서도 같은 준비 사례를 공식 DGX light 탐침 `EB-WORDS-baseline-bff5c93`으로 측정했다(33.9초·종료0). 수정 전후 src/public/의존성 차이는 `v4Copy.generated.ts` 하나다. 기대 문자열만 원래750‰/650‰ 문구로 바꿨으며 같은1280×800 카드 경로를 사용했다. [기준 기록](baseline/captures.json)·[원본 PNG 해시와 보존 위치](baseline/original-pngs.json)를 남긴다. 기준 원본 PNG는 별도 kept 실행과 로컬 수집물에 보존하여 이 문서 묶음의3MiB 한도를 넘기지 않는다.

두 독립 검토(소스·기능/시각·한글)의 제한 판정은 [GOOD](visual-verdict.json)다. [005 차이](diff-005.json)2.72%, [042 차이](diff-042.json)3.43%, 크기 일치·유사도97이다. 배경 식생·윤곽 차이도 포함하므로 모든 픽셀 차이를 문구 탓으로 돌리지 않는다. 배경 애니메이션 가능성은 미검증이다.

## 기하 범위와 출처

문구의 실제 소비 경로는 `registryCardModel.ts:211–225`의 선택 label/tradeoff와 `sinceLastModel.ts:63`, `seasonStewardModel.ts:65–75`의 label/chronicle, `chronicleScreenModel.ts:524`의 선택 비교, `decisionThread.ts:43/59/118/165`의 답변 label이다. 마지막 경로는 결과 알림·연대기·연말·종료 화면으로 이어진다.

따라서 다음12행의 기본 전체 viewport/copy/numbers 축을 측정한다: `modal.lord.registry`, `modal.lord.registry-hold`, `modal.lord.registry.variant-078`, `hud.event-card.trace`, `hud.event-card.lord-moment`, `modal.history.record-card`, `modal.history.decision`, `modal.history.thread-decision`, `modal.history.thread-because`, `modal.year-review.lord`, `modal.season-ledger.steward`, `modal.slice-end`.

최초59행 작업 `EB-WORDS-geometry-11eada3`은 불필요한 혼인·청원·상시 방침·가계도·인물·세력·지도 행을 제외하기 위해 **대기 중 실행 전에 취소**했다(scope inactive/dead, 기하 산출물 없음; 강제 종료여서 exit-code 없음/로컬255). 이를 성공 실행으로 세지 않는다. 대체 작업 [EB-WORDS-consumers-bc4241c](../uiaudit1/geometry/EB-WORDS-consumers-bc4241c/geometry.md)는 실제 종료0(1388.7초),12행240조건을 측정했다. clean·전체 축, 실패0·미개방0·미등록0·새 기준선 실패0·수정된 기준선0이다. 빈 공간 주의46건은 실패와 별도이며 원본 보고서에 보존한다. RR26의 이름 붙인 행별 보고서 계약을 따르고 축/실패 기준을 낮추지 않는다. 이 범위는 소스 소비 경로로 선정한 검증이며 자동 import-closure 전수 증명은 아니다.

## 검증 상태

집중12시험·타입 검사·lint는 제품 커밋 전에 통과했다. 최종 게시 판정은 이 증거와 문서를 커밋한 정확한 트리의 실제 `test:changed` 기록 및 `check:merge` 결과를 사용한다. 이 문서 커밋 자체가 최종 시험 통과를 미리 주장하지는 않는다. 이 문서는 전체 EB-WEIGHT 동작 통과 선언이 아니다.
