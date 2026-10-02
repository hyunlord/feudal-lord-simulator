# 고을의 연례 자율 규칙

14개 규칙의 **설계 데이터**다. 엔진에 등록하거나 실행하지 않았다. 1300년은 초기 상태이며 1301~1450년의 150차례 전이를 상정한다. 확률·비용·기간·연령별 사망률은 모두 **게임 추정**이다. 조건부 시도 확률과 시도 뒤 성공 확률을 혼동하지 않는다. 아래는 역사 통계의 추정 모형이 아니다.

| ID | 규칙·단위 | 적용 조건 | 연간 조건부 확률 범위 / 선택 | 결과·출처 |
|---|---|---|---|---|
| NW01 | 나이와 자연사 (person) | alive_at_year_open, not_plague_death_same_year | 0.2%~18% / 1% | 태어난 연도에서 나이를 계산한다. 저장된 나이에 +1을 중복 적용하지 않는다. 연령대 위험으로 사망 여부를 정한다. 사망하면 deceased, 사망년과 원인을 기록하고 생존 배우자·후견·직책·권리 승계를 NW08/NW14에 한 번 전달한다. [HS01, HS06](SOURCES.md) |
| NW02 | 부부의 출생과 새 세대 (married_pair) | both_alive, both_age_at_least_18, mother_age_18_to_42, no_religious_vows, two_years_since_last_birth, same_household_or_regular_co_residence | 8%~35% / 22% | 부모 ID가 있는 아이 하나를 추가한다. 이름 재사용은 가능하지만 ID는 고유하다. 아이의 권리·가문 계승은 출생만으로 확정하지 않는다. 새 초상은 연령 적합 풀이 없으면 요청 상태로 둔다. [HS01](SOURCES.md) |
| NW03 | 혼인 상대 탐색 (unmarried_adult) | alive, age_at_least_18, not_married_or_betrothed, no_religious_vows, consenting_pair_exists, kinship_clear_or_documented_dispensation | 8%~25% / 15% | 개별 인물 욕망·동의, 기존 친족·거래 연결, 이동거리, 재산부담·신분 등을 근거로 최대3후보를 낸다. 플레이어를 특별 우선하지 않는다. 실제 양쪽 동의와 NW04 계약 검사를 통과할 때만 혼인한다. 실패하면 관계의 작은 기억만 남기고 권리를 주지 않는다. [HS01, HS03](SOURCES.md) |
| NW04 | 혼인 재산·과부산의 설정 (courtship) | mutual_consent, both_alive, no_concurrent_marriage, funds_and_rights_available, settlement_does_not_override_existing_life_interest | 40%~75% / 60% | 지참금·연금·과부산·후견·상속 기대를 별도 약정으로 작성한다. 금고 지급은 양쪽 원장을 동시에 갱신한다. 혼인은 상속 기대 청구권을 낳을 수 있으나 배우자 부친의 영지 전체를 즉시 이전하지 않는다. 과부 몫은 기존 문서·관습과 중복되지 않게 조정한다. [HS01, HS02, HS03](SOURCES.md) |
| NW05 | 채무와 담보 약정 (debtor_creditor_pair) | debtor_has_documented_shortfall, creditor_has_surplus, both_authorised, collateral_not_already_pledged_or_entailed_without_consent | 15%~45% / 30% | 현금 대부 또는 외상 대금을 채권·채무 한 쌍으로 기록하고 현금 이동은 한 번만 한다. 담보는 수입 조각·동산·조건부 이전 중 문서가 정한 것. 채권자가 자동 영주가 되지 않는다. [HS04, HS01](SOURCES.md) |
| NW06 | 상환·체납·담보 집행 (debt_contract) | contract_open, payment_due | 100%~100% / 100% | 지급 능력이 있으면 약정액만 양쪽 장부에 이전한다. 부족하면 현금 전액을 음수로 만들지 않고 미지급분을 체납으로 남긴다. 체납2년이면 채권자가 유예 재협상·소송·담보 점유 청구 중 택한다. 담보 자동 압류·채무와 원영지 이중상실 금지. [HS04, HS03](SOURCES.md) |
| NW07 | 권원·경계·채무 소송 (claim) | claim_open, evidence_exists, claimant_alive_or_represented, no_identical_case_open, filing_cost_affordable | 5%~18% / 10% | 증거·법정 관할·대리인·후원을 기록하여 소송을 연다. 같은 권리·같은 당사자·같은 근거를 반복 개시하지 않는다. 판결은 claim 판단, 실제 점유 집행은 별도 단계다. 기각·화해·지연도 서사 결과다. 무력 사용은 비용·법적 후과가 있으며 권원 생성과 동일하지 않다. [HS01, HS03](SOURCES.md) |
| NW08 | 권리별 상속과 대의 단절 (succession_context) | holder_died_or_life_interest_ended, right_not_processed_for_this_death | 100%~100% / 100% | 생애권·한정상속·차순위 문서를 먼저 적용하고 남은 일반법 재산에 대표상속·아들 우선·딸 공동상속·방계 탐색을 적용한다. 남자 후손이 없다는 이유만으로 가문 완전 소멸이라 하지 않는다. 남계 단절·명의 가문 흡수·모든 추적 계통 단절을 구별한다. 둘 이상 타당한 청구가 있으면 contested; 죽은 사람의 명의를 활성 holder로 유지하지 않는다. 미성년 상속은 후견·수익관리와 별도. [HS01, HS02](SOURCES.md) |
| NW09 | 권리 조각 매매 (seller_buyer_piece) | seller_willing, buyer_can_pay, seller_has_transferable_title, not_disposed_this_year, existing_burdens_disclosed | 4%~12% / 8% | 계약금·권원 이전·점유 인도를 구별한다. 연간 가치와 거래가는 다른 금액이다. 토지와 모든 관습·공유권이 함께 없어지지 않는다. 과부 몫·한정상속·기존 담보가 걸렸으면 해당 동의/해제를 선행한다. [HS01, HS03, HS05](SOURCES.md) |
| NW10 | 후원 관계 재협상 (house_patron_pair) | patron_dead_or_unpaid_or_unhelpful_or_obligation_ended, alternative_patron_willing, service_compatible | 4%~16% / 9% | 갱신·중립·새 후원자를 비교한다. 보호·법률 지원·연금·봉사 대가를 기록한다. 후원자는 법적 상위 영주와 같지 않다. 후원 변경이 봉건적 토지 보유 관계나 모든 우정을 즉시 바꾸지 않는다. [HS03, HS09](SOURCES.md) |
| NW11 | 재정 몰락과 지위 하락 (secular_house) | three_years_nonpositive_net, arrears_exist, no_affordable_rescue, not_already_collapsed | 10%~35% / 20% | 외곽 수입 매각→가신 연금 축소→영주관 임대/이주 중 가능한 순서를 택한다. 재정 몰락은 생물학적 멸족이 아니다. 살아 있는 인물은 서기·청지기·혼인 친족·상인의 동업자로 계속 남는다. [HS04, HS01](SOURCES.md) |
| NW12 | 1348–1349 역병과 후속 파동 (person_exposure) | alive, local_outbreak_active, not_processed_for_same_wave | 25%~55% / 35% | 1348–1349를 한 번의 지역 노출 파동으로 다룬다. 2년 모두35%를 중복 적용하지 않는다. 거점별 유행 도착년을 정해 인물별1회 판정한다. 사망은 NW08/NW14로 전달한다. 사망률·가문별 피해는 예시 게임 추정이며 전국 수치 재현 아님. 빈 땅이 즉시 목초지가 되거나 플레이어 소유가 되지 않는다. [HS06](SOURCES.md) |
| NW13 | 1381의 집단 청원·저항과 문서 분쟁 (estate_community) | year_is_1381, grievance_or_tax_pressure_exists, not_processed_1381 | 15%~45% / 25% | 부역·부담금·징수 절차의 집단 청원 또는 장부 제출 요구가 생긴다. 청원·중재를 기본 결과로 두고 문서 탈취·소각은 조건부 일부 사례만 허용한다. 문서 소실은 증거 신뢰도에 영향을 주며 실제 모든 권리·모든 채무의 삭제가 아니다. 1382 이후 복구·사면·소송의 기억을 남긴다. [HS07, HS08](SOURCES.md) |
| NW14 | 수도원·주교좌의 직위 계승 (institution_office) | vacancy, eligible_cleric_candidates_exist, not_filled_this_vacancy | 100%~100% / 100% | 수도원은 공동체의 선출/승인 절차, 주교좌 장원은 새 주교 또는 위임 관리인의 권한 확인으로 대표자를 바꾼다. 기관 재산은 전임자의 아들·조카에게 자동 상속하지 않는다. 전임·현직·후임 후보의 직위 연속성은 혈통3세대와 다르다. [HS01, HS02](SOURCES.md) |

