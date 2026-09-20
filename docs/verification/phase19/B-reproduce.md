# Phase 19 — B 측정 재현 및 경계

`paired-work-benchmark.mjs`는 이미 설치된 Playwright Core와 Chrome을 사용한다. 새 의존성을 설치하지 않는다. 아래 작업 트리를 각각 Vite `--host 127.0.0.1 --strictPort`로 실행한다. 제품 파일은 수정하지 않고 저장 상태·카메라·과거 계측을 HTTP 응답에만 넣는다.

| 변형 | 커밋 | 포트 |
|---|---|---|
| 과거 기준 | b8ed6504f465b9cf38dfdd753d8e15743465d945 | 3252 |
| A 주택 후보 | a5c1b55d124b59de9b8d9bacab2830955886adab | 3253 |
| C 도로 후보 | 94a2e4c7129ec6e1323e8706ba2c5e682ffdcf34 | 3254 |
| 현재 제품 | 398174c8cddeae010c63086f7cf643176dcef302 | 3243 |

이 폴더에서 다음 명령을 DPR 1·2, condition `paused`, `running`, `drag`로 각각 실행한다. `FLS_BASE`, `FLS_CANDIDATE`, `FLS_STATE`, `FLS_PLAYWRIGHT`는 해당 로컬 절대 경로다.

```sh
node paired-work-benchmark.mjs --task A --dpr 1 --condition paused \
  --before-root "$FLS_BASE" --after-root "$FLS_CANDIDATE" \
  --before-url http://127.0.0.1:3252/ --after-url http://127.0.0.1:3253/ \
  --state "$FLS_STATE" --adapter ./historical-work-adapter.mjs \
  --playwright "$FLS_PLAYWRIGHT" --output ./local-results
```

C는 task/후보 작업 트리/포트를 C/94a2e4c/3254로 바꾼다. 현재 제품은 before/after 모두 398174c·3243, `--single true`, adapter 인자 제거. 8채 입력은 `tests/fixtures/phase16-city.json.gz`(압축 해제 SHA `183c1fa74b4cac58d97e73eb431df1ed534ccad8fe490fbd554f86aa89e64732`). 16채 입력은 C 실행의 final-state(요약 데이터에 SHA 포함)다.

16채 입력은 제품 소스 `398174c` 루트에서 다음과 같이 재생성한다(장시간 자연 시뮬레이션이며 CPU 측정과 동시에 실행하지 않는다).

```sh
./node_modules/.bin/tsx scripts/phase19NaturalGrowth.ts 16 600000 ./output/phase19/reproduce-growth16
```

생성된 `./output/phase19/reproduce-growth16/final-state.json`을 `--state`에 전달한다. 파일 SHA256 기대값은 `a23a6fd8e8555262d750c7c860927b0650d9bbc354a9c1b478ce556d61a8a1e1`이다. CLI 종료코드0은 내부 실행 실패가 없다는 뜻이며 자연 성장 C의 수용량·안정 기준 통과를 의미하지 않는다.

- 각 조건 3회×240그리기, 첫 회 폐기. 과거 비교는 A0 B0 A1 B1 A2 B2 순서, 현재 도시는 N0 N1 N2. 정렬 표본의 `floor(n/2)` 값(짝수는 위쪽 중앙값), p95는 `floor(n*.95)` 값을 모든 변형에 동일 적용한다.
- 최초 A/DPR1 세 조건은 `paired-work-benchmark-initial.mjs`; 이후 버전은 측정 전 visibility/DPR 필드·검사만 추가했다. 첫 버전 SHA `5424d9052342db74018e43a74cbf71b2708ab3fcc936ff527c7621f8a197468c`. 세 번째 조건의 종료 시 파일 SHA와 실제 시작 시 버전이 달라 요약에 둘 다 보존했다. 측정 루프는 동일하다.
- `proof-work-runtime.mjs`는 계측 커밋 743646e의 `proofFrameWork.ts`를 Node `stripTypeScriptTypes`로 변환한 동일 수집기다. 출처·SHA는 `instrumentation-source.json`, HTTP 변환 입출력 SHA는 요약에 있다.
- 링버퍼는 채널별 240개. 틱 회수는 40그리기 간격, 계수 차이와 수집 개수를 대조한다. 진단 스냅샷 비용은 frameWork 밖이지만 rAF에는 영향을 줄 수 있다. React 상태 스냅샷 tick은 커밋 지연으로 실제 advanceTick 계수보다 늦을 수 있으며 `snapshotCountDifference`에 보존했다. 이를 틱 유실이나 동일 진행량으로 표현하지 않는다.
- 전체 테스트·다른 QA 종료 후 직렬 측정. 기존 OS/Orca/사용자 브라우저와 2~3일 된 다른 작업의 낮은 부하 Chrome은 보존했다. 엄밀한 OS 격리 실험은 아니다. 브라우저·기기·회차별 수치는 요약에 기록했다. GPU 원인을 추적하지 않았다.
