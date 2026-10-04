# B02 코드 진단: 방향 모드 해제 조건이 없다

[코드] HEAD5fb1aebfe735592c1424c947e88388d4ffe21742에서 `src/ui/tutorial/tutorialModel.ts:159` ALL_OPEN은 direction:false이며, `tutorialAccess:176`은 tutorial disabled/finished 분기에서 ALL_OPEN을 반환하고 진행 중 분기190에서도 false를 반환한다. 청원 응답·agency·연도에 따른 해제 술어는 없다.

`src/ui/tutorial/useTutorialController.ts:139`는 tutorialAccess를 그대로 access로 사용한다. `src/App.tsx:528`은 해당 tutorial.access를 LayerSwitch에 전달하고, `src/ui/hud/HudShell.tsx:85`의 open=false면 onPress가 잠금 문구를 보여 준 후 return하여 onChange를 부르지 않는다. 문구는 `src/ui/tutorial/tutorialCopy.ko.ts:50` ‘첫 청원 뒤에 열립니다’다.

따라서 청원을 마친 저장을 고르는 것으로 방향 버튼을 열 수 없다. 이것은 R05 청원 전 fixture 잠금만 관찰했을 때보다 강한 근거다. B02 높은 우선순위 통합 누락의 코드 진단이며, source 수정을 하지는 않는다.

후보 N02 1325년 저장은 청원 market_charter@25000을 accept한 실제 장기 실행 상태다. 창고2개는 agency receipt와 현존 building.id가 연결돼 있어 초기창고 검사보다 성장 원인 UI 검증에 적합하다. 다만 현 코드 src/ui scoped agency 조회 0hit, marriage 조회는 인물 상태와 가계도 표시뿐이었다. 검색 부재 자체를 모든 UI 부재의 최종 증거로 쓰지 않는다.

혼인은 negotiation-1 accepted, marriage.stage=lost이며 pending 협상은 없다. 이 판은 첫 혼인 제안의 조건을 갖췄다고 주장하지 않는다. 브라우저 실행 전에 부모에게 선택과 한계를 보고했다.
