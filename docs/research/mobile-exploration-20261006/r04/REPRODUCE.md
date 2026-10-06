# 실험 재현과 경량 원자료

게임 실행은 prototype/RUN.md를 따른다. 아래 리그 명령은 이 ZIP을 푼 최상위 폴더에서 실행한다. Node22 이상, 포함된 사전 빌드 `dist`를 사용하며 패키지 설치는 필요 없다. 31,680경기의 전체 재실행은 작은 게임 실행보다 훨씬 오래 걸린다. Mac에서 로컬 순차 배치로 수행했고 DGX는 사용하지 않았다.

## 기본 리그

```sh
node prototype/league-batches.mjs
node prototype/dist/league/analyze.js --kind duel --input records/league-run --out records/league-analysis
node prototype/dist/league/analyze.js --kind multi --input records/league-run --out records/league-analysis
```

배치 실행기는 100경기 단위, 경기 사이30초 상한 검사, 이미 완료된 동일 소스·스케줄 자료는 hash 검증 후 재개한다. 하나의 동기 게임을 중간에 강제 중단하지 않는다. 중간 실패 뒤 동일 명령을 다시 실행하면 이미 완료한 배치를 검증하고 다음으로 넘어간다. 다른 source hash의 결과를 같은 폴더에 섞지 않는다. 상세 evidence/R04_RUN_CONTRACT.md.

단일 경기 재현:

```sh
node prototype/dist/league/run.js --kind duel --replay-index 0
```

## 보충 실험

다음은 각 kind의 0~99번 작업을 실행하는 예다. 범위·총수는 growth625, challenge2160, diplomacy400, geometry5. 출력의 `next`를 다음 `--start`에 넣어 계속한다. 이미 완료된 같은 범위는 내용 해시를 확인한다.

```sh
node prototype/dist/league/supplement.js --kind growth --plan no --freeze-hash 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a --start 0 --count 100 --out records/supplement-final
node prototype/dist/league/supplement-analysis.js --kind all --in records/supplement-final --out records/supplement-analysis
```

이 해시는 보충 실행 소스를 포함한다. 기본 리그의 `3b40f466ab6adc1d88df07b5a585270fe8b0fa322c0fcbc5e637f67d3d36d100`, 저장 모델의 `ef5f2dfdd1d29d6b307f0f463e43fce332270337045917accf71bf244caf8007`와 범위가 달라 서로 같을 필요가 없다. 모델 파일 교집합은 같다.

## 무엇을 경량화했나

기본 리그의 경량 outcomes gzip에는 **모든 경기**의 ID·seed·지형·시점·좌석·전략과 성장/대외/회복 시점 인구·자원·자기 에스크로·V·정책·시설 수, 전투별 결과·결정 수를 넣었다. 전체 승무패·목적함수9민감도를 다시 계산할 수 있다. 개별 가구·시설 전체 좌표·원장 사유별 상태는 깊은 원자료에 남겼다. 공간/원장 거리 지표를 세부 재검산하려면 고정 소스·스케줄을 재실행하거나 아래 로컬 원자료를 사용한다.

원 작업 폴더:
`/Users/rexxa/fls-astra-mobile/mobile-study/records/league-run/`
`/Users/rexxa/fls-astra-mobile/mobile-study/records/supplement-final/`

이는 원래 작업한 컴퓨터의 경로이며 ZIP을 받은 다른 컴퓨터에는 존재하지 않는다. 필수 플레이·최종 성적 읽기에 이 경로는 필요 없다. 리그 분석 JSON의 coverage.batches와 보충 verified-files 목록에 원자료 파일별SHA를 보존한다. 대형 경로 최적화 임시 golden 파일과 node_modules는 제외했다.

소스 수정 후에는 정본 결과와 달라진 실험으로 취급한다. 모델 수정 시 build-identity 생성기를 다시 실행하고 컴파일한다. 원래 평가 seed에서 결과를 보고 조정한 판을 독립 검증으로 부르지 않는다.

검증 환경은 Node25.8.2/macOS ARM64다. Node22는 API 기준 최소 요구 버전이며 이번에 별도로 실행 검증한 버전은 아니다. 위 analyze 명령은 경량 outcomes를 바로 읽는 명령이 아니라, 앞 단계에서 재생성한 `records/league-run`의 깊은 원자료를 읽는다. outcomes는 점수/민감도를 재계산할 필드를 제공하지만 별도의 outcomes 전용 집계 CLI는 동봉하지 않았다.

보충 원자료는 `supplement-raw/`에 전부 동봉했다. 재시뮬레이션 없이 검증·재집계할 수 있다:

```sh
node prototype/dist/league/supplement-analysis.js --kind all --in supplement-raw --out supplement-rechecked
```
