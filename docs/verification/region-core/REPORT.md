# REGION core — 실제 코어 검증 증거

**고정 core18 안정화 화면 동등성 PASS, 공식 계절4뷰 수치·독립 시각 검토 완료.** 이 폴더는 검토된 코어 증거를 공식 경로로 이관한 패키지다.

실제 source commit은 `442b71822c189a245877cc1da1af86831e19448a`, 비교 baseline은 `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5`다. 실제 run `astra-region-core-v1-442b718`의 full identity18·native RGBA18·A/A18 동일, 오류0, 예상 URL-뷰34쌍 request/decode/paint가 확인됐다. core 원본18장의 독립 개별 시각 검토와 부모의 별도 검산을 동봉했다. 이는 미래 main HEAD/게시 완료 증거가 아니다.

## 비교 장면과 검증 범위

`presentation-index.json`은 spring1/.6 대표2쌍과 summer/winter1/.6 공식4쌍을 기록한다. spring1/.6 및 summer1/winter1 네 쌍은 실제 core18, summer .6와 winter .6 두 쌍은 별도 실제 reference2로 채웠다. 별도 before/core run 두 개는 각각2뷰/A/A2/errors0, 두 비교쌍 identity/RGBA0다. 수치 슬롯6개가 채워졌고 **reference2 별도 독립 native 검토와 부모 확인도 PASS**다. 추가 검수자는 BEFORE/CORE 원본4장을 개별 열람하고 repeat 포함 PNG8장을 검산했다. core18 검토와 새2장의 별도 검토를 구분한다.

JPEG는 브라우저가 만든 실제 before/core 원본을 그대로 복사했다. 바이트 동등성을 직접 확인한 경우에만 한 물리 JPEG를 공유하고 논리 before/after의 서로 다른 raw 경로·commit·SHA는 각각 유지한다. 재인코딩/줌 변환0. 원본 PNG와 큰 full-freeze는 패키지 밖에 있으며 `runtime-identity-index.json`과 `external-evidence.json`에 절대 경로·해시를 기록했다.

reference2 조립·검토 절차(수치/원본 조립 및 별도 독립 native·부모 검토 완료):

1. 별도 실제 before/core 캡처의 commit, savedStateSHA/tick, season/tile/zoom/viewport/DPR/visualTime/expectedRequests 전체 identity를 비교한다.
2. 원본 before/core/repeat PNG RGBA0·A/A0·오류0·예상 사용을 확인하고 원격 clean/export/source freeze 영수증을 별도로 참조한다. core18 raw receipt는 수정하지 않는다.
3. 두 pending 슬롯에 실제 JPEG와 원본 PNG SHA/receipt 링크를 채운다. 이전 네 쌍이나 baseline18 fixture는 바꾸지 않는다.
4. JSON/REPORT의 완료 수치를 갱신하고 SHA256SUMS 및 3MiB 한도를 다시 검사한다. 원 조립기는 core18만 조립하므로 reference2를 채운 뒤 재실행해 덮어쓰지 않는다.

## 정적 결과와 원격 동결

정적14파일 시험174/174, typecheck/lint exit0, catalog135 검증 및 canonical79 소유권 검증이 통과했다. 기존105 entry/rule을 보존하며 기존 terrain30을 계약으로 옮겼다. terrain30+기존HEATH1의 소유31, 나머지 legacy48이며 원본30/public/provenance bytes를 바꾸지 않았다. `static-checks-original.json`과 실제 로그의 외부 SHA를 함께 보존했다. 과거 RED/잘못된 CLI·시험목록 정정 이력도 숨기지 않는다.

원격 pre/post guard는 정확442b HEAD·tracked-clean·입력26,857개·export26,858개를 확인했다. 입력맵 SHA와 Node/Chromium/Playwright/cache 식별은 동봉 guard에 있다. export와 입력 수 차이1은 self-manifest다. 전체 큰 파일은 해시와 외부 경로로 연결한다. 패키지를 만든 사람이 원격 검사를 새로 실행했다는 뜻은 아니다.

