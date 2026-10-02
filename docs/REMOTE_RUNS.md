# 원격 실행 (REMOTE-1)

코드는 Mac에서 편집하고, 무거운 검증은 DGX Spark(`hyunlord@100.70.109.50`, Ubuntu 24.04 arm64, 20코어·119GB)에서 돌린다. 결과만 Mac으로 가져온다.
플레이 서버(PLAY-1, `~/fls-play`, 포트 4173)는 건드리지 않는다.

## 명령

```sh
npm run remote:test                                    # 전체 회귀(npm test). --typecheck를 붙이면 typecheck도
npm run remote:guardrail -- --seeds 1,2,3,4,5          # 가드레일(기본 1,200,000틱, seed 병렬). --ticks N --checkpoint
npm run remote:browser -- --repeat 10 [tests/x.test.ts ...]  # 브라우저 테스트 N회 연속(기본 Part7)
npm run remote:perf [-- --baseline perf/baseline-dgx-<sha>.json]   # 인자 없으면 기준선 기록, 있으면 p95 비교
npm run remote:clone-check                             # 커밋 깨끗한 클론(+LFS) → npm ci·typecheck·test·build
npm run remote:trend [-- --commits a,b] [--rounds 3]  # 커밋마다 성능 추이(scripts/perf/trendRun.ts) → ~/fls-runs/_trend/<sha>.json
                                                       #   본선 푸시 때 pre-push가 뒤로 띄운다(FLS_TREND_OFF=1로 끔). 모으기: npm run perf:trend
scripts/remote/run.sh <label> [--slot guardrail] [--detach] [--keep] -- <아무 명령>   # 임의 명령
```

- **label**: `FLS_REMOTE_LABEL=<세션>-<작업ID>`(예: `render-F0V`, `engine-F0A`). 지정하지 않으면 브랜치 이름을 쓴다. 원격 폴더는 `~/fls-runs/<label>-<짧은 해시>/`이다.
- **긴 실행**: `FLS_REMOTE_DETACH=1 npm run remote:guardrail`(또는 `run.sh … --detach`)로 띄워 두고, 나중에 `scripts/remote/run.sh --attach <run>`으로 따라가거나 `--fetch <run>`으로 결과만 받는다. ssh가 끊겨도 원격 실행은 계속되고, 같은 방법으로 다시 붙는다.
- **판정에 쓰는 실행은 `--keep`**(`--task`는 `FLS_REMOTE_KEEP_RUN=1`): 캠페인·가드레일·비교처럼 보고서의 수치가 되는 실행이다.
  - 그 폴더는 정리에서 빠지고 10개에 세지 않는다.
  - 끝나면 결과(`.remote/`와 가져올 결과 파일)를 `~/fls-runs/_kept/<run>/`에도 복사한다. `_`로 시작하는 폴더는 어느 브랜치의 정리도 지우지 않는다. 옛 `remote-exec.sh`를 가진 브랜치가 폴더를 지워도 결과는 남는다.
  - `--fetch <run>`은 폴더가 없으면 `_kept/`에서 받는다.
  - 결과를 저장소에 옮긴 뒤 `scripts/remote/run.sh --release <run>`으로 놓아준다.
  - 까닭: FIX-10 때 습지 seed 1 캠페인의 결과를 정리가 지워 잃었다(2026-09-30).
- **상태**: `scripts/remote/run.sh --status`로 도는 실행(스코프), 슬라이스 사용량, 폴더 목록, 붙잡아 둔 실행(`_kept`)을 본다.
- **종료 코드**는 원격 명령의 것이다. 요약은 `.remote-runs/<run>/summary.txt`(가드레일은 `guardrail/summary.json`)에 있다.
- **가드레일의 사람 경로**(CODE-1a): seed 실행 옆에서 `tests/humanPath*.test.ts`(명령 재생, 봇 없음)가 함께 돈다. 결과는 `guardrail/human-path.json`·`human-path.log`이고, 실패하면 가드레일 실행도 실패한다.

## Mac에서 막는 것

`scripts/remote/localGuard.mjs`가 무거운 검증을 Mac에서 시작하면 거부하고(종료 3), 쓸 명령을 알려 준다(결정 RR1).

