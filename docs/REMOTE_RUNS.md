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
scripts/remote/run.sh <label> [--slot guardrail] [--detach] -- <아무 명령>   # 임의 명령
```

- **label**: `FLS_REMOTE_LABEL=<세션>-<작업ID>`(예: `render-F0V`, `engine-F0A`). 지정하지 않으면 브랜치 이름을 쓴다. 원격 폴더는 `~/fls-runs/<label>-<짧은 해시>/`이다.
- **긴 실행**: `FLS_REMOTE_DETACH=1 npm run remote:guardrail`(또는 `run.sh … --detach`)로 띄워 두고, 나중에 `scripts/remote/run.sh --attach <run>`으로 따라가거나 `--fetch <run>`으로 결과만 받는다. ssh가 끊겨도 원격 실행은 계속되고, 같은 방법으로 다시 붙는다.
- **상태**: `scripts/remote/run.sh --status`로 도는 실행(스코프), 슬라이스 사용량, 폴더 목록을 본다.
- **종료 코드**는 원격 명령의 것이다. 요약은 `.remote-runs/<run>/summary.txt`(가드레일은 `guardrail/summary.json`)에 있다.

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
5. **정리**: DGX는 최근 실행 폴더 10개만 남긴다(도는 중인 폴더는 지우지 않는다). node_modules 캐시는 최근 4개를 남긴다.

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
- Node 20에는 전역 `WebSocket`이 없다(Node 22부터 기본). 그래서 원격 실행은 Node 20일 때 `NODE_OPTIONS=--experimental-websocket`을 켠다. CDP 클라이언트(Part7 증명, 성장 기록 감시)가 이것을 쓴다.

## 성능 기준선
- 성능 관문(p95 비교)은 **DGX 대 DGX로만** 한다. Mac 수치와 섞지 않는다.
- 기준선은 `perf/baseline-dgx-<sha>.json`이다. `scripts/renderStageBenchmark.mjs`로 한 칸을 3회 × 240 draw 재고(첫 회는 버린다), frameWork·tick·rAF의 중앙·p95를 기록한다. 서버는 DGX Vite 개발 서버(127.0.0.1, 4300~4399)다.
- 기본 칸은 `lots24:1:still, lots24:1:drag, lots24:2:still, pop176:1:still, newgame:1:still`이다.
- 비교: `npm run remote:perf -- --baseline perf/baseline-dgx-<sha>.json`을 실행하면 `.remote-runs/<run>/perf/compare.md`에 칸별 p95 비가 나온다.
- 성능 측정은 다른 원격 실행과 겹치지 않게 돌린다. `--status`로 먼저 확인한다.

## DGX 준비(한 번, 다시 해도 됨)
`npm run remote:setup`은 `scripts/remote/setup-dgx.sh`를 DGX에서 실행한다. sudo 없이 `~/fls-runs`와 `~/.config/systemd/user`만 쓴다.
- Node 20 확인(PLAY-1과 같은 `/usr/bin/node`).
- `~/fls-runs/_tools`에 playwright-core와 Chromium, git-lfs 3.8.0을 설치한다.
- Noto CJK를 확인하고, 헤드리스로 한글을 렌더링해 폭을 확인한다.
- `fls-runs.slice` 단위를 만들고 bare 미러를 준비한다.
- **sudo 한 번(사용자)**: `sudo ln -sfn "$(cat ~/fls-runs/_tools/chromium-path)" /usr/bin/google-chrome`

## 배치
```
~/fls-runs/
  <label>-<sha>/           실행 폴더(최근 10개)
    .remote-in/            Mac이 보낸 목록·메타·bundle
    .remote/               로그·요약·원자료 → Mac .remote-runs/<run>/
  _cache/repo.git          bare 미러(실행 폴더 git의 객체 저장소)
  _cache/nm-<hash>/        node_modules 캐시
  _tools/                  playwright-core, chromium-path, bin/git-lfs
  _locks/ _slots/ _ports/  실행·가드레일 슬롯·포트 잠금(flock)
  _clones/                 clone-check 임시 클론(끝나면 지운다)
```
