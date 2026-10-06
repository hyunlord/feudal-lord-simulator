# v4.2 엔진 근거 감사

기준 HEAD: 9181ce03394f8be064c131d1ddfae121249e9694. 저장소 읽기 전용. 기존 esbuild로 실제 src/engine/registryV4.ts를 외부 /tmp/astra-engine42.mjs에 묶고 registryV4Support()를 직접 호출했다. 대체 데이터 주입 없음.

## 범위 확정

- 현재 지원 판정: 정본 215개 중 **86개 실행 가능**, 129개 비실행. enabled.json이 정확한 86개 ID다. 실행 가능은 조건을 충족할 때 후보가 된다는 뜻이며 실제 출현 보장이 아니다.
- scripts/buildRegistryV4.ts:38 및 scripts/registryCanon.ts의 합치기를 거친 현재 generated 원본에는 v4.1이 반영되어 있다. 이전 보고의 70개에 011 수정과 201–215가 더해진 86개다.
- LM-E9b 기존 v4e 기록: 1: 63 offers / 34 unique; 2: 59 offers / 31 unique; 3: 74 offers / 32 unique. 합집합 **40개**. 원자료의 invalid도 제시 이력에 포함했다. 이는 v4.1 이전 실행 관측이며 현재 86개 전부의 출현이나 재미를 증명하지 않는다.
- 과거 실제 제시 ID: ck_evt_005, ck_evt_008, ck_evt_009, ck_evt_010, ck_evt_015, ck_evt_027, ck_evt_031, ck_evt_032, ck_evt_034, ck_evt_035, ck_evt_038, ck_evt_042, ck_evt_046, ck_evt_051, ck_evt_053, ck_evt_101, ck_evt_102, ck_evt_105, ck_evt_108, ck_evt_113, ck_evt_115, ck_evt_123, ck_evt_124, ck_evt_127, ck_evt_130, ck_evt_131, ck_evt_133, ck_evt_136, ck_evt_138, ck_evt_140, ck_evt_141, ck_evt_144, ck_evt_145, ck_evt_150, ck_evt_155, ck_evt_160, ck_evt_161, ck_evt_163, ck_evt_164, ck_evt_165

## 명령 의미와 판정 경계

|명령|실제로 변하는 것|보이는 결과 판정/금지 표현|근거|
|---|---|---|---|
|file_suit|기존 청구에 소송 생성, 제소비 지급, claim.status=suing|특정 토지/권리의 소송 시작으로 인정; 즉시 소유권 취득 아님|src/engine/estateSuits.ts:59,72|
|add_suit_evidence|특정 소송의 청구에 종류별 증거를 1회 추가하고 비용 지급|구체 법적 진전. 승소 확정 아님|estateSuits.ts:86|
|seek_suit_patron|후원 단계에서 실제 세력 후원자와 후원력 기록|소송의 특정 세력 지원으로 인정; 관계를 소비하거나 별도 대가 지급하는 명령 아님|estateSuits.ts:99|
|enforce_possession|집행비, 집행 횟수; 성공 시 possessor 변경, 실패 시 저항 감소|실제 땅/권리 점유 경합. 성공 조건을 충족하지 않으면 즉시 탈환 아님|estateSuits.ts:142|
|propose_marriage|실제 신랑/신부가 있는 혼인 교섭 생성, 승낙/거절/역제안|실제 사람의 교섭. 반드시 혼인 성립 아님|src/engine/marriage.ts:137|
|answer_counter|기한 내 실제 역제안 승인 시 계약, 거절 시 withdrawn|교섭 및 사람/계약 결과. 현금 지급만으로 축소하면 안 됨|marriage.ts:154|
|keep_promise|실제 약속 kept; 금액 있으면 국고 지급|약속 이행 장부는 있으나 교회·시장·구호를 건설/실행하지 않음. 주제에 비해 결과가 얇으면 보류|marriage.ts:211|
|set_estate_oversight|실제 장원 감독방식/청지기 교체, candidate/serving 상태|특정 사람·장원의 책임자 변화 인정|src/engine/stewardship.ts:409|
|set_exception_rules|청원 보고 예외 기준 전체 교체|행정 규칙 결과. 개별 권리 부여나 직접 청원 처리 아님; 이전 나머지 규칙 보존 필요|stewardship.ts:423|
|answer_estate_petition|홈은 돈/처리 상태; 외지는 돈/소작인·상인 호감, 경우에 따라 방치|청원 이름만으로 권리/가구/토지 변화를 주장하지 말 것|stewardship.ts:445|
|set_audit_mode|다음 미카엘마스 감사 방식 설정|미래 실제 감사 계획, 즉시 횡령 적발/파면 아님|stewardship.ts:477|
|answer_audit|처벌/교체 시 실제 청지기 해임과 후임 임명, 처벌은 일부 회수; 용인은 충성|구체 사람 결과. replace보다 punish의 대가가 카드에 명확해야 함|stewardship.ts:489|
|set_market_dues|도시 전체 좌판세 배율 250–2000 변경|실제 규칙이나 주효과는 수입과 사업 유인. 특정 좌판권/통행권/장날 생성 아님|src/engine/townAgency.ts:95;townAgencyDues.ts:4|
|set_project_subsidy|종류별 보조 약정 교체, 국고 1/4 한도; 착수 때 지급|조건부 건설 유인. 특정 공사를 직접 세우거나 보조액만큼 즉시 소비하지 않음|townAgency.ts:74,83,302,557|
|set_estate_policy|도시 전체 정책 가중치 변경|간접 우선순위뿐. 특정 굶주린 가구 구호·임금·국왕 특권 확인·징발 수행으로 쓰면 보류 권고|townAgency.ts:65,302|
|order_timber|잔여 주문량을 교체, 장날 실제 공급과 돈이 있어야 목재가 들어옴|물자 주문/장날 납품은 구체 과정. 불탄 특정 집 재건 보장 아님|src/engine/timberTrade.ts:19,42|

