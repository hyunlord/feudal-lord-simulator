# R02 후보 변경

061 b/c recurring=true 명령 그대로, 홈12·지도밖 반복청원의 전역 재상신 비용을 label/tradeoff/limits에 명시.143c set_market_dues800과153c order_timber4를 사건 선택에서 제거했다. 각 a/b의 실제 증거비용·명령·조건은 그대로다.

200 ID·모든 비활성·차단과 가드·역사 근거를 유지했다.020/135/166/181은 기존부채로 남기며161은이번수정대상아니다. 현재572선택·395명령이다. 원본 신규140동결·NE10미구현 언급 등 아래는 당시 기록이며 현행지원은 ENGINE_SUPPORT를 따른다.

---

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

## 독립검수 후 061 범위 교정

홈12는 recurring=true가 선례 처리를 막는다. 청지기 위임 지도밖은 금액/권리/혼인 예외에 먼저 맞아야 다시 상신한다. c의 rights=false를 명확히 하고 직접 감독은 별도로 구분했다. 같은6필드만 바꾸었고 명령·registry는 그대로다.

## 061c 결과문장 범위 교정

원장·연대기 두 문장도 홈 청원, 위임된 지도 밖 영지의20d이상·혼인 청원 상신과20d미만 비혼인 청원의 청지기 처리를 구분했다. 앞선6필드와명령은 그대로다.
