# 고정 사건 문맥 2차 검토 — 4종·10문장 제안

기본 사건의 나이·단계·명칭이 고정이어도 **발생 당시 처지**는 구별할 수 있었다. 세 종류에는 사건 시점 snapshot 제안을, ledger.l4에는 보존 기록의 원시 from/to 비교 제안을 만들었다. 실제 캡처·게임 설치·정본 변경은 하지 않았다. 정본650에 10개를 합산하지 않는다.

| 유형 | 제한된 의미 분기 | 문장 |
| --- | --- | --- |
| person.came_of_age | 기록된 부모 중 현재 people 소속·생존·leftYear 없음·동일 가구인 사람이 있음 | 기록된 부모와 한 가구에서 지내던 아이가 성장의 고비를 맞았다. |
| person.came_of_age | 부모 둘이 명확히 조회되지만 위 조건에 해당하지 않음 | 기록된 부모와 함께 살지 않는 가구에서 아이가 성장의 고비를 맞았다. |
| milestone.stone_town | 당시 모든 성벽 구간 completed=true | 석벽 사업 단계가 기록될 때, 성벽 구간들은 모두 완성 상태였다. |
| milestone.stone_town | 완성·미완성 구간 혼재 | 석벽 사업 단계가 기록될 때, 완성된 성벽 구간과 미완성 구간이 함께 있었다. |
| milestone.stone_town | 구간은 있으나 모두 completed=false | 석벽 사업 단계가 기록될 때, 아직 완성 상태인 성벽 구간은 없었다. |
| plague.priest_died | 기존 church 또는 chapel 건물 있음 | 교회나 예배당이 있는 도시에 사제직 공석이 기록되었다. |
| plague.priest_died | 둘 다 없음 | 교회와 예배당이 없는 도시에 사제직 공석이 기록되었다. |
| ledger.l4 | 보존 params.to > from | 보존된 집계에서 도시 대가옥 수가 늘었다. |
| ledger.l4 | to < from | 보존된 집계에서 도시 대가옥 수가 줄었다. |
| ledger.l4 | to = from | 보존된 집계에서 도시 대가옥 수는 그대로였다. |

## 이전 미작성 판단보다 나아진 근거

- **성장:** history.ts:406의 연령 경계만 보면 나이 변형은 불필요하지만 Person은 motherId/fatherId/householdId/alive를 보유한다. 정확히 같은 사건 인물의 당시 부모 동거 여부는 구별 가능하다. 부모 ID **둘 다**가 명확히 조회되어야 하며 하나라도 누락·모호하면 unknown이다. 부모 정보 미상을 부모 부재로 바꾸지 않는다. 동거 양성에는 당시 persons.people 소속이며 alive=true, leftYear 없음, 같은 householdId라는 네 조건을 모두 요구한다. past에 남은 이주 부모는 살아 있고 옛 householdId가 같더라도 동거로 세지 않는다. ‘고아’, 실제 돌봄, 부양 부담, 일 배정은 단정하지 않는다. 부모와 떨어져 있다는 이유나 사망 원인도 쓰지 않는다.
- **석벽 단계:** milestoneDrafts는 era=stone_town만 확인한다. confirmStoneTownProclamation은 그 시점에 completed 구간의 교체공사장을 새로 만들므로 단계 명칭은 물리 완공과 다르다. PalisadeSegment의 명시적인 completed만 비교한다. null/빈 구간·중복 ID·잘못된 boolean은 unknown이다. **material을 추정하지 않으며**, completed=true가 석재 교체공사 완료나 전 구역의 방어선 봉합을 뜻하지 않는다. replacementConstructionSiteId와 completed를 같은 속성으로 취급하지 않는다.
- **사제직 공석:** plague.ts:511–522는 역병 도래와 함께 curacy.vacantSince를 설정하고 청원을 연다. 실제 사제 인물의 사망·원인을 확인하지 않는다. 그래서 새 문구는 공석만 말한다. 기존 buildings의 church/chapel 존재를 별도로 snapshot한다. 공사장만 있으면 기존 건물로 세지 않는다. 건물이 없다고 신자·예배·성직자가 전무하다는 뜻이 아니다.
- **대가옥 집계:** historyCopy.ko.ts:336은 분명히 from/to를 읽는다. 정확 문자열의 graft 조회와 history.ts의 계절 원장 producer(468–491) 확인에서는 현재 ledger.l4 생성 경로를 찾지 못했다. 이것은 모든 과거 버전의 생성 경로가 없었다는 증거가 아니다. N02 1450 실제 보존 저장 1개를 별도로 읽었으며 history 8,567건 중 해당 record는 **0건**이었다(ARCHIVE_CHECK.json). 실제 발견했다고 주장하지 않고, 앞으로 실제 archive record를 식별했을 때만 쓸 수 있는 보수적 원시 집계 비교 초안으로 남긴다. 증가·감소 원인, 기간, 생산경로 정체는 단언하지 않는다.

