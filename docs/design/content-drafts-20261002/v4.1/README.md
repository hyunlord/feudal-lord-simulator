# Charter & Kin v4.1 추가·수정분

- `events-v4.1.json`: 원고 delta16건 = 011 수정 + 신규201–215.
- `registry-v4.1.json`: 같은16건의 실행 조건·대상·명령·반복 delta.
- `*.schema.json`: v4 레코드 계약을 유지한 delta Schema.
- `CHANGES.md`: 사건별 변경 및 통합 주의.
- `EXPECTED_DISTRIBUTION.md`: 기존 실측과 가정 기반 예상의 구분.
- `VALIDATION.md`, `proofs/`: 실제 LM-E9b 단위 실행·독립 편집 검수.
- `SOURCES.md`, `contracts/sources.json`: 역사 근거14개와 검증 범위.
- `REMAINING.md`: R5·미지원 맥락 및 장기 분포 미검증.

## 통합 계약

1. v4 원본 배열을 `id` 키로 병합한다. **011은 교체**, 201–215는 추가. 001–200 중 다른199건은 수정하지 않는다. registry의 entries도 같은 규칙으로 병합한다. 원고와 등록기 중 하나만 적용하면 안 된다.
2. 충돌하는201–215가 이미 있으면 덮어쓰지 말고 담당 편집자와 ID 예약을 조정한다. 011 교체 외에 기존200건 삭제 없음. 합친 건수는215.
3. LM-E9b의 기존 `buildRegistryV4.ts`는 정본 경로에 있는 두 파일을 읽는 생성기다. 통합 담당자가 원본과 delta를 병합한 뒤 정본 입력으로 놓고 생성한다. delta만200건 대신 넣으면 다른 사건이 사라진다.
4. `enabledInEngine:false`는 v4의 미설치 편집 파일 표식을 유지한 것이다. LM-E9b 생성기는 이 표식을 제거하고 실제 `unsupportedFilters`·읽기·명령·최소 선택 조건으로 지원 여부를 판단한다. 이번 검사에서는16건이 실제로 지원됐으며, 이 ZIP은 게임에 설치하지 않았다.
5. READ_MODEL의 새 파생 이름이나 새 엔진 함수를 추가하지 않는다. 011의 잘못된 이름은 제거했고 신규 바인딩은 기존 DSL만 사용한다. 기존 COMMAND_CONTRACT·ADAPTER_CONTRACTS의 역할도 바꾸지 않는다.
6. 장기 판은 저장소 실행기 규칙에 따라 설치 담당자가 DGX에서 비교한다. 이 납품은 원격 병합·게임 배포·125년 관문 통과를 뜻하지 않는다.

검사: `bash validate.sh`. JSON Schema 검사에는 Python의 `jsonschema` 패키지가 필요하다. 납품 생성에 사용한 환경에는 설치되어 있었다. `SHA256SUMS`는 자기 자신을 제외한 모든 납품 파일을 포함한다.
