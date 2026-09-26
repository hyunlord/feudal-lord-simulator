# REMOTE-1 DGX 원격 실행기 — 보고서

관문: ①회귀 2,944/2,944(Node 24 재확인 2,954/2,954) · ②가드레일 실행 성공 · ③브라우저 10/10 · ④동시 통과 · ⑤자원 제한 확인 · ⑥기준선 기록

Claude Code 작업이다. 스크립트·문서만 바꿨고 게임 코드는 0줄이다. 플레이 서버(4173)는 건드리지 않았다. 사용법은 [REMOTE_RUNS.md](../../REMOTE_RUNS.md)에 있다.

## 관문
| 관문 | 결과 | 근거 |
|---|---|---|
| ① `remote:test` | `6c5088f`에서 2,944/2,944, 459초. 결과가 Mac `.remote-runs/`로 돌아왔다. 첫 시도는 2,943/2,944였다. 실패 1건은 Part7이었고 `/usr/bin/google-chrome`이 없어서였다(사용자 sudo 링크 전) | run `remote1-gate1-6c5088f` |
| ② `remote:guardrail` | seed 1을 20,000틱 돌리는 데 10초. 요약과 최종 상태가 돌아왔다. 판정 `regression`은 짧은 실행을 120만 틱 기준선과 비교한 값이라 관문 판정이 아니다 | run `remote1-guardrail-6a83c46` |
| ③ `remote:browser` | Part7 10회 연속 통과(각 7.2~7.5초), 시간 초과 0 | run `remote1-browser-6a83c46` |
| ④ 동시 | browser 10회와 guardrail을 두 label로 동시에 돌렸다. 폴더가 따로, 포트가 4300·4301로 따로 잡혔고 가드레일 슬롯은 1/2였다. 둘 다 정상 결과. gate1과 clone-check도 동시에 돌려 둘 다 통과했다 | 위 run들 |
| ⑤ 자원 제한 | `systemctl --user show`: `MemoryMax=51539607552`(48G), `CPUQuotaPerSecUSec=12s`(12코어), `Slice=fls-runs.slice`, nice 10. 슬라이스에도 같은 상한이 있다(모든 실행의 합) | run.log 첫 줄 |
| ⑥ DGX 기준선 | [`perf/baseline-dgx-1326765.json`](../../../perf/baseline-dgx-1326765.json), Chromium 151 linux-arm64, 3×240 draw | 아래 표 |

| 칸 | frameWork 중앙 / p95 (ms) |
|---|---|
| lots24 DPR1 정지 | 5.0 / 8.8 |
| lots24 DPR1 드래그 | 5.8 / 9.1 |
| lots24 DPR2 정지 | 17.4 / 20.0 |
| pop176 DPR1 정지 | 4.0 / 11.7 |
| 새 게임 DPR1 정지 | 4.1 / 5.7 |

## 필수 조건
- 깨끗한 클론 `6c5088f`는 `npm run remote:clone-check`로 확인했다. 미러에서 clone한 뒤 GitHub에서 LFS pull(129초), npm ci, typecheck, 전체 회귀 2,944/2,944, build 순서로 모두 통과했다.
- 한 번 실행에 더 드는 시간은 캐시 적중 때 약 8~12초다(rsync 5.5~8.4초, 준비 2.0~3.5초). 첫 실행 때는 동기화 38.5초와 npm ci 3.2초가 들었다.

## Node 24 전환(후속)
- **설치:** Node 24.21.0 LTS를 `~/fls-runs/_tools/node`에 설치했다(버전·SHA256 고정, `setup-dgx.sh`). **시스템 Node는 20, 게임은 `_tools`의 24다.** `/usr/bin/node`(20.20.0)는 DGX의 다른 작업이 쓰므로 그대로 두었다(사용자 결정).
- **원격 실행:** `PATH` 맨 앞에 `_tools/node/bin`을 넣는다. `--experimental-websocket` 우회는 지웠다. Node 24 테스트 요약(spec 형식 `ℹ pass N`)도 읽는다.
- **플레이 서버:**
  - `fls-play.service`의 `ExecStart`와 갱신 서비스의 `PATH`를 `_tools` Node 24로 바꿨다.
  - 순서: 단위 설치·`daemon-reload`(재시작 없음) → Node 24로 `485a3ce` 빌드·원자 교체(`build.json` `"node": "v24.21.0"`, 그동안 옛 서버가 200을 냈다) → 서버 한 번 재시작.
  - 재시작 동안 0.2초 간격으로 40번 찔러 1번 응답이 없었다(0.2초 안팎). 새 PID의 실행 파일은 `node-v24.21.0-linux-arm64/bin/node`다.
- **확인(`485a3ce`, Node 24):** 전체 회귀 2,954/2,954(379초). 깨끗한 클론은 clone+LFS 128초, npm ci, typecheck, 2,954/2,954, build 모두 통과.
- **PLAY.md:** 지원 버전을 "Node.js 22 이상(22.x는 22.12 이상, 권장 24 LTS)"으로 고쳤다.

## 발견
- **Node 20과 전역 WebSocket:** DGX의 Node 20에는 전역 `WebSocket`이 없어서 CDP 테스트 2건이 실패했다. 지금은 원격 실행에서 `--experimental-websocket`으로 맞춘다. PLAY.md는 Node 20.19 이상을 지원한다고 적는다 → 다음 후보(Node 22 이상으로 올리기).
- **`CHROME_PATH`:** 이 값을 넣으면 기본 경로를 검사하는 CLI 테스트 3건이 깨진다. 그래서 원격에서는 설정하지 않고 `/usr/bin/google-chrome` 링크를 쓴다.
