# R07 콘텐츠 인계 — 현재 등록기 대조 감사

대상은 200개 원고와 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`의 LM-E9 계약이다. 원고·엔진 수정과 엔진 실행은 하지 않았다. graft 탐색 후 실제 소스로 등록기 필드·바인딩·효과와 가까운 기존 기능의 한계를 확인했다. 입력 SHA는 INPUTS.json, 코드 SHA/직접 읽은 구간은 SOURCE_EVIDENCE.json에 있다.

## 결론

**기존 ‘전 선택 효과 미지원 60개’ 분류는 여전히 맞다.** 사건 단위 `blocked_unsupported_effect`는 61개다. 차이는 135번: 실제 소송 후원 명령 하나가 있지만 중립 중재는 없으며, 원고의 결과 있는 선택 최소 두 가지를 충족하지 못한다. 60과 61은 서로 다른 지표다. 61개 전부의 개별 요구와 현재 기능 경계를 CORE_MAPPING.json에 연결했다. 이 중 새 등록기로 핵심 효과 보류를 해제할 사건은 발견하지 못했다.

200개 ID/572선택/395명령 템플릿을 재검산했고 현재 content/SHA256SUMS 전 항목을 통과했다. 이 수치는 실행 성공이나 200개 의미 전수 검증이 아니다. 인프라·핵심효과·역사근거는 서로 독립된 보류 축이다.

## 현재 등록기가 해결한 것과 남은 것

등록기는 실제로 있다. RegistryEffect 16종, 명시된 읽기 필드와 여섯 바인딩, 빈도/재등장/선례를 제공한다. 따라서 옛 ‘등록기 자체가 전혀 없음’을 현재 엔진 설명으로 반복하면 부정확하다. 다만 배포물의 `commands/type/args`, `exists/call/literal` 등 조건 제안, 복합 바인딩·맥락 키와 실제 `effects/command`, allowlist field/op, 단일 bind 계약은 같지 않다. `unsupportedFilters`는 이 sidecar의 보류 메타데이터이며 현 RegistryEntry가 직접 지원하는 필드가 아니다. 어댑터가 보류를 보존해야 한다.

현재 소스는 home 청원과 11개 같은 ID 초안을 명시적으로 가져온다. sidecar 200개의 `enabledInEngine:false`는 이 파일의 설치 상태이며, 해당 ID가 게임에 하나도 없다는 뜻이 아니다. 같은 ID가 있다고 문구·선택·조건이 이 파일과 같다는 증명도 아니다. ALL200_BOUNDARIES.json은 이 11개 ID를 표시한다.

sidecar에서 쓰인 기존 명령 중 `answer_counter`, `answer_estate_petition`, `famine_response`, `keep_promise`, `petition_response`, `propose_marriage`, `seek_suit_patron`은 현 RegistryEffect에 없다. GameCommand에 있다는 사실만으로 등록기 효과로 실행할 수 없다. 나머지 139개도 자동 승격하지 않는다. 조건·바인딩·중복 억제·맥락 증명과 선택의 실제 결과를 개별 이식해야 한다.

`none`도 enabledChoices에서 비-null로 남을 수 있다. 엔진의 선택 수 검사와 원고의 ‘결과 있는 선택 최소 두 가지’는 동일하지 않다. 또 setProjectSubsidy 거절은 lastRefusal을 기록한 새 객체를 반환하고 등록기는 객체 동일성으로 변경을 판단한다. 이는 원고의 원자적 성공 판정 계약을 곧바로 충족한다고 볼 수 없는 정적 경계다. 본 감사는 재현 테스트를 하지 않았다.

## 역사근거 보류와 최소 수정안

**189번은 A안 권고:** `unsupportedFilters`에서 `NE_SR01_KI09_source_fulltext` 항목 하나만 제거한다. 현재 CS09는 공식 해설 본문을 읽은 `LIMITED_TO_CONFIRMED_CLAIM`인데 이 항목은 아직 ‘원문403; 검색 발췌만’이라고 쓰여 있다. 접근 실패를 다른 불확실성으로 이름만 바꾸어 계속 미지원 필터로 남기는 B안은 권하지 않는다.

현재 081번도 CS16 제한적 직접 확인을 근거 카탈로그에 두고, registry에는 authored_context와 MT21 핵심 효과 보류만 둔다. 이와 같은 분리가 맞다. 189의 CS09는 고문서 자체 독립 판독이나 모든 여성의 법적 지위 일반화를 허용하지 않는다. 이 제한은 이미 SOURCE_CATALOG와 events.history에 남아 있으므로 새로운 실행 조건으로 발명할 필요가 없다.

적용 시 189의 사건 조건 `literal:false`, KI09_context 필터, 3선택의 빈 commands/false 조건, enabledInEngine:false와 다른 모든 사건을 보존해야 한다. 이 감사는 제안만 남겼다. 접근 사유 해소는 실행 보류 해소가 아니다.

070/089/096 역사 창, 166의 시대·실제 위험 맥락, 181/182/183/185/187의 후대 관행 적용 제한은 별도 검토 대상이며 이번 등록기 구현으로 해소되지 않는다. 195/FA04는 after1440(?) 대 1435년 또는 이전의 편년 불확실 보류를 유지한다. ALL200_BOUNDARIES의 sourceCatalogRestrictions는 인용한 출처의 제한 목록이지 각 사건의 자동 실패 판정이 아니다.

## 검증 범위

기존 content/VALIDATION.json은 R05 좁은 검사와 과거 전체 검사 참조다. historical validate.rb는 R05/R04 절대 경로와 특정 4개 사건을 대상으로 하므로 실행해도 현 200개 등록기의 증거가 되지 않는다. 원본 validator는 실행·수정하지 않았다. 자체 audit.rb만 Ruby로 실행했다. 감사 대상 61개 핵심 요구는 전수 분류했고, 200개 전체는 ID/수량/명령 이름/필터/출처 제한/같은 ID 여부를 검사했다. 새 게임 실행, 저장·복원, 렌더, 실제 선택 성공, 전 200개 문장 인과의 재심사는 하지 않았다.

## 개별 매핑

아래 표의 분류별 현재 소스 경계와 제안 요구 원문은 CORE_MAPPING.json에 함께 있다. 분류는 상호 배타적 대표 책임 축이며 사건의 다른 요구를 지우지 않는다.

| ID | 제목 | 분류 | 새 효과 |
|---|---|---|---|
| ck_evt_063 | 소환을 듣지 못한 사람 | court_procedure | NE01, NE_SR01_MT03 |
| ck_evt_064 | 빌려 간 쟁기가 돌아오지 않는다 | chattels_contract_delivery | NE01, NE_SR01_MT04 |
| ck_evt_066 | 가축 우리에서 풀려난 소 | land_use_damage_tenure | NE01, NE_SR01_MT06 |
| ck_evt_069 | 지붕용 가지를 장에 내다 팔다 | land_use_damage_tenure | NE01, NE_SR01_MT09 |
| ck_evt_070 | 약속한 날의 다른 일꾼 | labour_public_work_relief | NE01, NE_SR01_MT10 |
| ck_evt_071 | 직영지의 한 해를 미리 사겠다는 사람 | land_use_damage_tenure | NE01, NE_SR01_MT11 |
| ck_evt_072 | 한 필지에 세 개의 부엌 | land_use_damage_tenure | NE01, NE_SR01_MT12 |
| ck_evt_073 | 장부에는 길, 밭에는 이랑 | land_use_damage_tenure | NE01, NE_SR01_MT13 |
| ck_evt_074 | 갈대 묶음에 붙은 새 요구 | land_use_damage_tenure | NE01, NE_SR01_MT14 |
| ck_evt_079 | 이웃이 주문한 지붕 기와 | chattels_contract_delivery | NE01, NE_SR01_MT19 |
| ck_evt_081 | 남의 인장으로 남긴 약속 | documents_accounts_identity | NE01, NE_SR01_MT21 |
| ck_evt_082 | 먼저 찾아온 보증인 | debt_guarantee_setoff_escrow | NE01, NE_SR01_MT22 |
| ck_evt_084 | 같은 빚이 다른 두 줄로 | documents_accounts_identity | NE01, NE_SR01_MT24 |
| ck_evt_086 | 짐값 대신 잡아 둔 보따리 | chattels_contract_delivery | NE01, NE_SR01_MT26 |
| ck_evt_089 | 같은 도랑을 찾는 두 작업장 | land_use_damage_tenure | NE01, NE_SR01_MT29 |
| ck_evt_091 | 빚 대신 내민 물건의 값 | chattels_contract_delivery | NE01, NE_SR01_MT31 |
| ck_evt_094 | 작업장 아래의 다른 주인 | land_use_damage_tenure | NE01, NE_SR01_MT34 |
| ck_evt_096 | 계절 끝에 돌아온 빌린 베틀 | chattels_contract_delivery | NE01, NE_SR01_MT36 |
| ck_evt_097 | 런던까지 이어진 외상 장부 | debt_guarantee_setoff_escrow | NE01, NE_SR01_MT37 |
| ck_evt_098 | 새 다리 곁의 오래된 여울 | land_use_damage_tenure | NE01, NE_SR01_MT38 |
| ck_evt_099 | 이름 없이 적힌 재단사 | documents_accounts_identity | NE01, NE_SR01_MT39 |
| ck_evt_103 | 미사 뒤의 맹세 | court_procedure | NE_SR01_CN01 |
| ck_evt_104 | 두 성직록 사이의 편지 | church_office_restricted_gift | NE_SR01_CN02 |
| ck_evt_106 | 남은 나무를 팔겠다는 청 | land_use_damage_tenure | NE_SR01_CN03 |
| ck_evt_107 | 한 해에 두 사람의 장부 | documents_accounts_identity | NE_SR01_CN04 |
| ck_evt_109 | 소환장은 누구에게 갔는가 | court_procedure | NE_SR01_CN01 |
| ck_evt_110 | 수확을 받을 것인가, 정한 지대를 받을 것인가 | land_use_damage_tenure | NE_SR01_CN05 |
| ck_evt_112 | 지붕 위로 갈 타일, 수레에 실릴 타일 | chattels_contract_delivery | NE_SR01_CN06 |
| ck_evt_114 | 종자로 남긴 자루 | labour_public_work_relief | NE_SR01_CN07 |
| ck_evt_116 | 장원의 열쇠와 성직자의 이름 | church_office_restricted_gift | NE_SR01_CN02 |
| ck_evt_118 | 다리 몫의 지대 | church_office_restricted_gift | NE_SR01_CN08 |
| ck_evt_119 | 유언에 적힌 덮개 | chattels_contract_delivery | NE_SR01_CN09 |
| ck_evt_120 | 같은 손에 모인 두 장부 | documents_accounts_identity | NE_SR01_CN04 |
| ck_evt_121 | 서명 옆에 설 사람 | debt_guarantee_setoff_escrow | NE_SR01_CN10 |
| ck_evt_122 | 울타리 안의 수선 길 | land_use_damage_tenure | NE_SR01_CN11 |
| ck_evt_125 | 반쪽 다리의 값 | labour_public_work_relief | NE_SR01_CN12 |
| ck_evt_126 | 같은 빚을 적은 두 장 | debt_guarantee_setoff_escrow | NE_SR01_CN10 |
| ck_evt_129 | 가축을 먼저 돌려보내자는 청 | land_use_damage_tenure | NE_SR01_CN11 |
| ck_evt_134 | 다투는 동안의 지대 | debt_guarantee_setoff_escrow | NE_SR01_CN13 |
| ck_evt_135 | 법정에서 이름을 빌려 줄 사람 | court_procedure | NE_SR01_CN15 |
| ck_evt_137 | 나무를 벨 권리, 땅을 남길 의무 | land_use_damage_tenure | NE_SR01_CN14 |
| ck_evt_181 | 후견 중인 장원의 새는 지붕 | family_wardship_care_consent | NE_SR01_KI01 |
| ck_evt_182 | 돌려줄 쟁기와 가축 | family_wardship_care_consent | NE_SR01_KI02 |
| ck_evt_183 | 재혼을 서두르지 않겠다는 과부 | family_wardship_care_consent | NE_SR01_KI03 |
| ck_evt_184 | 형제의 빚에 우리 인장을 | debt_guarantee_setoff_escrow | NE_SR01_KI04 |
| ck_evt_185 | 성년 친족의 혼담을 알릴 일 | family_wardship_care_consent | NE_SR01_KI05 |
| ck_evt_186 | 서로 다른 채무 사본 | debt_guarantee_setoff_escrow | NE_SR01_KI06 |
| ck_evt_187 | 두 집이 맡겠다는 아이 | family_wardship_care_consent | NE_SR01_KI07 |
| ck_evt_188 | 죽은 친족의 채무 청구 | family_wardship_care_consent | NE_SR01_KI08 |
| ck_evt_189 | 어머니 몫의 지대 영수증 | documents_accounts_identity | NE_SR01_KI09 |
| ck_evt_190 | 형제 둘의 한 방앗간 | land_use_damage_tenure | NE_SR01_KI10 |
| ck_evt_191 | 영주관의 돌을 둘러싼 형제 다툼 | labour_public_work_relief | NE_SR01_KI11 |
| ck_evt_192 | 혼례 옷의 두 몫 | chattels_contract_delivery | NE_SR01_KI12 |
| ck_evt_193 | 아픈 친족의 귀가 | family_wardship_care_consent | NE_SR01_KI13 |
| ck_evt_194 | 회복을 빌며 남긴 약속 | family_wardship_care_consent | NE_SR01_KI14 |
| ck_evt_195 | 몸값을 댄 친족의 잃어버린 증서 | documents_accounts_identity | NE_SR01_KI15 |
| ck_evt_196 | 가족을 위한 사제의 숙소 | family_wardship_care_consent | NE_SR01_KI16 |
| ck_evt_197 | 가족 몫을 담보로 내놓자는 부탁 | land_use_damage_tenure | NE_SR01_KI17 |
| ck_evt_198 | 같은 편지를 두 번 쓰는 서기 | documents_accounts_identity | NE_SR01_KI18 |
| ck_evt_199 | 병문안과 집안의 빈자리 | family_wardship_care_consent | NE_SR01_KI19 |
| ck_evt_200 | 가문 문서 상자의 두 열쇠 | documents_accounts_identity | NE_SR01_KI20 |
