# S0 독립 코드 검토

검토 범위: `scripts/growthStateRecord*.ts`, `tests/growthStateRecord.test.ts`, B8 schema v2 migration/codec/fingerprint/determinism 및 관련 테스트. 제품·테스트 파일 수정 및 커밋 없음.

## 발견 1 — 중간: 잘못된 checksum 타입이면 무결성 검증이 생략됨

- 위치: `src/save/saveCodec.ts:74`의 `typeof raw.checksum === "string"` 조건과 `validateEnvelope`.
- 조건: envelope에 checksum이 존재하지만 숫자/null/object 타입인 경우, decodeSave가 검사를 건너뛰며 validateEnvelope도 해당 필드 타입을 확인하지 않는다.
- 영향: 손상된 checksum과 변경된 state를 함께 가진 파일이 정상 저장 데이터로 받아들여진다. 타입이 잘못된 checksum은 무결성 검증을 생략할 근거가 될 수 없다.
- 재현(현재 작업 트리에서 실행): v1 `population-176.save.json`을 JSON parse → `state.treasuryTimber=999999`, `checksum=123` 설정 → JSON stringify → decodeSave.
- 실제 결과: `{"accepted":true,"schema":2,"timber":999999,"checksum":123}`.
- 필요한 수정: checksum 필드가 존재하면 우선 string 타입임을 검증하고 아니면 SaveFormatError로 거부. 문자열이면 migration 전에 현재 방식으로 검증. checksum 없는 legacy v0 입력의 계약은 유지.

## 발견 2 — 낮음: 결정론 보고서의 hash 범위 설명이 실제 계산과 다름

- 위치: `scripts/verifySaveDeterminism.ts:199`.
- `canonicalStateHash`는 root pathCache를 제외하지만 보고서 필드 `hash`는 여전히 `sha256 of canonical (sorted-key) JSON of GameState`라서 전체 상태 일치처럼 읽힌다.
- 필요한 수정: 출력 설명에 root pathCache 제외를 명시. 저장 checksum이 전체 state를 계속 검사하는 점과는 분리해서 기재.

## 확인 근거

`npx tsx --test tests/growthStateRecord.test.ts tests/saveSchemaMigration.test.ts`: 7/7 통과 (`/tmp/s0-review-tests.log`).

- 25분 상한은 부모 프로세스 watchdog이 자식 동기 루프와 독립적으로 SIGKILL하여 처리한다.
- 10초 판단 입력은 decision-start에서 JSON 복사본으로 전송되며, 실제 debugger stack을 위치와 함께 저장한다.
- 자연 opening 240틱 원 driver와 계측 worker의 full state parity 테스트는 통과했다. 이보다 긴 전 구간의 동등성을 입증했다고 해석하지 않는다.
- v1→v2는 state를 건드리지 않고 schemaVersion만 이동하여 timber 관측 이력을 발명하지 않는다.
- 현재 검사 범위에서 위 2건 외 재현 가능한 버그를 찾지 못했다.

## 최종 수정 확인
체크섬 숫자/null/object를 거절하는 회귀 테스트와 체크섬 사전검증을 반영했다. 결정론 보고의 schemaVersion 및 pathCache 제외 설명도 수정했다. 저장 테스트 29/29 통과.
