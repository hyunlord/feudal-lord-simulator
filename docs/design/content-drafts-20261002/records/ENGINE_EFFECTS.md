# 엔진 효과 실사

- 기준 가지: `codex/phase15-organic-ground`
- 기준 HEAD: `602fdd8467ada0a9288654c7f850db293ab76ef6`
- 읽기 전용 소스 확인. 게임 실행 검증은 하지 않았다.
- 돈: 정수 페니(d), 계절 1000 tick, 연도 4000 tick. 수치 범위는 게임 추정. 기존 상수는 `[x,x]`로 적으며 임의 변경하지 않는다.

## 사용 경계

- 60개 새 JSON은 현 엔진 등록 데이터가 아님. 기존 command로 안내하는 초안도 대상 상태/ID가 실제 존재해야 함.
- 효과 연결과 조건/빈도/원장 문구 어댑터는 미구현. 새 문구만 썼다고 실행되지 않음.
- 관계/금고 효과는 해당 경로의 고정 조합만 유효하며 서로 다른 경로의 독립 효과를 마음대로 합치지 않음.
- 그림·서사상 수리/혼인허가/입촌은 실제 건물 수리/혼인/가구이주 mutation을 뜻하지 않음.
- 집단 감정, 정치 merchantGauge, offmap goodwill, 외교 관계는 서로 다른 필드.

## 효과 목록

### petition.charterFee

- 경로: generic PetitionDef → respondToPetition
- 근거: `src/content/chapterConfig.ts:48`, `src/engine/politics.ts:211`
- 단위/값: 페니 d; 양의 정수만 실제 수입; 0 무변동
- 선행조건: 등록된 defId, 미응답 청원, 제공된 응답
- 작용: charter_fee 원장에 일회 수입
- 제한: 음수 값은 generic 경로에서 무시. 지출은 별도 장별/명령 경로 필요.

### petition.gauge

- 경로: generic PetitionDef → respondToPetition
- 근거: `src/engine/politics.ts:220`
- 단위/값: merchantGauge 점; 정수 delta, clampGauge
- 선행조건: generic 경로
- 작용: 상인 게이지 변경
- 제한: 임의 세력 관계가 아님.

### petition.right

- 경로: generic PetitionDef → respondToPetition
- 근거: `src/engine/politics.ts:222`, `src/engine/politics.ts:230`
- 단위/값: politics.rights 권리기록; right ID 및 stallFeePermille
- 선행조건: 등록된 청원
- 작용: 청원 세력 holder로 권리기록 추가
- 제한: estates.pieces 소유권과 다름. 임의 ID는 downstream 소비자가 없어 실제 효력이 없을 수 있음.

### home_petition.answer

- 경로: answer_estate_petition → answerEstatePetition → history
- 근거: `src/content/stewardshipConfig.ts:61`, `src/engine/stewardship.ts:399`, `src/engine/history.ts:948`
- 단위/값: 페니 d, 세력 관계 점; 12종 표의 amount 범위와 고정 faction delta
- 선행조건: home estate의 open 청원, deadline 이내
- 작용: 승인/거절: 표에 따른 금고 ±amount, 관계 변화, granted/refused 기록
- 제한: rights/marriage 플래그는 상신 분류뿐. 실제 권리·혼인·이주·수리 생성 안 함. 새 ID 또는 선택지 3개 연결은 신규 어댑터 필요.

### offmap_petition.answer

- 경로: answer_estate_petition → answerEstatePetition
- 근거: `src/engine/stewardship.ts:163`, `src/engine/stewardship.ts:415`, `src/content/stewardshipConfig.ts:40`
- 단위/값: 페니 d, 해당 영지 tenants/merchants 점; amount=영지 연가치/4 × size‰; 6종 고정 관계 delta
- 선행조건: 보유 지도 밖 영지, 해당 청원 open/deadline
- 작용: rent_relief·market_dues·repair·common_dispute·charter_request·marriage_licence
- 제한: 글로벌 commons/town 관계와 다름. charter_request도 실제 권리조각 양도 없음.

### offmap_petition.neglect

- 경로: repair 거절
- 근거: `src/engine/stewardship.ts:169`, `src/engine/stewardship.ts:237`, `src/content/stewardshipConfig.ts:88`
- 단위/값: 영지 annualValue; 고정 −20‰, 반올림
- 선행조건: 지도 밖 repair 청원 거절
- 작용: 영지 카드 연가치 손실
- 제한: 지도상의 건물 파괴·내구도 효과 아님.

### steward.precedent

