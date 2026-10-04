# 사건 시점 문맥 초안 2차 — 작성자 산출물

지정 10유형 중 9유형·22문장·9개 enum 문맥 필드. 미작성 1유형은 negotiation.rejected다. 소스가 반환하지 않는 거절 동기를 지어내지 않았다. 이 문서는 사용자 요청의 문장·선택 데이터 초안이며 엔진 구현을 추가 완료 조건으로 삼지 않는다. 정본·엔진·기존 wave1·검수 폴더는 수정하지 않았다.

## 문장 전문

| 유형 | 사건 시점 조건 | 후보 문장 |
|---|---|---|
| reorg.textile_street | already_recorded | 에일집의 성장에 이어 직물 거리도 도시의 기록에 올랐다. |
| reorg.textile_street | same_tick | 직물 거리와 에일집의 성장이 함께 도시의 기록에 올랐다. |
| reorg.textile_street | not_yet_recorded | 직물 거리의 성장이 기록되었다. 에일집은 아직 성장의 기준에 이르렀다는 기록이 없었다. |
| reorg.alehouse_boom | already_recorded | 직물 거리가 기록된 뒤 에일집의 성장도 도시의 기록에 올랐다. |
| reorg.alehouse_boom | same_tick | 에일집과 직물 거리의 성장이 함께 도시의 기록에 올랐다. |
| reorg.alehouse_boom | not_yet_recorded | 에일집의 성장이 기록되었다. 직물 거리는 아직 성장의 기준에 이르렀다는 기록이 없었다. |
| legacy.charter_refused | refused | 도시의 자치 특허를 내어 달라는 청원을 거절했다. |
| legacy.charter_refused | expired | 자치 특허 청원에 답하지 않은 채 기한을 넘겼다. |
| legacy.last_market | town | 마지막 장날, 도시가 남긴 유산이 가문과 교회의 유산보다 작지 않았다. |
| legacy.last_market | family | 마지막 장날, 가문의 유산이 도시를 앞서고 교회의 유산에도 뒤지지 않았다. |
| legacy.last_market | church | 마지막 장날, 교회의 유산이 도시와 가문보다 크게 남았다. |
| decision.market_town | water_reach | 물길을 경계의 일부로 삼고, 땅 위에는 목책을 두를 시장도시를 선포했다. |
| decision.market_town | land_ring | 땅 위를 잇는 목책 둘레를 정하고 시장도시를 선포했다. |
| decision.stone_town | all_ready | 목책의 모든 구간이 완성된 뒤, 이를 돌로 바꾸는 석벽 사업을 열었다. |
| decision.stone_town | partly_ready | 아직 짓는 목책을 남겨 둔 채, 완성된 구간부터 돌로 바꾸는 사업을 열었다. |
| decision.stone_town | none_ready | 목책이 완성되기를 기다리며 석벽 사업을 먼저 선포했다. |
| decision.rebuild | residents_present | 살던 사람들이 남아 있는 불탄 집에 재건 공사를 열었다. |
| decision.rebuild | empty | 거주자가 없는 불탄 집에 재건 공사를 열었다. |
| decision.wall_expand | retained | 기존 성문 자리를 지키면서 목책 둘레를 넓히기로 했다. |
| decision.wall_expand | moved | 새 둘레에 맞춰 성문 자리를 옮기고 목책을 넓히기로 했다. |
| decision.drainage | sole_work | 다른 배수 공사가 없는 때에 웅덩이의 물을 빼는 공사를 열었다. |
| decision.drainage | parallel_work | 먼저 시작한 배수 공사를 남겨 둔 채 또 한 곳의 물빼기 공사를 열었다. |

## capture와 사실 경계

FIELD_CONTRACTS.json에 각 필드의 capture 지점·현재 저장 상태·복원 가능성·규칙을 기재했다. SOURCE_EVIDENCE.json은 전체 파일 SHA와 원문 스팬을 포함한다. 모든 필드는 현재 history condition schema 밖의 제안이다. PROPOSAL.schema.json과 CONTEXT.schema.json은 wave1 형식만 재사용한 별도 스키마다.

- 직물·에일집은 이미 존재하던 상대 업종 자체가 아니라 상대 성장 이정표의 기록 순서를 구별한다. 같은 tick을 별도 조건으로 둔다. 건물 수가 현재 많다는 이유로 과거 순서를 만들지 않는다.
- 마지막 장날은 해당 사건에서 확정한 legacy.ending.highest를 쓴다. 동점 처리까지 endingOf의 town > family > church 우선순위를 따른다. 도시 분기가 반드시 자치 특허 획득을 뜻하지 않는다. 기존 결말 제목은 사실줄에 남는다.
- 자치 청원의 무응답은 명시 거절과 다르다. 기존 사실줄은 둘 다 '거절했다'고 하므로 expiry 후보는 ADOPTION_LIMITS.json에 사실줄 검수 전 설치 차단했다.
- 시장 경계·성문 이전·석벽 교체·재건·배수는 결정 시점의 계획 또는 공사 착수만 적는다. 완공·이주·인부 확보·조기 완공을 약속하지 않는다.
- 석벽 none_ready는 소스에서 허용되지만 자연 플레이 도달은 미측정이다. 문맥 누락·unknown·잘못된 형식·provenance 불일치는 baseline으로 돌아간다. fallback도 사실줄 충돌을 고치지는 않는다.
- 숫자/좌표/tick에서 enum으로 바꾸는 capture 검증은 계약 제안이다. 안전한 정수·유효 상태를 검증할 어댑터는 아직 구현하지 않았다. fixture는 신뢰된 출력 이후의 선택만 확인한다.

## 보존과 검증

baseline647.ko.json은 SHA ac1bde4a2c92381f8adaed3b3e5c6a4cd6dbe5745098639754bb6389919aba88의 원고 기준 사본이다. 작성 도중 부모가 별도 검수 완료한 3문장을 병합하여 공유 정본은 650/SHA7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf가 되었다. 두 기준을 분리하고 새 ID 충돌을 양쪽에서 검사한다. 타 작업의 정당한 변경을 이 작업의 오류나 원본 보존 실패로 취급하지 않는다.

ruby validate.rb는 별도 스키마·enum scope·positive/missing/unknown/malformed fixture·이름 계약 모형·소스 SHA/스팬·원고647사본·공유650 ID 충돌·expiry 차단을 검사한다. 엔진·포매터·UI·capture 구현은 실행하지 않았다. 독립 검수 미실시, author-only다. 전체 E 요구의 완료를 뜻하지 않는다. graft 1회, 추정 절약20,478토큰; 실제 source 원문으로 재확인했다.

용어는 docs/design/glossary.md를 따른다. '장원'과 '영지', 권리 소유와 점유를 섞지 않는다. 인명 읽기 계약은 READ_TIME_NAMES.md 참조.

## 독립 검수 반영 수정본

PATCH_LOG.md와 NEGATIVE_SCHEMA_RESULTS.json을 참조한다. 원본22문장과176 fixture를 유지하며 문맥 schema의5가지 수용 한계를 수정했다. expiry1건 차단과 시장도시2건 조합출력 보류를 ADOPTION_LIMITS.json에 명시했다. 원본 독립 검수를 반영한 작성자 수정본이며 이 수정본의 독립 재검수는 아직이다.
