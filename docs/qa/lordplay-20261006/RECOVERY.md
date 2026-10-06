# Browser recovery journal
07:59–08:04 UTC: screenshot reports page/context/browser closed; own Node PID48907 and browser48918 still alive.
Hypotheses: (1) only original page closed, context survives; (2) context closed and storage lost; (3) browser transport failed despite process alive.
Will attach local Node inspector to own control PID48907, inspect only Playwright context/page handles and export saves. No game source or simulation internals. Temporary inspector/helper must close on completion. Recovery time excluded from active play.
08:03 UTC: inspector handle inventory found Browser+BrowserContext, no Page. Exported context storage (IndexedDB feudal-lord-simulator-saves plus settings). Launched isolated headless replacement with this storage. Welcome screen recognizes saved game ‘영주의 스무 해 ·65분째·인구88’. No source inspection/state injection used for gameplay. Resumed08:04; exclude 07:59:08–08:04 recovery from active play (about5min). Minimum actual-play endpoint now09:03 UTC, and input-unattributed interval07:54–07:59 additionally flagged.

08:13 UTC 사용자 답변: “잠깐 직접 조작했었음”. 따라서 앞서 관찰한 입력 귀속 불확실 구간에는 사용자 조작이 섞였음이 확인되었다. 정확한 조작 내역·시각과 페이지 종료 원인은 확인되지 않았다. 그 구간의 도시/혼인/방침 변화는 평가자의 선택 결과에서 제외한다. 복구 후 독립 headless 브라우저로 진행한다.

08:36 UTC 자동 목표 이어하기 뒤 PTY98273은 Unknown process id. ps 확인상 브라우저·4490서버 모두 없음. 실행 세션 종료 원인은 확인불가. 1309겨울 내보낸 저장으로 복구하여 재진행. 1310~1311 관찰은 캡처로 유효하나 최종 저장의 분기와 다를 수 있다. 08:34:36~재개까지 중단을 플레이시간에서 제외한다. 이후 자주 저장 상태를 내보낸다.