## 기본 사실 줄과 별도 패치 경계

ADOPTION_LIMITS.json은 **7개** 조합 보류를 둔다.

- 성장2: 기본 줄은 “일을 거들기 시작했다”지만 producer는 연령만 검사한다. 실제 일 배정을 보증하지 않는 중립 기본 줄과 함께 검수해야 한다.
- 석벽3: 기본 줄 “석벽 도시가 되었다”와 화면의 완공 이미지가 물리 재료·완공을 보증할 수 없다. 이번 문구는 구간 상태를 명시하지만 전체 조합 검수는 남는다.
- 사제 공석2: 기존 줄이 “사제가 역병으로 죽었다”라서 그대로 조합하면 충돌한다. 다른 작업자의 사실 줄 중립화 패치가 **제안 중**이라는 점만 알며 적용·승인을 전제로 삼지 않았다. 이 폴더는 해당 패치를 수정하거나 설치하지 않는다.

ledger.l4 세 문구는 기존 from/to 사실 줄과 의미가 맞지만 실제 archive 존재·캠페인 결합이 선행되어야 한다. 전체10개가 현재 런타임에서 채택되었다는 뜻은 아니다. unknown fallback은 기존 사실 줄의 한계까지 해결하지 않는다.

## 선택·이름 계약

발생 시점 snapshot3유형은 emission_snapshot, 원시 archive 집계는 immutable_record_params로 엄격히 분리한다. template별 enum·필수 키·추가 키 금지·safe tick·sourceHead·known/unknown을 schema에서 검사한 **뒤** 대상 recordId/tick/template/campaignId/sourceHead가 일치해야 선택한다. ledger.l4는 추가로 실제 대상 record.params.from/to를 finite nonnegative safe integer로 검사하고 방향을 **다시 계산하여** context enum과 비교한다. 잘못된 enum을 referenceVerified=true로 보내도 선택하지 않는다. 이 어댑터 모형을 실제 archive 검증이나 엔진 설치로 오인하지 않는다.

부모 ID·당시 동거 상태는 원시 snapshot에 고정하되 표시 이름을 새로 저장하지 않는다. 기존 history.summary(record,state)와 FIX-12 읽기 시점 이름 조회를 유지한다. 현재 부모의 이름·사망·가구를 과거에 소급하지 않는다. 이름 슬롯을 새로 만들지 않았다.

## 검증·재현

`ruby validate.rb`:정상10·fallback120의 selector130건, 별도 schema 음성140건, archive 원시값·방향 불일치 음성10건, 소스9파일·18구간 SHA/원문, 정본SHA 불변을 확인했다. 경량 schema 부분 구현이며 전체 JSON Schema 적합성 인증은 아니다. 부모 관계 실제 snapshot 추출, 물리 세계 렌더, 엔진·저장복원·포매터·UI는 실행하지 않았다. 생존 부모가 없는 분기·성벽 미완성 분기 등의 자연 발생률도 미측정이다.

build.rb는 작성 재현용이고 prepare.rb는 재사용 형식으로 이를 생성한다. 쓰기 범위는 이 폴더뿐이다. 검증 후 SHA256SUMS를 갱신한다. 독립 검수 전 author-only다. 새 외부 역사 사실을 추가하지 않았으며 근거는 현재 코드·용어 정본과 명시한 단일 저장 표본이다.

graft1회, 추정 절감58,375 tokens(달러 미제공).

## 부모 동거 계약 재검수 반영

원본 fixed-context-second-pass는 유지했다. 인물 이주 시 past가 기존 householdId·alive를 보존하는 persons.ts:233–237와 inTown의 leftYear 조건(85–87)을 근거에 추가했다. parents 조회는 people+past에서 두 ID가 각각 정확히 한 번 조회되어야 하고, 동거 양성은 people 현재 소속과 leftYear 부재까지 요구한다. unknown을 부재로 바꾸지 않는다.

parent_capture.rb는 이 교정의 오프라인 참조 함수이며 전체 사건 캡처 구현이 아니다. 14개 추가 사례에서 past 이주·생존·같은 householdId 반례, people에 leftYear가 있는 입력, 사망·중복·누락 부모, 피후견 인물 이주 등을 검사했다. 기존 selector130/schema음성140/archive음성10과 새14검사는 validate.rb에서 함께 실행된다. 실제 엔진 통합·저장복원·UI는 여전히 미검증이다.