| 막는 것 | 대신 쓸 것 |
|---|---|
| 전체 시험 스위트 `npm test` | `npm run remote:test` |
| 가드레일 `scripts/efficientGrowthRun.ts` | `npm run remote:guardrail` |
| 브라우저 캡처 스크립트(Playwright를 쓰는 `scripts/*`, 90개) | `scripts/remote/run.sh <세션>-<작업ID> -- <같은 명령>`, 브라우저 시험은 `npm run remote:browser` |

- **Mac에서 되는 것**: 단일 파일·소규모 시험(`npx tsx --test tests/<파일>.test.ts`), `npm run typecheck`, `npm run lint`, `npm run dev`, `npm run perf:gate`(끊김 판정은 Mac 실제 창), Astra QA.
- **판별**: macOS이고 `scutil --get LocalHostName`이 있으면 Mac이다. Mac의 `os.hostname()`은 네트워크가 주는 이름(예 `172.25.nate.com`)이라 쓰지 않는다. DGX와 CI는 Linux라 그대로 돈다.
- **급할 때**: `FLS_ALLOW_LOCAL=1 <같은 명령>`.
  - 보고서에 적을 문장이 출력된다. 그 보고서에 반드시 적는다.
  - `.remote-runs/local-heavy.log`(git 밖)에 시각·호스트·커밋·명령이 남는다.
- **새 브라우저 캡처 스크립트**: 첫 `import` 앞에 두 줄을 넣는다.
  ```js
  import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
  refuseHeavyOnMac("브라우저 캡처(scripts/<이름>)", { entry: import.meta.url });
  ```
  `entry`가 있으면 다른 모듈이 import할 때는 막지 않는다.

## 한 번 실행에서 일어나는 일
1. **동기화**: git이 보는 작업 트리를 보낸다. 추적 파일과 무시되지 않은 새 파일이 대상이고, `node_modules`·`.git`·`dist`는 보내지 않는다.
   - 바뀌지 않은 파일은 DGX에서 직전 실행 폴더로부터 복사한다(`rsync --copy-dest --checksum`). 그래서 네트워크로는 편집한 파일만 건너간다.
   - origin에 없는 커밋은 git bundle로 함께 보낸다.
2. **준비**(DGX, 스코프 안에서):
   - git: 실행 폴더는 공유 bare 미러(`_cache/repo.git`)를 alternates로 쓰는 `$FULL_SHA` 작업 트리가 된다. `git status`는 Mac의 커밋 안 한 변경을 그대로 보여 준다.
   - node_modules: `package-lock.json` 해시·Node 버전·arch별 캐시(`_cache/nm-<hash>`)에서 하드링크로 복사한다(`cp -al`). 캐시가 없을 때만 `npm ci`를 한 번 한다.
   - 포트는 4300~4399 가운데 빈 것 하나(`FLS_REMOTE_PORT`)다. 가드레일은 슬롯을 잡는다(동시에 2개까지, 셋째는 기다린다).
3. **실행**: `bash -c "<명령>"`. 로그는 `.remote/run.log`에 남는다.
4. **회수**:
   - 실행 폴더의 `.remote/`(로그·요약·가드레일/성능 원자료)는 Mac의 `.remote-runs/<run>/`으로 온다(git 무시).
   - 명령이 `docs/`·`seeds/`·`perf/`·`output/`·`fixtures/` 아래에 만들거나 바꾼 파일은 작업 트리로 온다. `rsync --update`라서 실행 중에 Mac에서 고친 파일은 덮지 않는다. 목록은 `.remote-runs/<run>/changed-files.txt`에 있다.
