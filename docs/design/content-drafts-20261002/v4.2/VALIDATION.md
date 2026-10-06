# 검증 범위와 결과

- 최신 본선 실제 registryV4Support 호출: 215개 중86개 지원. docs의 enabledInEngine=false는 미설치 초안 메타데이터이므로 활성 여부로 쓰지 않았다.
- 사건86개·선택270개 전수 판정. 수정30개 event/registry ID 일치. 통합215개, 미수정185개 보존.
- v4.1 Schema에서 배치 수 제한만30으로 바꾼 v4.2 Schema 통과. 객체·효과·표현식 계약은 유지. events number 최대215 유지.
- 수정30개 모두 역사 근거·기간·재발 계약 보존. 실행 변경은150·163·165·206·209의5개뿐.
- 최신 엔진에 외부 수정 데이터 주입: 지원86개 유지. 목재60사례, 증거 선택2개, 중복 증인/43d 부족/원자 실행 경계 통과.
- 목재 검사는 구성한 상태에서의 명령·납품 검사다. 모든 조건 조합이나 무작위 출현을 전수 검증한 것은 아니다.
- 독립 원고 검수 통과. 브라우저 읽기성·125년 밀도·사용자 재미는 미검증.
- 저장소 코드는 수정하지 않았다. 고정 HEAD 및 입력 해시는 records/INPUTS.json.

재현: node proofs/verify-data.cjs; python jsonschema로 두 schema와 json을 각각 검증. 실행 검사는 proofs/verify-engine.mjs의 REPO/ESBUILD_FROM 설명을 따른다. 산출물 생성 스크립트는 저장소를 쓰지 않는다.

SHA256SUMS는 자기 자신을 제외한 파일 전부를 포함한다. 최종 ZIP의 CRC·재압축 해제·모든 해시·정확한 파일 집합 검증은 ZIP 옆 .verification.json에 기록한다.