## 카드 표면

src/ui/registryCardModel.ts:160,180–189는 body, choice.label, choice.tradeoff와 실제 즉시 국고 차액을 읽는다. 따라서 딜레마와 결과 설명은 **body/label/tradeoff**에 있어야 한다. 다른 기획 필드에만 적으면 이 카드에서는 안 보인다. src/ui/lord/policyModel.ts:56–67은 정책/보조/세율 화면으로 이어지는 읽기 표면이다. 이는 소스 연결 확인이며 브라우저에서 현재 세이브를 클릭해 검증한 결과는 아니다.

## 우선 보류 권고 대상

실행 가능한 명령이 전부 정책 전환인 사건: ck_evt_202, ck_evt_203, ck_evt_207, ck_evt_208, ck_evt_210, ck_evt_212, ck_evt_213, ck_evt_215. 관계 비용 보류 버튼이 섞여 있어도 사건 대상에 실제 변화가 생겼다고 보지 않는다. 해당 사건은 정책 카드로 정직하게 재목적화할 타당한 이유가 없는 한 보류를 권한다. 구호/임금/특권 등 다른 의미를 정책 변경으로 흉내 내는 방식은 피한다.

## 검증 범위

실제 최신 엔진의 지원 목록 실행 + 명령 구현 및 카드 모델 정적 추적. 125년 새 실행, 브라우저 눈검증, 실제 유저 재미 판정은 수행하지 않았다. 명령이 있다는 것과 사건 문맥에 적합하다는 것은 별도로 판단해야 한다.

## 감사 처벌의 관계 대가 보충

`answer_audit`의 대가는 처리 함수만 보고 끝내면 빠진다. `src/engine/history.ts:986` 이후는 감사가 pending에서 punished로 바뀌면 청지기의 실제 연결 세력에 `PUNISH_CONNECTION_RELATION` 관계 기록을 만든다. 상수는 `src/content/stewardshipConfig.ts:103`의 **-5**다. 따라서 처벌은 해임·후임 임명·일부 회수에 더해 연결 세력의 반발을 치르는 선택이며, 단순 교체와 같은 대가가 아니다. 연결 세력이 없으면 해당 관계 기록은 생성되지 않는다. 이는 handler에서 끝나지 않는 기록 처리 경로의 정적 확인이며, 아래 목재·소송 시험에 감사 플레이 실험을 추가했다고 주장하지 않는다.

## 재현 명령

```sh
REPO=/path/to/audited-checkout ESBUILD_FROM=/path/to/existing-dependency/package.json node proofs/verify-engine.mjs
```

스크립트는 감사한 HEAD를 확인하고 패키지의 정본 기준 파일에 v4.2를 ID별 병합한다. 기존 esbuild를 사용해 저장소를 바꾸지 않고 임시 번들을 만들며, 실제 지원 목록·목재 60사례·150의 증거/비용/원자 실행 경계를 검증한다. 생성된 번들은 검사 뒤 지운다. `ESBUILD_FROM`을 생략하면 `REPO/package.json`에서 기존 esbuild를 찾는다. 새 의존성을 설치하지 않는다.
