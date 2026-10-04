# 습지 seed3 성장판 비교 준비

새 습지 결과를 읽기 전에 비교 지표를 고정했다. 기준은 `inherited/R07/long-run/seed3-open-fixed-growth`의 HEAD5fb1aeb, seed3, fixed growth, dues1000, subsidies[]다. **같은 seed의 두 실행 경로 비교이며 지형의 직접 인과 효과·재미 판정은 아니다.** 실행·SSH·엔진 변경·새 probe 구현 없이 기존 JSON을 Ruby로 읽었다.

## 시간창과 비교 허용 조건

150개 행의 periodYear는1300–1449이고 각각 다음 해 경계1301–1450의 상태를 담는다. 1300행의 명령·역사 집계는 tick[0,4000), 인구·금고 등은 tick4000의 스냅숏이다. 경계 금고를 해당 해의 수입으로 부르지 않는다. 개방지 baseline은 tick600000/1450 완료이며 연간 명령 합이 commands.jsonl과 일치한다.

습지 metadata의 실제 archetype, seed/방침/통제, source SHA, probe 버전을 먼저 확인한다. 종료·제어 드리프트·누락 연도가 있으면 같은150년 결과로 비교하지 않고 완료된 공통 기간과 중단 부분을 구분한다. 결과 차이는 fen−open, 비율은 open이0이면 계산하지 않는다. 25년 블록은1300–1324,…,1425–1449로 고정한다.

## 경량 기준값 검산

| 지표 | 개방지 기준 |
|---|---:|
| 연간 행 / 마지막 tick | 150 / 600000 |
| 최종 인구 / 주택 / 거주 주택 | 768 / 24 / 24 |
| 최종 금고(페니) / 영주 목재 | 118342 / 0 |
| 최종 foodReserveTicks | 5662 |
| 명령 시도 / 참조 변경 | 324 / 210 |
| asked / own | 202 / 8 |
| 시도0 / 변경0 / asked0인 해 | 0 / 0 / 0 |
| 최다 연간 시도 / 변경 | 117 / 8 |
| 변경5회 이상 / 시도5회 이상인 해 | 1 / 2 |
| pauseTicks 합 | 102 |

시도324−변경210=114의 차이는 성공률이나 재미가 아니다. 1300년 소송 증거 추가 반복이 시도 밀도를 키운 기존 관측을 보존한다. ‘빈 해’는 시도0·변경0·asked0을 각각 말하며 사건0과 같지 않다. ‘과부하’ 대신 **많은 명령의 해**를 기술한다. 변경≥5/년은 이번 비교용 임의 기준이며3·5·10을 함께 민감도 표로 제시한다. 실제 attention 부하/용량이나 사람의 부담은 수집되지 않았다.

경제곡선은 population/treasury/timber/foodReserveTicks와 buildings/stocks/tradeStock/actorFunds/집 수를 별도로 그린다. 연말 표본 평균은 시간 가중 평균이 아니며 금고 증분은 순잔액 차이뿐이다. 기존 추적기에는 연간 총수입·총지출·물자 보존 증명이 없다. 첫 표본은 시작값이 아닌1301경계다. 초기 금고 대비 전체 변화가 필요하면 start 저장의 금고/원장을 별도로 검증한다.

## 사망·영지·세력·직업 범위

최종 retainedDeathsByCause는 age2127, famine346, famine_year11, plague413, fire7, 합2904다. 연간 누계 차분에 음수는 없으며 시작 저장에는 persons.past가 없다. BASELINE_ANNUAL에는 원본150행과 차분을 담았다. **차분 명칭은 보존 사망기록 순증감**이다. 기존 분석이 최종 고유 ID/deathYear까지 맞춘 사실은 승계하되 이번에는 큰 최종 저장을 다시 전수 심사하지 않았다. 새 습지에서 보존 삭제/범위 차이를 확인하기 전 차분을 실제 발생 사망 수로 단정하지 않는다. age를 모두 노환으로 번역하지 않는다. 사망률 분모인 노출 인구·인년과 전 세계 인물 집합이 없으며, 연말 인구나 전체 누적 사망으로 사망률을 만들지 않는다.

영지4개는 실제 ID별 명의·점유·annualValue와 조각별 ID/명의/점유/loss를 비교한다. 명의와 점유, 영지 전체와 조각 권리를 합치지 않는다. annualValue는 설정/평가값이지 금고 수입이 아니다. 연말 관측 변화는 연중 모든 이전이나 취득 원인을 증명하지 않는다. 소송 closed·약속 kept를 영지 취득으로 바꾸어 말하지 않는다.

세력9개는 관계 최소/최대/최종과 관측 수장 ID·인접 경계 교체 수를 비교한다. 한 해 안의 교체·복귀는 놓칠 수 있다. 직업15종의 값은 trades.households를 tradeId별로 센 **가구 수**다. 도시 전체 사람의 occupation·고용률·생산량이 아니며 inventory와 tradeStock도 별도다. 이 경계별 기준값은 BASELINE_SUMMARY에 보존했다.

registry/history/receipt는 유지된 기록 수와 ordinal을 구분한다. 연간 retained 스냅숏 합을 총발생 수로 계산하지 않는다. 자연 만료·선택 로그는 각각 기록한 부분집합이다. commands는 가능한 모든 선택지나 플레이어 체험을 대표하지 않는다.

## 코드 근거와 산출물

- probeMetrics.ts:13–45: 스냅숏 필드와 집계 모수. retainedDeaths는 persons.past의 !alive, 직업은 trades.households, livingTownPeople는 manor 제외다.
- stewardProbe.ts:35–47·61–69: 초기 fixed 통제와 bot policy/subsidy/dues 명령 제외.
- stewardProbe.ts:140–151: attempted 증가, reducer 참조 변경, asked 분류와 명령 로그.
- stewardProbe.ts:175–178·200–208: pause 이유와 연간 반개구간 집계, 연말 스냅숏.
- lordBot.ts:35: ASKED_KINDS. asked는 실제 사람의 질문 횟수가 아니다.

CONTRACT.json에 원시필드·공식·미수집 값·비교 중단 조건을 명시했다. BASELINE_ANNUAL.json은 약0.75MB의150개 행으로 경량 재검산 가능하며 BASELINE_SUMMARY.json은 주요 지표/6블록·세력/직업 기준이다. 입력과 읽은 소스 SHA는 INPUT_SHA256.json에 있다. baseline의 자체 장기실행 검수와 달리 이번 설계는 시뮬레이션·최종 저장·전체 불변식을 재실행하지 않았다. 습지 결과를 본 뒤 기준을 유리하게 바꾸지 않는다.
