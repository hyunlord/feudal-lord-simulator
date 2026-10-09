# 과거 재현 산출물 일관성 검증

validateHistoricalReplayArtifacts는 외부에서 확인한 manifest SHA와 원본 기준 묶음, 이름별 바이트 접근자를 받는다. 허용된12개 산출물의 해시를 모두 확인하고 원문 NDJSON과 gzip을 스트리밍 대조한다. 원래125년 결과 전체 JSON, 원래 보고서 summary, 기준56/16/40집합, 관측 기록과40행 집계를 다시 계산해 저장된 결과와 비교한다. 관측 오류·쓰기 오류는0, callback/기록/manifest 행 수는 일치해야 한다.

바이트 또는 비동기 바이트 청크 접근자를 지원한다. 시뮬레이션이나 엔진 모듈을 실행하지 않는다. 시험의 재현 묶음은 명시적인 합성 자료이며 실제 실행 성공을 뜻하지 않는다.

반환값 artifactConsistencyVerified는 파일 간 일관성만 나타낸다. 도구·계측·선행 실행 기록은 해시로 묶이지만 실제 소스·런타임·종료·계측 비간섭은 외부에서 별도로 확인해야 한다. applicabilityAllowed·fullStateComparable·perTickComparable·originalRuntimeVerified·completeCausesVerified 및 externalChecksVerified는 false다. 부재40개 원인 분류와 실제 과거 재현은 아직 미완료다.

검증: node --test tests/engineBHistoricalReplayReport.test.mjs 9/9 통과, 저장소 ESLint 통과. 해시 교체·필수 자료 누락·경로 추가·전체 결과/요약/집계 변조·관측 실패·잘린/잘못된 NDJSON·gzip 및 접근자 스트림 오류를 거부했다.
