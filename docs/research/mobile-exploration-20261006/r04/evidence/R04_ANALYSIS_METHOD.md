# R04 리그 분석기 방법과 재현

분석 소유 범위: `prototype/league/analyze.ts`, `analysis-{input,files,summary,outcomes}.ts`, `prototype/tests/analysis{,-files}.test.ts`. 게임·봇·규칙·schedule·runner를 바꾸지 않았다. 의존성을 추가하지 않았다. 평가 seed는 이 작업에서 실행하지 않았으며 검증은 training seed 1의 smoke만 사용했다.

## 실행

`mobile-study` 폴더 기준, 기존 TypeScript 컴파일러가 있을 때:

```sh
../node_modules/.bin/tsc -p prototype/tsconfig.json
node --test prototype/dist/tests/analysis.test.js prototype/dist/tests/analysis-files.test.js
node prototype/dist/league/analyze.js --kind duel --input records/league-run --out records/league-analysis
node prototype/dist/league/analyze.js --kind multi --input records/league-run --out records/league-analysis
```

배포 ZIP의 컴파일된 `dist`가 있으면 두 `node ... analyze.js` 명령만으로 실행한다. 소스 provenance도 확인하므로 `prototype/model`, `prototype/league`, `tsconfig.json`을 함께 보존한다. 분석 출력은 `<kind>-analysis.json`, `<kind>-analysis.md`, `<kind>-outcomes.ndjson.gz`다. 새 출력 디렉터리 사용을 권장한다. 오류가 나면 임시 gzip은 남을 수 있으나 완료 outcomes 파일로 이름을 바꾸지 않는다.

기본은 duel 11,880판 또는 multi 19,800판 전부 없으면 오류다. `--partial true`는 중간 점검 전용이며 JSON `coverage.complete=false`와 누락 구간을 표시한다. 일부 seed에서 특정 전략이 전혀 없는 불균형 부분 자료는 bootstrap 단계에서 거부될 수 있다. 부분 자료로 최종 균형을 판단하지 않는다. `--kind smoke`는 별도의 training 1판 데이터 검증 경로이며 최종 리그가 아니다.

## 자료 무결성

- provenance의 소스 목록을 직렬화한 SHA256을 검사하고 목록에 있는 현재 소스의 SHA256을 전부 대조한다. 세션 UI 파일은 runner의 사전 고정 제외 목록을 따른다. 필수 모델/runner 소스 누락, 중복·경로 이탈은 거부한다.
- 저장 schedule이 현재 고정 schedule 전체와 같고 hash·총수가 맞아야 한다. 단순히 결과에 등장한 ID 수를 세지 않는다.
- 모든 manifest의 kind/sourceHash/scheduleHash·batch 경계·파일명·시작/끝·수·정확한 ID 목록을 검사한다. 겹친 구간, 범위 밖, 원자료만 있는 orphan은 거부한다.
- gzip 파일은 각각 SHA256 확인 후 줄 단위로 읽는다. 각 줄이 정확한 scheduled game ID/block/rotation/spec와 맞고 각 단계 좌석/전략 매핑·시각, 12회의 순환 처리 순서가 맞아야 한다. 좌석당 명령 기회 12회(별도 breach 영수증 제외), 전투 건수와 raid/siege 결정 수의 일치도 확인한다.
- 소비하는 수치/배열/객체를 unknown에서 좁혀 읽는다. 인구는 0 이상 정수, 수치는 유한수이며 자원/정책/시설 수가 음수가 아니어야 한다. 각 단계 V를 법적 소유 재고(자유 재고+자기 escrow)로 다시 계산하여 저장 V와 불일치하면 거부한다. 안 쓰는 원자료 필드까지 완전한 runtime schema 검사했다고 주장하지 않는다.
- 결과 JSON coverage에 모든 입력 batch 파일명·SHA256·범위·수와 schedule/source hash가 남는다. 원자료는 고치지 않는다.

## 승패와 통계

주 분석은 회복 뒤 V다. 살아 있는 인구×12 + 식량 + 자재×2 + 공구×4 + 은화. escrow는 원 소유자에게 한 번 합산한다. 이 시제품에는 별도 확정 채권·채무가 없어 가상의 가감항을 만들지 않는다. 한쪽만 인구 0이면 패배, 둘 다 0이면 무승부. 그 밖에는 평균 절대 V의 1% 이내를 무승부로 둔다. 1:1에서 원시 승/무/패와 `(승+무×0.5)/경기` 승점률을 함께 쓴다. 55% 초과 관찰, 60% 초과 위험 후보이며 승점률과 문자 그대로의 승리 비율을 섞지 않는다.

