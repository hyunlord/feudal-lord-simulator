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

## R03: 선례 설명 45곳 정정

HEAD5fb1aeb의 stewardship.ts:188–233을 읽어 홈 12종 ER-6 선례의 조건을 recurrence.steward에 반영했다. 기존 자료의 NE10 설명과 달리 홈 종류의 제한된 선례는 구현되어 있다. 새 사건·추가 효과의 일반 위임까지 지원한다고 쓰지 않았다. 사건001·012의 관계 중심 두 선택은 기존 판결 변형이라는 범위를 유지한다. 효과·선택 개수·등록 활성 상태 불변. 수정 전 원본과 상세 변경은 revisions/r03-precedent-scope/ 참조.

## R05 지원표 갱신

ENGINE_SUPPORT.atomicity만 현 HEAD의 DGX 4사례·8검사로 갱신했다. 7+9d의 부분 적용 결함이 재현됐고 세 복수 장려금 선택의 차단은 유지한다. 상위 지원표 전체를 현행 재검증으로 바꾸지 않았다. 200사건 원문·등록기 객체는 이 단계에서 변경하지 않았다.

## R05 네 편집 질문 해결

011 원안·역제안 금전조건 비교 명세와 정본 금고 호출을 분리하고 둘 모두 어댑터 차단 유지. 049 관측 직물거래 전제 제거. 057 교회 가까운 시장을 발판거리4칸(게임추정)으로 정의. 058 이웃중개 설정 제거·도시로 재분류. 새청원 두 정의는 미등록이며 달력자동발동 금지·등록기 도착/기한/중복 계약을 분리했다. 196원고 객체 보존, 200ID 보존, 엔진활성0.

## R06 등록기 지원 설명 정정

ck_evt_061–100의 integration.requirements40곳에서 NE01 전체 미구현이라는 오래된 설명을 제한형 등록기 존재·이 sidecar 미연결로 정정했다. 선택·효과·조건·등록기 JSON은 보존했다. events.json을 역치환하면 수정전 객체 전체와 같으며 EVENTS.md의 같은40문구도 동기화했다. before 및 REVISION은 revisions/r06-registry-status/에 있다. 게임 설치·엔진 실행 변경은 없다.

## R06 사료 접근 보류 독립검수 반영

독립검수 승인된20개 근거필드만 반영했다. 081의 TNA 인장교육PDF와189의 공식 유물해설 직접확인으로 CS16·CS09 접근보류를 확인한 주장에 한해 해소했다. 195는 전사·학술주석의 확인범위를 명확히 하고 정확편년 보류를 유지한다. 가공 가족·분실·채무·절차는 게임추정으로 구분한다. 200사건의 조건·효과·본문·선택과 registry는 불변이며 EVENTS.md의3사건 근거도 동기화했다. 수정전 사본·20필드검사·SHA는 records/source-hold-application-r06/에 보존했다. 이 반영은 근거자료 정리이며 엔진 설치·미지원효과 승인 아님.

## R07 근거 접근 보류 정합

ck_evt_189의 해소된 CS09 원문 접근 실패 필터 NE_SR01_KI09_source_fulltext만 제거했다. 공식 해설의 제한적 확인 범위는 SOURCE_CATALOG 및 events.history에 유지한다. 가족 맥락·효과 미지원, literal:false, 세 빈 commands, enabledInEngine:false는 그대로다. 사건 실행 승인이나 역사 일반화가 아니다. 근거와 정확한 변경검사: ../records/content-source-filter-fix-r07/RESULT.json 및 ../records/content-handoff-current-r07/REVIEW.md.
