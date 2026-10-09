# 과거 판 보관 결과 비교기

관문: **도구 준비, 과거 판 재현 미실행**. `scripts/engineBHistoricalProjection.mjs`는 원래 seed1 판의 전체 반환 JSON을 비교하는 순수 함수다. 엔진을 가져오거나 틱을 진행하지 않는다.

`compareHistoricalProjection(referenceGzip, replayJson)`에 원래 압축 파일의 바이트와 비교할 JSON 바이트를 전달한다. 기준은 `docs/verification/lm-e9c-final/distribution/run-1.json.gz`이며 압축 SHA와 원문 SHA 둘 다 코드에 고정했다. 다른 기대 객체나 다시 압축한 파일로 기준을 바꿀 수 없다.

- 파싱한 반환 객체 전체를 `deepStrictEqual`로 비교한다. 필드를 추리거나 버리지 않으며 중첩 키·값·형식·배열 순서를 모두 검사한다. 객체 키 순서와 JSON 공백은 의미상 비교에서 제외하되 양쪽 원문 바이트 해시를 따로 기록한다.
- 실패하면 `projectionMatched:false`와 첫 불일치의 JSON pointer를 돌려준다. 파일 기록은 후속 실행 래퍼의 책임이다.
- 성공의 뜻은 `projectionMatched:true`뿐이다. `applicabilityAllowed`, `fullStateComparable`, `originalRuntimeVerified`는 항상 false다. `sourceRevision`은 고정된 기준 자료의 소스 식별자이며 비교 대상 실행의 소스를 검증했다는 뜻이 아니다.
- `report/context`의 지원 집합, 재현 소스·런타임·계측 무간섭, 관측기 오류 및 실행 순서 관문은 이 함수의 검사 범위 밖이다. 이 조건들을 별도로 검증하기 전에는 새 후보 기록을 과거 40건의 원인 자료로 적용할 수 없다.

원래 보관 자료에는 전체 GameState·틱별 체크포인트와 정확한 Node/작업 트리 상태가 없다. 따라서 향후 JSON이 같아도 전체 내부 궤적, 원래 실행 환경 또는 모든 숨은 원인이 같았다는 증거가 되지 않는다.

검증(Mac): `node --test tests/engineBHistoricalProjection.test.mjs` 11/11 통과, 저장소 ESLint·diff 검사 통과. 실제 보관 파일과 변조한 복사본으로 정상 일치·중첩 필드 변경/누락/추가·배열 순서/길이·스칼라/배열 형식·잘못된 JSON·대체 기준 거부를 확인했다. 자기 자신과의 비교는 비교기 시험이며 새 시뮬레이션 결과가 아니다.

P-M1: 없는 상태를 만들지 않는다. P-C3: 비교 일치를 인과 판정으로 확대하지 않는다. 기존 가드레일 → 전체 답변 재현 → 실제 계절 UI 순서는 유지하며, 과거 판의 무거운 재현은 그 뒤에만 실행한다.
