# 상시 플레이 서버 (PLAY-1)

| 항목 | 값 |
|---|---|
| **주소** | <http://100.70.109.50:4173/> (Tailscale 안에서만. 공개 인터넷·LAN에는 열지 않는다) |
| **상태 페이지** | <http://100.70.109.50:4173/status> (JSON: `/status.json`) |
| **서버** | DGX Spark `hyunlord@100.70.109.50`(Ubuntu 24.04, arm64, Node 20) |
| **내용** | 본선 `codex/phase15-organic-ground`의 `npm run build` 결과(정적 파일) |
| **갱신** | 5분마다 본선 머리를 확인한다. 바뀌었으면 빌드해서 바꿔 끼운다. 빌드가 1분 안쪽이라 대개 5~6분 안에 뜬다 |
| **커밋 표시** | 게임 화면 왼쪽 위 구석의 7자리 해시(누르면 상태 페이지) |

## 쓰는 법
- **열기:** 브라우저에서 주소를 연다. 저장은 브라우저의 IndexedDB에 남는다. 주소(호스트·포트)가 같으면 새로 고침하거나 새 빌드가 올라와도 유지된다.
- **지금 갱신하기:** `ssh hyunlord@100.70.109.50 '~/fls-play/bin/update.sh'`. 본선이 그대로여도 다시 빌드하려면 끝에 `--force`를 붙인다.
- **로그:**
  - 갱신 기록: `~/fls-play/state/updates.log`. 상태 페이지에도 마지막 20줄이 나온다.
  - 빌드 출력: `~/fls-play/state/build-<커밋>.log`(최근 5개).
  - 서버: `journalctl --user -u fls-play.service`
  - 타이머: `journalctl --user -u fls-play-update.service`, `systemctl --user list-timers`
- **서비스:** `systemctl --user status|restart|stop fls-play.service fls-play-update.timer`

## 동작
- **정적 서버:** `deploy/play-server/serve.mjs`(Node 내장 모듈만). Tailscale 주소 `100.70.109.50:4173`에만 붙는다. 매 요청마다 `~/fls-play/current` 심볼릭 링크를 따라가므로, 바꿔 끼우면 재시작 없이 바로 새 빌드가 나간다.
- **갱신 스크립트:** `deploy/play-server/update.sh`(설치 사본은 `~/fls-play/bin/`).
  - 본선 머리가 서빙 중인 커밋과 다르면 `~/fls-play/repo`를 그 커밋으로 맞추고 `npm ci && npm run build`를 한다.
  - **성공하면:** `dist/`를 `~/fls-play/releases/<시각>-<커밋>/`에 복사하고 커밋 표시·`build.json`을 넣은 뒤, `current`를 원자적으로 바꾼다(`ln -s` 임시 이름 + `mv -T`). 서빙 중인 것 말고 최근 3개를 남긴다.
  - **실패하면:** `current`는 그대로라 이전 빌드가 계속 나간다. 상태가 `failed:npm-ci` 또는 `failed:build`가 되고, 같은 머리는 5분마다 다시 빌드하지 않는다(본선이 움직이거나 `--force`까지).
  - 한 번에 하나만 돈다(`flock`). 성공한 뒤에는 새 커밋의 `update.sh`·`serve.mjs`로 설치 사본을 바꾸고, `serve.mjs`가 바뀌었으면 서버를 재시작한다.
- **systemd(사용자 단위):**
  - `fls-play.service`: 서버. 늘 재시작하고, Tailscale 주소가 늦게 올라오면 5초마다 다시 붙는다.
  - `fls-play-update.timer` → `fls-play-update.service`: 켜진 뒤 1분, 부팅 뒤 2분, 이후 확인이 끝날 때마다 5분 뒤에 돈다.
  - 사용자 단위라 로그인 없이 부팅 때 뜨려면 `loginctl enable-linger`가 한 번 필요하다(유일한 sudo 단계).

## 다시 설치하기
```sh
ssh hyunlord@100.70.109.50
git clone -b codex/phase15-organic-ground https://github.com/hyunlord/feudal-lord-simulator ~/fls-play/repo   # 없을 때만
~/fls-play/repo/deploy/play-server/install.sh
sudo loginctl enable-linger hyunlord   # 한 번만(재부팅 뒤 자동 시작)
```
- **지우기:** `systemctl --user disable --now fls-play.service fls-play-update.timer && rm -rf ~/fls-play ~/.config/systemd/user/fls-play*`

## 확인
- **브라우저 검사:** `deploy/play-server/check.mjs`(Chrome 필요)는 두 가지를 본다.
  - 새 게임 frameWork: 증명 포트가 localhost에서만 열려서 `ssh -N -L 4174:100.70.109.50:4173`로 같은 빌드를 연다.
  - 저장 유지: 실제 주소에서 IndexedDB를 새로 고침 전후로 읽는다.
- **보고서:** [PLAY-1](verification/play1-server/REPORT.md)

## 로컬 대안
서버가 없을 때는 Mac에서 저장소 `npm run play`를 쓴다(빌드 후 `127.0.0.1:4173`를 열어 준다). 저장은 주소별이라 서버 쪽 저장과는 따로다.
