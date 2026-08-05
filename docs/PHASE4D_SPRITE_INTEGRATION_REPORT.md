# Phase 4D Sprite Integration Report

## Release decision

Phase 4D replaces the live world's procedural-only presentation with the
Phase 4C manifest assets while retaining the procedural renderer as the
loading and missing-asset fallback. The simulation and balance model are
unchanged.

## Runtime contract

- The singleton manifest preload begins from the canvas lifecycle and does not
  delay first paint.
- Terrain and road textures are cached per canvas context and image source.
  A transient `createPattern()` failure is retried rather than cached.
- Buildings, individual trees, explicit ground cover, and walkers share one
  stable depth queue. Building depth uses the forward footprint tile and walker
  depth uses the same foot anchor as drawing.
- Building sprites draw only at full detail (`zoom > 0.7`). The exact LOD policy
  is blocks at `zoom <= 0.5`, simplified procedural forms at
  `0.5 < zoom <= 0.7`, and full sprites/details above `0.7`.
- A successful building sprite retains the hard procedural contact shadow.
  Missing or loading assets fall through to the previous procedural shapes.
- Malformed runtime manifest records fail closed with field-specific errors;
  unsupported categories, unsafe paths, and non-positive dimensions cannot be
  reinterpreted as valid fallback metadata.

## Visual acceptance

| Evidence | Result |
| --- | --- |
| [Default settlement](assets/phase4d_default_settlement.png) | Terrain, water, trees, shrubs, and the opening house render from the release manifest without a blank first frame. |
| [Close adjacent buildings](assets/phase4d_close_buildings.png) | The starting house, a new house, and a well share adjacent road-space anchors without floating or detached contact. |
| [0.5x block LOD](assets/phase4d_lod_0_5x.png) | Buildings become compact blocks and ground-cover sprites disappear at the exact overview boundary. |
| [Walker depth](assets/phase4d_walker_depth.png) | Live fivefold simulation produces multiple cargo walkers that sort among the nearby buildings and foliage rather than in a separate top layer. |
| [375px responsive canvas](assets/phase4d_responsive_375.png) | The real canvas, overlay plaque, minimap, build controls, ledger, and speed controls remain framed inside the narrow viewport without horizontal overflow. |
| [768px responsive canvas](assets/phase4d_responsive_768.png) | The same live sprite path keeps the world readable and the court console non-overlapping at the intermediate breakpoint. |

The camera-edge clearing is stable because tree density is derived from the
full world before visible-range and building-clearing filters are applied.
Every building footprint also clears its one-tile apron. The live browser
reported no console warnings or errors, and all 22 manifest PNG URLs returned
HTTP 200 with `image/png` content. Browser layout metrics also confirmed exact
375x720 and 768x720 CSS viewports with matching canvas bounds and no horizontal
overflow.

## Regression evidence

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run harness`: PASS
  - determinism hash: `4d92c66f9408a603 == 4d92c66f9408a603`
  - food stability, cargo thrashing, labour deadlock, and housing oscillation:
    PASS
- `npm test`: 336/340 PASS locally. The four remaining tests all stop at
  `spawnSync ffmpeg ENOENT`; they are release-pipeline file-boundary tests and
  do not represent assertion failures. They must be rerun on the DGX host where
  the asset toolchain is installed before delivery is declared complete.

## Performance

Browser measurements used a deterministic synthetic render state at
1280x720 with 40 buildings, 439 individual tree render items, and 20 walkers.
Each result contains 120 measured frames after 20 warm-up frames. The fivefold
case advances five simulation ticks before every render.

| Revision | Competition | Average | p95 | Worst observed |
| --- | ---: | ---: | ---: | ---: |
| Phase 4C `903f435` | 1x | 2.78 ms | 3.40 ms | 3.70 ms |
| Phase 4C `903f435` | 5x | 2.99 ms | 3.30 ms | 5.60 ms |
| Phase 4D `1073e86` run A | 1x | 7.62 ms | 9.90 ms | **12.40 ms** |
| Phase 4D `1073e86` run A | 5x | 7.40 ms | 9.30 ms | 11.80 ms |
| Phase 4D `1073e86` run B | 1x | 7.13 ms | 9.60 ms | 11.20 ms |
| Phase 4D `1073e86` run B | 5x | 8.04 ms | 10.60 ms | **13.00 ms** |

Average and p95 frame cost remain below 12 ms, but one worst frame in each
competition mode exceeded the reporting threshold. This is a measured render
cost regression from the Phase 4C procedural baseline and remains a follow-up
profiling risk; it is not hidden by the average.

## Known issues

1. Local macOS verification cannot run the four ffmpeg-backed pipeline tests
   because no `ffmpeg` executable is installed.
2. The new manifest presentation increases worst-frame render cost; rare
   samples reached 12.4-13.0 ms in the acceptance fixture.
