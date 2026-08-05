# Phase 4D Wire World Sprites Design

## Goal

Render the approved Phase 4C world assets inside the live game without changing
simulation state, economy rules, balance, or deterministic world generation.
Loading failures and low-detail zoom levels retain the current procedural
renderer as an intentional fallback.

## Runtime boundary

`src/render/worldAssets.ts` owns one browser-only manifest registry. It imports
the checked-in manifest, converts repository paths from `public/...` to served
URLs, starts each `Image` exactly once, shares concurrent preload calls, and
never rejects. Each entry moves through `idle`, `loading`, `ready`, or `missing`;
only ready entries are returned to drawing code.

`src/render/worldSprite.ts` owns placement. Public `drawWorldSprite` accepts a
manifest key and tile anchor. A world-anchor helper supports deterministic
within-tile foliage offsets without duplicating image logic. Both transform the
bottom-centre manifest anchor to device space, snap destination pixels, cull
against the device canvas, disable smoothing only for the draw, and restore the
caller's complete canvas state.

## Object composition and depth

Buildings, individual foliage descriptors, and walkers enter one render queue.
Every item exposes its forward contact point in fractional tile coordinates,
then sorts by `tx + ty`, `tx`, and a stable identity. Multi-tile buildings use
their forwardmost footprint tile. The queue preserves the existing procedural
draw functions and calls them whenever a sprite is unavailable or the current
LOD requires category blocks.

House levels map to `house_l0` through `house_l3`; the granary maps to `barn`;
the remaining building kinds map to their manifest keys. Existing tree hashes
select the four tree sprites and the two shrub sprites only for explicit
ground-cover descriptors. Existing scale, offset, sway, density, and clearing
decisions remain deterministic.

## Terrain composition

Terrain diamonds stay procedural geometry. A per-context cache creates at most
one `CanvasPattern` for each ready terrain texture. The diamond path clips the
pattern in world coordinates, so panning and zooming do not change texture
phase. Existing deterministic brightness remains a palette-derived translucent
overlay. Road centre and connection arms use the packed-earth pattern while
retaining the current connection geometry.

## LOD and failure behavior

- Above `0.7`: full sprites, decals, full foliage.
- Above `0.5` through `0.7`: sprites with simplified foliage and no decals.
- At `0.5` and below: existing procedural category blocks.
- Loading or missing assets: existing primitives in the same frame.

The camera minimum remains `0.5`; the acceptance screenshot at that boundary
therefore proves block LOD. No generated asset, palette, simulation type, or
economy value changes in this phase.

## Verification

Unit tests lock preload convergence, missing-image safety, device-pixel anchor
math, 1x1 and 2x2 footprint anchors, unified walker depth, stable terrain phase,
clearing preservation, LOD boundaries, source guards, and determinism. The full
suite, typecheck, production build, and economy harness must pass.

Real-browser QA captures the requested four game views from the running DGX
server and checks StrictMode console output. A repeatable browser benchmark
renders at least 40 buildings, 400 trees, and 20 walkers, measuring average and
worst frame time at 1x and with five simulation ticks per render. Baseline and
final runs use the same fixture; values above 12 ms are reported rather than
hidden by an unrequested redesign.
