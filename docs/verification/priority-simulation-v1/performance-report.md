# Renderer priority: stable wall raster reuse

Implemented in the actual playable worktree, without changing the world art, depth order, tree sway, moving residents, construction progress, farm animation, or gameplay.

## Cause and correction
The previous investigation isolated repeated wall masonry raster work as a major cost. Completed wall units now retain a device-resolution transparent raster and replay it at the same point in the existing depth queue. Geometry, gate/node shape, material, image-loading status, camera transform (including fractional pan), zoom, canvas size/DPR, and image smoothing invalidate the entry. Alpha/compositing modes unsupported by the cache use the original drawing path.

The cache is per destination canvas context, LRU bounded to 8 million pixels (32 MB of RGBA pixels, excluding browser/GPU overhead). Oversized entries and unavailable DOM/canvas fall back to original drawing. All visible sprites are retained. New worlds and wall edits cannot accidentally share rasters because their full draw inputs are in the key.

A terrain-pass cache was experimentally tried and removed: it did not improve the observed frame-interval median beyond wall caching and added unnecessary invalidation dependencies. Trees were deliberately kept live because they sway with the simulation tick.

## Final quiet browser benchmark
Real installed Chrome, headless, Vite development server, 1600×1100 at DPR1, same natural-final saved city and camera. Baseline bypasses the cache in served module text only; product files stay unchanged. Both variants use the same current simulation/UI code. Four serial runs of 40 frame intervals; baseline and candidate pages/browser closed afterward. The earlier overlapping-test measurements are superseded by this final quiet run, coordinated after service tests and natural simulation ended.

| Run | Median rAF interval | p95 |
| --- | ---: | ---: |
| Original drawing, paused | 183.3 ms | 200.1 ms |
| Original drawing, 1× | 199.9 ms | 200.1 ms |
| Wall raster cache, paused | 50.0 ms | 66.7 ms |
| Wall raster cache, 1× | 66.6 ms | 66.8 ms |

Active interval is approximately 3× faster. This remains roughly15 FPS in this headless scene, **not** a claim of smooth60 FPS or production/hardware-wide performance. Cold cache creation and camera changes still cost rasterization; very large/high-DPR views may exceed the cache budget and rebuild entries. No production Lighthouse claim is made; the measurement addresses the existing developer-game runtime problem with a matching A/B surface.

## Correctness evidence
- 87 focused renderer tests passed, including wall/building ordering and stone topology cases; TypeScript passed.
- Real Chrome full-renderer comparison:36 combinations of DPR1/2, zoom0.5/1/1.35, integer/fractional pan, tick advance, and wall removal.
- Cold-cache versus reused-cache output: **0 differing pixels in all36 cases**.
- Original drawing versus cache is not pixel-identical: sparse antialias/compositing differences at wall edges. Typical mean RGB-channel difference~0.001–0.006 on a0–255 scale; first initialized scene0.0655. No geometry/occlusion content is deliberately removed. The result was visually inspected.
- Real Canvas callback checks confirm cache hit, content replacement, camera change, resize, asset-status change, and alpha fallback. See performance-parity.json.
- Frame-capture images are replayed saved-state developer screenshots, not newly uninterrupted natural play.

## Files
- `src/render/worldRasterCache.ts`: bounded static raster cache.
- `src/render/drawPalisadeSegments.ts`: preserves original draw function and uses the cache only for completed wall units.
- `tests/worldRasterCache.test.ts`: transform/viewport/content key boundary.

Scripts/results: `performance-browser.mjs/.json`, `performance-parity.mjs/.json`, `performance-tests.log`. Individual screenshot: [cached](performance-cached.jpg). The historical baseline capture was already absent from the Phase 16 base commit; no replacement baseline is claimed.
