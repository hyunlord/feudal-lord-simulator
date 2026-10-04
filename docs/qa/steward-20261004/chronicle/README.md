# R06 현재 인계 기준

현재 정본 `variants.ko.json`은 **650개 문장 객체**다. 역사 182종·원장 46분류를 유지하며, 역사 91종은 단일 문장이다. 최신 검증은 `VALIDATION.json`·`R06_VALIDATION.json`과 `../records/registry-invalid-review/RESULT.json`이다. 기존 647개 객체 및 전체 계약을 보존하고 registry.invalid의 감사 처분·반복 청원 원칙·점유 집행 안건에 3개 조건 문장을 추가했다.

모든 문장은 설치 전 초안이다. 이번 검증은 전체 JSON Schema, 기존 객체 보존, 28개 오프라인 선택 fixture, 실제 소스 7파일·11개 구간 대조이며 실제 엔진 선택·자연 발생·UI 출력은 **미검증**이다. `R05D_INSTALL_BLOCKS.json`의 기존 차단 **6개**는 그대로 유효하다. 숫자 입력 가드도 제안 어댑터 수준이다.

나이 문맥 20개는 별도 제안이며 650개에 포함하지 않는다. 기본 종류 커버리지나 단일 유형 분류만으로 나이·처지·관계·시대별 다양성 요구가 완료되었다고 보지 않는다.

이번 재검증: `ruby records/registry-invalid-review/check_merge.rb` (회차 루트에서). 원647 후보 validator는 변경하지 않았으며, 보존 사본은 `ruby records/registry-invalid-review/replay/records/registry-invalid-candidates/validate.rb`로 실행한다. 원래 후보 validator는 현650 정본에 실행하면 의도대로 baseline drift로 거부된다. 과거 R01–R05 검증·CHANGES와 과거 README 절의 수량은 각 당시 이력이다. R06 변경은 `R06_CHANGES.json`을 따른다.

## R06 별도 문맥 원고 인계

[CONTEXT_DRAFTS.md](CONTEXT_DRAFTS.md)는 별도 문맥 초안의 최신 전문과 조건·검수 출처를 묶는다. JSON catalog는 원문 엔트리를 보존한 읽기용 목록이며 통합 런타임 스키마가 아니다. 정본650에 합산하지 않는다.

단일 기본형91종 모두에 별도 변형 원고가 있다. 현재 엔진 사실행과 충돌하는30개는 `R06_CONTEXT_FACTLINE_HOLDS.json`에 유지한다. 수정 사실행14개와 연결30개 조합의 독립 승인 대응은 `R06_PROPOSED_COMPOSITION_ACCEPTANCE.json`에 있다. 수정안 조합 승인과 실제 설치 여부를 구분하며, 기존 R05D 제한6개는 이 승인 범위에 포함하지 않는다. 전체 사건·전기 범위의 품질 감사는 진행 중이다.

---

# R05 동결 당시 인계 기준 (647개)

현재 정본 `variants.ko.json`은 **647개 문장 객체**다. 역사 182종·원장 46분류를 유지하며, 역사 92종은 아직 단일 문장이다. 최신 검증은 `VALIDATION.json` 및 `R05D_VALIDATION.json`이다. 게임에는 설치하지 않았고 실제 엔진 선택·UI 출력은 미검증이다.

나이 문맥 **20개는 별도 제안**이며 647개에 포함하지 않는다. `AGE_CONTEXT_PROPOSAL.md`의 어댑터·스키마 확장 조건을 따른다. 문장 종류의 기본 커버리지가 나이·처지·관계·시대별 다양성 요구의 완료를 뜻하지 않는다.

아래 R04·R05A·R05B 절의 ‘현재’와 수량은 각 병합 당시 기록이다. 당시 검증기는 보존된 당시 기준본에 사용하며 현행 647판 전체의 통과 근거로 재사용하지 않는다. 최신 병합의 범위와 제한은 마지막 R05D 절을 따른다.

---

# R05A 병합 당시 기록 (548개)

누적 548문장 객체. R04의 505개를 보존하고 독립 검수 뒤 43개를 추가했다. 현재 검증은 R05_VALIDATION.json 및 ../records/merge-reviewed-variants.rb를 사용한다. validate.sh·validate-r04.rb·R04_VALIDATION.json과 이전 CHANGES/fixture 파일은 각 이전 회차 계약의 역사 자료이며 548판 검증기로 주장하지 않는다. R05 선택 fixture는 ../records/variant-candidates/SELECTION_FIXTURES.json에 있다.