5. **정리**: DGX는 최근 실행 폴더 10개만 남긴다(도는 중인 폴더와 `--keep` 실행은 지우지 않고 세지도 않는다). node_modules 캐시는 최근 4개를 남긴다.
   - **올리는 동안에도 폴더는 잠겨 있다**(2026-10-02): run.sh가 실행 폴더를 만들기 전에 그 실행의 잠금(`_locks/<run>.lock`)을 ssh 세션으로 잡고, 올리기·실행 시작이 끝날 때까지 쥔다. `remote-exec.sh run`은 그 잠금을 1분까지 기다려 넘겨받으므로 비는 틈이 없다. 올린 뒤에는 폴더 시각을 지금으로 바꾼다(`rsync -a`가 Mac 폴더의 옛 시각을 붙여, 정리가 새 폴더를 오래된 것으로 볼 수 있었다).
     - 전에는 올리는 동안 잠금이 없어서, 다른 실행의 정리가 받는 중인 폴더를 지웠다(`6e6b96eb` 추이, rsync "No such file or directory" 1만 줄).
     - 2026-10-02에 확인: 올리는 동안(파일 0 → 30,553개) 잠금이 계속 잡혀 있었고, 실행이 끝난 뒤 풀렸다.
     - 본선을 합치지 않은 체크아웃의 옛 run.sh는 아직 올리는 동안 잠그지 않는다.
   - 정리는 어느 세션의 실행이 끝날 때든 돈다. `_`로 시작하는 폴더(`_kept`·`_trend`·`_clones` 등), `.remote/keep`이 있는 폴더, 아직 도는 폴더(잠금)는 건드리지 않는다(2026-10-01 DGX 임시 폴더에서 `prune_runs`를 그대로 돌려 확인: 14개 중 보존·도는 폴더를 빼고 가장 오래된 둘만 지움).
   - 그래서 `--keep` 없이 돈 실행의 폴더는 다른 세션의 실행이 지울 수 있다. 남겨야 할 실행은 `--keep`으로 돌린다.
   - 추이 실행(`--task trend`)은 결과를 `_trend/`(측정 `<sha>.json`, A-B 확인 `ab/`)에 두고, 로그도 `_trend/logs/<run>.log`로 복사한다.
   - **본선 푸시의 추이 측정**은 pre-push 훅이 `scripts/remote/trendLaunch.mjs`로 띄운다. 새 세션(setsid)에서 돌고, 표준 입력은 닫고, 출력은 `.remote-runs/trend-push.log`로 보낸다. 그래서 푸시의 입출력을 붙잡지 않고, 푸시를 죽여도 함께 죽지 않는다. 푸시는 그 프로세스가 생겼는지만 확인하고 바로 끝난다.
     - 로그는 띄울 때마다 `시작됨 (<run>)` 또는 `시작 실패 — <까닭>` 한 줄로 끝난다. 까닭은 run.sh 실패, 20분 안에 DGX 실행이 시작되지 않음, 분리된 실행 보고 없음 가운데 하나다.
     - 실행 이름은 `infra-TREND-<잰 커밋 8자>-<체크아웃 커밋>`이다. 한 체크아웃에서 두 번 푸시해도 겹치지 않는다.
     - 2026-10-02 전까지는 백그라운드 실행이 푸시의 입출력을 붙잡아 푸시가 끝나지 않았다(INBOX가 10분 제한에 걸림). 그 푸시가 죽으면서 측정도 함께 죽었다(`f662b67e`, 다시 띄움).
   - A-B 확인이 두 번째 포트를 붙잡는 프로세스는 잠금을 쥔 채 `sleep`으로 바뀌는 한 프로세스다(최대 3시간). 전에는 `flock … sleep`이 남긴 `sleep`이 하루 동안 포트를 쥐었다(4300~4346, 2026-10-02에 36개 정리).

## Node
- **시스템 Node는 20, 게임은 `_tools`의 24다.**
  - `/usr/bin/node`(nodesource 20.x)는 DGX의 다른 작업이 쓰므로 그대로 둔다.
  - 원격 실행과 플레이 서버(서버·빌드)는 `~/fls-runs/_tools/node/bin/node`(Node 24.21.0 LTS)를 쓴다. `_tools/node`는 `node-v24.21.0-linux-arm64`를 가리키는 심볼릭 링크다.
