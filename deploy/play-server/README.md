# deploy/play-server — 상시 플레이 서버 (PLAY-1)

본선 빌드를 DGX Spark(Tailscale `100.70.109.50:4173`)에 늘 띄워 두고, 5분마다 본선이 바뀌었는지 보고 다시 빌드한다. 사용법·운영: [docs/PLAY_SERVER.md](../../docs/PLAY_SERVER.md).

| 파일 | 하는 일 |
|---|---|
| `install.sh` | 사용자 단위 설치: `~/fls-play/{bin,state,releases}`, 저장소 클론(없으면), systemd 사용자 단위 설치·활성화, 첫 빌드 |
| `update.sh` | 본선 확인 → 빌드 → `current` 심볼릭 링크 원자 교체, `state/status.json` 기록. 실패 시 이전 빌드 유지 |
| `serve.mjs` | Node 내장 모듈만 쓰는 정적 서버. `current`, `/status`, `/status.json` |
| `systemd/fls-play.service` | 서버(늘 재시작) |
| `systemd/fls-play-update.service`, `.timer` | 5분 주기 갱신 |
| `check.mjs` | 브라우저 확인(새 게임 frameWork, IndexedDB 저장 유지) |

`~/fls-play` 배치:
```
repo/                 저장소(빌드 전용 체크아웃, update.sh가 reset)
releases/<시각>-<커밋>/  빌드 결과 사본 + build.json + 커밋 표시
current -> releases/…  서빙 중인 빌드
bin/                  설치된 update.sh, serve.mjs
state/                status.json, updates.log, build-<커밋>.log, update.lock
```

비밀번호·키는 쓰지 않는다. 저장소는 공개 HTTPS로 받는다.