가구의 ‘공사 시작’ 문구 1건을 ‘새 일에 나섰다’로 교정했다. enforcing 후보는 현재 판결 전환에서 suit_stage 대신 suit_judged가 기록되므로 자연 발생 확인으로 세지 않는다. 엔진 설치·실제 선택·UI 표시는 미검증이다. 단일 변형 역사종은 118개 남았다.

---

# R04 동결 당시 기록 (505개)

현재 정본은 `variants.ko.json`의 **505개 문장 객체**다(연대기 319·원장 186). 연대기 182종 중 복수 변형은 54종이고, **128종은 기본 문장 하나뿐**이다. 종류별 기본 문장이 있다는 사실은 나이·처지·관계·시대별 변형 요구를 모두 달성했다는 뜻이 아니다. 게임에는 미설치다.

현재 검사: `ruby chronicle/validate-r04.rb`(회차 폴더에서 실행). 현행505개 전체 Schema 결과는 `../records/CHRONICLE_R04_CURRENT_VALIDATION.json`이다. 이전 `CHRONICLE_R04_VALIDATION.json`은 직업 변형 추가 직후436개 검증 이력이며 선택 fixture25개도 당시 결과다. 아래 R02–R03 검증 수치와 명령은 당시 동결본에 관한 이력이며 현행 505개 전체의 런타임 통과 근거가 아니다. 다음 작성 대상은 `../records/CHRONICLE_VARIATION_GAPS_R04.csv`에 있다.

**R02에서 독립 검수를 거쳐 납품용 초안으로 승격했고, R03이 그대로 승계했다. 게임에는 미설치다.** 기준 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. R01 canonical을 복제해 허용된 계약만 갱신했다. R01 후보·기준 보존본·5ad runtime helper는 변경하지 않았다.

## R02–R03 변경 이력 (현행 수량 아님)

`variants.ko.json`의 변경은 정확히 다섯 경로다.

1. sourceHead를 현재 HEAD로 변경.
2. slots.amountExact → `moneyWordsFull(entry.amount)`.
3. slots.amountAbsExact → `moneyWordsFull(Math.abs(entry.amount))`.
4. slots.amountSignedExact → `moneyWordsFullDelta(entry.amount)`.
5. historyTemplates의 `ledger.season.sourceExpression`을 현재 333행 본문으로 갱신.

**427개 ID·headline/text 본문·조건·priority·requiredSlots·현물 producer/guard·FIX12 계약은 모두 R01과 같다.** 182 history template의 headline 241개와 원장 46분류 문장 186개다. template/category 추가·삭제는 없다. `CHANGES.json`과 `R01_BASE_MANIFEST.json`은 구신 해시와 원본 보존 증거다. R01_CHANGES/R01_VALIDATION 및 상속한 REVIEW_FIXES/GLOSSARY_CORRECTIONS/EMITTER_REFERENCES/BIOGRAPHY_CONTRACT/BASELINE_LIMITATIONS는 그 작성 시점의 자료다. 현행 상태·검증 범위는 본 README 첫머리와 CHRONICLE_R04_CURRENT_VALIDATION.json을 따른다.

## 금액 표시 계약

Full 함수는 유한 정수 페니의 남은 d까지 표시한다. 새 어댑터는 유한 safe integer만 허용하여 소수 절삭·정밀도 상실 입력을 거부한다. 원시 부호 있는 페니를 항상 보존한다. 253d는 `£1 1s 1d`, −253d의 signed 표시는 `−£1 1s 1d`, 0의 signed 표시는 `±0d`다. cash_out은 절댓값과 “금고에서 … 나갔다” 문장으로 지출을 나타낸다.

기존 short 함수 moneyWords/moneyWordsDelta는 여전히 £1 이상 잔여 페니를 생략한다. 따라서 모든 엔진 기본 사실 줄이 Full로 바뀌었다고 주장하지 않는다. 현 HEAD의 ledger.season과 ledgerCopy signed/sourceLine/entryLine만 해당 diff의 Full 적용을 확인했다. 다른 short 사용처와 실제 금액은 기존 한계를 유지한다.