- 원격 실행은 `PATH` 맨 앞에 `_tools/node/bin`을 넣는다. 실행 로그 첫머리에 `node v24.21.0 (/home/hyunlord/fls-runs/_tools/node/bin/node)`가 찍힌다.
- node_modules 캐시 키에 Node 버전이 들어가므로, Node를 바꾸면 처음 한 번은 `npm ci`를 한다.
- 버전을 올릴 때는 `setup-dgx.sh`의 `NODE_VERSION`·`NODE_SHA256`을 고치고 `npm run remote:setup`을 실행한다. 링크를 원자적으로 바꾼다. 그다음 `remote:test`로 확인하고, 플레이 서버를 한 번 재시작한다(docs/PLAY_SERVER.md).
- 테스트는 Node 22 이상의 전역 `WebSocket`을 쓴다(CDP 클라이언트: Part7 증명, 성장 기록 감시).

## 자원 제한
- 모든 실행은 systemd 사용자 스코프 `fls-run-<run>-<시각>`에서 돈다. 스코프마다 `MemoryMax=48G`, `CPUQuota=1200%`(20코어 중 12)이고, `nice -n 10`이다.
- 스코프는 `fls-runs.slice`에 들어간다. 슬라이스에도 같은 상한이 있어서 **동시 실행을 모두 합쳐도** 48GB·12코어를 넘지 않는다. 사용자의 로컬 추론(llama·ComfyUI 등)이 나머지 8코어·70GB를 쓴다.
- 확인: `systemctl --user status fls-runs.slice`(합계), `systemctl --user status 'fls-run-*'`(실행별). 스코프 로그 첫 줄에 `nice 10 memory.max 51539607552 cpu.max 1200000 100000`이 찍힌다.
- 48GB를 넘으면 그 실행만 OOM으로 죽는다. 그러면 종료 코드가 남지 않아 Mac 쪽이 `left no exit code`로 알린다.

## 브라우저
- Chrome에는 linux-arm64 빌드가 없어서 Playwright의 Chromium(linux-arm64, `playwright-core@1.62.1` = revision 1234)을 쓴다.
  - `FLS_CHROMIUM_PATH`: Chromium 실행 파일.
  - `PLAYWRIGHT_MODULE`: 증거 스크립트용 playwright-core 심(`scripts/remote/playwright-chrome-shim.mjs`). `channel: 'chrome'`을 이 Chromium으로 바꾸고, 나머지는 그대로 둔다.
  - `/usr/bin/google-chrome`: 같은 Chromium을 가리키는 심볼릭 링크. Linux 기본값으로 Chrome을 찾는 테스트(Part7)를 위해 둔다.
- `CHROME_PATH`는 설정하지 않는다. 기본 Chrome 경로를 검사하는 CLI 테스트가 Mac과 똑같이 돌게 하기 위해서다. 명시 경로가 필요한 명령은 `CHROME_PATH=$FLS_CHROMIUM_PATH …`를 붙인다(`remote:browser`는 그렇게 한다).
- 한글 캡처에 쓰는 폰트는 Noto CJK(`fonts-noto-cjk`)다. 이미 설치되어 있다.

## 성능 기준선
- 처리량 관문(p95 비교)은 **DGX 대 DGX로만** 한다. Mac 수치와 섞지 않는다.
- 끊김 판정과 메모리 측정은 이것과 따로다. `npm run perf:gate`·`scripts/perf/memoryHolders.ts`로 이 Mac의 실제 Chrome 창에서 한다([perf-gate](verification/perf-gate/README.md)). DGX 헤드리스는 소프트웨어 래스터라 끊김 판정에 쓰지 않는다.
- 기준선은 `perf/baseline-dgx-<sha>.json`이다. `scripts/renderStageBenchmark.mjs`로 한 칸을 3회 × 240 draw 재고(첫 회는 버린다), frameWork·tick·rAF의 중앙·p95를 기록한다. 서버는 DGX Vite 개발 서버(127.0.0.1, 4300~4399)다.
- 기본 칸은 `lots24:1:still, lots24:1:drag, lots24:2:still, pop176:1:still, newgame:1:still`이다.
- 비교: `npm run remote:perf -- --baseline perf/baseline-dgx-<sha>.json`을 실행하면 `.remote-runs/<run>/perf/compare.md`에 칸별 p95 비가 나온다.
- 성능 측정은 다른 원격 실행과 겹치지 않게 돌린다. `--status`로 먼저 확인한다.

