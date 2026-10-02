# 2차 변경 요약

60개 ID·시대별20개·종류별 분포를 유지했다. 1차 파일 실측은 선택124개(2개 선택56건, 3개 선택4건)다. 사용자 언급 수량과 별개로 아래 비교는 납품 JSON을 기준으로 했다.

2차는 선택 **157개**이며, 선택 수별 사건 수는 2개 선택 24건, 3개 선택 35건, 4개 선택 1건이다.

## 구분과 실행 범위

- 기존 사건 문구 개선: 9개
- 기존 청원 변주: 16개
- 신규 사건 초안: 35개

기존 사건 문구 개선은 같은 실제 장 사건을 대체·보충하는 원고다. 신규 발생량으로 더하지 않는다. 기존 청원 변주 역시 실제 대상에 결부하며 원래 청원의 효과를 두 번 실행하지 않는다.

NE10은 신규 제안에서 철회했고 남은 제안은9개다. 최신 pull HEAD83b06802에서 FIX-14 SW-12의 지도 밖 선례는 확인했지만 홈 생성은 direct였다. [실사](records/ENGINE_EFFECTS.md)에 이 차이를 명시했다.

등록기 형식은 [제안](REGISTRY_PROPOSAL.md)·[스키마](registry.schema.json)·[예시](registry.example.json)로 나눴다. 신규 등록기나 묶음 명령을 이번에 구현한 것은 아니다. 기존 시간 경과를 기다리는 선택은 자동 기한 연장을 뜻하지 않는다. 명령을 여러 개 쓰는 선택은 순차 실행 제안이며, 실패·부분 실행·재시도 처리는 등록기 계약으로 구별한다.

## 초안별 변경

