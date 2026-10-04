# Wave2 검수 반영 — 별도 수정본

원본 event-context-wave2와 정본650을 수정하지 않았다. 22개 문장·9개 필드 계약·원래 176 fixture는 그대로다. 원본 manifest는 ORIGINAL_SHA256SUMS로 보존했다.

CONTEXT schema는 known 상태에서 해당 template의 정확한 필드를 필수로 요구한다. 다른 template의 필드, 빈 필드, 누락, 알 수 없는 enum을 거부한다. recordTick은 0..9007199254740991 정수이며 sourceHead는 근거 HEAD 상수다. provenance와 referenceVerified 조건도 해당 필드 계약에 묶었다. unknown은 빈 fields만 허용하며 기존 fallback으로 간다.

PROPOSAL schema도 필드 계약9개·문장22개·template별 condition enum·eq/in 형식·비어 있지 않은 when·factline 유지·새 이름 슬롯 금지를 검증한다. 실제 기록 ID와 tick에 연결되었다는 사실은 JSON schema만으로 증명되지 않는다. 고정 h-test/1000 선택 fixture는 참조 모델이며 capture/저장복원/포매터 실행이 아니다.

ADOPTION_LIMITS는 expiry의 명시 거절 사실줄 충돌1건을 계속 차단한다. 시장도시2건은 headline과 사실줄을 함께 읽으면 완공으로 오해할 수 있어 최종 조합 검수까지 사용을 보류했다. 기본 사실줄 수정 제안은 “목책을 두를 경계를 정하고 시장도시를 선포했다”이며 엔진 원문을 바꾼 것은 아니다.

독립 검수의 negative5유형(음수 tick·unsafe tick·필수필드 누락·다른 template 필드·빈 HEAD)을 9개 template 모두에 검사한다. 잘못된 타입·소수 tick·provenance·unknown과 사실 혼합도 검사한다. 양성176 원래 fixture를 SHA로 보존하고 정상 context22개 및 safe tick 경계2개를 스키마로 검사한다.