## 병합 전 자동 검사
본선(`codex/phase15-organic-ground`)과 main에 들어가는 것은 pre-push 훅이 먼저 검사한다(AGENTS.md 규칙 19, REVIEW-1).
- **실행**: `npm run check:merge [-- --base <rev> --head <rev>]`. 기본 범위는 본선과의 merge-base..HEAD다. 훅은 `FLS_PUSH_OK=1 git push …`로 푸시할 때 원격 머리..로컬 머리를 넘긴다.
  - 검사 여덟 가지(1~8) 가운데 하나라도 실패하면 푸시를 거부한다. 9번(추이 문서 뒤처짐)은 경고만 한다.
  - 이 작업 트리가 `<head>`와 다르거나 수정돼 있으면, `<head>`의 임시 워크트리(LFS는 포인터)에서 ESLint·tsc·빌드 크기 예산을 돌린다. 예산 검사는 빌드가 웹 파생본으로 바꾸는 받은 PNG(키아트·삽화·초상 풀)만 로컬 LFS 저장소에서 꺼낸다(`git lfs checkout`).
- **검사**:
  1. `scripts/checks/pinChanges.mjs`: 고정값 파일·테스트 해시 값이 바뀌었으면, 같은 범위에서 결정 목록(`docs/decisions/**`, `docs/DECISIONS.md`)에 더한 줄에 그 파일 이름이나 상위 폴더가 있어야 한다.
  2. `scripts/checks/lintExceptions.mjs`: 새 `eslint-disable…`·`@ts-ignore`·`@ts-expect-error`·`as any`(캐스트)에 `// why:`가 같은 줄이나 윗줄에 있어야 한다. 기존 것은 `scripts/checks/lint-exceptions-baseline.json`(25건, 파일 + 줄 내용으로 대조)에 있다.
  3. ESLint(`tools/eslint/`): 바뀐 코드 파일만 본다. `tools/eslint/eslint-suppressions.json`에 없는 위반만 실패한다(REVIEW-1 때 122건: 금지 컨트롤 118, exhaustive-deps 4. UI-KIT-1이 모두 고쳐 0건).
  4. typecheck: 루트 `node_modules`의 `tsc --noEmit`.
  5. `scripts/checks/inboxLedger.mjs`(INBOX-1q): `<head>`의 `assets-inbox/INBOX_LEDGER.csv` 전체에서 `replaced_by`의 경로(`;`로 이은 것 하나하나)가 장부의 다른 행 `file`이어야 한다. `cursor_*.png(6장)` 같은 패턴·설명·오타는 실패한다. 범위에서 바뀐 행만이 아니라 장부 전체를 본다(도입 때 걸린 행 1개는 같은 커밋에서 고쳐 기존 위반 목록이 없다). INBOX-1y부터 둘을 더 본다. ① 장부 전체에서 `verdict_note`의 `(정본: <경로>)`는 sha256이 같은 다른 행을 가리켜야 한다. ② 범위에서 새로 생긴 행의 sha256이 다른 행과 같으면 그 행 비고에 `○○와 동일 바이트(정본: 경로)`가 있거나, 같은 바이트의 다른 행이 그 행을 정본으로 적고 있어야 한다. 정본은 runtime manifest나 설치 대장이 가리키는 행, 없으면 같은 바이트 가운데 confirmed이면서 가장 먼저 받은 행이다(순서는 `docs/ASSET_INBOX.md` 2절). 기존 중복 215묶음 245행은 INBOX-1y에서 한 번에 표시했다.
  6. `scripts/checks/koreanStrings.mjs`(CODE-1b): `<head>`의 `src/**/*.{ts,tsx,js,jsx,mjs,cjs}`에서 한글이 든 문자열·템플릿·JSX 텍스트는 `*.ko.ts`와 `*.generated.*`에만 둘 수 있다(주석 제외).
     - 파싱은 `tools/eslint`의 TypeScript 6으로 한다.
     - 기존 것은 `scripts/checks/korean-strings-baseline.json`(40개 파일, 463개 문구)에 파일별 정확한 문구로 있다. 목록 문구를 고치면 새 문자열로 본다.
  7. `scripts/checks/distBudget.mjs`(BUDGET-1): `<head>`를 임시 폴더에 `vite build --outDir`로 빌드해(작업 트리의 `dist`는 그대로) 파일 크기를 범주별(세계 그림·초상·삽화·키아트·UI·소리·코드, 규칙에 안 걸리면 기타)로 더하고, 전체나 예산 있는 범주가 넘으면 실패한다. 빌드 폴더는 지운다.
     - 범주 규칙과 예산(전체 150 MB, 초상 20 MB, 삽화 25 MB; MB = 1,000,000바이트)은 `scripts/checks/distBudget.config.json` 한 파일이다. 새 에셋 폴더가 기타로 잡히면 목록에 이름이 나오니 규칙을 더한다.
     - 따로 재기: `npm run budget:dist`(같은 빌드·표), 이미 있는 빌드는 `node scripts/checks/distBudget.mjs --dist dist`.
  8. `scripts/checks/decisionIds.mjs`(결정 RR8): `<head>`의 `docs/decisions/README.md`에서 같은 결정 ID가 두 행에 있으면 실패한다. ID는 표 행의 첫 칸이 ID 모양(영문·숫자·`-`·`~`·`·`, 예: `FX7-1`, `RR7`, `INSTALL27-D1~D4`)일 때다. 세션들이 같은 날 같은 번호를 쓰거나(RR4·RR5), 병합이 한 행의 옛 판과 고친 판을 둘 다 남길 때(FX7-1, 병합 `e1b8119c`) 걸린다. 나중 것에 새 번호를 주거나, 같은 행의 묵은 사본이면 지운다.
  9. `scripts/checks/trendLag.mjs`(경고만, 결정 RR4): `<head>`의 `docs/verification/perf-trend/trend.json`이 본선 머리를 몇 개 뒤처졌는지 센다. 10개를 넘으면 경고 한 줄을 찍고 푸시는 막지 않는다.
     - 세는 단위는 본선 머리(추이가 재는 단위)다: 이 저장소의 `origin/codex/phase15-organic-ground` reflog(워크트리끼리 공유)에 있던 커밋과 `<head>` 가운데, 문서의 측정 커밋 어느 것에서도 닿지 않는 것. reflog가 없는 새 클론에서는 그 범위의 커밋 전부를 센다(병합된 브랜치의 커밋까지 세어 많게 나온다).
     - 경고는 `<git common dir>/fls-trend-lag.log`에도 한 줄씩 쌓인다. 어느 워크트리에서든 `cat "$(git rev-parse --git-common-dir)/fls-trend-lag.log"`로 본다.
     - 갱신: `npm run perf:trend`로 DGX 결과를 모아 `docs/verification/perf-trend`를 커밋한다. 합치는 세션이 하고, 경고가 쌓이면 인프라 세션이 모아 커밋한다.
     - 자동 갱신(2026-10-03): `npm run hooks:install`(npm ci·install이 함께 돌림)이 `post-merge` 훅과 병합 드라이버 `fls-trend`를 설치한다. 작업 브랜치에 본선을 합쳤을 때 문서가 10개 넘게 뒤처졌으면 훅이 `perf:trend`를 돌려 `docs/verification/perf-trend`만 따로 커밋한다("post-merge: trend …" 한 줄). 본선·main·분리된 HEAD·squash 병합·그 폴더에 커밋 안 한 변경이 있을 때는 하지 않는다. 충돌로 멈춘 병합은 훅이 돌지 않으므로 다음 병합이 맡는다. 실패하면 폴더를 되돌린다. 끄기: `FLS_TREND_AUTO=0`. 두 세션의 갱신이 만나면 드라이버가 측정 커밋이 많은 쪽을 남긴다.
