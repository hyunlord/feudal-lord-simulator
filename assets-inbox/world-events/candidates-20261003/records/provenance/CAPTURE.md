# 실제 장면 캡처

- 저장소 HEAD: c2460918ecb13cdd6475f25f3e4809b3a352b01d.
- 실행: `npm ci --ignore-scripts --no-audit --no-fund` (32 packages); postinstall의 git hook 설치를 생략하여 저장소 설정 변경 방지.
- 개발 서버: `npm run dev -- --host 127.0.0.1 --port 4480 --strictPort`. PID 57696 / exec session 14155. 종료는 납품 직전에 루트 에이전트가 수행.
- Chrome headless, viewport 1600×1000, DPR 1; 브라우저 종료 완료.
- 프로젝트의 `fixtures/perf-gate/ch4-1380.save.json.gz`를 원래 IndexedDB 저장 경로에 넣고 일반 ‘이어하기’로 진입. 실제 게임 렌더러와 원래 자산을 사용. proof 모드 사용 안 함.
- 같은 도시 배치로 계절을 비교하도록 브라우저 메모리의 `load_saved_state`로 tick만 321010(1380 여름),323010(1380 겨울)으로 바꿈. **자연 플레이로 사건이 발생한 장면이 아니라 계절을 준비한 실제 게임 배경**이다. 사건 그림은 이후 별도 합성이며 게임 설치/실시간 사건 구현의 증거가 아니다.
- 카메라는 게임의 native input zoom/lookAt으로 제어. zoom=1.0/0.6을 qaProbe로 읽고 저장. 0.6은 1.0 캡처를 축소한 것이 아님.
- clean PNG는 원래 canvas.toDataURL. HUD JPG를 병행 저장하여 출처·카메라 상태 검토 가능.
- `captures.json`에 12장 camera,viewport,tick,건물 위치,길 데이터. `placement-anchors.json`에 발 기준점 후보와 투영 좌표.

## 선택과 한계

- `church-*`, `market-*` 8장은 본문 합성에 사용 가능. 여름/겨울의 실제 눈·식생 차이를 확인했다.
- `manor-*` 4장은 현재 branch의 manor_house가 텍스트와 단순 도형 placeholder로 렌더되어 **납품용 합성 배경에서 제외 권고**. 엔진 기존 상태이며 수정하지 않았다. 독립된 완성 법정 건물도 이 저장에 없음; 판결 연출은 법정 위치의 제안임을 표시해야 한다.
- 현재 코드 `walkerComposer.ts:35` VILLAGER_WORLD_SCALE=0.5로 성인 H=16 world px. `drawWalkers.ts:43` WALKER_FLOOR_ZOOM=0.65이므로 zoom0.6에서 H=10.4 screen px. 바이블의 17.6/14.08은 이 HEAD와 차이가 있으므로 새 그림 비례 기준과 실제 proof 스케일을 분리 기록.
- 합성할 때 (x,y)=((tx-ty)*32*z+panX,((tx+ty)*16+5.76)*z+panY)로 발 위치. 사람은 화면 H16(z1)/10.4(z0.6), 건물·지면 소품은 실제 월드 크기×z. 무리 통째 최소 줌 확대는 모든 발 위치가 도로에서 벗어나지 않는지 별도 점검 필요.
- 캡처 파일의 사람·눈 애니메이션은 캡처 시점의 실제 프레임이며 픽셀 결정론 테스트가 아니다.

## 도구 증거

graft 3회: 18,109 + 11,978 + 9,296 = 39,383 tokens saved (금액 미제공).

## 침수 논밭 레이어 보정

`capture-flood.mjs`는 실제 `buildZoneLayer`와 `drawArableFields`를 호출하여 Wave9 침수 이랑을 **반복 패턴 → 등각 affine 변환 → 실제 경작지 crop clip** 순서로 그린다. 512×64 띠를 장면에 직사각형 스티커처럼 붙이지 않는다.

- `references/flood-layer-{summer,winter}-z{1.0,0.6}.png`: 1600×1000 투명 캔버스. 같은 이름의 church 배경 위 (0,0)에 합성.
- `flood-test-*.jpg`: 확인용 결과. 모래주머니는 별도 합성.
- 실제 field zone-000005 중 tile x=52..55,y=47..50.4를 사용. 전체 농지를 사후 덮으면 건물 지붕 위까지 칠해지는 문제를 발견해, 전경 건물에 가리지 않는 밭 부분으로 제한했다.
- 상태 lookup을 proof에서 flooded로 지정한 **배치 검증용 레이어**다. 여름만 허용하는 `wetSummer`를 바꾸거나 겨울 침수 엔진을 구현한 것이 아니다. 겨울은 같은 기존 침수 무늬를 제안된 연출에 재사용한다.
- 추가 graft skeleton 1회 3,375 tokens saved. 캡처 에이전트 총 42,758 tokens / 4회.

## 종료

납품 검수 중 루트가 전용 Vite PID57696에 SIGTERM을 보내 종료했다. 최종 포트 재확인 결과는 DELIVERY_QA.json에 기록한다.
