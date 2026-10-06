# 저장 파일과 복원

플레이 종료 뒤 IndexedDB의 저장 바이트를 그대로 꺼냈다. 게임 상태를 편집하지 않았다. `*.latest.save.json.gz`는 각 내보내기 시점에 실제 저장된 슬롯 중 가장 최근 파일이다. **내보낸 시각과 마지막 자동 저장 시각에는 차이가 있을 수 있다.** 이름의 연도만으로 정확한 틱을 판단하지 말고 아래 시각을 사용한다.

| 내보내기 | 추출한 슬롯 | 실제 저장 UTC | 틱 |
|---|---|---|---|
| [browser-storage-recovered](saves/browser-storage-recovered.latest.save.json.gz) | auto-1 | 2026-10-06T07:59:41.271Z | 39158 |
| [checkpoint-1312](saves/checkpoint-1312.latest.save.json.gz) | auto-2 | 2026-10-06T08:54:50.395Z | 48073 |
| [checkpoint-charter-1310](saves/checkpoint-charter-1310.latest.save.json.gz) | auto-3 | 2026-10-06T08:48:04.632Z | 43518 |
| [checkpoint-latest](saves/checkpoint-latest.latest.save.json.gz) | auto-3 | 2026-10-06T09:30:04.421Z | 75078 |
| [checkpoint-marriage-1315](saves/checkpoint-marriage-1315.latest.save.json.gz) | auto-2 | 2026-10-06T09:09:31.312Z | 62078 |
| [final-1319-winter-after-reload](saves/final-1319-winter-after-reload.latest.save.json.gz) | manual | 2026-10-06T09:37:14.963Z | 79914 |
| [final-1319-winter-before-reload](saves/final-1319-winter-before-reload.latest.save.json.gz) | manual | 2026-10-06T09:37:14.963Z | 79914 |

각 이름의 `.json.gz` 파일은 Playwright storageState 전체(설정·자동 저장3개·수동 저장·IndexedDB)다. 특히 `browser-storage-recovered.json.gz`는 실제 복구에 쓴 1309년 저장 묶음이며, 최종 파일은 `final-1319-winter-before-reload.json.gz`이다. `after-reload`는 실제 불러오기 뒤 다시 내보낸 것이다.

복원 방법: 같은 커밋 개발 서버를 `http://127.0.0.1:4490`으로 켜고 storageState gzip을 풀어 Playwright의 `browser.newContext({storageState: 파일경로})`에 전달한 다음 해당 주소를 연다. IndexedDB를 지원하는 Playwright 버전이 필요하다(이번 브리지는 `storageState({indexedDB:true})` 사용). 이어하기 또는 설정의 수동 저장 슬롯을 고른다. 이번에는 이 방식으로 1309년 저장을 실제 복구했다. 최종 수동 저장의 게임 안 재불러오기도 확인했다. 다른 버전의 저장 이행·일반 파일 가져오기 UI는 시험하지 않았다.

최종 저장/불러오기 전후 HUD: 1319년 겨울, 인구102, 식량684일, £55 4s로 동일. 카메라는 물 위로 이동했고 대기근 예고 칩이 다시 보였다. 저장의 모든 내부 필드가 동일하다는 검사는 하지 않았다.
