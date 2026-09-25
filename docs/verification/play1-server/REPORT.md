# PLAY-1 상시 플레이 서버 (DGX Spark)

관문: ①접속 · ②자동 갱신 · ③재부팅 · ④실패 폴백 · ⑤저장 유지 — 5/5 통과

- **주소:** <http://100.70.109.50:4173/> (Tailscale 안에서만)
- **상태 페이지:** <http://100.70.109.50:4173/status> (JSON `/status.json`). 게임 왼쪽 위 구석에 커밋 7자리가 뜬다.
- **갱신 주기:** 5분마다 본선 머리를 확인한다. 바뀌었으면 빌드해 원자적으로 바꿔 끼운다. 빌드는 이 서버에서 약 3초다.
- **범위:**
  - 게임 코드는 0줄 바꿨다. 커밋 표시는 빌드 결과 사본의 `index.html`에만 넣는다.
  - 저장소에 더한 것: `deploy/play-server/`, `docs/PLAY_SERVER.md`, 이 폴더.
  - 비밀번호·키는 없다. 공개 HTTPS로 클론한다.

## 서버
- **환경:** Ubuntu 24.04.4, aarch64(20코어), Node 20.20.0(배포판), git. git-lfs는 없다. 런타임 그림은 일반 파일이라 필요 없다. sharp 같은 네이티브 의존성도 없다(`npm ci` 31개 패키지).
- **배치:** `~/fls-play/{repo,releases,current,bin,state}`
- **서비스:** systemd 사용자 단위 `fls-play.service`(서버), `fls-play-update.timer` → `fls-play-update.service`(갱신).
- **서버 프로그램:** Node 내장 모듈만 쓰는 `serve.mjs`다. `100.70.109.50:4173`에만 붙는다. LAN(192.168.0.18)과 127.0.0.1에서는 연결이 거부됨을 확인했다. 경로 탈출 요청은 게임 첫 화면으로 떨어진다.

## 관문
| 관문 | 결과 | 증빙 |
|---|---|---|
| ① 접속 | 주소에서 게임이 뜬다(캔버스 1, 제목 "봉건 영주 시뮬레이터", 커밋 표시). 목표형으로 시작 → 1배속 12초, tick 245에서 frameWork 중앙 1.3ms, p95 11.5ms(≤ 20ms, headless Chrome 1280×800) | `check.json` gate1, `new-game.jpg` |
| ② 자동 갱신 | 본선에 `bd314e1`(이 배포 커밋)을 푸시한 때가 10:38:20Z다. 서버는 10:39:48Z에 빌드를 시작해 10:39:50Z에 `bd314e1`을 서빙했고, 상태 페이지 해시가 바뀌었다(1분 30초, ≤ 10분) | 아래 기록 |
| ③ 재부팅 | 사용자가 `sudo loginctl enable-linger hyunlord && sudo reboot`을 실행했다. 서버는 10:42:04Z에 내려갔고 부팅은 19:42:35 KST다. 로그인 없이 사용자 systemd가 19:42:44에 떴다(마지막 로그인 19:41:58은 재부팅 전의 sudo 세션). 확인은 HTTP로만 해서 ssh 로그인이 끼지 않았다. `fls-play.service`는 Tailscale 주소가 올라올 때까지 5초마다 다시 떴고(EADDRNOTAVAIL), 19:43:48(10:43:48Z)에 붙었다. 같은 때 타이머가 첫 확인을 돌렸다("unchanged"). `Linger=yes`, 두 단위 모두 enabled·active | 아래 기록 |
| ④ 실패 폴백 | 빌드 명령을 실패로 바꿔(`FLS_PLAY_BUILD_CMD=false update.sh --force`) 돌렸다. `current`는 이전 빌드 그대로였고 첫 화면 커밋 표시도 그대로였다. 상태 페이지는 "마지막 결과: failed:build"(붉은 글씨)다. 다음 성공 빌드(`bd314e1`)에서 실패 표시가 풀렸다 | `status-failed.jpg`, `status-failed.json` |
| ⑤ 저장 유지 | 실제 주소에서 새 게임 → 5배속 8초 → 일시 정지(자동 저장 `pause`). IndexedDB `feudal-lord-simulator-saves`의 `slots`·`meta`에 `auto-1`이 생기고, 새로 고침 뒤에도 남는다 | `check.json` gate5, `after-reload.jpg` |

③ 재부팅 기록:
```
uptime -s                2026-09-25 19:42:35
loginctl Linger          yes
is-enabled / is-active   fls-play.service enabled active · fls-play-update.timer enabled active
19:42:44 systemd[2183]: Started fls-play.service …
19:42:44 node: listen 100.70.109.50:4173 failed: EADDRNOTAVAIL        (Tailscale 아직)
… 5초마다 재시작 …
19:43:48 fls-play.service ActiveEnterTimestamp, fls-play-update.timer 첫 실행
```
- 재부팅 뒤 무한 재시도를 확실히 하려고 `StartLimitIntervalSec=0`을 더했다(systemd 기본 한도: 10초 안 5번).

② 갱신 기록(`~/fls-play/state/updates.log`):
```
2026-09-25T10:26:54Z building 2b0e9ce (serving )
2026-09-25T10:26:57Z serving 2b0e9ce from 20260925T102657Z-2b0e9ce
2026-09-25T10:32:32Z building 2b0e9ce (serving 2b0e9ce)
2026-09-25T10:32:33Z build failed for 2b0e9ce, still serving 2b0e9ce
2026-09-25T10:39:48Z building bd314e1 (serving 2b0e9ce)
2026-09-25T10:39:50Z serving bd314e1 from 20260925T103950Z-bd314e1
```
- 10:32 줄은 관문 ④ 시험이다.
- 빈 커밋 대신 이 배포 커밋 자체를 푸시로 썼다. 본선 변경이라는 점은 같다.

① 측정 방법: 게임의 증명 포트(`?phase10-proof=1`)는 localhost와 github.io에서만 열린다(게임 코드). 그래서 SSH 터널(`127.0.0.1:4174` → 서버 `:4173`)로 같은 서빙 빌드를 열어 쟀다. 저장 시험(⑤)은 IndexedDB가 주소별이라 실제 주소에서 했다.

## sudo가 필요했던 지점
- **한 곳:** `sudo loginctl enable-linger hyunlord`. 사용자 단위 서비스는 linger가 없으면 마지막 로그인 세션이 끝날 때 멈춘다.
  - 설치 직후 실제로 겪었다. SSH 세션이 끝날 때마다 서버가 멈췄다.
  - linger가 있으면 부팅 때 로그인 없이 뜬다.
- **재부팅:** 관문 ③ 확인을 위해 사용자가 직접 했다.
- **그 밖:** 설치·갱신·서비스 관리는 모두 사용자 권한이다(방화벽·패키지 설치 없음).

## 로컬 대안
Mac 저장소에서 `npm run play`가 그대로 된다(빌드 후 `127.0.0.1:4173` 200, `BROWSER=none`으로 확인).

## 그 밖
- **깨끗한 클론(배포 커밋 `bd314e1`):** npm ci·typecheck·build 통과, 테스트 2832/2833.
  - 실패 1건은 `phase13Part7BrowserProof`의 45초 하위 프로세스 제한 초과다(전체 실행 부하에서만). 따로 돌리면 8.5초에 통과한다. V2 최종 클론에서도 한 번 같은 일이 있었다.
  - 이번 작업은 `src/`를 바꾸지 않았다.

## 소요 시간
2026-09-25 19:23 ~ 19:55, 약 30분(재부팅 대기 포함). 2시간 상한 안.
