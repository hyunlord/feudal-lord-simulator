# 다음 장기 실행 후보 — 설계만

**추천 한 조합: seed3 / core:fen_drainage / fixed growth / campaign lord, 1300→1450.** 구성상 지원되는 지형·양의 정수 시드다. 이 정확한 시작 상태 생성 성공·완주는 아직 실행하지 않아 미검증이다. 새 실행0, 소스수정0. 실패하면 임의 다른 지형/시드로 바꾸지 않는다.

기존 고정 방침 범위는 v3 seed1 open growth/stability와 v3 seed3 open growth/stability다. seed2 chalk은 N04-chalk-2-full/v2 완주이며 config.policy가 growth여도 policyArgumentApplied=false, 실제 growth→revenue, 정책명령5회이므로 고정growth 비교군이 아니다. chalk은 지형 실행 이력으로만 센다. 현재 long-run-inheritance/COVERAGE.json에서 이 구분을 확인했다. `river`라는 새 이름을 만들어 추가하지 않는다. 실제 강변 지형 ID는 기존 `core:open_field`이므로 새 river 실행은 지형 범위를 늘리지 않는다. 반면 습지는 실제 별도 ID `core:fen_drainage`이며 새 후보로 유효하다.

## 무엇이 추가되는가

archetypes.ts15,70–81: fen은 물 비중330/1000, 돌5, 숲70, 2~4칸 강, arable1150/pastoral1100/timber800/flood2500 규칙을 갖는다. 기존 open은 계수1000, chalk은 flood600이다. 습지의 적은 육지·돌, 다른 생산 계수, 큰 습한 여름 수확 손실 계수가 장기 시장도시·배급/물자/자율개발/인물 기록 경로를 추가한다. eventSchedule.ts264–271에서 flood계수가 실제 wet-summer 수확 조정에 쓰이며, tick.ts237–238에서 drainage 단계도 존재한다.

배수 단계가 있다고 실제 배수 공사가 발생했다고 주장하지 않는다. 기존 helper는 그 모든 내부 상태를 매틱 기록하지 않는다. `start`/25년 체크포인트/최종 저장과 기존 annual/commands로 실제 생성·사건·배급·물자 지표를 확인한 뒤, 필요할 때만 작은 별도 관측을 설계한다.

seed3을 유지하면 기존 seed3/open/growth와 같은 방침·시드 번호를 맞추면서 **새 지형 축**을 추가할 수 있다. 같은 시드여도 지형 생성·인물·사건·상속 경로는 달라지므로 지형 효과의 직접 인과 추정이나 정책 수익 비교로 쓰지 않는다. 이번 후보는 새 seed를 추가하는 목적이 아니다.

150년은 새 지형에서 후기 사건·수확·성장·후계 누적의 상호작용까지 한 번 확인하기 위해 제안한다. 이미 완료한 open 조합 재반복이나 모든 지형×모든 시드 양산을 제안하지 않는다. 기존 v3 helper는 --resume을 거부하므로25년 선행 실행 후 동일150년 재시작을 자동으로 붙여 계산을 중복하지 않는다. 부모가 기간을 줄이면 부분범위로 명시한다.

## 기존 helper의 정확한 호출

아래는 **미실행 제안**이다. 부모가 공식 DGX runner 한 개를 직렬 실행한다.

```sh
scripts/remote/run.sh astra-steward-seed3-fen-growth-r08 --detach --keep -- timeout --signal=TERM --kill-after=30s 2400s nice -n 19 node_modules/.bin/tsx output/steward-probe-v3/stewardProbe.ts --seed 3 --land core:fen_drainage --mode fixed --policy growth --years 150 --output .remote/seed3-fen-fixed-growth
```

