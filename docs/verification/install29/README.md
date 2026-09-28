# INSTALL-29 물 움직임 — 로컬 확인 자료 (Mac, DGX 아님)

- 장면: `fixtures/saves/v26/palisade-construction.save.json`(가을, tick 90976), 1280×720, headless Chrome `--disable-gpu`, `?phase10-proof=1&weather=…`. 게임은 일시정지 상태로 두었다(물은 벽시계로 계속 움직인다). 성능 관문 판정은 DGX 기준선으로만 한다.
- `lake-0.jpg` 호수 [55,20] 확대 1.6, 맑은 날(깊은 잔물결·반짝임; 물고기 고리는 자리마다 8~20초에 한 번이라 이 장에 있다고 보장하지 않는다) · `shore-0.jpg` 북쪽 물가 [49,16] 확대 2.6(물가 거품·얕은 물 무늬) · `winter-0.jpg` 같은 물가 확대 2, 그림 계절만 겨울(`seasonArt.ts`의 `seasonOf`를 응답 재작성으로 3으로), `&weather=cold`(얼음 테, 거품·반짝임 없음) · `wet-0.jpg` `&weather=wet&weather-tick=300`(반짝임 없음, INSTALL-23 비 물결 그대로) · `zoom06-0.jpg` 확대 0.6(간략: 깊은 잔물결만) · `reeds-6frames.jpg` 갈대 [55.8,32.6] 확대 4, 150 ms 간격 6장.
- 이 지도(WORLD_SEED 1)에는 강이 없다: 남쪽 좁은 만은 흐름 방향 규칙(RIVER_MIN_LENGTH)에 걸리지 않아 흐름 시트가 그려지지 않는다. 물레방아가 없어 급류 시트도 그리지 않는다.
- `local-check.json`: 150 ms 간격 두 장 사이 바뀐 화소 수(일시정지 장면도 0이 아님), 그리고 물 단계(`terrain.water`) 시간 — 끔(`drawWaterMotion` 즉시 반환) 평균 0.005 ms / 켬 0.137~0.139 ms, 프레임 작업 p95 1.4~1.5 → 1.5~1.7 ms.
