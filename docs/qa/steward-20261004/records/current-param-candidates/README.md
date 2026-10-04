# 원시 params 기반 문장 후보 — 3종·6문구

작성자 후보이며 **정본650은 그대로**다. 독립 검수·병합·게임 설치를 수행하지 않았다. 문구 선택은 현재 인물이나 현재 도시 상태가 아닌 해당 기록의 원시 params만 사용한다.

| 유형 | 조건과 필수 입력 가드 | 문구 |
| --- | --- | --- |
| plague.new_graves | dead가 양의 safe integer, =1 | 역병으로 숨진 한 사람이 기록되었다. |
| plague.new_graves | dead가 양의 safe integer, >1 | 역병으로 숨진 여러 사람이 기록되었다. |
| plague.empty_streets | houses가 양의 safe integer, =1 | 역병 기록에 빈집 한 채가 올랐다. |
| plague.empty_streets | houses가 양의 safe integer, >1 | 역병 기록에 여러 채의 빈집이 올랐다. |
| legacy.mayor_demand | candidateId가 문자열, 정확히 빈 문자열 | 시장 후보를 특정하지 않은 선출권 요구가 기록되었다. |
| legacy.mayor_demand | candidateId가 문자열, 빈 문자열 아님 | 시장 후보가 함께 적힌 선출권 요구가 기록되었다. |

## 원시 값의 의미

history.ts:655–661은 첫 역병 dead가 0에서 양수로 바뀌는 시점의 누적 사망자 수와 빈집 수가 0에서 양수로 바뀌는 시점의 vacantHouseIds.length를 기록한다. dead는 실제 무덤 그림 개수나 장원 사망자 수가 아니다(plague.ts:227–233의 townDead/manorDead는 분리). houses는 당시 기록된 빈집 수이며 집마다 사람이 모두 죽었다고 단정하지 않는다. 새 문구도 이런 확대 해석을 하지 않는다. 실제 세상에서 이후 늘어난 사망·빈집 수를 과거 params로 소급하지 않는다.

legacy.ts:94–97의 merchantLeader는 해당 상인 가문 leaderId가 town people에 있으면 ID, 없으면 null을 반환한다. history.ts:736은 이 값을 candidateId 또는 빈 문자열로 저장한다. 빈 문자열은 **이 기록에 후보가 특정되지 않았다**는 뜻이다. 후보가 사망했다거나 선출 가능한 주민이 아예 없다는 원인을 뜻하지 않는다. 비어 있지 않은 ID도 지금 생존·재직·선출 성공을 보증하지 않는다. 문자열의 공백을 trim하거나 ID를 현재 인물 목록으로 조회해서 조건을 바꾸지 않는다. 공백 문자열도 정확한 원시 비어 있지 않음 분기에 속하지만 정상 엔진이 그런 ID를 발행한다는 주장은 아니다.

## 제안 가드와 연산자, 설치 차단

기존 condition schema의 eq/gt는 양의 유한 safe integer를 보증하지 않는다. `GUARD_CONTRACT.json`의 **1..9007199254740991 정수값** 가드를 먼저 적용하고 그 뒤 eq1/gt1을 평가해야 한다. JSON 숫자 1.0은 JavaScript의 Number.isSafeInteger(1.0)와 같이 정수값 1로 다루며 문자열 "1"은 거부한다. NaN/Infinity·소수·0·음수·unsafe integer·누락·잘못된 타입은 기본형으로 돌아간다. 단순히 schema 모양이 맞는 것을 가드 구현으로 오인하지 않는다.

현재 schema에는 neq가 없다. candidateId의 비어 있지 않음 분기에 필요한 **문자열 타입 검사 후 neq ""**를 `PROPOSED_VARIANTS.schema.json`으로 별도 제안했다. 기존 schema를 변경하지 않았다. 새로운 neq는 일반 숫자 비교 연산자 확대를 뜻하지 않으며, 여기서는 GUARD_CONTRACT의 문자열 전제 아래만 정의된다. 기존 schema 모양에 맞는 후보5개와 새 연산자가 필요한 후보1개를 VALIDATION.json에 구분했다.

여섯 후보 모두 `INSTALL_BLOCKS.json`에 제안 선택기 가드 검증 전 설치 차단으로 표시했다. 4개 숫자형은 safe integer 가드가, 2개 ID형은 타입 계약이 필요하며 비어 있지 않음 분기에는 연산자 확장도 필요하다. 숫자 가드는 새 입력 계약이고, 단순 gt가 이미 해결했다고 주장하지 않는다. 최종 병합 여부는 독립 검수 뒤 부모가 결정한다.

## FIX-12 및 사실 줄

requiredSlots는 모두 비어 있고 인명을 새로 저장하지 않는다. 원래 필수 사실 줄 `history.summary(record,state)`를 유지한다. candidateId→candidate 이름은 historyNames.ts:15–20,43–54의 읽기 시점 조회가 담당한다. 이름·별칭 변경이나 현재 인물 검색 실패를 조건에 사용하지 않는다. 조회 실패 시 기존 기본 이름 fallback이 적용되며 후보가 현재 없다는 이유로 과거 기록의 비어 있지 않은 ID를 빈 ID로 덮지 않는다. 새 문구가 가드 실패 때 기본 사실 줄 자체를 교정하는 것은 아니다.

## 검증과 재현

`ruby validate.rb`: 기준650 SHA·전체 객체 보존, 새6 ID 유일성·기존 proposal ID 충돌 없음, 세 대상이 현행 단일 문장인 점, 제안 schema의 가상656문서, 원시 입력 fixture46건(34fallback), JSON 밖 비유한수6건, 소스6파일·12구간 SHA/원문,6개 설치 차단·정본 불변을 검사한다. 선택기는 Ruby 참조 모형이다. schema_validator.rb는 기존 R06 registry-invalid 후보의 경량 schema 검사기 사본이다. 실제 엔진 선택기·이름 포매터·저장복원·UI는 미실행이다.

`build.rb`는 작성 재현용이며 현재 baseline650 SHA가 다르면 중단한다. 검수에는 build를 먼저 실행하지 말고 validate.rb를 사용한다. 출력 파일 갱신 뒤 SHA256SUMS를 다시 만들어야 한다. 독립 검수 전 author-only이며 여섯 문구를 정본 수량에 미리 합산하지 않는다.

추가 역사적 원인·관행은 쓰지 않았으므로 새로운 외부 사료를 붙이지 않았다. 근거는 SOURCE_EVIDENCE.json의 현재 코드 및 docs/design/glossary.md다. graft1회, 도구 추정 절감56,852 tokens(달러 미제공).
