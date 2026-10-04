# 독립 검수 — legacy-town-context

판정: **DRAFT PASS, 런타임 통합 미검증**. 6유형 15문구를 실제 producer와 대조했다. 6문구의 사실행 결합 보류는 타당하며 해제하면 안 된다. 후보·정본·엔진을 변경하지 않았다.

## 재현과 독립 검증

- 저자 validator는 출력 위치 3곳만 검수 폴더로 바꿔 재현: 선택 195(양성15/폴백180), 스키마 음성210, 소스9파일/14구간 모두 통과.
- 추가 독립 60사례: 각 문구마다 추가키, 안전정수 초과 tick, 잘못된 sourceHead, 잘못된 enum → 모두 폴백.
- 후보 manifest 17항목 통과. 실행 전후 후보 전체 파일 SHA 동일. 정본 SHA `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf` 유지.
- 검사는 경량 Ruby의 제한된 스키마 해석/selector 검증이다. 표준 JSON Schema 전체 구현, 실제 capture, 저장 복원, 엔진 실행, formatter/UI 검증을 뜻하지 않는다.

## 문구·의미 판정

| 유형 | 판단과 근거 |
| --- | --- |
| staple 2 | `legacy.ts:279–304`의 예정 사건과 가격계수만 존재. 완성 buildings의 weaver_house 유무를 기록 시점에 찍는 조건은 사실 수준에 머문다. 매출·이익·실제 직조공 인구나 역사 원인으로 확장하지 않는다. constructionSites는 제외해야 한다. |
| guild_dispute 2 | `GuildRecord.headId: string|null`과 `legacy.ts:294` 안건 생성에 맞는다. nonempty ID는 기록된 수장을 뜻하고 null은 미특정만 뜻한다. 생존·활동·사망·공석 원인을 단정하지 않아 안전하다. ID를 현재 인물 검색 실패만으로 null로 바꾸면 안 된다. |
| market_fire 3 | `post`는 금고 잔액으로 지출을 제한하고 0이면 원장도 생성하지 않는다(`legacy.ts:73–76`). history cost150는 요청된 정액이지 지급액이 아니다(`history.ts:765`). exact post의 moved가 필요하다. 해당 함수에는 건물 파괴·사상자·화재 범위 작업이 없으므로 이 문구로 그것을 증명하지 않는다. |
| church_rebuilding 2 | 청원 생성 직전 금고와 비용300의 비교다. 지급·승인·예약·후속 시공 여부를 말하지 않아 적절하다. 독해 시 금고나 같은 tick 전체 차액으로 복원하면 안 된다. |
| nave_rebuilt 3 | accept 시 bounded post 이후 즉시 naveRebuilt=true(`legacy.ts:196–201`). 0/일부 지출이어도 flag가 세워진다. `history.ts:767`도 false→true로 발행할 뿐 공사 완료를 확인하지 않는다. “증축이 기록되었다”로 제한한 초안은 타당하다. |
| deposition 3 | `factions.ts:425–429` 왕실 초기 관계로 반만 돌아가는 개별 delta의 부호 분기다. 전체 tick의 최종 관계 변화, 충성 보상·징벌로 번역하지 않는다. 0은 filter 전 contribution을 캡처해야 한다. 다른 원인의 동시 조정·clamp와 구분한 원고가 적절하다. |

## 사실행 보류 6건

화재 3건은 기본 사실행의 수리 정액과 실제 지급액을 명확히 구분해야 한다. “수리에 150”를 지급 완료라고 읽히게 두면 partial/zero와 충돌한다. 불이 났다는 사건 설정과 특정 건물이 실제 불탔다는 엔진 결과도 분리해야 한다.

회중석 3건의 원래 사실행 “교회의 새 회중석이 섰다”는 즉시 flag producer만으로 물리적 완공을 입증하지 못한다. 중립 제목만 붙여 이 문제를 해소할 수 없다. `retainFactLine=true`이므로 결합 문장 검수 보류가 필요하다.

나머지9도 event-time capture가 구현·검증되기 전에는 자동 채택하지 않는다. 이는 초안 합격과 별개의 통합 조건이며, 설치를 이 초안 작업의 완료조건으로 추가하지 않았다.

## 선택기·FIX12·경계

schema-first → known/referenceVerified → recordId/tick/campaignId/template/sourceHead 결합 → enum 선택 순서가 맞다. referenceVerified 플래그만으로 데이터 진실성이 증명되지는 않는다. 모든 문구 requiredSlots=[]이며 새 사람 이름을 직접 합성하지 않는다. 향후 이름 슬롯 도입 때 기존 `history.summary(record,state)`/FIX12 경로를 유지해야 한다. unknown·누락 과거 기록은 기본 문구로 폴백한다.

Graft 1회는 다른 작업트리의 부정확한 lexical 결과를 반환해 의미 근거로 사용하지 않았다. 정확한 steward 작업트리 source 9파일/14구간을 직접 SHA와 대조했다. 도구가 보고한 절약 추정은 9,129 tokens이나 실제 유용 검색 성공으로 세지 않는다.