## 한계와 후속 경계

- 안정화 readiness에서 실제 동등성만 확인했다. shared loader decode/치수 검증으로 생기는 cold-loading 타이밍 변화는 의도된 차이이며, cold-loading 전체 동등성을 주장하지 않는다.
- optional A/B pattern 원자성·실패 fallback은 정적 시험 범위다. 새 봄 DATA4의 실제 seasonal paint를 core parity로 대신 검증하지 않는다. **DATA4 미설치**, N0417 riverside 제외 상태다.
- 기존 겨울 grain·지형의 날카로운 전환·해상 grid는 기준선과 동일하다. 시각 보고서의 native18 관찰을 참조한다.
- autumn·chapter4/1380·실제 drainage·DPR2는 이18뷰 범위 밖이다. repeat 상세 request/draw 배열은 저장되지 않아 반복 lineage/absence를 따로 입증하지 못한다.
- 원래 실행/정적 영수증에 남아 있는 당시 `NATIVE_REVIEW_PENDING`/`NOT_RUN` 문구는 그 시점의 이력 그대로다. 최신 native 판정은 동봉 독립 검토서이며 과거 파일을 성공으로 고쳐 쓰지 않았다.
- 증거 이관은 제품·public·provenance·ledger·기존 DATA6/test1 바이트를 바꾸지 않았다. 이관만으로 새 원격 실행이나 DATA 승격을 주장하지 않는다.


보완 actual runs: `astra-region-reference2-before-fd68f12`, `astra-region-reference2-core-442b718`. before 입력26928/export26929, core 입력26949/export26950; 각각 pre/post actual guard PASS 영수증과 큰 freeze의 외부 해시를 분리 유지한다. 기존18 fixture/영수증을 변경하지 않았다.


보완 독립 판정: `reference2-independent-native-review.md/json`, 부모 확인: `reference2-parent-check.json`. 원래 run/result의 당시 native pending 표기는 이력으로 보존했다. 이 패키지가 작성되는 동안 진행된 DATA 적용 또는 이후 HEAD를 촬영 당시 core442b로 재명명하지 않는다. DATA4 미설치는 위 core 촬영 시점의 상태이며 현재 다른 작업 트리 상태를 판정하는 문구가 아니다.


## DATA 확장을 허용하면서 canonical30을 보존하는 시험 수정

`region-core-test-fix.md/json`과 `region-core-test-fix-baseline-mutations.json`은 캡처 뒤 별도 test-only 변경 증거다. 기존의 전체 REGION entry 수30 단정을 immutable migration fixture의 exact30 ID 및 전체 객체 deep-equal로 바꿨다. optional DATA4를 허용하지만 기존30 누락·URL·geometry·provenance 변경을 허용하지 않는다. baseline135와 candidate139에서 각각30개 단일 누락을 assertion/registry가 모두 거부하고, 개수를 유지한 잘못된 URL도 거부했다.

이후 집중33/33·typecheck·해당 test lint는 통과했다. 첫 DATA 집중시험32/33 실패 이력은 외부 원본 로그 해시로 보존했다. 테스트1파일만 바뀌었고 촬영한 제품 코드는 동일하다는 영수증을 첨부했다. 이것은 **역사적 committed442b core18+reference2 = core20**의 증거와 **현재 DATA4의 미검증 후보 상태**를 구분한다. 시험 수정 후의 새 HEAD에서 runtime을 재실행했다고 주장하지 않으며 DATA6의 catalog/PNG 변화는 별도 실제 DATA20 관문을 기다린다.

독립 test-only 검토: `test-fix-independent-review.md/json`의 제한된 PASS를 함께 기록했다. 기존30 전체 내용 검증 강화와 DATA6 보존을 확인했으며, DATA 실제 paint 승인과 구분한다.
