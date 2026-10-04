# R05 튜토리얼 시작 표면 읽기전용 진단

기준: `/Users/rexxa/fls-astra-steward`, HEAD 5fb1aebfe735592c1424c947e88388d4ffe21742. 실제 DGX 작업에 접속하거나 입력하지 않았다. 부모가 복사한 DOM과 JPEG, 현행 소스만 읽었다.

## 관측 결론

**초기 CTA는 없지 않았다. `house`의 ‘집 놓기’가 있었다.**

- `ui-r05-live/0007-goal-initial.json`: ‘새 길가에 집 짓기’, 0/1, ‘집 놓기’; 버튼 `data.tutorialCta=house`, `disabled=false`. 설정의 ‘튜토리얼 켬’도 있다.
- 같은 번호 JPEG를 직접 보았다. 좌상단 집 짓기 카드와 집 놓기 버튼이 실제 표시된다. 화면 밖이거나 접힌 카드가 아니다. 실제 클릭/히트테스트 성공은 이 정지 증거만으로 보장하지 않는다.
- `0010-goal-start-unavailable.json`: 목표 기록을 연 상태에는 CTA가 없다. ‘아직 마친 목표가 없습니다’와 도시 발전 조건이 표시된다.
- 두 장 모두 집 관련 청지기 대사가 있다. 처음부터 튜토리얼 꺼짐이라는 해석과 맞지 않는다.

## helper의 판정 한계

`output/steward-ui-round5/probe.mjs:58–74`의 startGoalPath는 첫 목록에서 **greet만** 찾는다. house 같은 다른 유효 CTA를 별도 결과로 보존하지 않고 목표 기록을 연 후 다시 목록을 읽는다. 따라서 `goal-start-candidates rows=[]`는 처음부터 CTA가 전혀 없었다는 증거가 아니다. `start_cta_unavailable`은 좁게 ‘greet/시작하기 부재’로만 읽어야 한다. Lord identity의 직접 배치 목표 관측은 0007 증거를 근거로 별도 수동 판정할 수 있다.

## 정적 경로와 가설

| 가설 | 현행 코드 | 판정 |
|---|---|---|
| H1 환영 토글 전달/리마운트 실패 | App.tsx:417–423은 welcomeTutorial 값을 startNewGame에 전달. useTutorialController.ts:280–285는 기록 갱신. | enabled=true에 해당하는 ‘튜토리얼 켬’과 실제 house CTA가 관측되어, 튜토리얼 전체가 비활성화됐다는 설명은 기각. 모든 리마운트 내부 동작까지 검증한 것은 아님. |
| H2 접힘/DOM 숨김 | uiStateMachine.ts:61–71의 goalCard는 idle 또는 일부 배치 모드에만 true. App.tsx:477–483은 이 값으로 GoalCards를 렌더하고 goals 모드에서는 별도 GoalDrawer를 렌더한다. | **0010에서 CTA가 없는 이유를 설명하는 소스 경로.** 목표 기록을 여는 행위가 카드 CTA를 숨긴다. 0007 house CTA는 접힘/비표시가 아님. |
| H3 isFreshGame 거절 | useTutorialController.ts:88–91,281–285; tick/zone/construction/newCount 가드. App.tsx:420–422는 새 명령일 때 null을 전달하여 가드를 건너뜀. | 이번 전체 튜토리얼 활성 실패 원인으로 지지되지 않음. 실제 시작 시점 state와 command는 읽지 않아 freshness 내부 결과는 미검증. |
| H4 뒤 단계 충족으로 greet 자동 생략 | tutorialModel.ts:133–143은 더 뒤 predicate가 true이면 그 앞의 acknowledgement 단계도 건너뜀. road는 :91–94의 기존 openingVillage 도로 좌표 외 도로가 하나라도 있으면 충족(:108). house는 새 house가 있어야 충족(:109). | house가 초기 표시되는 경로를 설명하는 **유력한 정적 후보**. 현재 지도의 초기 도로가 기준 openingVillage와 다른지, 실제 predicate별 boolean은 미측정. 이를 동적 확정 원인으로 보고하지 않음. |

`TutorialShell.tsx:44–46`에서 foldKey 있는 카드만 접힘 경로로 간다. useTutorialController.ts:252–256의 실행 튜토리얼 카드는 foldKey를 제공하지 않는다. 그러므로 이번 greet 부재를 단순 ‘카드 펼치기 누락’으로 설명하지 않는다.

## 다음 단일 관측 제안

현행 실행에 개입하지 않는다. 다음 승인된 UI 표본에서 **목표 기록을 닫아 idle로 돌아간 뒤**, 현재 `[data-goal-card]`, `[data-tutorial-cta]`의 키·문구·가시성·hit-test를 한 번 기록한다. ‘집 놓기’를 누르지 않아도 직접 배치 안내와 정상 카드 접근 여부를 판정할 수 있다. 현재 작업이 이미 다른 화면으로 진행했다면 오래된 0010에 대한 임의 클릭을 하지 않는다.

H4 원인 확정은 별도의 공식 DGX 읽기전용 초기상태 계측에서 초기 도로와 openingVillage 기준의 차이 및 단계 predicate를 비교해야 한다. 이번 진단에는 그 실행이 없다.

## 결과 범위

새 원격 실행 없음, 게임/엔진/UI 코드 수정 없음, 동적 state 내부 읽기 없음. 사용자 경험상 ‘첫 청원’보다 ‘집 놓기’ 안내가 먼저 보인다는 관측은 성립하지만, 자연 플레이의 굶주림을 이 한 원인으로 귀속하지 않는다.

Graft 절약 추정 102,744토큰. 6회 절약 수치가 나온 호출(27,550 + 12,263 + 12,892 + 1,571 + 20,528 + 27,940). 추가 무응답 검색 1회와 잘못된 정규식 호출 1회에는 수치가 없어 합산하지 않았다.
