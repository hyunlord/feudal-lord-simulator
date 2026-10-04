# Charter & Kin 사건·청원 v4 정본

**읽을 정본은 events-v4.json 하나다(200개).** registry-v4.json은 같은200개의 A 형식 등록 중간명세이며 실행 가능한 현행 LM-E9 코드가 아니다. 이전 입력은 records/inputs/에만 증거로 보존했다.

- 기존001~060 두 갈래 병합,061~200 B 기준 전수 검토.
- A+B 판단49개, A 기반151개. A/B 실질충돌22개 사건은 MERGE.md에 선택 이유를 남겼다. A-only 편집쟁점58개와는 별도 집계다.
- 200개·576선택. A 원고 대비171개 원고,154개 연도창 변경. 원고/등록조건/달력/중복계약을 함께 맞췄다.
- JSON Schema 2종, 구조 검사2,902개, 조건단편 경계77건 통과. 게임 설치·노출 빈도·실행 검증은 하지 않았다.
- 남은 문제는 REMAINING.md의7종. 모든 enabledInEngine=false 및 기존 차단 유지.

## 파일

- events-v4.json / events-v4.schema.json: 편집 정본과 A+B 형식 스키마.
- registry-v4.json / registry-v4.schema.json: 정적 등록제안과 스키마.
- MERGE.md:200개 각각 출처·충돌·이유·남은 문제.
- CHANGES.md / records/CHANGES.json: 변경 요약과 원고 필드 전후값.
- ADAPTER_CONTRACTS.json: v4 소송별 중복계약을 중앙·scoped 양쪽에 반영한 계약 정본.
- READ_MODEL·COMMAND_CONTRACT·EDITORIAL_CONTRACTS_R05·기타 계약: A의 미구현 계약을 승계. 사건별 v4 원고·등록기 변경과 아래 판정 문서를 함께 읽는다. inherited 문서 안의 이전 납품본 상대 경로·실행 보고는 과거 근거이며 현재 검증으로 해석하지 않는다.
- records/ENGINE_REVIEW.md / INDEPENDENT_REVIEW.md / DEDUP_REVIEW.md: 독립 검토 근거. 초기 발견과 최종 정정이 함께 있으므로 후속 정정까지 읽는다.
- records/SOURCE_MANIFEST.json: 읽은 원본의 고정HEAD·해시. 출력 파일 무결성은 최상위 SHA256SUMS가 증명한다.

## 다시 검증하기

`sh validate.sh` (Ruby, uv 필요). JSON Schema 도구 check-jsonschema0.38.2를 사용한다. 이 스크립트는 저장소를 수정하거나 게임을 실행하지 않으며 패키지 안의 정적 결과 JSON만 갱신한다.

원본 저장소 HEAD:7e0c93c34b1c6e090716f88ed7337a33cf5400f2, 가지 codex/phase15-organic-ground. 저장소 코드 수정·커밋·푸시·콘텐츠 설치 없음.

상대 계약은 contracts/에 포함했다. registry.sourceScopes는 이 패키지의 contracts/ 경로를 가리킨다. ADAPTER_CONTRACTS.json 참조는 패키지 루트이며 나머지 상대 참조는 해당 scope에서 해소한다. 과거 원고를 새 정본 위에 다시 덮어쓰면 안 된다.
