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

## 덧붙임(2026-09-30 밤): NAT-2 뒤 JS 힙 증가 확인

- 보낸 곳: 인프라·문서 세션, 사용자 지시("NAT-2 뒤 JS 힙 증가(63~77 → 74~87 MB)의 원인을 봐, 줄인 그림 캐시(밉맵)일 가능성이 커").
- 받는 곳: 렌더 세션, UI-AUDIT-1 뒤에 이 요청서와 함께.

### 결론

**NAT-2가 JS 힙을 늘렸다는 증거는 없다.** 추이의 "나빠짐" 표시는 측정 방법에서 나왔다. 밉맵 캐시도 원인이 아니다.

- **A-B-A-B**: `00df3324`(SMOOTH-2R) 대 `8ebdcf5c`(NAT-2). Mac 실제 Chrome 창, 가장 큰 도시 5배속, 60초 × 4쌍([기록](../verification/perf-ab/2026-09-30-2310-00df3324-8ebdcf5c.md)).

  | 지표 | SMOOTH-2R | NAT-2 | 판정(±2 SE) |
  |---|---:|---:|---|
  | JS 힙 끝 MB | 85.3 | 81.1 | 소음 안(−4.3 ± 8.8) |
  | JS 할당 MB/s | 19.7 | 17.1 | **좋아짐**(−13 %, 4/4쌍) |
  | 힙 하락(GC)/분 | 113.8 | 69.3 | **좋아짐**(−39 %, 4/4쌍) |
  | 프레임당 스크립트 ms | 6.26 | 6.33 | 소음 안 |

- **DGX 추이의 표시는 측정 방법 때문이다.**
  - "JS 힙 끝 MB"는 기록이 끝난 순간 GC 톱니의 한 점이다. DGX에서 같은 커밋 안의 세 번이 61~90 MB로 퍼진다(`00df3324` 90.3·61.2·76.7, `8ebdcf5c` 73.6·65.5·85.9, `e6d08a6e` 68.9·66.2·51.4).
  - 기준도 앞선 커밋 두 개뿐이었다. 짝수 개의 중앙값을 아래쪽 값(63)으로 잡아 표시가 났다.
- **GC 뒤 남은 힙**(Mac, `scripts/perf/memoryHolders.ts --commit`, 강제 GC 뒤 `Runtime.getHeapUsage`):

  | 지점 | SMOOTH-2R | NAT-2 |
  |---|---:|---:|
  | 불러온 뒤 | 35.1 MB | 33.6 MB |
  | 2분 플레이 뒤 | 37.0 MB | 38.5 MB |

- **밉맵은 JS 힙이 아니다.**
  - `spriteMipCache`의 수준은 OffscreenCanvas 픽셀이라 JS 힙 밖에 있다.
  - 픽셀 붙잡이로 재면 기본 줌에서 0 MB, 카메라를 움직인 뒤 2.1 MB다. 힙 스냅숏의 붙잡이 목록에도 나오지 않는다.

### 렌더가 볼 것(판정 아님, 한 번씩의 관찰)

1. **카메라를 움직인 뒤의 차이.** memoryHolders의 카메라 지점에서만 차이가 컸다. 원자료는 `~/feudal-lord-analysis/perf-traces/nat2-heap-20260930/`에 있다.
   - GC 뒤 힙 39.0 → 56.1 MB, 렌더러 RSS 440 → 682 MB.
   - 성벽 래스터 캐시(`worldRasterCache` `trimToDrawnExtent`, 목책 구간) 픽셀 8.6 → 32.0 MB.
   - 힙 스냅숏에서 새로 보이는 붙잡이는 `worldRasterCache`의 `caches` Map(6.2 MB)이다.
   - 다만 SMOOTH-2R 쪽은 그 구간에 게임 날짜가 멈춰 있었고(1382년 봄 → 봄), NAT-2 쪽은 2년이 흘렀다(1382년 겨울 → 1384년 봄). 같은 조건이 아니다.
   - 확인하는 법: 줌을 바꿔 가며 목책 래스터 키(`rasterCacheKey`가 줌 행렬 a·b·c·d를 포함)가 몇 개 쌓이는지 본다. 픽셀 상한(`MAX_PIXELS` 8 M)과 캔버스 예산 안에서 도는지 텔레메트리 사건 `worldRaster.evict`로 본다(위 표).
2. **NAT-2 쪽 긴 프레임.**
   - 같은 A-B에서 최대 프레임은 SMOOTH-2R 25.0~26.2 ms, NAT-2 33.1~700.5 ms였다. 4쌍 모두 NAT-2가 컸다.
   - 33 ms 초과는 분당 0 → 4.65였다.
   - ±2 SE 밴드 안이라 판정은 아니지만, 4쌍 모두 같은 쪽이다. 텔레메트리 훅이 들어가면 그 프레임의 함수·사건 이름으로 가릴 수 있다.

### 측정 쪽에서 고친 것(인프라 세션)

- `hitchAudit`가 기록 뒤 강제 GC로 **GC 뒤 남은 JS 힙 MB**(`heapAfterGcMB`)를 잰다.
- `perf:trend`의 판정 지표는 이것으로 바꿨다. "JS 힙 끝"은 참고 칸으로 옮겼다.
- 앞선 측정 커밋이 셋 이상일 때만 표시한다. 짝수 개의 중앙값은 가운데 두 값의 평균이다.
- `perf:ab` 표에도 두 힙 지표가 함께 나온다.
- 추이 실행마다 DGX의 다른 일 CPU를 함께 적는다. 틱당 값도 DGX가 바쁘면 커진다. `a597617b` 큰 도시 스크립트가 조용할 때 13.5 ms/틱, 전체 시험과 함께일 때 19.9 ms/틱이었다.
  - 그 칸이 높은 줄의 "나빠짐"은 `perf:ab`로 확인한 뒤에 받는다.