- 경로: set_exception_rules / estateSeason
- 근거: `src/engine/stewardship.ts:265`, `src/engine/stewardship.ts:385`
- 단위/값: 선례·예외 규칙; amountAtLeast/null, rights, marriage, recurring boolean
- 선행조건: 위임된 지도 밖 영지, 같은 estateId/kind의 과거 lord 결정
- 작용: recurring!=true면 과거 승인/거절을 청지기가 재사용
- 제한: home 청원은 선례 자동처리 안 됨. 새 초안 ID마다 선례 저장하는 범용 시스템 아님.

### steward.appoint

- 경로: set_estate_oversight
- 근거: `src/engine/stewardship.ts:371`
- 단위/값: 인물 serving/candidate; direct/steward; 비수치
- 선행조건: 해당 영지 유효 living 후보
- 작용: 청지기 지정 또는 직접 감독 전환
- 제한: 임의 인물 생성/능력치 부여 아님.

### audit.mode

- 경로: set_audit_mode
- 근거: `src/engine/stewardship.ts:431`, `src/content/stewardshipConfig.ts:95`
- 단위/값: accounts/visit, 연도; 발견율 accounts300‰ / visit850‰ + 능력식
- 선행조건: 기존 oversight
- 작용: 다음 미카엘마스 감사 방식; 방문시 attention 부담
- 제한: 즉시 횡령 적발 보장 아님.

### audit.answer

- 경로: answer_audit
- 근거: `src/engine/stewardship.ts:443`, `src/content/stewardshipConfig.ts:101`
- 단위/값: 페니 d, loyalty/tenants 점, 인물 상태; punish 회수 round(revealedKept×500‰), tenants+5; tolerate loyalty+10
- 선행조건: pending 감사 deadline 이내; 해임시 살아 있는 후임 필요
- 작용: punish/replace는 dismissed+후임 serving; tolerate 유지
- 제한: 임의 사형/구금/상처/망명 상태 효과 없음.

### policy

- 경로: set_estate_policy
- 근거: `src/engine/townAgency.ts:64`, `src/engine/townAgency.types.ts:11`
- 단위/값: growth/revenue/stability/defence; enum
- 선행조건: agency 영주모드
- 작용: 도시 자율 제안 점수의 방침 변경
- 제한: 건물 직접 배치나 특정 결과 보장 없음.

### subsidy

- 경로: set_project_subsidy
- 근거: `src/engine/townAgency.ts:73`, `src/engine/townAgency.ts:82`, `src/engine/townAgency.ts:540`
- 단위/값: 페니 d / building kind; 정수 ≥0; 합계≤현재 금고250‰; 0철회
- 선행조건: agency; 유효 BuildingKind
- 작용: 해당 종류 프로젝트 장려금; 실제 채택시 금고 지급
- 제한: 설정 즉시 지출 아님; 건설 보장 안 함; 개별 청원 earmark/만료일 없음.

### market_dues

- 경로: set_market_dues
- 근거: `src/engine/townAgency.ts:94`
- 단위/값: 기본 노점세 대비 ‰; 정수250–2000
- 선행조건: agency
- 작용: duesPermille 변경
- 제한: 임의 권리조각 세율 변경/한 철 뒤 자동 복원 아님.

### timber.order

- 경로: order_timber → orderTimber → advanceTimberTrade
- 근거: `src/engine/timberTrade.ts:19`, `src/engine/timberTrade.ts:42`, `src/content/timberTradeConfig.ts:5`
- 단위/값: 목재 단위 및 페니 d; 주문0–400; 촌락0–60; 시장일당2/1; 가격18/27d
- 선행조건: 거래 시장 또는 촌락 창고; 금고 구매력
- 작용: 주문 후 시장 주기 때 구매한 만큼 treasuryTimber 증가·금고 감소
- 제한: 즉시 목재 지급 아님. 다른 물자 범용 grant API 아님.

### marriage.offer

- 경로: propose_marriage / answer_counter
- 근거: `src/engine/marriage.ts:114`, `src/engine/marriage.ts:137`, `src/engine/marriage.ts:154`, `src/engine/marriage.ts:255`
- 단위/값: 페니 d, years, 협상 점수; Term cash/pension/debt_assumption 등; 가용성/수락식
- 선행조건: 살아 있는 적합 groom/bride, 협상 미진행, 금고
- 작용: 수락/역제안/거절; 계약시 cash 차감·관계 상승·혼인 청구권 생성
- 제한: MARRIAGE_ESTATE_ID와 상대/혼인 경로 제한. 자유로운 어떤 두 인물 혼인 아님. 새 사건이 즉시 혼인 성공시키면 안 됨.

### marriage.promises

- 경로: contractPromises → keep_promise
- 근거: `src/engine/marriage.ts:180`, `src/engine/marriage.ts:211`, `src/engine/marriage.ts:236`, `src/content/diplomacyConfig.ts:72`
- 단위/값: 페니 d / years / tick; pension 연별, debt_assumption 분할; 정치지원8000tick
- 선행조건: 혼인 계약 생성 약속 또는 기존 open lord 약속, deadline 이내
- 작용: 금고 지불/정치지원 이행과 kept; 미이행 broken·관계손실
- 제한: 아무 청원에서 자유롭게 약속 생성 불가. 임의 강제 만료/새 deadline은 신규 효과.

