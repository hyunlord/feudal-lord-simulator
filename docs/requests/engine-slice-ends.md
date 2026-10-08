# 렌더 A → 엔진: 수직 조각의 여는 쪽·끝 쪽이 쓸 것 (LM-R3 2단계, 2026-10-09)

수직 조각의 여는 쪽(`lordSliceStart`)과 끝 쪽 "이 도시가 내 결정의 결과인가"(`lordSliceOutcome`·`traceInRange`·`yearReview`·`decisionRemembers`)는 엔진이 주는 것만으로 만들었다(`src/ui/slice/`, 결정 LR3-D5·D6). 비어 있는 자리:

1. **오래된 해의 결정**: `yearReview(state, year)`가 흔적(trace)이 지닌 결정만 읽어, 20년 뒤 1300~1308년의 결정이 0으로 나온다(흔적은 10년을 지닌다; seed 3 영주 bot 판에서 가장 오래 남은 결정이 틱 38455). 요청: 흔적에서 빠진 결정은 연대기 기록에서 읽거나, 영주 모드에선 조각의 20년을 지니기. 지금 끝 쪽의 해마다 줄은 연대기의 결정 줄로 센다.
2. **시작의 도시와 세력**: 첫 틱의 도시(사람·집·금고)와 세력 관계를 남겨 두기(예: `lordSliceOutcome.start`). 지금 "그때"는 연대기 첫 철의 사람 수뿐이다.
3. **틱 0의 조각**: `newGameState({scenarioId: "core:lord_slice"})`가 세력과 이웃 가문을 틱 0에 앉히기 — 그러면 여는 쪽이 가문 단계 바로 뒤에 열린다(지금은 첫 재생을 누를 때; 틱 0의 이웃 이름은 자리표, 예: seed 3 "de Lisonde" → "de Heronel").
4. **본 영지의 값**: `lordSliceStart.home.annualValue`가 날것의 영지 값 0 — 화면은 영지 포트폴리오의 해마다 값(seed 3: 560d)을 쓴다. 요청: 같은 값을 주기.
5. **세력 기억이 접힐 때**: LONGRUN-1이 세력 기억을 3년으로 접으면 `decisionRemembers`가 처음 결정들을 잃는다 — 결정마다의 합을 남겨 두기.

출처: LM-R3 2단계(렌더 A, slice-ends), `docs/verification/lmr3/SLICE-REPORT.md`.
