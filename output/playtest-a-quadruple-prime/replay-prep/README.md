# A⁗ 자연 플레이 상태 보존 준비

**상태:** 수집·복원 도구 준비 및 첫 화면 연기 검사만 완료. A⁗ 자연 플레이, 5분 연속 수집, 목책 관문 판정은 아직 실행하지 않았다.

도구: [`scripts/a4SnapshotCapture.mjs`](../../../scripts/a4SnapshotCapture.mjs). 제품 `src/`, 빌드 결과, UI, 엔진, 저장 형식은 수정하지 않는다. 수집기는 플레이어가 보는 Chrome 화면에 CDP로 별도 연결하고, 현재 React `GameProvider`의 **전체 `GameState`**를 읽기만 한다. 플레이 입력·일시정지·속도 변경·DOM 변경은 보내지 않는다. `phase10-proof` 요약 상태를 사용하지 않으며 그 옵션이 있는 화면은 거부한다. 수집 프로세스와 그 출력은 별도 운영자가 관리하고 플레이어 에이전트에게 전달하지 않는다. 이 분리는 절차상 정보 차단이며, 같은 OS 사용자 권한의 파일 접근을 기술적으로 막는 보안 경계는 아니다.

## 운영 절차

1. 동일 제품 HEAD에서 `npm run play`로 4173 production preview를 연다. 별도 Chrome 프로필을 아래 명령으로 실행하고 `http://127.0.0.1:4173/` 한 탭만 연다. Playwright가 Chrome을 띄우는 경우에도 같은 원리로 `--remote-debugging-port=9223` 인수를 전달한다. 플레이어가 받는 것은 화면 스크린샷과 마우스/키보드 입력 인터페이스뿐이다. CDP 포트·수집기 출력·원시 파일·DOM/콘솔은 플레이어에게 보내지 않는다.

   ```sh
   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --remote-debugging-port=9223 --user-data-dir=/tmp/a4-natural-player-chrome --no-first-run --new-window http://127.0.0.1:4173/
   ```
2. 첫 화면 시각과 수집 시작 시각을 각각 기록한다. 관찰 담당자가 다음 명령을 실행한다. `raw/`는 비어 있어야 하며 파일을 덮어쓰지 않는다.

   ```sh
   node scripts/a4SnapshotCapture.mjs capture --first-screen-utc 2026-09-23T20:00:00.000Z --cdp-port 9223 --out output/playtest-a-quadruple-prime/replay-prep/raw --minutes 60 --interval-minutes 5
   ```

3. 예시 UTC는 실제 첫 화면 시각으로 교체한다. 수집기는 그 시각(0분)과 이후 실제 경과 5, 10, …, 60분에 상태를 저장한다. 단조 시계로 예정 시각을 계산하며 각 파일에 첫 화면 UTC·관찰자 시작 UTC·예정 UTC·실제 캡처 UTC·실제 경과 밀리초를 함께 기록한다. 처리 지연으로 캡처가 늦으면 해당 실제 시각을 그대로 보고하고 정확한 정시 스냅샷이라고 주장하지 않는다. 종료선 판정은 별도 자연 플레이 화면 캡처가 우선한다.
4. `minute-NNN.json`에는 `GameState`의 모든 직렬화 가능한 필드, 당시 속도, 대상 탭 ID/URL, 제품 git HEAD, `dist/` 전체 파일 목록과 내용으로 만든 SHA-256 지문, 수집 스크립트 SHA-256이 있다. `manifest.jsonl`에는 파일 SHA-256과 상태 JSON SHA-256, tick, 예정·실제 시각을 저장한다. 원시 폴더는 0700, 파일은 0600 권한으로 만든다. 수집 파일은 수정하지 않는다.
5. 중단 원인을 재현할 때는 **같은 HEAD·같은 `dist/`**의 새 Chrome 탭을 기본 시작 화면에서 일시정지(tick 0, speed 0) 상태로 열고 별도 관찰 담당자가 다음 명령을 실행한다. 복원은 플레이어의 기존 탭이나 원본 자연 플레이를 변경하지 않는다.

   ```sh
   node scripts/a4SnapshotCapture.mjs verify --snapshot output/playtest-a-quadruple-prime/replay-prep/raw/minute-025.json --manifest output/playtest-a-quadruple-prime/replay-prep/raw/manifest.jsonl
   node scripts/a4SnapshotCapture.mjs restore --cdp-port 9223 --snapshot output/playtest-a-quadruple-prime/replay-prep/raw/minute-025.json --manifest output/playtest-a-quadruple-prime/replay-prep/raw/manifest.jsonl --out output/playtest-a-quadruple-prime/replay-prep/restoration
   ```

복원은 기존 `commit_simulation_state` 전이를 호출해 저장한 상태를 새 화면에 넣는다. SHA-256·HEAD·빌드 지문을 먼저 검증하고, 주입 뒤 다시 읽은 **전체 상태 해시와 tick이 정확히 일치**해야 영수증을 기록한다. 복원 화면은 일시정지 상태다. 중단 도시(`settlement.outcome=abandoned`)는 기존 reducer가 외부 주입을 거부하므로 복원 불가로 명시적으로 실패한다. 수집된 속도는 기록하되 자동으로 재개하지 않는다. 카메라·선택 도구·열린 패널·표시 안내 등 React 표시 상태는 `GameState`가 아니므로 복원되지 않는다. 복원된 화면의 후속 진행은 **자연 플레이 원본이 아닌 QA 재생**이라고 표기해야 한다.

## 준비 검사

2026-09-23 UTC, 별도 4183 preview와 9223 CDP Chrome으로 정상 첫 화면에서 `--minutes 0` 원시 상태를 수집했다. 원시 파일 SHA-256은 `6da76cc20cd099aa269d22657030b50834b220036ad46579aa44deeb75559c82`; 저장 상태 해시는 `00088342a7993680ecf1fd5fcd919f0452d9a86324f4e4c0ffc499bca1483e1d`, tick 0이다. 새 탭에 복원 후 전체 상태 해시/tick 일치를 확인했다. 이어 이 원시 상태의 복제본에서 **시험용으로** tick을 42, treasuryTimber를 147로 바꿔 별도 `smoke-synthetic/`에 저장했고, 다시 새 탭에 주입해 전체 상태 해시 `45984bb2fe2131c371ae6354003c1c7253962f3469a02b7c420d5e2691a198bd`와 tick 42 일치를 확인했다. 이 합성 시험은 비0 tick 주입 작동만 증명한다. 진행된 자연 상태의 복원이나 60분 수집 성공 증거는 아니다. 시험 Chrome/preview는 종료해 4183·9223 포트 해제를 확인했다. React 내부 fiber 구조가 바뀌면 수집기는 추정으로 진행하지 않고 오류를 낸다.