### marriage.jointure

- 경로: 혼인 contract → 남편 사망 → settleForLife
- 근거: `src/engine/marriage.ts:270`, `src/engine/marriage.ts:445`, `src/engine/estates.ts:204`
- 단위/값: 기존 권리조각 종신보유; pieceId, 비수치
- 선행조건: 계약 jointure 조각·남편 사망·아내 생존
- 작용: 아내에게 종신보유, remainder 유지
- 제한: right_piece/land_use term 자체는 즉시 양도 안 함. 협상 점수 term 존재만으로 mutation 단정 금지.

### marriage.will

- 경로: answer_will_change
- 근거: `src/engine/marriage.ts:374`
- 단위/값: favour/support_promise/let_it_be; 설정 상수/기존 약속
- 선행조건: 해당 혼인 will-change 단계
- 작용: 청탁 지출 또는 해당 will_change 단계에서 정치지원 약속을 생성하거나 개입 안 함
- 제한: 범용 유언 재작성/후계자 임의 지정 아님.

### suit.file

- 경로: file_suit
- 근거: `src/engine/estateSuits.ts:59`, `src/engine/estateSuits.ts:72`, `src/content/estateConfig.ts:91`
- 단위/값: 페니 d·claim 상태; 접수60d, 이후 심리120d/집행80d 고정
- 선행조건: 기존 open 청구권, 타인 명의, 금고
- 작용: suing 및 filed 소송; 이후 시간 경과
- 제한: 임의 청구권 생성은 별도 엔진 어댑터 필요.

### suit.evidence

- 경로: add_suit_evidence / seek_suit_patron
- 근거: `src/engine/estateSuits.ts:86`, `src/engine/estateSuits.ts:99`, `src/content/estateConfig.ts:81`
- 단위/값: 페니 d·증거 가중치·patronSupport; 종류별 비용/가중치 고정; 후원 relation≥10, 최대30
- 선행조건: filed/evidence 단계 증거 종류 1회; patronage 단계 후원1회
- 작용: 증거 추가·기존 세력관계를 후원력으로 활용
- 제한: 후원 요구 자체가 세력관계 대가를 차감하지 않음.

### suit.enforce

- 경로: enforce_possession
- 근거: `src/engine/estateSuits.ts:142`
- 단위/값: 페니 d·권리조각/영지 possessor; 집행80d; force vs hold 식
- 선행조건: enforcing 소송, 금고
- 작용: 성공시 점유자 변경; 실패시 hold 감소
- 제한: 승소 즉시 실제 점유 확보 아님; 임의 군대 생성 안 됨.

### chapter.famine

- 경로: famine_response
- 근거: `src/engine/politics.ts:92`, `src/engine/politics.ts:105`, `src/engine/eventSchedule.ts:304`
- 단위/값: 금고·빵/밀·가격‰·가구 이탈 상한; relief/price_control/laissez_faire/speculation 고정 enum/계산식
- 선행조건: 기존 도착한 대기근, 아직 미응답
- 작용: 계절별 구휼·가격제한·방임·매점 매각 경로
- 제한: 매년 새 날씨 청원에 복제할 수 있는 범용 식량배급 효과 아님.

### chapter.war

- 경로: respondToPetition(trigger=war) → answerWarPetition
- 근거: `src/engine/war.ts:284`
- 단위/값: 금고·분할납부·징집·피난가구·전쟁대응; WOOL_PAYMENT/LEVY_RESPONSE/WAR_FUNDING/REFUGEE_ADMISSION/WALL_OR_MARKET 고정 ID·balance
- 선행조건: war 상태 존재, 해당 기존 청원
- 작용: 현물부담, 면역금, 차입/전쟁세, 피난민 수용(빈자리 범위), 방위 방침
- 제한: 새 ID·다른 시대에서 동일 mutation 자동 호출 안 됨. 인력 사망 비율은 장별 시뮬레이션 결과.

### chapter.plague

- 경로: respondToPetition(trigger=plague) → answerPlaguePetition
- 근거: `src/engine/plague.ts:376`, `src/engine/plague.ts:336`
- 단위/값: 성직 공석·금고·지대권리·이주가구; VACANT_PRIEST/CASH_RENT 등 고정 ID와 balance
- 선행조건: plague 상태/공석·빈집·물 서비스 등 해당 조건
- 작용: 성직자 기다림/평신도 서기, 부역 금납화, 후속 계절 재정착
- 제한: 임의 사람 치유/사망 확률 증감 효과 아님. 양도된 commuted_rent는 정치권리 기록.

