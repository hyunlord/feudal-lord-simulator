# 습지 seed3 고정성장 150년 — 독립 완주 감사

판정: **PASS_BOUNDED_150_YEAR_COMPLETION**. 보존된 공식 실행 결과는 seed3 / core:fen_drainage / fixed growth / dues1000 / 장려금 없음으로 tick0에서600000, 1300년에서1450년까지 도달했다. 공식 exit0·1187.0초와 관측기1184초를 구별한다. 엔진을 재실행하지 않고 동결25파일의 SHA, 원시9저장,150연간 행,819명령,38codec 기록 및 소스/수명주기 근거를 대조했다. 경량 검사232항목 통과다.

## 실제 결과와 경계

|항목|독립 확인|범위|
|---|---|---|
|실행 신원|metadata/summary HEAD5fb1aeb, seed3·습지·150년·고정growth 일치. 공식 run.log/exit/timing과 가져온 바이트 동일|공식 .remote-runs/astra-steward-seed3-fen-growth-r08-5fb1aeb의 로컬 보존물 읽기. 새 SSH 없음.|
|개시/종료|실제 start tick0, final600000, campaign scenario·fen archetype, 원시 상태 통제 일치|newGameState의 시작 이후 정책 설정은 관측기 opening 함수에서 수행되며819 command 로그 밖이다.|
|연간 연속성|150행 periodYear1300..1449, year1301..1450, tick4000..600000 4000간격, throughTickExclusive 일치|1300과1450을 모두 완전연도로 세어151년으로 늘리지 않는다.|
|명령/통제|819시도·306참조변경. 매년 로그를 tick구간으로 독립 재분류해 attempted/changed/kinds와 일치; 각 before/after와 모든 연말 growth/1000/[] 유지|stateReferenceChanged는 의미 있는 플레이어 결정이나 재미의 수가 아니다. 고정 통제는 실험 프로토콜이며 모든 영주 정책/자연 플레이를 대변하지 않는다.|
|최종 요약|연말 마지막 행과 summary.final의 모든 필드 일치. 별도 실제 상태에서 인구470·금고543952·재목금고0·집24·거주24·도시인물470·건물종류/재고·보존사망·history 카운터 재계산 일치|foodReserveTicks 등 엔진 함수 산출량은 summary↔annual 대조만. 모든 파생함수를 Ruby로 복제하거나 독립 실행했다고 하지 않는다.|
|현금/인구 보조검사|종점 가구 주민 합470, cash entries+rollups=treasuryCoin543952|종점 산술 일치이지 모든 중간 돈 이동이 원장에 기록됐다는 보존 증명 아님.|
|진행/진단|1000틱 간격600개 진행행 연속, 전부 findings0; summary.findings=[]|관측기 invariantFindings는1000틱마다 호출. 틱 사이 위반·모든 물자 이동·죽은 인물 명령거부를 검증하지 않는다.|
|저장 왕복|38로그: 시작1+5년마다 latest30+25년마다 명명6+final1. 모두 stateHash=decodedHash, exactJsonRoundTrip=true|실제 encodeSave→decodeSave 호출 순서는 stewardProbe.ts:73–84. 본 감사는 codec 재실행 없음. overwritten latest29개 바이트는 남지 않고 기록으로만 승계.|
|남은9저장|9개 모두 원시 JSON의 state 부분을 바이트로 추출, 파싱동일성 확인 후 SHA를 해당 마지막 codec로그와 대조. 저장 크기·tick·시나리오·통제도 일치|Ruby JSON 재직렬화의 숫자/순서 차이로 계산하지 않음. envelope cyrb53 checksum은 기록했지만 독립 구현하지 않음.|

보존사망 원시 집계는 age1963/famine607/famine_year8/fire9/plague289, 합2876이다. 이는 persons.past의 기록된 사망이며 전세계 사망률이나 원인 기전의 증명이 아니다. history는6250행만 남고 nextOrdinal42920이므로 마지막 history만으로150년 전체를 다시 세었다고 하지 않는다.