정확 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`, DEFAULT_SCENARIO_ID=`core:campaign_market_town`, mode lord는 기존 opening()이 지정한다. fixed는 정상 gameReducer로 growth/dues1000을 정하고 subsidies[]를 검증한다. 기존 bot 응답 허용목록과 fixed 제어 유지 계약은 그대로다. helper를 수정하거나 새 명령을 넣지 않는다.

준비 조건:

1. 로컬/원격 HEAD와 sourceManifest의9개 핀·tracked source clean 확인. 이번 폴더 SOURCE_INPUT_SHA256SUMS의 실제 v3 helper와 지형 관련 소스도 대조한다. `V2_SHA256SUMS`는 v2 파일 목록이므로 v3 준비물 해시로 대신 쓰지 않는다.
2. 공식 runner가 무시되지 않은 v3 helper 폴더 및 필요 소스를 동기화했는지 확인. 원격 포트는 runner 제공 FLS_REMOTE_PORT, 4173 플레이 서버 불접촉. 기존 본인 실행/포트/scope를 정리한 뒤 하나만 시작한다. 타세션 실행에 손대지 않는다.
3. `.remote/seed3-fen-fixed-growth`가 비어 있어야 한다. helper는 기존 증거 덮어쓰기를 거부한다. 재개 인자 사용 금지.
4. 시작 metadata/config/archetypeId가 실제 fen인지, opening null 없이 start.fls.json을 만들었는지 확인한다. 미지원처럼 실패한 시작을 임의 open fallback으로 바꾸지 않는다.
5. 완료 여부는 summary.completedTarget/actual tick600000/year1450/150 annual rows/exit/controls/codec 결과로 각각 확인한다. 시간초과·abandoned·invariant findings는 그대로 보존하며 완주로 계산하지 않는다. SIGTERM 종료는 checkpoint 가능성이 있지만 --resume 지원을 의미하지 않는다.
6. source/input/helper SHA 전후와 exit/runner timing/cleanup을 부모 실행 장부에 남기고 자료를 회수한다. v3 main은 source검증을 실행하지만 source-after/runner lifecycle 관리는 부모의 기존 공식 운영 절차로 수행해야 한다. 여기 새 wrapper는 작성하지 않았다.

## 시간 예상과 중단

실측 R07 seed3/open/growth helper seconds988, runner COMMAND_S990.5. stability helper967, COMMAND_S969.9. 같은 출처의 sync19.7/21.2초, prepare6.3/6.5초다. 각각 약16분으로, 전체 왕복 약17분이었던 실행이다. 이는 성능 벤치마크가 아니며 습지의 경로 탐색/인구/다른 동적 상태에 그대로 비례하지 않는다.

계획 예상 **15~30분**, 미측정 습지에 여유를 둔 범위다. 제안 timeout40분(2400초)+종료 유예30초. 시작 실패·실제 abandon·공식 tick 정지 때는 helper 결과를 기록하고 멈춘다. 단지 시간이 느리다는 이유로 모델 규칙이나 상태를 수정하지 않는다. 예상보다 오래 걸리면 partial로 회수하고 원인을 읽은 뒤 다음 결정을 한다.

## 근거·한계

- AGENTS.md104–117 / docs/REMOTE_RUNS.md: 무거운 실행은 공식DGX, Mac 우회 불사용, runner동기화/회수/port 계약.
- src/content/scenario/archetypes.ts11–15,70–81 / coreScenarios.ts84,95–112,155: 실제 등록 지형·campaign.
- src/state/newGame.ts67–86: archetypeById 조회 및 지형 생성. 구성 유효성과 실제 시작 성공은 다르다.
- output/steward-probe-v3/probeOptions.ts10–28: seed양수/years1~150/land/정책/fixed, resume미지원.
- stewardProbe.ts opening/main, sourceManifest.ts: 정상 새게임·제어·원자료·source핀.

이 문서는 후보와 준비 계약이지 추가 커버리지 완료 보고가 아니다. 코드 읽기/JSON 읽기/해시만 수행했다. Graft 조회 추정 절감31,379 tokens.
