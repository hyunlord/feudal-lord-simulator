# 공식 동기화 범위 보충 — 2026-10-04

기존 REPORT/PREFLIGHT/해시 파일은 동결 그대로 보존했다. `helperInOfficialSyncList=true`는 실행 helper 소스가 공식 파일 목록에 포함된다는 뜻이며, 그 디렉터리의 모든 파일이 전송된다는 뜻이 아니다.

## 직접 확인한 로컬 근거

- `git check-ignore -v output/steward-probe-v3/unit-test.log` 결과: `.gitignore:6:*.log`.
- `scripts/remote/run.sh:129–133`은 `git ls-files -co --exclude-standard`로 추적 파일과 무시되지 않은 미추적 파일을 수집한다. 따라서 이 미추적 과거 테스트 결과 로그는 전송되지 않는다.
- `output/steward-probe-v3/stewardProbe.ts:2–21`의 실행 import 및 보조 모듈, `sourceManifest.ts:6–25`의 검증 입력에서 `unit-test.log`를 읽는 경로는 없다. 로그는 기존 검증 결과물이며 이번 시뮬레이션의 실행 입력이 아니다.
- 기존 SOURCE_SHA256SUMS는 로컬 감사 범위 26개 파일의 핀이다. 원격 실행 입력 26개가 모두 존재한다는 보증으로 해석하면 안 된다. 로그 SHA는 `3809039d5c0d375230f5b2066ad42f1964d68f3c3c6368f402e947926a86210c`이다.

## 부모가 전달한 원격 관측 — 이 작성자가 원격 재확인한 값 아님

부모는 `astra-steward-seed3-fen-growth-r08-5fb1aeb` 공식 실행 시작 및 scope suffix `1791077860`을 보고했다. 26개 감사 핀 중 이 로그만 미전송이며, 나머지 25개가 일치한다고 전달했다. 최초 누락 오류 원문과 25개 재검증은 부모 lifecycle 기록이 원본 증거다. 본 보충은 그 실행 성공 또는 150년 완주를 판정하지 않는다.

로그 부재는 실행 입력 누락으로 보지 않는다. 실행 이후 소스 불변, 실제 종료 상태, 완주 조건은 기존 보고서의 별도 검증 조건을 유지한다. SSH·엔진·브라우저 실행은 수행하지 않았다.

## 보존 파일 SHA256

- `REPORT.md`: `b8693e9821adb5d23820501f5647f98d175acc34f0edeb2c7c18e41b06e86840`
- `PREFLIGHT.json`: `1b5962f9aa59b949d09b4f7e157918ca78d2280e0a28b287fb45ec9be28e33fc`
- `SOURCE_SHA256SUMS`: `281d94a4067dbbf11a83d01bf109d6c068475b9d748b96e4afaca48eb5606a1e`
- `SHA256SUMS`: `0ee0cc7b8ef9566f670399e81518c3f2c14b604ab884496e387d9eb24d76b326`
