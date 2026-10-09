# 과거 판 기준 묶음 검증

원본 56ee1d9의 run·report·context 압축 파일 세 개를 입력받는 순수 검증기를 추가했다. 각 압축 및 원문 SHA-256, report의 입력·문맥 해시 연결, 1300–1424년 범위, 발생85건과 지원56·관측16·부재40의 정확한 ID 집합을 대조한다. 누락·추가·교체·손상 입력은 거부한다.

이 검증은 보관된 기준 자료의 일관성만 입증한다. 새 재현의 실행 소스, 원래 런타임, 전체 상태 또는 40건의 부재 원인을 입증하지 않는다. 반환값의 applicabilityAllowed·fullStateComparable·originalRuntimeVerified는 항상 false다.

검증: node --test tests/engineBHistoricalReference.test.mjs tests/engineBHistoricalProjection.test.mjs 19/19 통과(기준 검증8·전체 JSON 비교11). 두 신규 파일의 저장소 ESLint 통과. 실제 시뮬레이션 실행 없음.

구현: scripts/engineBHistoricalReference.mjs, tests/engineBHistoricalReference.test.mjs. 고정 원본은 docs/verification/lm-e9c-final/distribution/{run-1,report-1,context}.json.gz. 공유 sourceScan 실패1·기하 미등록4와 실제 답변/계절 UI 공백은 해소하지 않았다.
