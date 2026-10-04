# v4 정적 검증 결과

- JSON Schema: 원고200개 / 등록중간명세200개 모두 PASS. check-jsonschema0.38.2.
- 구조·연도·선택ID·원고/조건 동기화:2,902개 단언 PASS.
- 수정한 세율·소송 연도/쿨다운·무명령 보류 조건단편:77건 PASS.
- A 미지원필터·선택차단 보존, 중앙/scoped 계약, 원본해시, 후임ID 연결:626개 단언 PASS.
- 200개 ID 연속·유일,576선택. 모두 enabledInEngine=false, 최소 실질선택2 보존.
- 독립 검수: IR-01 소송후보 탐색은 R2에 미결로 기록. IR-02 후임ID 누락은 수정 후 검사.
- 전용 clone HEAD7e0c93c34b1c6e090716f88ed7337a33cf5400f2, git status --porcelain 출력 없음. 코드·콘텐츠 설치·커밋·푸시 없음.

원시 결과는 records/*VALIDATION*.json, FINAL_CHECKS.json, BOUNDARIES.json, VALIDATION_LOG.txt에 있다. 압축은 ZIP CRC와 재추출 SHA256SUMS를 별도로 검사했다. SHA256SUMS 자체는 자기참조를 피하려고 해시 목록에서 제외한다.

검증의 한계: 등록 중간명세 평가·게임 실행·노출 빈도·실제 저장복원·새 키 마이그레이션·원전 전체 재감수는 수행하지 않았다. 스키마와 정적 조건단편의 통과를 런타임 통과로 읽으면 안 된다.
