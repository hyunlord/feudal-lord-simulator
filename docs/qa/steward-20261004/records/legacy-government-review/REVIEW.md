# 왕실·자치·가문 원고 독립 검수

판정: **PASS_OFFLINE_DRAFT_WITH_INTEGRATION_BLOCK**. 6종 14문구를 독립적으로 실제 소스와 대조했으며 원고 수정이 필요한 사실 충돌은 발견하지 않았다. 이는 정본 병합·엔진 설치 승인이 아니다. 캡처·출처 결합·저장 왕복·실제 발생이 구현/검증되지 않은 상태다.

## 독립 내용 대조

- **시장 좌판세**: politics의 market_tolls와 townsfolk 보유를 한정해 서술한다. 일반 시장 수입이나 estates 권리 조각 전체를 넘겨받았다고 확대하지 않는다. 권리 목록 누락과 실제 미보유를 구분하는 captureContract가 있다.
- **왕실 보조세**: legacy.ts:152–157의 royalSubsidy 증가량과 history.ts:743 amount를 대조했다. 잔액0 문장은 납부 시점의 관찰이며 보조세 한 건이 금고를 비웠다는 인과가 아니다. treasuryBalance(after)를 캡처해야 한다.
- **확인금 분리**: legacy.ts:179–180의 확인금도 royal_subsidy 원장 분류를 쓰지만 legacy.royalSubsidy 누계에는 합산하지 않는다. 가문 문구의 “과세 사절의 요구에 따른” 한정이 이 차이를 보존한다. no_record는 왕실에 돈을 한 번도 내지 않았다는 뜻이 아니다.
- **친족**: persons.ts:655–678에서 아들 후보, 딸의 남편 후보, nephew/kinsman 후보를 직접 확인했다. 후보 kind만으로 모두 조카라고 단정하지 않는다. city_seal 후보는 과거 선택 기록만 말하고 실제 현 영주의 생존이나 소유권 승계까지 주장하지 않는다. 후보/선택 personId 결합 불일치는 unknown 처리 계약이다.
- **도시의 시장**: legacy.ts:182–189의 후보 대체 경로와 history.ts:750–755를 확인했다. 서로 다른 ID에 사망·이주 원인을 붙이지 않았다. 명시적 null은 이름 없는 기록으로 한정한다. historyCopy.ko.ts:42의 mayor 기본값은 빈 문자열이므로 :194 기본 사실행과 충돌하지 않는다. “첫 도시의 시장”은 문장상 약간 어색하나 의미 오류나 차단 사유는 아니다.
- **가문 이동/잔류**: legacy.ts:500 및 history.ts:756–758의 상태·고정 서사를 따른다. 실제 모든 인물 데이터가 이동했다는 주장이나 납세가 이동을 일으켰다는 설명을 추가하지 않았다.
- **FIX-12**: 추가 이름 슬롯이 없고 retainFactLine=true를 유지한다. historyNames.ts:43–54의 읽기 시점 ID→표시 이름 해석을 가로채지 않는다. 과거 문맥의 snapshot과 현재 표시 이름은 구분된다.

## 실행 검증과 불변성

원본 validate.rb는 원본 출력 경로를 검수 폴더로 돌린 사본으로 실행했다. 원고 14 양성 + context 196 + record 98 = 308 selector 검사, 원고 변조 4건 및 소스 10파일 18구간 검사를 재현했다. 원본 산출물에는 쓰지 않았다.

별도 independent_checks.rb는 null/boolean/array/빈 object/숫자/문자열 루트, 핵심 필드 null, unknown+referenceVerified=true 등 **238개 추가 반례**를 직접 검사했다. 원본 스키마 함수의 명시 지원 키를 확인했고 selector 앞 RECORD 및 CONTEXT schema 검사가 실제 수행되는 코드를 읽었다. schema 통과는 출처 진실성을 보증하지 않는다. referenceVerified=true 합성 입력을 진짜 스냅샷으로 인정하는 통합은 여전히 금지다.

PROPOSAL.schema는 문서 전체 const 동결 계약이며 일반 등록기 스키마로 평가하지 않았다. Ruby는 명시된 부분집합 검사기다. 정본 SHA `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf` 일치, 원본 SHA256SUMS 12파일 확인, 원본 입력 해시는 INPUT_SHA256.json에 별도 보존했다. HEAD는 `5fb1aebfe735592c1424c947e88388d4ffe21742`다.

## 남은 통합 조건

1. 실제 emitter 전이에 결합한 캡처 어댑터와 실패 시 unknown fallback.
2. 레코드 ID·틱·템플릿과 불변 출처 확인. 원고의 captureContract에 쓴 금액·관계·권리 검사는 아직 코드가 아니다.
3. 저장/불러오기 및 실제 런타임 구성 문장 확인. 자연 발생 빈도와 도달 가능성은 이번 정적 검토 범위 밖이다.

원고 품질 검수는 통과했다. 위 조건의 미구현을 저작 실패나 이미 구현된 기능으로 바꾸어 보고하지 않는다.