`metrics.ts`의 고정 seed bootstrap을 재사용한다. 2,000회 전체 평가 seed 블록을 공동 재표집하여 전략별95% 탐색 구간과 매 재표집의 최고 전략 성적 분포를 기록한다. 경기 한 판을 독립 관측으로 재표집하지 않는다. 독립 seed 6개뿐이므로 상한이60% 이하라도 지배전략 없음의 확증이 아니다. 다자는 독립 seed 2개라 구간을 부풀리지 않고 분할 우승률·좌석/지형/seed 성적을 보고한다.

1:1은 전략별 지형·성장 시점·좌석·상대와 지형×시점×좌석별 승점률도 출력한다. 전체 schedule이 균등하므로 단순 전체 승점률이 사전 계약의 상대·지형·좌석·시점 균등 가중과 같다. 다자 정규화 순위는 나머지3도시 각각과의 승점(1/0.5/0)의 평균이며 높은 값이 좋다. 우승 비중은 최상위 살아 있는 도시와1% 이내인 동률 후보 사이에 분할한다. 전멸 판은 전원 동률이다. 4도시 균등 기대25%이며 1:1의60% 문턱을 재사용하지 않는다.

민감도는 인구값6/12/24 × 자원배율0.5/1/2의9가지다. 동일 종료 상태에서 승점률·우승 비중만 재계산하며 게임을 다시 실행하거나 유리한 표본을 고르지 않는다. 전 전략 값은 JSON, 각 식의 선두는 MD에 기록한다.

## 성장·다양성·전쟁

성장/대외 직후/회복 뒤의 인구·V·자원·escrow·축별 시설·원장 자원 흐름 평균을 전략×지형×시점×단계로 기록한다. 해당 schedule의 반복 상대/좌석 빈도 가중 평균이므로 독립 성장 실험으로 오해하지 않는다. 성장→대외, 대외→회복, 전체 V와 인구 변화도 별도 집계한다.

상위25%는 다자 각 판의1위이며 동률은 분할한다. 주된 정책축 동률도 분할하고 축8개 기준 정규화 Shannon entropy, 전체 참가 기준 분포, 전체8차원 정책 벡터 분포를 함께 남긴다. 또한 각 판 모든 도시쌍의 정책/시설 구성/공간/원장 흐름 거리를 평균한다. 거리는 각 벡터의 절댓값 합으로 정규화한 뒤 L1/2다(둘 다0이면0). 공간은 살아 있는 시설 중심을21×21 지도 위3×3칸씩, 총7×7bin에 센 히스토그램이다. 도로·모든 동선의 인과성을 검증하는 지표는 아니다. 흐름은 원장 사유×자원 부호를 보존한다. 시설 거리의 크기 하나로 '다른 게임 같다'를 통과시키지 않는다.

공격 전략×raid/siege별 출정 수·목표 확보율·총/평균 순자원·약탈 평가액·양쪽 인명 손실·노출·단계·동원 인원, 방어 저지율을 구분한다. 비출정과 유상 평화 유지는 대외 기회(참가 도시×12) 분모로 따로 보고하고 군사 패배로 세지 않는다. breach는 추가 기록이므로 명령 기회 분모를 늘리지 않는다. 외교 receipt 종류별 수를 합산하지만 이 집계가 별도 ON/OFF 인과 시험을 대신하지 않는다.

## 경량 감사 원자료

`<kind>-outcomes.ndjson.gz`는 모든 경기 ID/seed/지형/성장시점/rotation/전략, 세 단계의 인구·자원·자기 escrow·V·정책·시설 수, 전투별 결과, 좌석별 결정 수와 외교 receipt 수를 보존한다. 종료 성적 및9개 민감도를 독립 재계산할 수 있다. 깊은 시설 좌표·가구·원장 전체는 로컬 원본 gzip에 남으며 경량 묶음에서는 빠진다. 공간/흐름 거리의 세부 재검산에는 원본 또는 고정 소스·schedule의 재실행이 필요하다. 경량 자료를 전체 원본이라고 부르지 않는다.

## 검증 기록

2026-10-06: 기존 엄격한 tsc 통과, 분석 전용 테스트3개 통과. 실제 compiled runner가 training seed1 smoke를 생성하고 compiled 분석 CLI가1/1 ID·hash·V·순서 검사를 통과해 JSON/MD/gzip를 만들었다. 테스트는 원자료 SHA 변조 거부, V 변조 거부, 1:1 승점 보존 및9개 민감도를 검사한다. 사례 출력: `records/analysis-smoke-output-v2/`. 이것은 분석 파이프라인 증거이며 평가 리그 완주나 좋은 밸런스의 증거가 아니다.
