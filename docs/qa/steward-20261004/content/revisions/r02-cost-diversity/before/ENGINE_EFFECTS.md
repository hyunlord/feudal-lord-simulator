# 현행 엔진 효과 지원표

기준 HEAD: c8cb7b7df78abc116437ecc4a2b6db71d97eba51. 원고 기준 HEAD 5ad4b834의 역사 기록과 구분한다. 소스 읽기와 정적 데이터 검사만 수행했으며 엔진 실행·게임 설치·200편 활성화는 하지 않았다. 세부 기계 판독 정보와 소스 SHA는 [ENGINE_SUPPORT.json](ENGINE_SUPPORT.json)에 있다.

| 제안 | 현재 판정 | 실제 범위 | 아직 연결되지 않은 범위 |
|---|---|---|---|
| NE01 | 부분 구현 | 홈 12종과 초안 11종, 제한형 조건·빈도·재등장·바인딩·효과 | 누적200의 임의 selector/call/derived, 복수 alias, optional 계약, 중앙 context 중복 억제 |
| NE03 | 일부 효과 구현 | 기간부 시장 부담(permille) 복원, 분납과 부족액 arrears | 일반 지대·노역 감면, 상대방별 수취, 여러 누락 연도 추징 보장 |
| NE08 | 일부 효과 구현 | 실제 소송의 기존 권리 조각에 sharePermille 0~2000과 소송ID 기록, 평가 수익 배율 반영 | 권리 신설·소유자 변경·경계 분할·판결 단계 보장 |
| NE10 | 홈 12종 구현 | 같은 종류의 연속 영주 판결 2회로 선례, 연 첫 판결 및 예외는 영주에게 | 누적200의 일반 선례 처리 |

근거: src/content/registry/registryTypes.ts:10, registryEntries.ts:10, homePetitions.ts:12; src/engine/registry.ts:193,229,248,273,286,307; stewardship.ts:188,211,432; estates.ts:315; estates.types.ts:40. 소스 파일 경로는 위 HEAD 기준이다.

## 효과 DSL과 원고 명령의 경계

RegistryEffect는 command 구별자를 쓰는 제한된 union이며 전체 GameCommand가 아니다. 조건은 all/any/not 또는 허용된 field·op·value이고, bind는 none/delegated_estate/held_estate/pending_audit/open_suit/open_claim 여섯 종류다. 현재 원고 COMMAND_CONTRACT와 registry.json은 역사적 제안 계약을 보존한다. 이 문서는 새 명령을 원고에 삽입하거나 기존 차단을 풀지 않는다. 나머지 83개 효과의 원문은 유지했고 이번에 지원 여부를 재분류하지 않았다.

## none과 의미 있는 선택

none은 상태를 그대로 반환하지만 enabledChoices에는 실행 가능한 선택으로 계산된다. 따라서 '효과가 있는 선택 최소 둘'이라는 원고 계약을 자동 보증하지 않는다. 홈 청원의 grant/refuse 표식은 none이어도 실제 판결은 기존 answer_estate_petition 경로가 처리하므로 홈 판결을 무효과로 분류하지 않는다. 019/a, 059/direct, 008/b, 015/b, 035/wait, 046/stock은 향후 번역 후보이며 아직 원고나 명령을 변경하지 않았다. 046/stock은 주문≤60과 대기 필요량>가용량 전제까지 유지해야 한다.

## 복합 명령의 원자성 유보

applyChoice는 null 실패가 감지되면 중간 상태를 버린다. 그러나 setProjectSubsidy의 거절은 lastRefusal을 포함한 새 상태를 반환할 수 있다(townAgency.ts:88). 참조가 달라졌다는 이유로 changed가 이를 성공으로 취급하므로 일반적인 '거절이면 전체 원복'을 보증할 수 없다. 004/c, 030/divide, 049/share의 blocked_until_atomic_adapter는 유지한다. 초기 전제조건뿐 아니라 각 장려금의 실제 설정 결과, 명시적 거절 판정, 런타임 원자성 검증이 필요하다. 이번에는 실행하지 않았다.

## 보존과 검증

기존 200편 본문·397개 명령 템플릿과 200개 비활성 상태를 보존한다. 159/159 Astra 독립 검수는 앞선 15건 해석과 9건 엔진 유보의 정적 인계 검수이며, 이번 지원표나 런타임 전체의 통과로 확대하지 않는다. before 사본과 전후 SHA는 ../records/content-revisions/r02-engine-support/에, 새 누적 정적 검사 결과는 ../records/cumulative-validation/에 보관한다.