## 같은 틱의 세 저장

latest/year-1450/final은 모두 tick600000이고 **실제 state 전체가 같다**. 원시 상태 SHA는 `0b6072ab358f443c0c766e1cd44ee11d297a24b114a156c181986a9ffbe9cf89`다. 하지만 봉투의 savedAt이 각각 `01:57:32.990Z`, `01:57:33.283Z`, `01:57:33.437Z`여서 파일 SHA가 다르다. 봉투 다른 키의 차이는 없음을 직접 비교했다. 세 파일을 보존한 부모 판단이 맞으며 이번 감사도 삭제/병합하지 않았다.

- final 파일 SHA: `a606e61731eef3b571ad1d36e1df1aa3e3d671d892653009ef497d6b517bb285`
- latest 파일 SHA: `a1f172a2c74026ce926f7dd599b6e843a795832a685247bb4795fa62fb1845b6`
- year-1450 파일 SHA: `583cf273ea35c3989c59101e5c47972ce3d3d1fb3db2f2908973493e748ac579`
- start 파일 SHA: `1d5c05ed2082daef4bb2a827b55731fec000e9b2a94a8a4a60b9eb6696365c93`

## 소스·실험 수명주기

`SOURCE_BEFORE_SHA256SUMS`26핀과 실행 입력25핀, summary의 핵심9소스 핀은 현재 로컬 바이트와 일치했다.26→25 차이는 이전 로컬 unit-test.log가 공식 동기화에서 제외된 경계이며 `SYNC_BOUNDARY.json`에 명시되어 있다. 이 로그를 원격에서 다시 통과했다고 바꾸지 않는다.

**전체 src1095핀은 사전 전체 핀이 아니라 실행 중에 캡처한 목록이다.** `FULL_SOURCE_DURING_NOTE.json`을 읽고 구별했다. 이 목록의 현재 로컬 SHA 및 원격 보존 검사 during1095/after1095가 모두 OK이며 실행 입력 before25/after25도 모두 OK다. 따라서 전체1095를 사전·사후 모두 독립 해시한 것처럼 요약하면 안 된다. 디스크 SHA는 메모리 모듈 캐시 trace가 아니다. 원격40변경경로 표시는 untracked helper들이며 부모 해설/empty tracked diff와 구별한다.

공식 로그의 바깥 runner nice10과 실제 관측기 명령 `nice -n 19 ...stewardProbe.ts`를 구별했다. timeout2400s 내 정상 exit0. END_SCOPE.txt는 inactive/dead, PID 표는 헤더만 남은 종료 기록이다. 타 세션 전체 스케줄을 새로 조회하거나 remote port를 재검사하지 않았다.

등록기에는ck_evt_050의439000 기다림→deadline440000→441000 lapsed 기록이 있고 reason=null, 통제는 그대로다. history 상관관계도 settled_tick+entry+template이며 유일 occurrence ID로 묶인 직접 이벤트라고 하지 않는다. 이 실행의 의도된 lapse는 정책 고정 실험의 일부분이고, 등록기 전체 기한 정확성/다른 사건들의 정상성까지 입증하지 않는다.

## 남는 한계와 인계

완주와 보존된 기록의 내부 정합은 지지된다. 전체 경제/권리 이동의 보존, 모든 중간 tick 불변식, 모든 사망자 행동 거부, 두 번 실행한 결정론, UI·재미·정책 우월성·단일seed 지형인과는 미검증이다. 기존 알려진 결함이 해결됐다는 보고도 아니다. 장기 비교·신규 심각도 최종 판정은 별도 담당 범위다.

원자료는 `long-run/seed3-fen-fixed-growth/`, 수명주기는 `records/fen-run-lifecycle/`. 세부 검사는 CHECKS.json, 읽은 파일의 핀은 INPUT_PINS.json, 재실행 가능한 경량 검산은 check.rb다. 요구사항 감사 동결본과 원본 실행 파일은 수정하지 않았다.
