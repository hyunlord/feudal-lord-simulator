# 요청서: 텔레메트리 훅(렌더 세션, 엔진 한 줄)

- 보낸 곳: 인프라·문서 세션(2026-09-30, 사용자 지시 "게임 쪽 훅은 렌더 요청서로").
- 받는 곳: 렌더 세션. 저장 관련 한 항목은 엔진 세션.
- 관련: `scripts/telemetry/`(항상 켜진 성능 텔레메트리), 결정 RR3.

## 왜

- **지금 되는 것**: 개발 서버의 텔레메트리(`scripts/telemetry/client.js`)는 게임 코드 없이 다음을 잰다.
  - 프레임 분포.
  - 긴 프레임의 우리 함수 이름(Long Animation Frame).
  - 힙과 GC.
  - 캔버스·비트맵 생성 수.
  - 계절 전환·자동 저장.
  - HUD의 배속·인구.
- **밖에서 못 보는 것 둘**:
  1. **카메라 줌**: 먼 줌(NAT-2)의 비용을 줌으로 나눠 봐야 한다.
  2. **어느 캐시가 다시 만들어졌는지**: 지금은 "캔버스가 몇 장 생겼다"까지만 안다. 지면 청크인지, 걷는 사람 합성인지, 경계 재구성인지 모른다.

## 넣을 것(각 한 줄, 개발·배포 공통, 비용 0에 가깝게)

훅이 없으면 아무 일도 하지 않는다. 옵셔널 호출이라 텔레메트리가 없는 배포판에서는 함수 조회 한 번이다.

1. **줌**: 카메라를 가진 곳(예: `useGameCanvasRuntime` 설치 시)에서 한 번만 등록한다.
   ```ts
   (window as unknown as { __FLS_TELEMETRY_ZOOM__?: () => number }).__FLS_TELEMETRY_ZOOM__ = () => cameraRef.current.zoom;
   ```
2. **이름 붙은 사건**: 다시 만들기가 일어나는 자리에서 한 줄을 넣는다.
   ```ts
   (globalThis as { __flsTelemetryEvent?: (name: string) => void }).__flsTelemetryEvent?.("groundChunk.rebuild");
   ```
   이름과 자리:

   | 이름 | 자리 |
   |---|---|
   | `groundChunk.rebuild` | `src/render/groundChunkCache.ts`, 청크를 새로 그리거나 캔버스를 새로 만들 때 |
   | `boundaryScene.rebuild` | `buildGroundBoundaryScene`(계절 전환 포함) |
   | `walkerCompose` | `src/render/walkerComposer.ts` `composedCanvas`, 새로 합성할 때 |
   | `worldRaster.trim` | `src/render/worldRasterCache.ts` `trimTransparentMargin` |
   | `worldRaster.evict` | 같은 파일, 상한 때문에 내보낼 때 |
   | `tintCanvas` | `src/render/worldSprite.ts` `createTintCanvas` |
   | `save.serialize`(엔진 세션) | 자동 저장 직렬화 시작. 조각으로 나누면 조각마다 |

   이름은 영역 이름으로 짓는다(규칙 9). 새 캐시를 더하면 여기에 줄을 더한다.

## 확인

- 개발 서버에서 5배속 가장 큰 도시를 1분 연다. `npm run telemetry:report -- --by zoom,speed`로 줌 칸이 채워지고, `~/.fls-telemetry/…jsonl`의 `window.events`에 위 이름이 나오는지 본다.
- 비용: `tsx scripts/telemetry/overhead.ts`(텔레메트리 끔/켬 A-B-A-B)로 프레임당 스크립트 시간 차이가 1 % 안인지 본다.
