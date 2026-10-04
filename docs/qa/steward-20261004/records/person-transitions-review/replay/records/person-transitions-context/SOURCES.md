# 근거와 범위

모든 경로는 `/Users/rexxa/fls-astra-steward`, HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742` 기준이다. 이 산출물은 역사적 혼인 관행을 새로 주장하는 원고가 아니라 현재 게임 이벤트의 정확한 기록 문구다.

| 파일·줄 | 사용한 근거 |
|---|---|
| src/engine/history.ts:333-378 | 입주 조건, 집 분기 early continue, 가구/개인 subject 및 head 선택 |
| src/engine/history.ts:386-424 | 새 spouse 인물만 married, alive 새 past만 left_town, record의 가구 actor |
| src/engine/history.ts:865-890 | 읽을 때 historyParams로 이름 해석 |
| src/engine/persons.ts:350-367 | 기존 일반 가구의 spouse 생성 |
| src/engine/persons.ts:385-411 | 굶주림/가구 승계 과정의 여러 이탈 경로; 동기 추정 배제 |
| src/engine/persons.ts:608-622 | 영주관 가구의 성인 자녀 이탈·배우자 생성 |
| src/engine/persons.types.ts:38-67,84-92 | manor household ID, Person household/role/alive, people와 past의 의미 |
| src/content/historyCopy.ko.ts:339-340,353-364 | 보존하는 기본 사실행 |
| src/engine/historyNames.ts:1-20,40-55 | FIX-12 ID 저장·읽을 때 현재 이름 해석 |

실파일 SHA와 인용 원문 12범위는 `SOURCE_EVIDENCE.json`에 있다. 새로운 문맥 값은 `FIELD_CONTRACTS.json`에 **현재 record에 없음**으로 표시했다. 소스 조건 자체와 제안한 stricter guard를 구분한다.