## 처리와 보존

연초 회계→유행 사망→나머지 자연사→권리별 상속/기관 직위→상환·체납→몰락→혼담·약정·출생→대부·소송·매매·후원→1381 사정의 순서다. 사망·상속·기한 지급은 가문당 배경 행동 연2회 상한에서 제외한다. 주민에게 보여 주는 새 장면 연2개 상한은 세계가 실제 움직이는 횟수의 상한이 아니다. 기존 v2 등록기 초안과 접속할 때 같은 사건을 두 번 결제하지 않는다.

NW01의 선택10‰은16~39세 기준이며 JSON의 연령대 값으로 대체한다. NW02도 어머니의 연령대 값으로 대체한다. NW12 노출연도에는 자연사를 중복 뽑지 않는다. 1348~1349 첫 파동은 개인당 한 번, 후속파동은 각 파동별 한 번이다. NW06은 도래한 상환 자체가100%이고 미지급 뒤 세 갈래만450/250/300‰ 추첨이다. NW08 승계 조사100%와 그 뒤 경쟁 청구의 분쟁250‰은 별개다.

금고는 음수로 내려가지 않으며 미지급은 체납으로 남는다. 양쪽 현금 이전의 합은0이고, 미래 연금·평가액·담보가를 즉시 현금으로 더하지 않는다. 같은 조각은 한 해 한 번만 매도하며 공동상속 분할 합은 원래 지분을 넘을 수 없다. 한정상속이나 과부 몫을 무시한 매각은 계약 완료로 인정하지 않는다. 인물 생존·연령·혈연·배우자·직위 검사를 클릭/결산 직전에 다시 한다.

## 해석 표와 최소 새 읽기 모델

조건 이름은 GameState에 이미 있는 필드 경로가 아니다. `alive`, `age_at_least_18`, `holder_died_or_life_interest_ended`는 인물/조각에서 계산한다. 나머지 `documented_shortfall`, `grievance`, `religious_vows`, `kinship`, `transferable_title`, `eligible_cleric_candidates`는 새 데이터 또는 검증 어댑터를 요구한다. 기관·개인 가문을 동일한 생식/혼인 루프에 넣지 않는다. 인물·가문별 원장과 양자 NPC 협상을 추가하지 않으면 이 JSON은 실행 불가다. 자세한 경계는 NEW_FIELDS.md에 통합한다.

수동 연대기는 규칙 ID, 당사자, 선행 상태, 사용한 판정값, 후속 상태를 기록한 한 판의 구성 사례다. 사건을 흥미롭게 골랐다고 통계적 생존율이나 균형 검증이 된 것은 아니다. 출생·혼인·자연사라는 이름만 붙여150년 생존을 건너뛰지 말고 주역 교체와 기존 인물 사망을 적는다.