현물 amount는 **자원 수량이 아니라 페니 평가액**이다. 44분류의 미확인 현물 producer는 차단 상태다. 빵·양털 두 분류만 원래 sourceRefs.detail 계약을 따르는 후보 파서로 수량을 분리한다. 수량 누락·모호한 중복·잘못된 resource/source 타입이면 평가액을 보존하고 “수량 미확인”으로 표시한다. amount/현재 가격으로 수량을 역산하지 않는다. 이 파서는 게임에 설치되지 않았다.

## R02–R03 당시 실행한 좁은 검증

`money-slot-adapter.mjs`는 후보 원장 행을 선택하고 slots를 채우는 **제안 어댑터 본체**다. engine/state를 import하지 않는다. `money-adapter-audit.mjs`는 현재 소스 SHA를 확인한 뒤 `src/ledger/moneyWords.ko.ts`의 순수 함수만 import해 실제 후보 문자열에 적용한다.

- 합성 원장 문자열 **1,152건** 통과. 조건 선택·미충전 placeholder·출력 금액 독립 산술 환산·원시 부호 보존을 확인했다.
- cash 전용 관측 ID는 **138개**다(46분류 × 유입/유출/0). 미납 증감 2개와 현물 평가액 2개까지 더해 금액 슬롯을 사용하는 **142개 ID 전부**를 렌더했다. 142개 전부가 cash 문장이라는 뜻은 아니다.
- cash 경계 입력: ±1, ±12, ±239, ±240, ±241, ±253, ±399, ±479, ±38447 및 0. 목적 기금·미납 ±253/0을 별도 검사했다.
- 현물 44분류 차단, 수량 불명 10경우, NaN/±Infinity/소수/unsafe integer 5경우 거부, unknown category 1경우를 확인했다.
- 이는 합성 입력의 순수 함수·제안 어댑터 검증이다. 실제 저장·engine·historySummary·이름 재조회·게임·브라우저·DGX·UI 렌더는 실행하지 않았다.

`validate.sh`는 **baseline 디렉터리를 필수 인수로 받는다**. 이전 `../chronicle/` 가정은 제거했다. 현재 source snapshot, JSON schema, 427 ID 전체 객체 보존, 다섯 경로 밖 변경 부재, 소스 key coverage, 기존 524개 selector fixture의 완전 동일성을 검사한다. 결과는 480선택/현물44차단으로 R01과 같다. 이 선택 fixture의 현물 행 선택을 실제 자원 producer 실행으로 세지 않는다.

## R02–R03 동결본 재현 명령 (현행 R04에 실행하지 않음)

```sh
node money-adapter-audit.mjs /Users/rexxa/fls-astra-steward
sh validate.sh /Users/rexxa/fls-astra-steward /tmp/astra-steward-r01-20261003/chronicle
```

첫 명령은 MONEY_ADAPTER_VALIDATION.json, 둘째는 VALIDATION.json과 동일한 SELECTION_FIXTURES.json을 이 후보 폴더에 쓴다. 소스가 다르면 snapshot 검사에서 실패한다. 출력 artifact를 갱신한 뒤 SHA256SUMS는 마지막에 새로 작성해야 한다. 게임 코드나 R01을 수정하는 명령은 없다.

## 필수 사실 줄·전기·미해결 사항

headline은 필수 baseline 사실 줄을 대체하지 않는다. HistoryRecord 원시 ID는 보존하고 historySummary/historyParams가 읽을 때 이름을 조회한다. 전기 event.id를 같은 저장의 원시 history.records에 재결합해야 params 조건을 쓸 수 있다. 실패하면 summary와 확인된 날짜를 보존한다. 현재 전기 나이를 과거 사건에 소급하지 않는다. estate-only 인물은 personBiography 조회 미지원이며 새 개인 전기 범위로 세지 않는다.

**E9R01은 미해결**이다. person.emptied의 중립 headline과 달리 엔진 기본 사실 줄은 여전히 “굶주려 가구가 흩어졌다”(historyCopy.ko.ts:347)다. 발생 조건 history.ts:372는 기근 원인을 보장하지 않는다. 필수 사실 줄을 함께 표시하므로 전체 원인 과장 교정 완료로 보고하지 않는다.

ledger.treasury_turn의 net=0 증가 표현(335행), audit_clean의 비탐지 이상 확정 표현(255행), registry bundle raw kind fallback, `{recovered}` 미치환, 다른 short 금액 사용처는 그대로 후속 범위다. 기존 R01 5ad runtime 결과를 이 R02의 427문장·새 HEAD·UI 통과로 소급하지 않는다.