- **ESLint 설치가 따로인 이유**
  - typescript-eslint는 TypeScript 6.1 미만만 지원한다. 루트의 TypeScript 7(네이티브 포트)에는 JS 컴파일러 API가 없다.
  - 그래서 `tools/eslint/`에 ESLint 10.11 · @typescript-eslint/parser 8.70 · TypeScript 6.0.3(파싱 전용) · react-hooks 7.1.1을 자체 lock으로 둔다. 루트 package.json의 의존성과 lock에는 넣지 않는다.
  - 첫 검사 때 `npm ci`가 저절로 된다(몇 초). ESLint는 저장소 루트에서 돈다(설정의 패턴이 작업 디렉터리 기준).
  - typescript-eslint가 TS 7을 지원하면 루트로 옮길지 그때 결정한다.
- **계층 규칙 파일: `tools/eslint/layers.mjs`**(CODE-1b)
  - `src/{engine,population,economy,zones,world,save,ledger,state}/**`에서 `src/ui/**`·`src/render/**`를 import하면 `no-restricted-imports` 위반이다(`../ui/…`, `../../render/…`, `src/ui/…` 모두).
  - 들어올 때 있던 위반(`src/population/marketAccess.ts` → `ui/serviceDiagnosisCopy.ko`, 1건)은 `tools/eslint/eslint-suppressions.json`에 있다. CODE-1a가 없앤다.
  - `npm run lint`도 이 억제 파일을 읽는다.
