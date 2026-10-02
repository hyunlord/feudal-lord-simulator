# 엔진 효과 실사 — 2차

- 기준 가지: `codex/phase15-organic-ground`
- 기준 HEAD: `83b06802661d6eef33ebf7dc5b7c31a18aa9fae8`
- 코드 수정 없이 함수 본문과 후처리를 확인했다. 게임 실행 검증은 하지 않았다.
- 1차 정본 이후 `src/` diff는 없다. 이번 수정은 누락된 효과·제약과 부정확한 설명을 바로잡은 것이다.
- 정수 페니(d), 계절 1000 tick, 연도 4000 tick. 실제 고정상수는 `[x,x]`, 초안 조정 폭은 게임 추정이다.

## NE10 / FIX-14 판정

NE10은 신규 효과 제안에서 철회한다. 다만 이 HEAD에서 확인한 FIX-14 SW-12 선례는 **지도 밖 영지**의 위임 청원이다. 홈 SW-11은 직접 상신한다. 타입 주석과 SW-12 기능명만으로 홈까지 작동한다고 판정하지 않았다. 홈 자동 선례가 후속 커밋에 추가되면 그 커밋에서 다시 대조해야 한다.

- 홈 생성: [`src/engine/stewardship.ts:181`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L181)
- 지도 밖 선례 조건: [`src/engine/stewardship.ts:265`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L265)
- 홈 연대기 분기 후 continue: [`src/engine/history.ts:946`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/history.ts#L946)

## 사용 경계

- 60개 새 JSON은 현 엔진 등록 데이터가 아님. 기존 command로 안내하는 초안도 대상 상태/ID가 실제 존재해야 함.
- 효과 연결과 조건/빈도/원장 문구 어댑터는 미구현. 새 문구만 썼다고 실행되지 않음.
- 관계/금고 효과는 해당 경로의 고정 조합만 유효하며 서로 다른 경로의 독립 효과를 마음대로 합치지 않음.
- 그림·서사상 수리/혼인허가/입촌은 실제 건물 수리/혼인/가구이주 mutation을 뜻하지 않음.
- 집단 감정, 정치 merchantGauge, offmap goodwill, 외교 관계는 서로 다른 필드.
- 여러 기존 명령을 한 선택에 묶는 것은 등록기/실행 어댑터 제안이다. 전체 선행조건을 먼저 검사하고 실패시 부분 실행하지 않는 원자성은 현 엔진이 보장하지 않는다. 미루기는 기존 시간 경과/무명령이며 신규 deadline 연장 명령이 아니다.

## 효과 목록

### petition.charterFee

- 경로: generic PetitionDef → respondToPetition
- 근거: [`src/content/chapterConfig.ts:48`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/chapterConfig.ts#L48), [`src/engine/politics.ts:211`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L211), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: 페니 d; 양의 정수만 실제 수입; 0 무변동
- 선행조건: 등록된 defId, 미응답 청원, 제공된 응답
- 작용: charter_fee 원장에 일회 수입
- 제한: 음수 값은 generic 경로에서 무시. 지출은 별도 장별/명령 경로 필요. 일반 응답은 기록 후 공통 세력 후처리가 따른다: 왕실 +5/+5/−20/−20, 기타 청원 세력 +10/+3/−15/−10(accept/accept_with_price/refuse/expired), 범위−100~100. 독립 보상으로 중복 실행하지 않는다.

### petition.gauge

- 경로: generic PetitionDef → respondToPetition
- 근거: [`src/engine/politics.ts:220`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L220), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: merchantGauge 점; 정수 delta, clampGauge
- 선행조건: generic 경로
- 작용: 상인 게이지 변경
- 제한: 임의 세력 관계가 아님. 일반 응답은 기록 후 공통 세력 후처리가 따른다: 왕실 +5/+5/−20/−20, 기타 청원 세력 +10/+3/−15/−10(accept/accept_with_price/refuse/expired), 범위−100~100. 독립 보상으로 중복 실행하지 않는다.

### petition.right

- 경로: generic PetitionDef → respondToPetition
- 근거: [`src/engine/politics.ts:222`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L222), [`src/engine/politics.ts:230`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L230), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: politics.rights 권리기록; right ID 및 stallFeePermille
- 선행조건: 등록된 청원
- 작용: 청원 세력 holder로 권리기록 추가
- 제한: estates.pieces 소유권과 다름. 임의 ID는 downstream 소비자가 없어 실제 효력이 없을 수 있음. 일반 응답은 기록 후 공통 세력 후처리가 따른다: 왕실 +5/+5/−20/−20, 기타 청원 세력 +10/+3/−15/−10(accept/accept_with_price/refuse/expired), 범위−100~100. 독립 보상으로 중복 실행하지 않는다. market_exemption의 stallFeePermille은 정치권리 전체 최솟값으로 시장 전체에 지속 적용되며 agency 시장부담과 별개. 종료/회수 API 없음.

### home_petition.answer

- 경로: answer_estate_petition → answerEstatePetition → history
- 근거: [`src/content/stewardshipConfig.ts:61`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/stewardshipConfig.ts#L61), [`src/engine/stewardship.ts:399`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L399), [`src/engine/history.ts:946`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/history.ts#L946), [`src/engine/stewardship.ts:181`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L181)
- 단위/값: 페니 d, 세력 관계 점; 12종 표의 amount 범위와 고정 faction delta
- 선행조건: home estate의 open 청원, deadline 이내
- 작용: 승인/거절: 표에 따른 금고 ±amount, 관계 변화, granted/refused 기록
- 제한: rights/marriage 플래그는 상신 분류뿐. 실제 권리·혼인·이주·수리 생성 안 함. 새 ID 또는 선택지 3개 연결은 신규 어댑터 필요. 계절 확률600‰, 그 해 접수 없으면 겨울 보장; 연도 상한 없음. 기한 이후 다음 계절에 lapsed로 바뀌고 refuse 관계표 적용, refuse의 수입은 자동 납부되지 않는다.

### offmap_petition.answer

- 경로: answer_estate_petition → answerEstatePetition
- 근거: [`src/engine/stewardship.ts:163`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L163), [`src/engine/stewardship.ts:415`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L415), [`src/content/stewardshipConfig.ts:40`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/stewardshipConfig.ts#L40)
- 단위/값: 페니 d, 해당 영지 tenants/merchants 점; amount=round(round(영지 annualValue/4)×size/1000); 6종 고정 관계 delta
- 선행조건: 보유 지도 밖 영지, 해당 청원 open/deadline
- 작용: rent_relief·market_dues·repair·common_dispute·charter_request·marriage_licence
- 제한: 글로벌 commons/town 관계와 다름. charter_request도 실제 권리조각 양도 없음. 지대·시장부담 감면 승인액은 일회 금고 지출이며 지속 세율 변경이 아님.

### offmap_petition.neglect

- 경로: repair 거절
- 근거: [`src/engine/stewardship.ts:169`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L169), [`src/engine/stewardship.ts:237`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L237), [`src/content/stewardshipConfig.ts:88`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/stewardshipConfig.ts#L88)
- 단위/값: 영지 annualValue; 고정 −20‰, 반올림
- 선행조건: 지도 밖 repair 청원 거절
- 작용: 영지 카드 연가치 손실
- 제한: 지도상의 건물 파괴·내구도 효과 아님.

### steward.precedent

- 경로: set_exception_rules / estateSeason
- 근거: [`src/engine/stewardship.ts:265`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L265), [`src/engine/stewardship.ts:385`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L385), [`src/engine/stewardship.ts:181`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L181), [`src/engine/history.ts:962`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/history.ts#L962)
- 단위/값: 선례·예외 규칙; amountAtLeast/null, rights, marriage, recurring boolean
- 선행조건: 보유 지도 밖 영지, oversight.mode=steward. 같은 estateId/kind의 가장 최근 lord granted/refused 기록. recurring!=true.
- 작용: 현재 청원이 예외 규칙에 걸려 상신될 경우 과거 lord 판결로 대체하여 자동 처리하고 decidedBy:steward 및 precedent:true 기록. 예외에 안 걸리면 기존 청지기 성향표로 처리한다.
- 제한: direct 감독은 선례 적용 안 함. 예외 미일치(matched=null)도 선례 조회 안 함. 금액/상대가 달라도 estateId/kind가 같으면 재사용하므로 초안 ID별 안전한 재발 판정과 다름. 홈은 이 HEAD에서 직접 상신만 구현. NE10을 신규 제안에서 철회하되 홈까지 구현됐다고 주장하지 않는다.

### steward.appoint

- 경로: set_estate_oversight
- 근거: [`src/engine/stewardship.ts:371`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L371)
- 단위/값: 인물 serving/candidate; direct/steward; 비수치
- 선행조건: 해당 영지 유효 living 후보
- 작용: 청지기 지정 또는 직접 감독 전환
- 제한: 임의 인물 생성/능력치 부여 아님.

### audit.mode

- 경로: set_audit_mode
- 근거: [`src/engine/stewardship.ts:431`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L431), [`src/content/stewardshipConfig.ts:95`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/stewardshipConfig.ts#L95)
- 단위/값: accounts/visit, 연도; 발견율 accounts300‰ / visit850‰ + 능력식
- 선행조건: 기존 oversight
- 작용: 다음 미카엘마스 감사 방식; 방문시 attention 부담
- 제한: 즉시 횡령 적발 보장 아님. auditMode는 지속 설정이므로 accounts로 바꾸기 전 미카엘마스마다 방문이 반복되고 visitTick이 갱신된다. 한 번 방문 뒤1년 차감은 계속 방문하면 매년 갱신된다. 여러 방문은 전역 visitTick 하나를 사용하므로 영지 수만큼 중복 차감되지 않는다. 방문은 이유값−1이며 실제 capacity=Math.max(1,이유합계)이므로 최저용량1에서는 실효 감소0이다. 이미 유효한 visitTick이 있으면 추가 감소도0이다. 실제 대가−1을 약속하는 선택은 최근 방문차감 없음 및 방문 전 capacity≥2를 조건으로 한다.

### audit.answer

- 경로: answer_audit
- 근거: [`src/engine/stewardship.ts:443`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L443), [`src/content/stewardshipConfig.ts:101`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/stewardshipConfig.ts#L101), [`src/engine/history.ts:984`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/history.ts#L984)
- 단위/값: 페니 d, loyalty/tenants 점, 인물 상태; punish 회수 round(revealedKept×500‰), tenants+5, 연결 세력 존재시 −5; tolerate loyalty+10(상한100); replace 회수0/관계보너스0
- 선행조건: pending 감사 deadline 이내; 해임시 살아 있는 후임 필요
- 작용: punish/replace는 dismissed+후임 serving; tolerate 유지
- 제한: 임의 사형/구금/상처/망명 상태 효과 없음. replace/punish는 후임이 없으면 전체 no-op. 미응답은 기한 후 tolerate. replace의 이점은 연결 세력 −5를 피하는 것.

### policy

- 경로: set_estate_policy
- 근거: [`src/engine/townAgency.ts:64`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L64), [`src/engine/townAgency.types.ts:11`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.types.ts#L11)
- 단위/값: growth/revenue/stability/defence; enum
- 선행조건: agency 영주모드
- 작용: 도시 자율 제안 점수의 방침 변경
- 제한: 건물 직접 배치나 특정 결과 보장 없음.

### subsidy

- 경로: set_project_subsidy
- 근거: [`src/engine/townAgency.ts:73`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L73), [`src/engine/townAgency.ts:82`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L82), [`src/engine/townAgency.ts:540`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L540), [`src/engine/townAgency.ts:527`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L527)
- 단위/값: 페니 d / building kind; 정수 ≥0; 합계≤현재 금고250‰; 0철회; 채택시 paid=min(설정 장려금,max(0,당시 금고))
- 선행조건: agency; 유효 BuildingKind
- 작용: 해당 종류 프로젝트 장려금; 실제 채택시 금고 지급
- 제한: 설정 즉시 지출 아님; 건설 보장 안 함; 개별 청원 earmark/만료일 없음. 설정은 채택 후에도 남으므로 같은 건물 종류가 다시 채택될 때마다 지급할 수 있다. 설정 합계≤금고25%는 설정 시 검사이며 누적 지출 상한·예약금·일회성 지급이 아니다. 중단하려면 set_project_subsidy(amount=0)가 필요하며 자동 철회는 없다.

### market_dues

- 경로: set_market_dues
- 근거: [`src/engine/townAgency.ts:94`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/townAgency.ts#L94)
- 단위/값: 기본 노점세 대비 ‰; 정수250–2000
- 선행조건: agency
- 작용: duesPermille 변경
- 제한: 임의 권리조각 세율 변경/한 철 뒤 자동 복원 아님.

### timber.order

- 경로: order_timber → orderTimber → advanceTimberTrade
- 근거: [`src/engine/timberTrade.ts:19`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/timberTrade.ts#L19), [`src/engine/timberTrade.ts:42`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/timberTrade.ts#L42), [`src/content/timberTradeConfig.ts:5`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/timberTradeConfig.ts#L5)
- 단위/값: 목재 단위 및 페니 d; 주문0–400; 촌락0–60; 시장일당2/1; 가격18/27d
- 선행조건: 거래 시장 또는 촌락 창고; 금고 구매력
- 작용: 주문 후 시장 주기 때 구매한 만큼 treasuryTimber 증가·금고 감소
- 제한: 즉시 목재 지급 아님. 다른 물자 범용 grant API 아님.

### marriage.offer

- 경로: propose_marriage / answer_counter
- 근거: [`src/engine/marriage.ts:114`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L114), [`src/engine/marriage.ts:137`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L137), [`src/engine/marriage.ts:154`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L154), [`src/engine/marriage.ts:256`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L256)
- 단위/값: 페니 d, years, 협상 점수; Term cash/pension/debt_assumption 등; 가용성/수락식
- 선행조건: 살아 있는 적합 groom/bride, 협상 미진행, 금고
- 작용: 수락/역제안/거절; 계약시 cash 차감·관계 상승·혼인 청구권 생성
- 제한: MARRIAGE_ESTATE_ID와 상대/혼인 경로 제한. 자유로운 어떤 두 인물 혼인 아님. 새 사건이 즉시 혼인 성공시키면 안 됨.

### marriage.promises

- 경로: contractPromises → keep_promise
- 근거: [`src/engine/marriage.ts:180`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L180), [`src/engine/marriage.ts:211`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L211), [`src/engine/marriage.ts:236`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L236), [`src/content/diplomacyConfig.ts:72`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/diplomacyConfig.ts#L72)
- 단위/값: 페니 d / years / tick; pension 연별, debt_assumption 분할; 정치지원8000tick
- 선행조건: 혼인 계약 생성 약속 또는 기존 open lord 약속, deadline 이내
- 작용: 금고 지불/정치지원 이행과 kept; 미이행 broken·관계손실
- 제한: 일반 청원에서 자유로운 약속 생성 불가. 혼인 계약 및 will_change의 정해진 생성 경로에 한정. 임의 deadline은 신규 효과.

### marriage.jointure

- 경로: 혼인 contract → 남편 사망 → settleForLife
- 근거: [`src/engine/marriage.ts:270`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L270), [`src/engine/marriage.ts:444`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L444), [`src/engine/estates.ts:207`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estates.ts#L207)
- 단위/값: 기존 권리조각 종신보유; pieceId, 비수치
- 선행조건: 계약 jointure 조각·남편 사망·아내 생존
- 작용: 아내에게 종신보유, remainder 유지
- 제한: right_piece/land_use term 자체는 즉시 양도 안 함. 협상 점수 term 존재만으로 mutation 단정 금지.

### marriage.will

- 경로: answer_will_change
- 근거: [`src/engine/marriage.ts:374`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L374)
- 단위/값: favour/support_promise/let_it_be; favour 고정 비용 또는 정치지원 약속 기한 8000 tick; let_it_be 경쟁 청구권 생성
- 선행조건: 해당 혼인 will-change 단계
- 작용: 청탁 지출 또는 해당 will_change에서 정치지원 약속 생성 또는 개입 안 함
- 제한: 범용 유언 재작성/후계자 임의 지정 아님.

### suit.file

- 경로: file_suit
- 근거: [`src/engine/estateSuits.ts:59`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L59), [`src/engine/estateSuits.ts:72`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L72), [`src/content/estateConfig.ts:91`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/estateConfig.ts#L91), [`src/engine/estateSuits.ts:171`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L171)
- 단위/값: 페니 d·claim 상태; 접수60d; 최소 한 계절씩 filed→evidence→patronage→hearing(120d자동지불)→judged. 집행 명령80d 별도.
- 선행조건: 기존 open 청구권, 타인 명의, 금고
- 작용: suing 및 filed 소송; 이후 시간 경과
- 제한: 임의 청구권 생성은 별도 엔진 어댑터 필요.

### suit.evidence

- 경로: add_suit_evidence / seek_suit_patron
- 근거: [`src/engine/estateSuits.ts:86`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L86), [`src/engine/estateSuits.ts:99`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L99), [`src/content/estateConfig.ts:81`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/estateConfig.ts#L81)
- 단위/값: 페니 d·증거 가중치·patronSupport; charter40d/+20, deed30d/+15, court_roll20d/+10, witnesses24d/+8, possession_years0d/+12. 후원 relation≥10, min(30,relation).
- 선행조건: filed/evidence 단계 증거 종류 1회; patronage 단계 후원1회
- 작용: 증거 추가·기존 세력관계를 후원력으로 활용
- 제한: 후원 요구 자체가 세력관계 대가를 차감하지 않음. 무비용 possession_years는 코드상 실제 보유연수 검사가 없고 filed/evidence 및 중복검사만 한다. 따라서 다른 증거 대신 독립 셋째 선택으로 놓으면 지배적 선택이 될 수 있어 제외하거나 공통 적용 필요.

### suit.enforce

- 경로: enforce_possession
- 근거: [`src/engine/estateSuits.ts:142`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L142)
- 단위/값: 페니 d·권리조각/영지 possessor; 집행80d; force vs hold 식
- 선행조건: enforcing 소송, 금고
- 작용: 성공시 점유자 변경; 실패시 hold 감소
- 제한: 승소 즉시 실제 점유 확보 아님; 임의 군대 생성 안 됨.

### chapter.famine

- 경로: famine_response
- 근거: [`src/engine/politics.ts:92`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L92), [`src/engine/politics.ts:105`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.ts#L105), [`src/engine/eventSchedule.ts:304`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/eventSchedule.ts#L304), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: 금고·빵/밀·가격‰·가구 이탈 상한; relief/price_control/laissez_faire/speculation 고정 enum/계산식
- 선행조건: 기존 도착한 대기근, 아직 미응답
- 작용: 계절별 구휼·가격제한·방임·매점 매각 경로
- 제한: 매년 새 날씨 청원에 복제할 수 있는 범용 식량배급 효과 아님.

### chapter.war

- 경로: respondToPetition(trigger=war) → answerWarPetition
- 근거: [`src/engine/war.ts:284`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/war.ts#L284), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: 금고·분할납부·징집·피난가구·전쟁대응; WOOL_PAYMENT/LEVY_RESPONSE/WAR_FUNDING/REFUGEE_ADMISSION/WALL_OR_MARKET 고정 ID·balance
- 선행조건: war 상태 존재, 해당 기존 청원
- 작용: 현물부담, 면역금, 차입/전쟁세, 피난민 수용(빈자리 범위), 방위 방침
- 제한: 새 ID·다른 시대에서 동일 mutation 자동 호출 안 됨. 인력 사망 비율은 장별 시뮬레이션 결과.

### chapter.plague

- 경로: respondToPetition(trigger=plague) → answerPlaguePetition
- 근거: [`src/engine/plague.ts:376`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/plague.ts#L376), [`src/engine/plague.ts:336`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/plague.ts#L336), [`src/engine/factions.ts:378`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/factions.ts#L378), [`src/content/factionConfig.ts:118`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/factionConfig.ts#L118)
- 단위/값: 성직 공석·금고·지대권리·이주가구; VACANT_PRIEST/CASH_RENT 등 고정 ID와 balance
- 선행조건: plague 상태/공석·빈집·물 서비스 등 해당 조건
- 작용: 성직자 기다림/평신도 서기, 부역 금납화, 후속 계절 재정착
- 제한: 임의 사람 치유/사망 확률 증감 효과 아님. 양도된 commuted_rent는 정치권리 기록.

### chapter.reorganisation

- 경로: respondToPetition(trigger=reorganisation)
- 근거: [`src/engine/reorganisation.ts:234`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/reorganisation.ts#L234), [`src/engine/reorganisation.ts:251`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/reorganisation.ts#L251)
- 단위/값: 길드·시장/다리 수입권·금고; GUILD_CHARTER/BOROUGH_CHARTER/TAX_COLLECTION/CLOTH_OR_GRAIN ID
- 선행조건: 해당 장 상태/청원
- 작용: 길드 설립, 도시 권리기록, 세금징수/직업특화의 후속 효과
- 제한: 새 사건의 임의 길드나 수익률을 바꾸는 범용 API 아님.

### chapter.legacy

- 경로: respondToPetition(trigger=legacy)
- 근거: [`src/engine/legacy.ts:146`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/legacy.ts#L146)
- 단위/값: 금고·후계 인물·자치권; ROYAL_TAX/HEIR_CHOICE/BOROUGH_AUTONOMY/LEGACY_CHOICE ID
- 선행조건: legacy 상태; 후보 목록/제시 응답
- 작용: 특별세 납부·상속부담금·후계 착좌·기존 도시 자치권
- 제한: 청원 60개의 일반 후계자/명성 조작 API 아님.

### chapter.restore

- 경로: restore_right → answerRestoration
- 근거: [`src/engine/lordship.ts:203`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/lordship.ts#L203), [`src/content/chapterConfig.ts:104`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/chapterConfig.ts#L104)
- 단위/값: 금고·권리복구·시간; 100d 즉시 또는50d·1년 기다림 고정
- 선행조건: 쇠퇴 후 원인 해소·기존 restore_right 청원
- 작용: 빼앗긴 권리복구/협상/거절 후 재청원
- 제한: 일반 권리조각 매입 단가 아님.

### steward.exception_rules

- 경로: set_exception_rules → setExceptionRules
- 근거: [`src/engine/stewardship.ts:216`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L216), [`src/engine/stewardship.ts:385`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L385), [`src/engine/stewardship.types.ts:70`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.types.ts#L70)
- 단위/값: 전 영지 공통 규칙; amountAtLeast:number|null, rights:boolean, marriage:boolean, recurring?:boolean
- 선행조건: stewardship 상태 존재. 기존 필드 모두 전달해야 함.
- 작용: 상신 기준 변경. 권리→혼인→금액 순서로 예외 검사. recurring=true면 선례로 상신을 건너뛰지 않음.
- 제한: 특정 새 초안만 위임하는 기능 아님. home 직접 상신에는 적용 안 됨. threshold는 추가 지불/수익/관계 효과가 아님.

### suit.patron

- 경로: seek_suit_patron
- 근거: [`src/engine/estateSuits.ts:99`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L99), [`src/content/estateConfig.ts:93`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/estateConfig.ts#L93)
- 단위/값: 후원력; 관계≥10, 지원=min(30,관계)
- 선행조건: patronage 단계, 후원 아직 없음
- 작용: 현재 관계를 후원력으로 저장
- 제한: 기존 관계를 소비하지 않고 새로운 약속도 만들지 않음. 무후원보다 항상 유리한 상태라 근거 없는 대가를 붙이지 않음.

### time.existing_progress

- 경로: 명령 없음 → 기존 advanceSuits/advancePromises/advanceStewardship
- 근거: [`src/engine/estateSuits.ts:171`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/estateSuits.ts#L171), [`src/engine/marriage.ts:236`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/marriage.ts#L236), [`src/engine/stewardship.ts:343`](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L343)
- 단위/값: tick; 실제 기존 deadline/stageSince에 따른 시간 경과
- 선행조건: 해당 기존 소송/청원/약속이 실제 존재
- 작용: 선택 화면을 닫고 기존 시계 계속. 청원 기한은 연장되지 않음. 소송 심리비는 자동 지불될 수 있고 약속은 깨질 수 있음.
- 제한: 미루기 전용 engine command 없음. 예약 재알림/새 기한/자동 재상정은 NE01 등 등록기 제안이며 기존 효과로 주장하지 않음.
