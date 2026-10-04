# 수정 기록

- calendar headline 한 개만 교체: 내부 마감의 역사화와 근거 없는 인과 표현 제거.
- inherited.son/kin: 문구 삭제나 engine 수정 대신 sidecar BLOCK_FACT_LINE_CONFLICT 두 개 명시.
- PROPOSAL.schema: fields 정확6개/중복 금지/정본 계약 값; fallback 필수와 허용값; additions20개; variant 필수필드; when 정확1개; 템플릿별 문맥 필드 및 eq/in 도메인 연결.
- CONTEXT.schema: known은 템플릿에 맞는 단일 필드·출처·검증참조 필수, unknown은 빈필드만, recordTick≥0, 고정 sourceHead.
- selector 앞 schema검사 추가. schema통과를 실제 capture 어댑터/참조 진실성 증거로 계산하지 않음.
- 현재 정본 대신 independent-review의647 사본 SHA 고정. 원본fixture166 바이트 보존.
- negative schema74사례: fields/fallback 빈 구조, 오도메인, 필수필드 누락, 템플릿/출처 교차, 잘못된 op형식, 음수tick, unknown에 주입한 사실 등.
- 코드/렌더/원본proposal/현재 정본 수정 없음. 독립 검수 원문과 소스9개19구간 계약 유지. 수정본은 별도 독립 재검수 전 작성자 검증 상태.
