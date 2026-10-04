# 가문 교체·재정착·목재 주문·혼인 제안 문맥 초안

5유형·13문장·5문맥 필드를 작성했다. 원본·정본650·엔진을 수정하지 않았다. 사건 시점 캡처가 필요한 별도 초안이며 실제 사용을 위해 필요한 엔진 통합을 사용자 요청의 초안 완료 조건으로 추가하지 않는다. 작성자 검사만 완료했고 독립 검수는 아직이다.

| 사건 | 사건 시점 조건 | 후보 전문 |
|---|---|---|
| house.withdrew | empty_town | 도시에 주민이 남지 않은 때, 종전 가문이 영지를 맡는 일이 끝났다. |
| house.withdrew | family_extinct | 역병으로 식구를 잃었던 가문의 식구가 현재 도시 기록에 남아 있지 않고 대기 중인 후계 후보도 없어, 새 가문으로 교체되었다. |
| house.withdrew | decline_elapsed | 쇠퇴가 이어진 끝에 종전 가문이 영지에서 물러났다. |
| house.arrived | inhabited | 주민들이 살고 있는 도시를 새 가문이 맡았다. |
| house.arrived | empty | 주민이 없어 비어 있던 도시를 새 가문이 맡았다. |
| house.resettled | granary_only | 빈집에 들어온 이주민들이 가져온 한 철치 빵을 모두 곡창에 넣었다. |
| house.resettled | split | 빈집에 들어온 이주민들은 가져온 빵을 곡창에 넣고, 남은 몫은 이주민 가구에 나누어 두었다. |
| house.resettled | household_only | 빈집에 들어온 이주민들은 가져온 한 철치 빵을 집집마다 나누어 두었다. |
| agency.timber_ordered | market | 도시가 시장 칙허에 모자란 목재를 주문했다. 주문 당시에는 시장이 받을 곳으로 정해져 있었다. |
| agency.timber_ordered | hamlet_storehouse | 도시가 시장 칙허에 모자란 목재를 주문했다. 주문 당시에는 촌락의 창고가 받을 곳으로 정해져 있었다. |
| negotiation.rejected | jointure | 과부산을 조건에 넣은 혼인 제안을 이웃 가문이 받아들이지 않았다. |
| negotiation.rejected | deferred_without_jointure | 과부산 없이 상속 뒤 빚을 떠맡는 조건을 넣은 혼인 제안을 이웃 가문이 받아들이지 않았다. |
| negotiation.rejected | neither | 과부산이나 상속 뒤 채무인수 조건을 넣지 않은 혼인 제안을 이웃 가문이 받아들이지 않았다. |

## source와 문맥

- house.withdrew: advanceLordship의 실제 가문 교체 호출 세 곳을 구분한다. 빈 도시, 남은 식구·후계 후보 없음(과거 역병 사망 포함), 쇠퇴 기한 경과다. 다른 조건도 동시에 참일 수 있으므로 현재 상태에 predicate를 다시 적용하지 않고 실제 선택된 경로를 기록한다. 모든 식구가 역병으로 죽었다고 과장하지 않는다.
- house.arrived: 교체 직전 주민 유무다. 같은 동작 안에서 재정착 후 인구가 늘 수 있으므로 after만 보고 비어 있지 않았다고 고치지 않는다. 가문이 영주관으로 실제 이동했다는 기록은 없으므로 물리적 이동이나 출신지를 발명하지 않는다.
- house.resettled: 새 주민들이 가져온 빵의 실제 초기 배분을 곡창 전부·곡창과 가구 분배·가구 전부로 구별한다. resettleTown의 local stored/bread/settled와 건물 ID를 캡처한다. 불탄 집은 제외되고 현재 재고로 과거 배분을 계산하지 않는다. 식량의 무한 지속이나 앞으로의 수확을 약속하지 않는다.
- agency.timber_ordered: 확인된 자동 producer는 시장 칙허에 모자란 목재를 주문하고, 기존 주문이0인 경우뿐이다. 새로운 보수·교회 증축 용도를 만들지 않았다. 목재가 실제로 벽에 소비되었다고도 적지 않았다. 시장/촌락 창고는 주문 당시의 수령처이며 실제 배송 시점에는 다시 선택된다. 두 경로 모두 코드에 있지만 자연 플레이 도달·발생률은 미측정이다.
- negotiation.rejected: 최초 제안의 proposer terms를 jointure 우선, 그다음 debt_after_inheritance, 둘 다 없음으로 나눈다. 둘 다 있으면 jointure 분기가 고르며 빚이 없다고 단정하지 않는다. 당시 조건의 차이일 뿐 거절 동기는 아니다. 거절된 제안이 혼인 계약·과부산 점유·채무인수 약정을 성립시켰다고 쓰지 않는다. malformed/금액0인 빚 항목·unknown terms는 unknown이며 그럴듯한 조건으로 보충하지 않는다.

## 기본 사실줄·보류

ADOPTION_LIMITS.json은 13개 조합에서 직접적인 사실줄 충돌은 발견하지 못했다고 기록한다. 이는 독립 검수나 설치 승인이 아니다. 모든 후보가 검증된 producer와 사건 시점 capture 어댑터가 있어야 사용할 수 있다. 목재 history는 단순 주문량 증가만 확인하고 resettled는 인구변화만 확인하므로, 각각 실제 자동 칙허 주문·resettleTown 호출이 확인되지 않으면 문맥 사용을 보류하고 fallback한다. 기존 baseline의 내재한 가정을 fallback이 고쳐 주는 것은 아니다.

과부산은 소유권 양도가 아닌 배우자의 평생 점유 조건이며, 이 원고에서는 그 조건을 제안했다는 것까지만 말한다. 상속 뒤 채무인수는 이미 떠안은 원래 빚과 다르다. '가문'과 주택 '가구', 인물 관계와 도시 subject를 구별한다. FIX-12 계약은 READ_TIME_NAMES.md에 있다.

## 형식·검증

PROPOSAL/FIELD_CONTRACTS는 capture 지점·현재 저장·복원 가능성·수치→enum 가드를 담는다. SOURCE_EVIDENCE는 실제 파일 SHA와 원문 스팬이다. strict schema gate를 선택기 첫 단계부터 연결했다. template별 필수 필드·도메인, 추가필드 거부, safe integer tick0..9007199254740991, HEAD/출처 일치를 검사한다. actual record provenance는 schema만으로 증명하지 못한다.

로컬 Ruby 검사: 기존 형식 선택104건, schema 음성75건, 추가필드 gate26건, envelope15건, 읽을 때 이름 계약 모형4건. 생산 엔진·저장복원·UI·실제 인명 formatter·capture adapter는 미실행/미구현이다. 전체 E 요구를 완료했다고 주장하지 않는다. manifest는 SHA256SUMS다.

graft1회 추정40,906토큰 절약. 실제 source 재독으로 판단했다.

## 독립 검수의 편집 보류 교정

CHANGES.json의3문구만 교정했다. family_extinct는 현재 도시 기록·대기 후계 후보 범위로 한정하고, 쇠퇴의 시간 경과에 약속된 마감을 덧붙이지 않으며, split은 모든 집에 배분했다는 뜻을 제거했다. 필드 계약·조건·fixture와 나머지10문구는 원본 그대로다. PATCH_LOG.md 및 PRESERVATION.json 참조. 수정본 독립 재검수는 아직이다.