- **금지 컨트롤 규칙 파일: `tools/eslint/uiControls.mjs`**
  - 이것이 원본이다. `src/ui`의 네이티브 `<select>`·`<input>`·맨 `<button>`을 금지하고, UI 부품 폴더 `src/ui/kit/`는 예외다.
  - UI-KIT-1의 ESLint 설정도 이 파일의 `uiControlsConfig`를 가져다 써서 규칙을 하나로 유지한다.
- **목록 관리**
  - 억제·예외 목록은 줄이기만 한다. 위반을 고쳤으면 본선에서 `node scripts/checks/lintExceptions.mjs --write-baseline`, `node scripts/checks/koreanStrings.mjs --write-baseline`, `tools/eslint/node_modules/.bin/eslint -c tools/eslint/eslint.config.mjs --suppressions-location tools/eslint/eslint-suppressions.json --prune-suppressions .`를 실행한다.
  - 새 위반을 목록에 넣어 통과시키지 않는다.
- **자체 시험**: `bash scripts/checks/selfTest.sh`. 버려도 되는 저장소에서 위반 여덟 종류(고정값·예외·금지 컨트롤·타입·장부 replaced_by·계층 import·`*.ko.ts` 밖 새 한글·장부 중복 행의 정본 표시 누락이나 다른 바이트를 가리키는 표시)는 거부되고, 고친 변경·일반 변경·작업 브랜치는 통과해야 한다.

## DGX 준비(한 번, 다시 해도 됨)
`npm run remote:setup`은 `scripts/remote/setup-dgx.sh`를 DGX에서 실행한다. sudo 없이 `~/fls-runs`와 `~/.config/systemd/user`만 쓴다.
- Node 24 LTS를 `~/fls-runs/_tools/node`에 설치한다(버전·SHA256 고정). 시스템 `/usr/bin/node`는 건드리지 않는다.
- `~/fls-runs/_tools`에 playwright-core와 Chromium, git-lfs 3.8.0을 설치한다.
- Noto CJK를 확인하고, 헤드리스로 한글을 렌더링해 폭을 확인한다.
- `fls-runs.slice` 단위를 만들고 bare 미러를 준비한다.
- **sudo 한 번(사용자)**: `sudo ln -sfn "$(cat ~/fls-runs/_tools/chromium-path)" /usr/bin/google-chrome`

## 배치
```
~/fls-runs/
  <label>-<sha>/           실행 폴더(최근 10개, .remote/keep이 있는 --keep 실행은 빼고)
    .remote-in/            Mac이 보낸 목록·메타·bundle
    .remote/               로그·요약·원자료 → Mac .remote-runs/<run>/
  _cache/repo.git          bare 미러(실행 폴더 git의 객체 저장소)
  _cache/nm-<hash>/        node_modules 캐시
  _tools/                  node -> node-v24.21.0-linux-arm64, playwright-core, chromium-path, bin/git-lfs
  _locks/ _slots/ _ports/  실행·가드레일 슬롯·포트 잠금(flock)
  _clones/                 clone-check 임시 클론(끝나면 지운다)
  _kept/<run>/             --keep 실행의 결과 사본(.remote/·결과 파일, --release로 지운다)
  _trend/                  추이: <sha>.json(측정)·ab/(A-B 확인)·logs/(실행 로그)
```