## R03 설명 정정

R02 승격 기록은 ../records/CHRONICLE_PROMOTION_R02.md/json에 복사했다. 이번 변경은 README의 납품 상태 설명뿐이다. 사건/등록기/문장 JSON은 R02와 바이트 동일하며, 설치·엔진 연결·자연UI 통과를 뜻하지 않는다. 이전 README는 ../records/r03-documentation-before/에 보존했다. R01 외부 경로를 가리키는 과거 기록은 당시 ZIP 근거이며 현재 R03 내부 파일로 오인하지 않는다.


## R04 직업 기록 변형

기록된 params.occupation에만 근거한 문장9개를 추가했다. 총436객체(연대기250·원장186),182종 중 복수 변형27종이다. 기존 객체는 모두 유지했다. 전체 JSON Schema와 새 선택 fixture25개를 검증했다. 누락·알 수 없는 값·잘못된 타입은 기본 문장으로 복귀한다. records의 CHRONICLE_R04_CHANGES/VALIDATION 및 person-variant-candidates/rationale.md 참조. 기존 validate.sh/VALIDATION.json은427객체 R02 검증의 동결 이력이며 R04 승인 범위 검증기는 아니다. 엔진·화면 연결은 미검증이다.

### R04 파생 표 검증

`ruby chronicle/validate-r04.rb`는 원본 427개 객체 보존, 추가 78개와 조건표 137행·분포표 228행의 정본 일치를 검사한다. 엔진 실행 또는 전체 JSON Schema 검사를 대신하지 않는다. `authored-lines.tsv`는 종류별 기본 문장 182개이며 조건 문장은 `conditional-lines.tsv`에 있다. R04 이전 검증 JSON은 그때의 결과로 보존했다.

## R04 미응답 청원 추가

독립 정적 검수를 통과한 `plague.unanswered` 조건 문장 4개를 추가했다. 기존 436객체를 모두 보존했다. 이 추가 직후 총440객체이며 사제 공석·임금·빈 필지·부역 청원을 저장된 defId로 구분한다. 검수·합성 선택 검사는 `../records/plague-variant-candidates/` 참조. 실제 엔진 선택기·화면 렌더 통과는 아니다. 위 직업 추가 당시 436개 수치는 변경 이력이다.

## R04 약속·영지 기록 추가

독립 검수에서 CTX01을 고친 16개를 정본에 통합했다. 약속 생성·이행·불이행은 저장된 term, 영지 인물 사망은 기록된 role, 권원·점유 이전은 to=lord만 사용한다. 청지기 분류는 재직 사실로 확대하지 않는다. 기존 440개 객체와 기준 427개 전체 구조를 보존했으며, 이 추가 직후 R04 누적 추가는 29개였다. 전체456개 Schema·ID 유일성·80개 합성 선택 사례·파생표 일치를 검사했다. `../records/CHRONICLE_CONTEXT_MERGE_R04.json`과 `context-variant-candidates/REVIEW.json`에 통합·검수 근거가 있다. 게임 엔진 선택기·브라우저·자연 기록 적용은 이번 검사 범위가 아니다.

## R04 장원·청지기 기록 추가

독립 정적 검수 `PASS_STATIC_CANDIDATE_ONLY`를 받은 20개를 통합했다. 기존 456개 객체와 427개 기준 구조를 보존했으며, 이 추가 직후 476개·R04 누적49개 추가였다. 숫자형 recurring/granted와 두 필드 조건은 승인 객체 전체와 정확 비교한다. 전체 Schema·476개 ID 유일성·정본 대상104개 합성 선택·조건표108행을 확인했다. 근거는 `../records/CHRONICLE_GOVERNANCE_MERGE_R04.json`과 `../records/governance-variant-candidates/REVIEW.json`이다.

**`stewardship.audit_clean.r04.visit`와 `.accounts` 두 후보는 설치 불가**다. `factLineOverrideRequired`를 그대로 보존했으며, 감사에서 미발견을 실제 부족분 부재로 과장하는 기존 사실줄을 먼저 고쳐야 한다. 이 필드는 Schema가 실행을 강제하지 않는 메타데이터이므로 통합·검증 통과가 배포 허가가 아니다. 전체 묶음은 미설치이고 엔진 선택기·저장 복원·UI·자연 발생은 이번 검증 범위가 아니다.

