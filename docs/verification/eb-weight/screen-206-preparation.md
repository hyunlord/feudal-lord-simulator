# 206/a historical continuation 준비 — 실행 전

2026-10-12. 성장 DGX 소유권이 유지되는 동안 읽기·하네스 편집만 했다. 아래 시험과 브라우저 관측은 아직 실행하지 않았다. [입력 확보표](screen-resume-readiness.md), [원본 seed1 manifest](kept-2485af4/checkpoint-manifest.json), [기존005 한 사례](live-manual-visible/README.md)를 기준으로 한다.

## 계약 비교

2485af4와 기대표 source a5776a8e의 `src/content/registry/v4Entries.generated.ts`에서206/a 실행 객체는 동일하다: `order_timber(amount:10)`, 주문 잔량≠10, completedMarkets 개수>0, treasuryCoin≥18. `src/engine/timberTrade.ts`, `src/content/timberTradeConfig.ts`, `src/engine/decisionTrace.ts`도 두 판에서 동일하다. registryV4.ts의 후보 관측 진단 코드 차이는 있지만 order_timber handler는 동일하다.

즉시 효과는 잔여 주문량을10으로 설정하는 것이다. 배송은 교역 tick·교역 거점·지불 가능한 금고·양수 주문이 충족돼 실제 timber_purchase, 목재 증가, 주문 감소가 생길 때다. decisionTrace의 goods_delivered는 주문 감소의 실제 전이를 기록한다. 원래 seed1의 h-020520@314029 → h-020521@314080은 그 한 사례이며51틱을 새 실행의 강제 결과 시각으로 쓰지 않는다.

INERT의 docs/design/engine-B-outcomes.json은 이 주문/배송 계약과 일치한다. 그러나 답 직후 화면 영수증, 정확한 답 ID를 주원인으로 삼는 조건은 설계 기대다. historical 화면의 공통 answerEffects 구현이나 모든 상태 변화 표시를 입증하지 않는다. 이번 저장은 답 이후이므로 선택 클릭 자체의 전후 효과 시험으로도 세지 않는다.

## 최소 도구 변경

- `scripts/engineBLiveTarget.mjs`: 입력 설정의 entry/choice/answer/tick와 두 SHA를 파싱하고 정확한 answer checkpoint만 선택. 알 수 없는 키·관측 예산 변경은 거부한다.
- `scripts/engineBLiveTarget206.json`: 기존 seed1 manifest와206/a 압축 저장 SHA를 고정. `EB_LIVE_TARGET_SPEC`로 선택한다. 미지정 기본값은 기존005/c다.
- `scripts/engineBLiveSpeedCapture.mjs`: 전역005 ID/tick 대신 검증한 target을 receipt 관측·연도 필터·수동 왕복에 전달한다. 결과 manifest에 target과 설정 파일 SHA를 남긴다.
- `scripts/engineBLiveSpeedManualRun.sh`: 기존9시험과 함께 target 회귀3시험 실행 준비. 기존24bd578cd 하네스에서 새 export 부재를 확인하는 red, 새 하네스 green을 같은 공식 실행 안에서 남긴다. red의 실패 이유는 로그로 별도 확인한다.

제품 코드·3000틱 상한·10배속 입력·정상 스크롤/중심점 가림 검사·실질 결정 무응답·기존 자동/수동 판정은 바꾸지 않는다. 입력 manifest 전체 검증·압축/encoded SHA·decode 동일성·초기 presentation 비교도 그대로다.

## 회귀 및 화면 계획

1. 기본005 식별자 유지,206/a 선택, 다른 선택/저장 SHA/tick 거부, 잘못된 설정과 예산 변경 거부를 순수 시험으로 확인한다. baseline 실패와 변경판 통과는 아직 미검증이다.
2. 성장 작업이 종료되고 실행 소유권을 넘겨받은 뒤, 깨끗한 커밋을 고정한 공식 DGX 실행 하나에서 시험과 실제 브라우저206/a 한 사례를 수행한다. 현재 제출 없음.
3. 첫 정확한 미래 receipt 관측 시 정상 Pause 후 KeyC 수동 탐색. 실제 모달이 막으면 그대로 증거를 남기며 임의 답/닫기 금지. 자동 전달은 별도 미달일 수 있고 수동 성공으로 전체 valid를 올리지 않는다.
4. 답·결과·원인 복귀 PNG,6개 전체 presentation JSON SHA, 설정/입력/도구 SHA, 원문 manifest/exit/cleanup을 회수한다. 모든 탐색 snapshot을 KeyC 전과 비교해 상태 불변을 확인한다. 해시 검사가 통과하기 전 관문 통과를 주장하지 않는다.

실행 인자는 기존 공식 명령에 `EB_LIVE_TARGET_SPEC=scripts/engineBLiveTarget206.json EB_MANUAL_ON_RECEIPT=1`을 포함한다. 실제 제출 때 고정하는 도구 커밋은 준비 문서 작성 시점에 정하지 않았다. 게임과 DGX 실행은 부모의 소유권 인계 전까지 하지 않는다.

## 전달 경로와 보관 예산 재확인

`manualTrace`와 capture는 모두 `evidence.target.startTick`을 START로 읽는다. 연대기 양쪽 연도 필터는 `1300 + floor(START / 4000)`이므로206의314029는1378년이며1310 고정 문자열이 없다. 이는 기존 historical 시나리오의 연도 계산을 그대로 적용한 것으로 다른 시나리오 일반화는 아니다.

미래 공식 명령의 `env EB_LIVE_TARGET_SPEC=scripts/engineBLiveTarget206.json`은 bash wrapper와 마지막 tsx 프로세스에 상속된다. wrapper는 계속 seed-1 원본 디렉터리와 e4615d5…manifest를 전달한다. capture는 환경의 설정 파일을 읽어 manifest 인자 일치를 확인한 뒤, readCheckpoints의 압축/encoded SHA·decode 검사를 거쳐206/a의 h-020520·314029·3e65b988…입력을 정확히 선택한다. 다른 선택·tick·입력 SHA는 selectLiveTarget이 거부한다. 설정 파일 전체 SHA도 실행 manifest에 남는다. 원본 결과 ID h-020521을 타깃으로 강제하지 않고 새로 관측한 정확한 답의 receipt만 사용한다.

새 baseline red는 **새 export 부재 확인**이며206 동작 회귀의 실제 재현이 아니다. baseline의 AssertionError와 working 시험 결과, 실제 브라우저 결과를 각각 따로 보고한다.

직전 추적 일반 증거는3,119,927바이트였다(한도3,145,728, 여유25,801). 이 준비 문서가 그 여유를 더 사용하므로 다음 결과를 무조건 추가할 공간이 있다고 가정하지 않는다. 새 게임 replay PNG·presentation만 기존 replay-captures 분류에 둔다. fixture·로그·manifest를 replay로 옮기거나 예외를 넓히지 않는다. JSON/로그는 원본 SHA를 보존하는 gzip, 바이트가 동일한 fixture 등은 기존 추적 원본을 SHA별로 참조하여 중복을 피한다. 다른 바이트의 일반 증거까지 합친 실제 크기를 커밋 전에 기존 evidenceSize로 확인한다. 공간이 부족하면 무손실 보관/중복 제거 구조를 조정하고 수치로 보고하며, 원본 삭제·다운샘플·검사 변경은 하지 않는다.
