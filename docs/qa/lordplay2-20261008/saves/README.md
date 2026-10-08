# 저장 파일

> 저장소 메모(INBOX, 2026-10-08): 저장 3개(`indexedDB-final.json`·`indexedDB-1306-recovery-source.json`·`manual-final.savebin`)는 docs/qa 규칙대로 `gzip -n -9`로 줄여 `.gz`로 넣었다. `gunzip -k <파일>.gz`로 원래 바이트(패키지 `SHA256SUMS`와 같음)를 되살린 뒤 아래 방법을 따른다.

최종 상태는 1320년 봄, 인구 382, 식량 292일, 상단 금고 £6, 일시정지다. schemaVersion 53, 원본 수동 저장은 2,247,423바이트다. 같은 커밋에서 별도 빈 브라우저 컨텍스트로 실제 불러오기를 검증했다.

- indexedDB-final.json: 최종 수동 저장의 meta/slots 레코드. ArrayBuffer를 손실 없이 base64로 포장했다. 자동 저장 3개는 경량화를 위해 제외했다.
- manual-final.savebin: 그 수동 슬롯의 원본 바이트. 게임 UI의 가져오기 형식을 주장하지 않는다. JSON 안 base64를 해제한 바이트와 동일함을 검증한다.
- indexedDB-1306-recovery-source.json: 중단 후 복구에 쓴 1306년 봄 수동 저장. 원 중단 직전 1315년 저장은 없다.
- localStorage-recovery-latest.json: 최종 설정 보조 백업. 저장 복원 검증에는 필요하지 않았다.
- restore-in-browser.js: 실제 검증한 복원 스크립트. 게임 소스에 설치하는 파일이 아니다.

## 복원

1. 별도 브라우저 프로필에서 동일 빌드의 게임을 열어 시작 메뉴에 둔다. 기존 저장을 보존하려면 반드시 별도 프로필을 사용한다. 스크립트는 선택한 JSON의 수동 슬롯을 덮어쓴다.
2. 개발자 도구 Console에서 restore-in-browser.js 전체를 실행하고 파일 선택창에서 indexedDB-final.json을 고른다.
3. 새로고침된 메뉴의 ‘이어하기’를 누른다. 별도 슬롯을 게임 코드로 해석하거나 게임 파일을 수정할 필요가 없다.
4. 1320년 봄·인구 382·식량 292일·£6·일시정지를 확인한다. [실제 재불러오기](../captures/V002-final-save-reloaded.jpg).

이는 현재 게임의 외부 가져오기 버튼을 검증했다는 뜻이 아니다. 브라우저 IndexedDB 저장을 복원한 뒤, 게임 자체 이어하기가 그 저장을 읽는 경로를 검증했다.
