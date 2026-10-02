# 60개 작성 계약
모든 산출물은 설치하지 않는 콘텐츠 초안. 기존 효과를 새 카드에 연결하는 등록/어댑터는 미구현이며 새 게임 효과와 구분한다. 코드 수정 금지. JSON은 배열.
각 사건 필드:
number 정수; id ck_evt_001 형식; category 장원/도시/교회/이웃 가문/세력/자연/가문 내부; period 1300–1347 또는 1348–1381 또는 1382–1450; years [start,end]; conditions {land,population,rights,relations,season,state} 각 한국어 문자열 (제한 없으면 명시; 미구현 조건은 편집 발동 필터라고 표시); sender {faction,role}; title; body (2~3문장); choices 배열2~4개 각 {id,label,effects:[{catalogKey,operation,parameters,rangeNote,preconditions,limits}],tradeoff,ledger,chronicle}; recurrence {allowed,cooldownYears,steward,exclusions}; illustration 한줄; history {sourceIds:[],basis,inference,limits}; integration {mode,requirements}; newEffectLinks [] 제안 식별자.
숫자 범위는 [x,x] 고정값도 인정. 실제 설정 범위와 게임 추정 후보 튜닝을 구분. sourceIds는 records/sources-land-kin.json(HK) 및 sources-trade-force.json(HT)의 키 사용. catalogKey는 records/engine-effects.json entries.key 중 하나. no_op은 별도 예외로 실제 무변동을 명시 가능.
엔진 독립 효과를 멋대로 합성하지 않는다. 기존 command와 handler의 온전한 경로만 사용. 각 효과의 경로 전제조건을 명시. 기존 장별 효과는 해당 실제 청원/상태가 있을 때만 보충 사건으로 연결, 기존 정본 제목 변경 금지. 일반 새 사건처럼 시기 재배치 금지.
choices는 돈 대 관계 외에 감사/사람 교체/기존 청구권/증거/방침/장려금 배분/혼인 조건·약속/시간·유보를 섞는다. 항상 이기는 선택을 만들지 않는다. merchet 고정 경로처럼 지배적 선택이 있으면 쓰지 않는다. 비수치 설명으로 존재하지 않는 관계/권리/시간 비용을 꾸미지 않는다. 미래 효과는 newEffectLinks로만 보내고 현재 결과에 반영하지 않는다.
신규효과 후보: NE01 범용 사건 조건·쿨다운; NE02 목적별 수선과 내구도; NE03 시간제 감면·납기 약속; NE04 생계 물자 배급; NE05 후견·가구 이동/인물 상태 범용; NE06 후원·추도미사 의무; NE07 무력동원·노동기회비용; NE08 권리 범위/관습 판결; NE09 가문 갈등·후계 중재; NE10 home 선례 자동처리. 필요할 때만 연결. 등록어댑터만 필요한 사건은 NE01 필수 연결하지 않음.
용어 정본: 사용자 지시로 pull 완료한 docs/design/glossary.md 및 docs/design/copy-audit-20261002/SOURCES.md. 이전 /tmp 원본 대비 의미 변경 없음. 산출물 링크는 docs/design/glossary.md, docs/design/copy-audit-20261002/SOURCES.md. 모든 이야기 가공/조합 명시, 수치 게임 추정. 출처 내용의 지역·연대 한계 유지.