| 번호 | 구분 | 선택 수 변화 | 2차 선택 | 대가의 축 |
|---|---|---|---|---|
| 1 | 기존 청원 변주 | 2→2 | 소작인 쪽의 청원을 받아들인다 / 상인 쪽의 사정을 따른다 | relationship |
| 2 | 신규 사건 초안 | 2→3 | 장부로 감사를 받는다 / 영주가 찾아가 감사를 한다 / 방문 대신 직접 감독으로 돌리고 장부 감사를 유지한다 | time, attention, information, delegation |
| 3 | 기존 청원 변주 | 2→3 | 청지기의 수선 지출을 승인한다 / 이번 수선 청원을 거절한다 / 기존 답변 기한 안에서 금고를 더 살핀다 | money, relationship, time, estate_value |
| 4 | 신규 사건 초안 | 2→3 | 우물 사업에 장려금을 건다 / 곡창 사업에 장려금을 건다 / 같은 한도를 우물과 곡창에 나누어 건다 | money, opportunity |
| 5 | 신규 사건 초안 | 2→3 | 시장 좌판세를 낮춘다 / 시장 좌판세를 높여 세입을 구한다 / 기존 세율을 지키며 다음 거래를 지켜본다 | money, market_burden, opportunity |
| 6 | 기존 청원 변주 | 2→2 | 이번 벌금을 면제한다 / 정해진 벌금을 받는다 | money, relationship |
| 7 | 기존 청원 변주 | 2→2 | 수선비를 보탠다 / 이번 수선비 청원을 거절한다 | money, relationship |
| 8 | 신규 사건 초안 | 2→3 | 예배당 사업의 장려금을 공고한다 / 지금은 새 장려금을 내걸지 않는다 / 작은 장려금부터 공고한다 | money, opportunity |
| 9 | 신규 사건 초안 | 2→3 | 특허장 사본을 증거로 갖춘다 / 재산 증서를 증거로 갖춘다 / 법정 장부의 짧은 등본만 갖춘다 | money, time, rights, information |
| 10 | 신규 사건 초안 | 2→3 | 기존 청구권으로 소송을 접수한다 / 지금은 청구권을 접수하지 않는다 / 접수할 때 특허장 사본까지 갖춘다 | money, time, rights, opportunity, information |
| 11 | 신규 사건 초안 | 2→3 | 되돌아온 조건을 받아들인다 / 이번 역제안을 거두게 한다 / 남은 기한 동안 혼담의 지출을 검토한다 | money, promise, time, opportunity |
| 12 | 기존 청원 변주 | 2→2 | 첫 가문의 청원을 받아들인다 / 둘째 가문의 사정을 따른다 | relationship |
| 13 | 신규 사건 초안 | 2→3 | 돈을 회수하고 청지기를 해임한다 / 드러난 일을 덮고 유임한다 / 회수 없이 해임하고 후임에게 넘긴다 | money, personnel, relationship |
| 14 | 기존 사건 문구 개선 | 2→2 | 기존 요구를 현물 분납으로 답한다 / 기존 요구를 현금으로 치른다 | money, materials, time |
| 15 | 신규 사건 초안 | 2→3 | 목재 열 단을 주문한다 / 새 목재 주문은 넣지 않는다 / 급한 몫으로 목재 네 단만 주문한다 | money, materials, time, opportunity |
| 16 | 기존 사건 문구 개선 | 3→3 | 기존 구휼 방침으로 답한다 / 기존 가격 제한 방침으로 답한다 / 기존 방임 방침으로 답한다 | money, materials, population, relationship |
| 17 | 기존 청원 변주 | 2→2 | 기존 지대 감면 청원을 승인한다 / 기존 감면 청원을 거절한다 | money, relationship |
| 18 | 신규 사건 초안 | 2→4 | 현금 지참금 120d를 제안한다 / 해마다 40d씩 세 해의 연금을 제안한다 / 현금60d와 연30d의 두 해 약속을 함께 제안한다 / 현재 보유한 권리 조각을 과부산으로 약정한다 | money, promise, time, rights |
| 19 | 신규 사건 초안 | 2→3 | 영주가 직접 감독한다 / 소작인 친화 후보에게 위임한다 / 상인 친화 후보에게 위임한다 | attention, money, delegation, market_burden |
| 20 | 신규 사건 초안 | 2→2 | 그 약속을 지금 이행한다 / 현재 기한 안에서 지급을 미룬다 | money, promise, time, opportunity |
| 21 | 기존 청원 변주 | 2→2 | 사망 부과금을 면제한다 / 관습에 따른 부담금을 걷는다 | money, relationship |
| 22 | 기존 사건 문구 개선 | 2→2 | 수도원에 사제를 청한다 / 평신도 서기를 세운다 | money, time, relationship |
| 23 | 기존 청원 변주 | 2→2 | 수선 청원을 받아들인다 / 이번 수선 지출을 거절한다 | money, relationship |
| 24 | 신규 사건 초안 | 2→3 | 시장 좌판세를 기본의 750‰로 설정한다 / 기본 시장 좌판세를 유지한다 / 좌판세는 두고 시장 사업에 24d를 약속한다 | money, opportunity, time, promise |
| 25 | 신규 사건 초안 | 3→3 | 돈을 회수하고 후임을 세운다 / 회수 없이 사람만 바꾼다 / 이번에는 자리를 지키게 한다 | personnel, money, relationship |
| 26 | 기존 청원 변주 | 2→2 | 입주금을 받고 청원을 승인한다 / 정착 청원을 거절한다 | money, relationship |
| 27 | 신규 사건 초안 | 2→3 | 방어 방침으로 돌린다 / 성장 방침을 택한다 / 방침은 두고 창고용 목재 8단을 주문한다 | opportunity, money, materials, time |
| 28 | 신규 사건 초안 | 2→3 | 안정 방침을 택한다 / 세입 방침을 택한다 / 현재 방침을 두고 곡창 사업에 32d를 약속한다 | opportunity, money, promise |
| 29 | 신규 사건 초안 | 2→3 | 장부로 감사한다 / 직접 방문해 감사한다 / 셈 밝은 후보로 바꾸고 장부로 감사한다 | time, attention, money, personnel |
| 30 | 신규 사건 초안 | 2→3 | 축융 방앗간에 장려금 32d를 설정한다 / 곡물 방앗간에 장려금 32d를 설정한다 / 두 사업에 16d씩 나누어 약속한다 | money, promise, opportunity |
| 31 | 신규 사건 초안 | 2→3 | 능력이 높은 후보에게 맡긴다 / 충성도가 높은 후보에게 맡긴다 / 수납 담당은 두고 영주가 직접 감독한다 | personnel, money, attention, time |
| 32 | 신규 사건 초안 | 2→3 | 특허장을 증거로 낸다 / 법정 기록을 증거로 낸다 / 두 묶음을 함께 낸다 | money, rights |
| 33 | 신규 사건 초안 | 2→3 | 보관한 증서를 증거로 낸다 / 기억하는 증인들을 불러 증언을 낸다 / 증서와 증인을 함께 제출한다 | money, rights |
| 34 | 신규 사건 초안 | 2→3 | 같은 종류는 선례를 따르게 한다 / 반복 청원도 다시 올리게 한다 / 금액 대신 권리·혼인 안건만 다시 올리게 한다 | rights, promise, attention, money |
| 35 | 신규 사건 초안 | 2→3 | 목재 12단을 주문한다 / 목재 4단만 주문한다 / 지금은 새 주문을 내지 않는다 | money, materials, time, opportunity |
| 36 | 기존 청원 변주 | 2→2 | 부담을 덜어 달라는 청을 받아들인다 / 제분 의무에 관한 청원을 거절한다 | money, relationship |
| 37 | 신규 사건 초안 | 2→3 | 가주가 직접 감독한다 / 청지기에게 계속 맡긴다 / 위임을 유지하되 방문 감사로 바꾼다 | personnel, money, attention, time |
| 38 | 신규 사건 초안 | 2→2 | 점유 집행을 시도한다 / 집행을 미룬다 | money, rights, time, opportunity |
| 39 | 기존 사건 문구 개선 | 2→2 | 기존 길드 청원을 받아들인다 / 기존 길드 청원을 거절한다 | money, time, relationship |
| 40 | 기존 사건 문구 개선 | 2→2 | 기존 청원대로 도시가 맡게 한다 / 영주의 징수인이 맡는다 | money, time, relationship |
| 41 | 기존 청원 변주 | 2→2 | 이번 납부금을 면제한다 / 장부의 납부금을 받는다 | treasury, faction_relation |
| 42 | 신규 사건 초안 | 2→3 | 시장 좌판세를 낮춘다 / 시장 좌판세를 높여 수입을 받친다 / 좌판세는 두고 시장 사업 장려금을 건다 | market_burden, recurring_income, treasury_future, subsidy_commitment, project_risk |
| 43 | 기존 사건 문구 개선 | 2→2 | 교회를 넓혀 짓는다 / 증축을 미룬다 | treasury, succession_or_legacy_commitment |
| 44 | 기존 청원 변주 | 2→2 | 우리 소작인의 주장을 지지한다 / 이웃의 주장을 받아들인다 | faction_relation, opposed_faction_relation |
| 45 | 기존 사건 문구 개선 | 2→2 | 길드 편을 든다 / 상인 편을 든다 | faction_relation, faction_relation_opportunity |
| 46 | 신규 사건 초안 | 2→3 | 남은 주문을 네 단으로 줄인다 / 미입고 주문을 모두 거둔다 / 남은 주문을 그대로 받아 비축한다 | treasury_future, timber, delivery_time |
| 47 | 기존 사건 문구 개선 | 2→3 | 맏아들에게 잇게 한다 / 딸의 남편에게 잇게 한다 / 조카를 후계자로 정한다 | treasury, succession_or_legacy_commitment, succession_person, faction_relation |
| 48 | 기존 청원 변주 | 2→2 | 방목 한도를 두자는 청을 받아들인다 / 이번에는 한도를 두지 않는다 | faction_relation, opposed_faction_relation |
| 49 | 신규 사건 초안 | 2→3 | 직조 작업장에 장려금을 내건다 / 축융 시설에 장려금을 내건다 / 두 일에 작은 장려금을 나눈다 | treasury_future, subsidy_commitment, allocation |
| 50 | 신규 사건 초안 | 2→3 | 살림의 안정을 먼저 살핀다 / 새 살림을 받아들이는 일을 앞세운다 / 수입을 낳는 사업부터 장려한다 | project_priority, opportunity_cost, housing_opportunity, future_income_uncertainty |
| 51 | 신규 사건 초안 | 2→3 | 기존 청구권으로 소송을 낸다 / 지금은 소송을 내지 않는다 / 접수와 함께 옛 증서를 낸다 | treasury, right_claim, court_time, faction_relation, evidence |
| 52 | 신규 사건 초안 | 3→3 | 해임하고 드러난 돈을 회수한다 / 회수 없이 청지기만 바꾼다 / 현직을 남겨 둔다 | treasury_recovery, steward_state, loyalty, faction_relation |
| 53 | 신규 사건 초안 | 2→3 | 재산 증서를 먼저 갖춘다 / 장원 법정 기록을 먼저 갖춘다 / 증서와 법정 기록을 함께 낸다 | treasury, right_claim, court_time, evidence |
| 54 | 기존 청원 변주 | 2→2 | 이번 지대 감면을 받아들인다 / 감면을 허락하지 않는다 | treasury, faction_relation |
| 55 | 기존 청원 변주 | 2→2 | 이번 시장 부담 감면을 승인한다 / 장부대로 부담하게 한다 | treasury, faction_relation |
| 56 | 기존 청원 변주 | 2→2 | 길 수선 부담금을 보탠다 / 이번 부담을 받지 않는다 | treasury, faction_relation |
| 57 | 신규 사건 초안 | 2→3 | 좌판세를 낮춘 특허를 허락한다 / 납부금을 받고 기본 좌판세의 특허를 준다 / 새 특허 조건을 받아들이지 않는다 | right_concession, market_burden, treasury_income, treasury_opportunity, merchant_cooperation |
| 58 | 신규 사건 초안 | 2→2 | 이번 납부 요구를 거둔다 / 일회 납부금을 받고 합의한다 | treasury_income, merchant_cooperation |
| 59 | 신규 사건 초안 | 2→3 | 능숙한 후보에게 맡긴다 / 직접 감독을 계속한다 / 충성도가 높은 다른 후보에게 맡긴다 | attention_time, steward_discretion, steward_ability, steward_loyalty |
| 60 | 기존 사건 문구 개선 | 3→3 | 도시에 길드홀과 시청을 남긴다 / 가문의 영주관과 문장, 혈통 기록을 남긴다 / 교회를 넓히고 기도처를 세운다 | treasury, succession_or_legacy_commitment |
