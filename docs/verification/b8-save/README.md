# B8 저장 시스템 검증 증빙

모든 캡처는 **자동 검증 스크립트 실행**(`scripts/verifyBrowserContinue.mjs`, headless Chrome, CDP 마우스 입력)이다. 사람 플레이도 자연 플레이 기록도 아니다. 1회차 2분 동안 게임 안 `자동 발전`을 켰다.

| 파일 | 내용 |
|---|---|
| `determinism.json` | 관문 ①: seed 1~5 최종 상태 + 새 게임 10,000틱, N=24,000. `straight`(같은 프로세스) vs `reload`(새 프로세스에서 저장 파일 열기), 자동 저장(1,200틱마다) 켠 실행, 자동 저장마다 다시 불러와 이어 가는 실행. 해시는 키 정렬 JSON의 SHA-256 |
| `browser-continue.json` | 관문 ②: 새 게임 2분 → 일시정지(자동 저장) → 새로고침 → `이어하기` → `지금 저장`으로 기록한 상태와 비교. 이어서 30초 더 → 탭 닫기 → 새 탭 → `이어하기` |
| `reload-0-before.jpg` / `reload-2-after-continue.jpg` | 새로고침 전/후 |
| `reload-1-welcome-continue.jpg` | 첫 화면 `이어하기` 요약 |
| `tab-0-before.jpg` / `tab-2-after-continue.jpg` | 탭 닫기 전/다시 연 뒤 |

재현:

```bash
npm run verify:save-determinism                 # 관문 ①, 약 3분
npx vite build && npx vite preview --host 127.0.0.1 --port 4183 --strictPort &
B8_URL=http://127.0.0.1:4183/ node scripts/verifyBrowserContinue.mjs docs/verification/b8-save 120   # 관문 ②
```

`browser-continue.json`의 `frameIntervalMs`는 headless Chrome 기준이며, 기준선(`baselineFrameGaps`, 저장 없음)도 약 100ms(약 10fps)다. 저장 순간 프레임 간격은 이 기준선과 같았다. 저장이 더한 메인 스레드 작업은 `frameWorkMs`로 본다.
