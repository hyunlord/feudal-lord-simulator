# 실행 전 읽기 전용 점검

**LOCAL_PREFLIGHT_PASS — 기존 명령의 옵션·소스·동기화 계약은 맞다. 원격 실행환경·시작 성공·완주는 아직 확인하지 않았다.** Mac 읽기/해시만 수행했고 SSH·엔진·시뮬레이션 실행0이다. 기존 helper 수정0.

## 확인 결과

- 현재 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. `git status --short --untracked-files=no`와 `git diff --stat HEAD` 출력이 비어 있다. 동시 작성자가 있으므로 실행 직전 부모 재확인을 대체하지 않는다.
- sourceManifest.ts의9개 소스SHA가 모두 현재 파일과 일치한다. verifySource()는 HEAD와 tracked src diff 및9SHA를 런타임에 검사한다. 모든 helper/지형파일이9핀에 포함된 것은 아니므로 별도 준비 해시를 동봉했다.
- v3 helper는 git 미추적이지만 무시되지 않아 `git ls-files -co --exclude-standard`에 나타난다. 공식 run.sh129–133의 동기화 목록에 들어간다. 수정/커밋 없이 기존 방식으로 전송 가능하다. V2_SHA256SUMS는 v3 증거로 쓰면 안 된다.
- `probeOptions.ts10–28`은 seed3, land 문자열, fixed, growth, years150, output을 받아들인다. resume는 거부한다. 새 land 문자열의 등록 검사는 options보다 newGameState/archetype 조회에서 수행한다.
- `stewardProbe.ts35–43`: DEFAULT_SCENARIO_ID campaign_market_town + mode lord + seed/land를 정상 newGameState에 전달한다. fixed에서는 정상 gameReducer의 set_estate_policy와 set_market_dues1000을 사용한다. 초기 controls에서 growth/1000/subsidies[]를 검증한다. 이후 policy/subsidy/dues bot명령을 걸러내며 규칙상 제어 변화는 drift/UNSUPPORTED로 처리한다.
- `newGame.ts66–88`은 실제 등록된 fen 지형의 buildArchetypeWorld 경로를 사용한다. `archetypes.ts15,70–81`에서 core:fen_drainage가 등록되어 있다. 성공 저장이 fen임은 실행 중 start/metadata에서 확인해야 하며 이번 정적 점검으로 성공 생성이라고 주장하지 않는다.
- years150은 targetYear1450. while calendar<1450, 마지막 checkpoint(final), summary.completedTarget는 stoppedFor=target_year와 year1450 모두 필요하다. abandoned/tick정지/signal은 부분실행이다. 일부 부분실행은 exit0일 수 있으므로 exit0 단독으로 완주 판정 금지. 600000tick/150 annual rows도 결과에서 확인한다.
- 로컬 `.remote/seed3-fen-fixed-growth` 없음. 원격 경로 부재는 조회하지 않았다. 공식 run.sh는 `.remote/`를 전송에서 제외하며 helper는 출력폴더를 만든 뒤 비어 있지 않으면 거부한다. 기존 자료 덮어쓰지 않는다.

## 대조한 명령 — 실행하지 않음

```sh
scripts/remote/run.sh astra-steward-seed3-fen-growth-r08 --detach --keep -- timeout --signal=TERM --kill-after=30s 2400s nice -n 19 node_modules/.bin/tsx output/steward-probe-v3/stewardProbe.ts --seed 3 --land core:fen_drainage --mode fixed --policy growth --years 150 --output .remote/seed3-fen-fixed-growth
```

명령 인자는 현재 코드와 일치한다. 공식 runner의 node_modules 준비 후 tsx를 사용하며 cache/runtime 실제 존재는 부모 원격 실행에서 확인한다. wrapper가 nice10으로 scope를 시작해도 명령의 nice19가 낮은 CPU 우선순위를 적용한다. timeout2400초+TERM유예30초, SIGTERM에서 helper는 stopping을 세우고 루프 후 final을 기록하려 한다. 강제 KILL/호스트 오류 때 final·summary 존재를 보장하지 않는다.

## 기존 명령만으로 빠지는 증거와 부모 책임

1. **사전/사후 source·helper 전체 해시**: helper는 실행 전9핀만 확인하고 metadata에 저장한다. 실행 후 전체 src/지형/helper 해시 검사파일은 만들지 않는다. 부모는 기존 실행 장부에서 SOURCE_SHA256SUMS와 이 준비 핀을 실행 전·후 대조해 남겨야 한다. 동기화 중/실행 중 불일치는 결과 채택 보류다. 여기 해시 파일은 로컬 절대경로이므로 원격 root에 맞춘 상대경로 대조가 필요하다.
2. **실제 라이프사이클**: remote-exec.sh가 systemd scope, PID/unit, timing.env, exit-code를 만든다. 종료 뒤 scope inactive/dead 및 본인 PID/포트 정리는 부모가 조회해야 한다. 다른 세션 scope는 건드리지 않는다. 이번 preflight는 원격 생존 상태를 확인하지 않았다.
3. **부분실행/완주 구분**: exit-code, run.log, summary.stoppedFor/completedTarget, final tick/year, annual 개수, controls, save-checks를 함께 회수한다. 40분 초과를 성공으로 바꾸지 않는다. resume 지원이 없으므로 자동 재실행하지 않는다.
4. **범위**: 기존 invariantFindings·codec 결과는 관측한 검사의 범위다. 현금·물자·권리 전체보존, 모든 UI/재미/정책 인과의 완료로 확장하지 않는다. seed2chalk N04는 v2/full·실제growth→revenue이므로 fixed 비교군 아님; 비교 기준은 seed3openfixedgrowth v3다.

AGENTS.md 원격 규칙 및 docs/REMOTE_RUNS.md를 재대조했다. 기존 공식 명령은 실행가능 형태지만 위 라이프사이클/사후해시를 부모가 기록하는 조건으로 ready다. 새 wrapper/소스변경/실행은 하지 않았다. Graft 선행 조회 절감 추정5,247 tokens.
