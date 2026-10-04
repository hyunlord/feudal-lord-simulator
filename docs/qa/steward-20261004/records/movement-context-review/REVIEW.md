# 가문 교체·이주·주문·거절13문구 독립 검수

**10개 조건부 초안 통과, 3개 편집 보류.** 원인·관계 문구의 범위를 source가 입증하는 관측 범위에 맞추는 교정이다. 실제 잘못된 기록이 자연 발생한 재현이나 엔진 결함으로 보고하지 않는다.

## 편집 보류3

1. `house.withdrew.r06move.family_extinct`: '남은 식구도 후계 후보도 없어'는 범위가 넓다. `lordFamilyExtinct`는 현재 persons.people의 가문 태그 부재, pending heir tag 부재, 과거 식구 중 역병 사망이 적어도 하나 있음을 검사한다. 지도 밖 혈족 전체나 세계의 모든 후계 가능성을 조사하지 않는다. '도시에 기록된 가문 식구와 대기 중인 후계 후보가 없어…' 등 검사 범위를 명시해야 한다. 전원이 역병으로 죽었다고 쓰지 않은 점은 맞다.
2. `house.withdrew.r06move.decline_elapsed`: '정해진 기한'은 시스템의 houseChangeTicks를 세계 속 정해진 마감으로 표현한다. `lordship.ts:188–190`에서 확인되는 것은 쇠퇴 시작 후 경과 시간이다. '쇠퇴가 이어진 끝에 종전 가문이 영지에서 물러났다'처럼 관측 결과로 표현하거나 게임상의 경과 기간을 쓰되 실제 통지·약속을 덧붙이지 않는 것이 적절하다.
3. `house.resettled.r06move.split`: '남은 몫은 집집마다'는 모든 집에 나눴다고 읽힌다. `resettleTown`은 곡창에 저장한 뒤 left가 소진될 때까지만 집 순서대로 나눈다. 합성 bread12/stored11/세 집 필요량4,4,4이면 가구 추가량은1,0,0이다(RESULT.json). '남은 몫은 이주민의 집에 나누어 두었다'처럼 일부 집일 수 있는 문구로 고친다. 실제 engine 실행이 아니라 source 동등 분배식의 반례다.

## 통과 범위

negotiation.rejected3개는 원래 제안 묶음을 묘사하며 거절의 동기라고 쓰지 않는다. 실패한 offer draw와 counterOffer=null이라는 생산 경로, original terms와 negotiation 연결, jointure 우선 분류, 부적절 값 unknown을 요구한 계약은 타당하다. 제안된 과부산이나 채무인수가 이미 양도/약정된 것으로 표현하지도 않는다. neither는 그 두 제안조건이 없다는 뜻이며 아무 조건도 없었다는 뜻이 아니다.

agency.timber_ordered2개는 현재 수령 지점을 '주문 당시'로 한정하고 실제 입고·지급·목재 소비를 주장하지 않는다. `timberTradePoint`는 완성 시장 우선, 없으면 hamlet의 첫 창고를 고른다. 배달 때는 다시 선택하므로 이 문맥을 배달 목적지 확정 계약으로 재사용하면 안 된다. 자동 charterTimber planner=era만 허용하고 수동/다른 planner는 unknown으로 두는 계약을 유지한다.

house.arrived2개는 교체 직전 population을 쓰며, 같은 operation의 resettlement 뒤 인구로 거꾸로 읽지 않는다. 물리적 가문 이사·이주민 동반 사실을 arrived만으로 추가하지 않는다. house는 여기서 영주 가문, 가구는 household 생활 단위로 구별되어 있다. empty_town withdrew도 사람의 자발적 이주 동기나 목적지를 덧붙이지 않는다.

resettled granary_only/household_only는 양수 실제 배분액과 settled set을 캡처하는 계약 안에서 타당하다. '한 철치'는 현재 게임의 resettleBreadTicks에 해당하는 기준량이며 실제로 굶지 않는 미래 한 철을 보장하지 않는다. 빵 생산량이라고도 하지 않는다.

FIX-12: 표시 이름과 현재 인물 역할을 새로 저장하지 않는다. 가문 교체의 old/new order와 기록 ID를 보존하고 현재 가문명으로 과거를 덮지 않는 계약을 유지한다. 현재 headline에는 개인명 슬롯이 없다.

## 실제 검사

읽기 전용으로 순수 schema/selector 함수를 분리해104 선택 fixture,75 schema 음성,26 추가 field/envelope,15 도메인/참조/provenance 변형을 재실행했다. 모두 통과했다. 소스11파일22구간·후보 manifest·현재 정본650 SHA `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf` 일치를 확인했다.

새 enum 캡처, 자연 발생, 저장복원, 포매터/UI는 미구현 또는 미검증이다. 초안 품질 검수와 엔진 설치 조건은 구별한다. 원고·정본·엔진 변경 없음. 경량 Ruby만 사용했다.

graft1회, 도구 보고 절감21,418 tokens.