## R04 집 등급·가구·후계 문장 추가

독립 검수 `PASS_CANDIDATE_MERGE_WITH_INSTALL_BLOCK`를 받은 13개(4종)를 통합했다. 이 추가 직후489개·R04누적62개 추가였으며 기존476객체와427기준 구조를 보존했다. 도달한 등급(level), 최종 식구 수(residents=1), 저장된 후계 관계의 정확한 eq 조건만 쓴다. 승인 객체 전체 비교와96개 정본 합성 선택·전체Schema·ID 유일성을 확인했다. 근거는 `../records/CHRONICLE_LIFE_MERGE_R04.json`과 `../records/LIFE_VARIANTS_INDEPENDENT_REVIEW.json`이다.

**`legacy.heir_seated.r04.son`은 사실줄 정정 전 설치 불가**다. 현재 마을의 아들을 우선하는 생산자가 맏아들을 보장하지 않으므로 `factLineOverrideRequired`를 보존했다. 앞 감사2개와 합쳐 이번 회차 새 후보3개에 사실줄 선행 수정 제한이 있다. 메타데이터가 자동 실행 차단을 구현하지는 않는다. `person.shrank`는 persons가 없는 구형 경로에 한정하며 현대 자연 발생을 주장하지 않는다. 엔진·UI·저장 복원은 이번 검사에서 실행하지 않았다.

## R04 선택·무응답·전쟁 기록 추가

독립 검수 `PASS_OFFLINE_CANDIDATE_MERGE`를 받은 16개(6종)를 통합했다. 현재505개·R04누적78개 추가이며 기존489객체와427기준 구조를 보존했다. 저장된 chosen/defId와 숫자 집계를 사용한다. 습격 후보의 세 조건은 화재·물자 약탈·금전 약탈 각각 숫자0의 동시 일치만 허용하며 전체 안전·사상자 부재를 말하지 않는다. 승인 객체 전체와 조건 개수를 정확 비교하고151개 정본 합성 선택·전체Schema·ID 유일성을 확인했다. 근거는 `../records/CHRONICLE_DECISION_MERGE_R04.json`과 `../records/DECISION_VARIANTS_INDEPENDENT_REVIEW.json`이다. 기존 감사2개·후계 아들1개의 설치 제한은 그대로이며 새 override는 없다. 엔진·UI·자연 발생은 이번 검증에서 실행하지 않았다.

## R05B 병합 당시 기록 (607개)

현재 누적607객체. 위548판 안내는 직전 단계 기록이다. R05B_VALIDATION.json이 최신이며 별도307fixture·schema·548객체보존을 확인했다. event.recovered의 피해0을 발화0으로 읽을 수 있는 표현과 조사오류2개를 교정했다. 단일 역사종103개. 재현순서: 동결505판→merge-reviewed-variants.rb→merge-reviewed-next.rb.

## R05C 병합 당시 기록 (629개)

629개 문장 객체, 역사종182·원장분류46 유지. 단일형 역사종98개. 저장params에 근거한5유형22개를 추가했고 기존607객체는 변경하지 않았다. 작성자와 부모 검수를 분리했으며 별도 제3검수자는 실행 전 중단되어 통과 인원으로 세지 않는다. 전체schema·병합 후80fixture 통과. R05C_VALIDATION.json과 records/remaining-template-parent-review/REVIEW.md 참조.

기존 N04 저장에서3개 분기의 기록을 확인했지만629개 전체의 자연 도달성이나 runtime 선택·설치를 검증한 것은 아니다. R05/B 검증 파일은 당시 누적판의 이력이다. 후보 validate.rb의 baseline607 가드는 현재629에 재실행하면 거부하는 것이 정상이며, 당시 원본은 records/remaining-template-parent-review/baseline-607.json에 보존했다.

## R05D 현재 누적판

647객체, 단일형 역사92종. 독립 검수 후6유형18개 추가,629객체 보존 및200fixture/전체schema 확인. R05D_INSTALL_BLOCKS.json의 사실줄2개·숫자adapter4개 설치차단을 보존한다. 테스트용 숫자검사를 엔진 구현으로 주장하지 않는다. 후보와 검수 스크립트는 병합 전629기준이며 records/next-context-review/baseline-629.json을 보존했다. 게임 미설치·runtime선택 미검증.