### chapter.reorganisation

- 경로: respondToPetition(trigger=reorganisation)
- 근거: `src/engine/reorganisation.ts:234`, `src/engine/reorganisation.ts:251`
- 단위/값: 길드·시장/다리 수입권·금고; GUILD_CHARTER/BOROUGH_CHARTER/TAX_COLLECTION/CLOTH_OR_GRAIN ID
- 선행조건: 해당 장 상태/청원
- 작용: 길드 설립, 도시 권리기록, 세금징수/직업특화의 후속 효과
- 제한: 새 사건의 임의 길드나 수익률을 바꾸는 범용 API 아님.

### chapter.legacy

- 경로: respondToPetition(trigger=legacy)
- 근거: `src/engine/legacy.ts:146`
- 단위/값: 금고·후계 인물·자치권; ROYAL_TAX/HEIR_CHOICE/BOROUGH_AUTONOMY/LEGACY_CHOICE ID
- 선행조건: legacy 상태; 후보 목록/제시 응답
- 작용: 특별세 납부·상속부담금·후계 착좌·기존 도시 자치권
- 제한: 청원 60개의 일반 후계자/명성 조작 API 아님.

### chapter.restore

- 경로: restore_right → answerRestoration
- 근거: `src/engine/lordship.ts:203`, `src/content/chapterConfig.ts:104`
- 단위/값: 금고·권리복구·시간; 100d 즉시 또는50d·1년 기다림 고정
- 선행조건: 쇠퇴 후 원인 해소·기존 restore_right 청원
- 작용: 빼앗긴 권리복구/협상/거절 후 재청원
- 제한: 일반 권리조각 매입 단가 아님.

## 특히 분리할 신규 효과

- 새 초안 ID/발생조건/기간/선례 매핑을 기존 경로에 연결하는 편집 콘텐츠 어댑터.
- 범용 임의 세력관계 ±delta, 음수 generic charterFee 지출, 자원 grant/consume.
- 어떤 사건에서든 임의 약속/의무/유예를 생성하고 만료하는 기능.
- 가구 지정 이주·임의 성직자/후계 인물 상태 수정·상처/질병 치료.
- 임의 권리조각 이전/기간제 사용권/공유권의 현실적 법률조건.
- 새 청원에서 청지기 선례 적용, home 청원 위임, 3~4개 선택지.

## 현행 등장과 연대기

`src/engine/stewardship.ts:183` home 생성 경로는 agency 존재만 요구하고 1320 종료 제한이 없다. 설정 주석의 1300–1320은 콘텐츠 소재 범위이며 실제로는 연중 계절마다 600‰, 그해 청원이 없으면 겨울 1건 보장, 12종 순환이다. 새 초안 빈도는 여기에 추가 합산하지 말고 대체 pool/cooldown 어댑터 제안으로 표시해야 한다.

청지기 선례는 `src/engine/stewardship.ts:270`의 지도 밖 영지 kind 단위이며 home에는 없다. 연대기 기존 문구는 `src/content/historyCopy.ko.ts:248`, `:293`; 새 제목/선택별 원장 문구는 편집안으로만 제공한다.

`src/contracts/effects.ts`의 EffectRegistry 및 EffectSpec 존재만으로 범용 상태 변경 지원이라고 판단하지 않았다. 소비 경로 확인이 필수다.


## 통합 검수 보완 (최종 기준 HEAD d6ae1549)

사용자 지시의 git pull 이후 src 차이가 없음을 확인했다. 이전 감사 기준 602fdd84와 엔진 로직은 같다. 원문 정본은 이제 저장소 docs/design/glossary.md를 따른다.

- 일반 PetitionDef 응답은 politics.ts의 효과 외 factions.ts:378의 공통 후처리를 거친다. 왕실은 accept/accept_with_price/refuse/expired 순서로 +5/+5/−20/−20, 다른 청원 세력은 +10/+3/−15/−10이다. 이는 merchantGauge와 별개이며 무제한 임의 세력 delta API가 아니다.
- 기근 응답의 첫 관계 변화는 구휼 commons+15/bishop+10, 가격 제한+5/0, 방임−10/−5, 매점−20/−15다. 관계는−100~100으로 제한되며 반복 실행하지 않는다.
- 장려금 실제 지급은 min(제안의 장려금, max(0, 채택시 금고))이다. 설정 때 한도를 통과해도 이후 금고가 줄면 전액 지급을 보장하지 않는다.
- will_change의 정치지원 약속은 그 단계에서 생성된다. 기존 약속 재사용이 아니며, 이후 이행 명령은 별도 실제 자원을 쓰지 않는다. 비용이 있는 것처럼 설명하여 선택 균형을 꾸미지 않는다.
