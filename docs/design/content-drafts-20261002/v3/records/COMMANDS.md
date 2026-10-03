# 명령·금액·발신 주체 확인

기준 HEAD: 5c16778d2eff26a1501485a7c0d7413ce16a6388. 소스 읽기만 수행. graft로 위치를 찾은 뒤 해당 실제 파일을 줄번호와 함께 확인했다. 게임 실행 검증 아님.

## 002

accounts→accounts 선택 a 제거; c의 중복 accounts 명령 제거. b visit와 c direct만 남김.

근거: `src/engine/stewardship.ts:371`, `src/engine/stewardship.ts:431`, `src/engine/stewardship.ts:60`.

남은 경계: 실제 estateId/currentSteward 바인딩은 등록기 몫.

## 025

후임 선택 파라미터를 생략하여 현행 자동후임 사용. pending/deadline/revealedKept>=2/loyalty<=90/tenants<=95/연결세력relation>=-95/생존후임 조건으로 회수·충성·관계·교체 실제 차이 보장.

근거: `src/engine/stewardship.ts:443`, `src/engine/history.ts:981`.

남은 경계: 실제 pendingAudit 바인딩·출력 시점 재검사 필요. 후임 정렬은 엔진 기존 localeCompare.

## 030

도시 공동체(town)의 기존 직인 길드 대표(reorganisation.guild.headId), 사람 persons.people.id로 명시. 건축actor guild와 회계merchant_house_2 구분.

근거: `src/engine/reorganisation.ts:214`, `src/content/factionConfig.ts:35`, `src/engine/townAgency.ts:207`.

남은 경계: 대표headId 없거나 해당 인물이 없으면 사건 제외; 새 세력/인물 생성 없음.

## 037

동일 위임·동일 담당 재설정 delegate 제거. direct와 delegate_visit 두 실효 선택만.

근거: `src/engine/stewardship.ts:371`, `src/engine/stewardship.ts:431`.

남은 경계: 영지/담당 바인딩은 등록기 몫.

## 042

시장 장려금32d. 세율 후보범위도800/1150‰로 확정. 현재1000‰, market 장려금0, 전체합계+32<=floor(금고/4).

근거: `src/engine/townAgency.ts:73`, `src/engine/townAgency.ts:82`, `src/engine/townAgency.ts:94`.

남은 경계: 지속 장려금; 반복 사업마다 지급 가능; 자동만료 없음.

## 049

직조 단독32d/축융 단독32d/분할16+16d, 총설정액32d 동일. 다른장려금0이면 금고128d부터.

근거: `src/engine/townAgency.ts:73`, `src/engine/townAgency.ts:527`.

남은 경계: 분할 기존 비원자적 순차경로 유지; 실패시 부분 성공만 기록.

## 중요 구별

- 025 연결 세력 −5는 answerAudit 본문이 아니라 history.ts:981–989의 pending→punished 후처리다. 금고·영지 tenants와 다른 경로이며 중복 적용하면 안 된다.
- 030 craftsmen 청원 주체는 factionConfig.ts:40의 town. townAgency.ts:208에서 guild 건축 주체가 merchant_house_2에 대응하는 것은 사업의 관계·원장 경로다. 둘을 같은 ID라고 쓰지 않았다.
- 32d는 기존 상수나 사료 가격이 아니라 이번 확정 콘텐츠 값. 분할16+16과 설정 합계를 같게 하여 업종 배분을 비교한다.
- subsidyRefusal은 agency가 없을 때도 null이므로 agency 존재를 별도 검사한다.
- 시장 사업 후보는 autoplayBuildAction의 반환이 place_building이며 building===market일 때만 유효. 단순 non-none은 다른 도시 서비스를 잘못 받아들일 수 있다.

## 정적 경계 계산

다른 장려금0: 금고127d→한도31d로 불가,128d→한도32d로 가능. 설정 즉시 금고변화0. 지급·건설·유입·치유 등을 보장하지 않는다. 실제 등록기 실행은 하지 않았다.

## graft

총6회, 절감량 제공5회 합계114080tokens, 금액정보 없음. 한 번 deathYear 검색은 결과·절감량 없음.
