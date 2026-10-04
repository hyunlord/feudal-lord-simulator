# 정상 새게임 → 영주 첫청원 준비

판정: **현재 정상 시작 경로로는 실행할 수 없음. helper 미제작, 추가 DGX 실행 불필요.** 전체 검수 목표의 중단을 뜻하지 않는다.

정상 / 시작은 main.tsx의 GameProvider → DEFAULT_GAME_STATE다. WelcomeScreen의 실제 시나리오 버튼은 CORE_SCENARIOS의 campaign_market_town와 sandbox 둘이다. App의 시작 콜백 → landStartCommand는 scenario/archetype/seed만 넘긴다. 지도1 campaign은 기존 기본 상태를 유지한다. 지도 URL의 seed 핀도 모드 변경이 아니다.

newGame.ts:58–63은 options.mode가 lord이거나 scenarioId가 core:lord_slice인 경우에만 agency를 초기화한다. gameStore의 명령은 mode를 지원하지만 위 정상 UI는 그것을 전달하지 않는다. LORD_SLICE는 coreScenarios.ts:134–137의 명시적 설명과 실제 배열상 타이틀 목록 밖이다. 따라서 “목표형으로 시작”을 영주 모드 시작이라고 바꾸어 보고하거나, console 명령/fixture로 우회하지 않는다.

R05 동일 HEAD 타이틀 DOM(0001-title.json)에 실제 두 scenario 버튼이 이미 기록되어 있다. 0007-goal-initial.json에는 직접 건설 목표인 “집 놓기”가 있었다. DIAGNOSIS.md는 helper가 greet만 찾아 유효 house CTA를 놓친 한계를 별도로 기록한다. 이 과거 관측은 타이틀 진입면의 일치 증거이며 새로운 Lord 플레이 관측이 아니다. 저장의 agency 부재를 이 DOM만으로 실측했다고 말하지 않는다.

정책은 별도 장벽도 있다. tutorialModel의 ALL_OPEN/tutorialAccess 모두 direction:false이며 App이 이를 연결한다. 첫청원 판결만으로 정책이 열린다는 가정은 소스와 맞지 않는다.

재개 조건: 정상 사용자 시작 UI가 mode:lord를 전달하거나 LORD_SLICE의 정상 진입면을 제공하는 새 코드. 그 뒤 source/HEAD를 다시 고정하여 새 격리 profile의 실제 타이틀 클릭부터 첫청원을 기다리고 선택 전 대가/후결과/다음 목표·청지기 안내/도시 변화와 영수증을 기록한다. 20분 wall-clock와 실제 tick4000은 독립 상한이며 먼저 도달한 쪽에서 멈춘다. 시간속도를 가정하지 않고 실제 UI 선택과 tick 증가를 기록한다. direction 잠금이 확인되면 반복 클릭하지 않는다.

이번 준비에서는 브라우저·엔진·원격 실행, fixture·저장 주입, 코드 수정이 없었다. Mac 소스와 기존 JSON 증거만 읽었다. Graft 새 호출 2회, 추정 절감 합계 51,830 tokens.

조사한 진입면은 main.tsx의 기본 게임 부트스트랩, WelcomeScreen의 최초 시작·새게임(기존 저장 위 시작)·바깥 클릭, App의 해당 콜백, landChoice의 지도 URL 파라미터, gameStore의 시작 명령 연결이다. 개발자 콘솔이나 다른 외부 도구까지 포함한 모든 가능한 진입 방식의 부재를 주장하지 않는다. 이어하기는 영주 저장을 불러올 수 있지만 이번 자연 NEW GAME 조건을 만족하지 않는다.
