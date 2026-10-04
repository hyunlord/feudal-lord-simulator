# 누적판 변경 목록

기존001–060은 별도 originals/baseline/events.json에 byte 그대로 보존했다. v2대비45건 무변경, v3교체15건 정규 JSON 동치 확인. 신규061–200은 네 작성 묶음의 frozen 입력 그대로 추가했다. 기존 content/에는 쓰지 않았다.

호출 정의의 같은 sourceRef metadata 확장은 병합하고 모든 출처별 원문 정의를 PROVENANCE/SOURCE_CATALOG에 보존했다. ID 충돌·다른 호출/파생 구현은 자동 해결하지 않았다. 상대 sidecar 계약은 registry.sourceScopes 아래 originals 작성묶음 기준이다.

NE10은 역사 v2 문서의 철회 기록과 현재 홈 선례 미구현 정정을 함께 보존한다. EFFECT_CATALOG의 legacyMarkdown 표시는 현행 구현 완료가 아니다.

- legacy_NE10_conflict: NE10
- read_model_metadata_extension: engineCalls:marriageGrooms
- read_model_metadata_extension: engineCalls:marriageRefusal
- read_model_metadata_extension: engineCalls:jointurePiece
- read_model_metadata_extension: engineCalls:marriageCandidates
- symbolic_fragment_alias_adapter_required: all
- blocked_templates_not_dispatchable: all
- unsupported_context_aliases_preserved_blocked: all
- binding_extension_adapter_required: all
- policy_aliases_need_adapter: all
