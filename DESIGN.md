# Living Manuscript Design System

Runtime art integration (2026-09-20): resource counters use the project's painted
resource art at existing 24px primary and 16px secondary slots. Text labels and
numeric stock semantics remain authoritative; failed images use a small Korean
material initial. Source PNGs remain preserved; registered 96px display buffers
avoid serving generation-sized images for these small UI elements.

## 1. Atmosphere

The game should feel like a courtly manuscript that has begun to move: a flat,
hand-painted world beneath a single carved command console. The world is the
primary surface and fills the viewport. Ornament is concentrated at the bottom
edge so the player reads terrain and placement first, then tools and status. The
lit map must read as one continuous landscape suspended in a quiet, ink-dark
surround; the tile grid is construction geometry, never the dominant motif.

Every visible element must appear to come from one workshop. Terrain,
buildings, icon glyphs, hover marks, tooltips, and generated surface art share
one ink outline, one upper-left light direction, one fixed-reference generation
language, and one family of slightly irregular medieval forms. Modern
dashboard vocabulary is forbidden.

## 2. Palette and Token Rules

`src/content/palette.ts` is the only source of colour literals in TypeScript,
TSX, and CSS. The brief calls the palette twenty colours, but its canonical
object lists nineteen; this project implements those nineteen values exactly
and invents no twentieth. That code palette governs DOM surfaces and
procedurally drawn Canvas fallbacks. It does not quantise or otherwise constrain
the interior RGB values of generated PNG art.

- Ink outlines use `ink`; secondary lettering may use `inkLight`.
- World fills use the named terrain tokens: `sage`, `forest`, `water`, and
  `stone`.
- Parchment surfaces use `parchment`, `parchmentDark`, and `vellum`.
- Valid and invalid placement use translucent `sage` and `vermilion`.
- Gold is an accent, never a general background.
- Generated images preserve their produced full colour depth. Sprite
  post-processing may remove the keyed background, normalize transparency,
  resize to the manifest contract, and add the exterior ink silhouette, but it
  may not remap interior RGB values to code tokens.
- Generated-set consistency comes from one model, one shared base prompt, the
  upper-left lighting clause, and IPAdapter against the fixed accepted
  references. Selection reviews form, silhouette, ground contact, lighting,
  and reference style; material identity is a prompt-and-rubric requirement,
  never an interior-RGB palette gate.
- Hex literals outside `palette.ts`, gradients, blur, CSS box shadows, and
  Canvas `shadowBlur` are prohibited.

General sprite placement uses integer snapping. Registered farm and wall art
retains fractional coordinates through the shared sprite helper so adjacent
pieces do not acquire independent rounding gaps. Farm perimeter clipping stays
inside the logical footprint; shared edges between completed farms stay aligned.
Procedural outlines are one CSS
pixel at 1x zoom and use `ink`; generated sprites receive one final-scale
exterior silhouette pixel using the same ink RGB, without changing their
interior colour. Lit faces point up-left; down-right faces are twenty percent
darker. Object shadows use two cheap earth-tinted isometric ellipses: a faint
lower-left halo and a darker contact core. Their reach derives from manifest
sprite height and display scale, not footprint alone. A narrow terrain contact
mark is painted in the ground pass immediately beneath every building and tree.

## 3. Typography

The display face is the built-in Georgia serif in small, restrained doses for
the title and tooltips. Readable status text uses the same serif family to avoid
a system-sans rupture. Headings use title case, not dashboard-style all caps.
Text is ink on parchment or vellum, with no pure black or pure white.

Construction controls show the actual building thumbnail, Korean name and cost.
Resource counters and command controls use the local Korean system sans family
(`Apple SD Gothic Neo`, `Malgun Gothic`, system-ui) for legibility, with 12–13px
labels and 18–20px tabular resource numbers. Restrained serif display headings
remain available elsewhere. All controls retain accessible names and focus.

## 4. Landscape Composition

Terrain is generated from seeded, low-frequency coherent noise. A world seed is
part of the visual identity: identical seeds produce identical terrain,
brightness, and woodland composition. A typical 64 by 64 domain contains one
connected lake system, one or two substantial woodland masses, and a rocky
ridge. Tiny isolated patches are removed after classification so water never
reads as blue confetti and forest or rock never reads as single-tile scatter.

Tile brightness varies slowly across the land at roughly five percent. Adjacent
tiles remain close enough in value to read as the same painted surface. Terrain
transitions are sparse, material-specific marks drawn on the land side:
earth along water, dark sage tufts along forest, and dark stone pebbles along
rock.

Forest tiles carry one or two deterministic trees. Exposed edges carry one and
connected interiors choose one or two; each tree varies position, scale,
silhouette, full-ramp foliage tint, and sway phase. The result
must read as a woodland canopy with an irregular boundary, not repeated stamps.
Beyond the map, three stepped palette-dark bands form a soft vignette without
gradients or blur.

## 5. Spacing and Layout

The current command UI supersedes the original seal-matrix layout below:
five resource groups form a 64px top bar (112px, two rows on phones). The
bottom command area contains minimap, six construction categories and building
thumbnails, then separate speed and overlay controls. It is 220px on desktop
and 340px at 700px and below, with the minimap and controls in a second row. Category
and tool strips may scroll internally; the document must not scroll sideways.
An always-available road tool, visible building names/costs and persistent
hover/focus/selection details replace the old indistinguishable round seals.
Palette tokens, plain parchment surfaces and a restrained earth-dark top rule
provide the medieval character without decorative text-obscuring imagery.
Timber and stone show construction-available stock using the same
placementSpendableResource calculation as build affordability. Their tooltips
also report physical totals and explain reserved, committed and in-transit
stock. Food and finances use real economyStockTotals. Development conditions
remain available in a collapsed disclosure to preserve visible map space.

Original layout reference (retained for historical context):

The world canvas occupies the complete viewport. A single continuous wood
console overlays the bottom edge at approximately 150 pixels on desktop. It has
three carved recesses:

1. a shield-shaped minimap at the left;
2. a compact four-column build-seal matrix in the centre;
3. objective, ledger, blocker status context, overlay legend, and speed readouts
   at the right.

At 768 pixels the recesses compress without horizontal scrolling. At 375
pixels the minimap and readouts become narrower and the opening Hamlet seal
grid remains usable in three rows. Later eras may add a fourth row while
keeping the same four-column matrix. The document and every internal surface
remain overflow free at all required widths.

The console art is quiet and architectural: flat horizontal planks, restrained
grain, three unmistakable sunken rectangular recesses, and iron only at the
outer ends. Decorative fragments may not protrude from or be clipped by the far
edges. Scroll art frames content only; its interior remains visually empty.

## 6. Components

- **World canvas:** three explicit render passes: ground, one depth-sorted
  object pass, and a reserved overhang pass. Buildings, individual trees,
  shrubs, and walkers enter one stable object queue so adjacent sprites and
  moving goods share the same tile-depth contract instead of separate ad-hoc
  painter layers.
- **World asset loader:** Phase 4C manifest assets preload from the canvas
  lifecycle without blocking the first procedural paint. The loader is a
  singleton; missing, loading, or failed images always leave the procedural
  renderer in control.
- **Terrain tiles:** procedural isometric diamonds with deterministic brightness
  variation, lower-right depth edges, four-neighbour transition marks, and
  connection-aware roads. When terrain textures are ready, clipped
  world-anchored `CanvasPattern` fills tint the same procedural diamonds;
  missing textures preserve the original flat paint path exactly.
- **Buildings:** each visual kind varies footprint proportion, height, and roof
  form; signature details confirm identity under the universal outline/light
  rules. At `zoom <= 0.5` they collapse to category-coloured city-mass blocks,
  at `0.5 < zoom <= 0.7` they use simplified procedural forms, and above
  `0.7` they may use manifest sprites with procedural fallback.
- **Ground details:** deterministic sparse grass tufts, rocks, shoreline earth,
  and connection-aware worn paths. Details disappear below 0.7x.
- **Building inspector:** a quiet parchment hover plaque with Korean identity,
  purpose, labour, stock, progress, and house service facts. It stays within
  the playable area above the command console, ignores pointer input, and
  never enters simulation state.
- **Cause diagnosis surfaces:** clicking a house or walker opens one
  dismissible parchment card; production and service buildings also open a
  persistent card using the same facts as their hover plaque. Houses state the exact water, bread, and
  population cause chain. Production-building hover plaques distinguish
  missing labour, disconnected labour or supply, and blocked output storage.
  Walker cards show
  their live role, cargo, route, status, distance, ETA, and cancellation cause.
  The card is presentation-only, gives walker selection priority over an
  overlapping building, and docks within the available space between the
  resource bar and court console, scrolling internally when needed.
- **Population event ledger:** a capped, presentation-only event list groups
  consecutive equal population changes, states the unit delta and immediate
  cause, and highlights the related houses when an entry is selected. It is
  derived from successive simulation snapshots and never adds fields to
  `GameState`.
- **Diagnostic overlays:** road-component and distributor-range modes reuse the
  exact road graph and footprint geometry used by routing. The former isolates
  the selected building's connected road component; the latter shows every
  road tile reachable within the canonical distributor range. Both remain
  optional presentation layers and do not alter pathfinding or balance.
- **Occlusion reading control:** the console exposes a labelled Korean `윤곽`
  control with shortcut `O`. It toggles presentation-only object silhouettes for
  buildings, construction sites, and walkers without entering `GameState`; roads
  and terrain remain normal readability anchors.
- **Placement mark:** translucent footprint, ink boundary, and a small
  parchment failure plaque positioned near the pointer.
- **Welcome parchment:** a centered parchment card above the world and the
  court console. It introduces the first interaction, uses the existing
  parchment and ink tokens only, and dismisses locally on click or pointer
  down without affecting the simulation.
- **Onboarding tasks:** the right console shows exactly one current imperative,
  its completion flourish, or the open-goal state. Future tasks remain hidden
  so the first thirty seconds contain one instruction, one world target, and
  one settlement status line; the open goal replaces the task once all tasks
  are complete.
- **Road seal:** the road tool is visually distinct from building seals so the
  player can find it quickly. It keeps the same token family as the other seals
  but reads as a separate path/utility action instead of a structure.
- **Armed seal:** the selected seal is inset and tinted so the active tool is
  unmistakable. Relevant onboarding tools pulse subtly while the onboarding
  task points at them, but only the armed seal receives the active inset and
  crosshair treatment.
- **Placement feedback:** valid and invalid placement states remain legible at
  both pointer scale and console scale. The palette tokens for these messages
  stay within the canonical parchment, vellum, ink, sage, and vermilion set;
  no new colours, blur, or shadow effects are introduced for feedback.
- **Opening road target:** while the first onboarding task is incomplete, the
  world marks one actually buildable cardinal road tile beside the canonical
  starting house with a gold-outlined parchment diamond and the vellum plaque
  `여기에 길을 놓으세요`. The marker is presentation only and disappears as
  soon as any cardinal road touches that house.
- **Onboarding world targets:** after the opening road, the current incomplete
  onboarding task may mark deterministic, actually buildable world origins for
  the required building kind. Food-chain onboarding may show the missing
  밀밭, 방앗간, and 곡창 targets at once when currently valid and
  non-overlapping, and it may add the same four numbered 오두막 prep targets
  used by the population task so houses can begin growing before the food
  chain is finished. If one more road is required before those six-minute
  prep markers are all actually buildable, the guidance keeps showing the
  presentation-only road extension first. These targets reuse the same
  gold-outlined parchment diamond and concise Korean vellum plaque language,
  remain presentation-only, and are derived from the existing placement rules
  rather than mutating economy, camera, control, or simulation state.
- **Population onboarding targets:** once road, production, storage, water, and
  food-chain tasks are satisfied, the population-30 task marks up to four new
  actually buildable 오두막 origins at once. Watered candidates within the
  existing well radius are preferred when enough exist; otherwise the same
  placement-rule scan falls back to the nearest buildable origins. Labels use
  the compact `오두막 n/4` pattern so the player builds the batch first, then
  immediately uses 5배속 without waiting through serial road-extension hints.
- **Court console:** one continuous generated wood surface with three clearly
  sunken recesses, never a collection of floating panels.
- **Build seals:** generated seal recesses containing procedural SVG glyphs.
- **Build guidance:** seals are grouped by dwelling, production, storage, and
  service. Hover or keyboard focus reveals Korean name, exact timber cost or
  shortfall, one-line purpose, and road or forest requirement. Unaffordable
  seals remain focusable but cannot be selected; Escape cancels placement.
- **Minimap shield:** non-rectangular overview set into the console.
- **Ledger plaque:** compact readouts and speed controls, not separate cards or
  pills.
- **Settlement guidance:** the normal screen persistently shows the current
  population target and one highest-priority Korean blocker line, sampled every
  sixty simulation ticks without adding presentation fields to `GameState`.
  Reaching 50 quietly advances the goal to 120 and never ends the game.
- **Problem glyphs:** true water, bread, labour, and storage failures use larger
  deterministic manuscript glyphs on steady compact parchment badges; no generic warning dot
  appears without a real condition.

## 7. Motion

Camera motion is direct and restrained: middle-drag, space-drag, keyboard pan,
and wheel zoom between 0.5x and 2x. It is presentation state owned by the render
layer, never by `GameState`.

Ambient motion is a deterministic sine offset evaluated only while drawing:
`amplitude * sin(tick * frequency + phase)`. Trees use two to three pixels of
amplitude, a frequency between 0.5 and 1.5 radians per second, and a stable
phase derived from identity. Nothing bounces, eases elastically, or stores
per-object animation state.

## 8. Depth and Surface

Depth comes from geometry and value, not effects. Isometric tiles are sorted
back-to-front. Buildings expose top, left, and twenty-percent-darker right
faces. Terrain gains a dark lower-right edge. Generated parchment and wood
textures retain full colour but stay fine-grained and low contrast so text and
procedural ink remain dominant.

Legacy shadows are hard-edged, earth-tinted, stacked isometric ellipses with a
narrow contact mark. Loaded baked house sprites instead use a small five-point
contact polygon so their painted base does not sit on a second oval platform. No gradient, blur, glow, drop-shadow, rounded dashboard
container, or one-pixel separator may substitute for the carved and painted
shape language.

## 9. Playable organic ground pass

The first engine integration preserves integer construction, selection and route
centres. A road occupies only its existing tile: rounded centre pads join seeded
half-arms whose shared-edge widths agree with the neighbouring road. Vary only
the margins, never the movement centreline. Remove dark repeated centre diamonds
and uniform ruts; keep a quiet earth base beneath ready road textures at 18%
opacity so the legacy texture cannot reintroduce dominant rectangular blocks. Forest margins
extend their existing forest-floor texture and tile variation into eligible grass
with a seeded, gently curved contour and a faint same-material outer edge. Skip the transition if either tile has a
road or building. Shoreline geometry
and terrain classifications remain authoritative and unchanged.

Render base terrain first, then land-side transitions, then roads and grounding.
This prevents later tile fills from cutting an earlier road arm or fringe. Reuse
the palette, seeded identity and existing pattern cache; introduce no blur,
gradients, dependencies, simulation fields or replacement sprite assets.

Verification: all sixteen road connection masks remain inside occupied tiles;
shared edges match for horizontal and vertical neighbours; identical seeds are
stable; road details paint after all base terrain. Run existing rendering,
placement, road routing and full repository tests; verify actual construction,
selection and demolition in the browser before delivery.

## Accepted art integration (2026-09-18)

Assets explicitly carrying `source.kind: accepted-art` and
`alphaPolicy: transparent-native-alpha` preserve the approved source's native
alpha and full colour. Their uniform-fit installer does not add a silhouette
outline or quantize interiors. This is a scoped exception to the generated
sprite outline rule above; legacy sources retain their existing requirements.
Source/output hashes and transforms are recorded in
`docs/asset-evidence/accepted-art/integration.json`. Runtime dimensions, anchors,
footprints and scales are preserved. Terrain retains opaque seamless edges.

## Village scale and frontage

Keep woodland interiors taller than their exposed edges. Species stature and
seeded variation control rendered trees without changing forest resources or
logical occupancy. An exposed canopy should sit around cottage height, leaving
roads and small moving residents readable; do not enlarge people to compensate.
Residents and their cargo/tools use 55 percent of the previous procedural body
scale (roughly 18 world pixels tall). Below 0.8 zoom retain a roughly 14-screen-pixel
readability floor. Feet, gait, route positions and depth sorting stay unchanged.

House frontage uses the existing earth palette and a seeded, asymmetric nine-point
pad oriented toward one adjacent road. A variable-width worn footpath connects
that entrance to the road. Paint the pad at 0.20 opacity and the path at 0.30
before the real road pass, without concentric soil bands. Pads stay inside the
house tile and paths reach only one orthogonally adjacent road tile.
They are surface wear, not new route edges or occupied tiles. Recompute from
the current map so demolition and road removal leave no stale connections.

## Road and civic frontage connections

Road centres use a seeded 0.208–0.220 tile radius matching their arm width,
with smoothly interpolated half-arms ending at shared world-coordinate widths
of 0.200–0.235. Only adjacent connected arms receive a rounded inner-corner
fillet, reaching 0.40 tiles internally. All geometry stays within its road tile;
all sixteen masks retain the original centreline and neighbour topology.

Well, storehouse, granary, logging camp and sawmill ground access reuses the
canonical whole-footprint road perimeter. Every eligible adjacent road has a
narrow worn connection; diagonal roads, foreign occupied tiles, water and rock
are excluded. The owned-footprint yard uses earth at 0.16 alpha and access wear
uses an earth core at 0.74, a narrow earth fringe at 0.24 and the adjacent
road's packed-earth texture at 0.18, preserving that road's pattern orientation. The small footprint-derived contact polygon uses earthDark
at 0.24 only for full-detail loaded baked art; procedural/low-detail fallbacks
retain their existing grounding. No sprite is rotated or mirrored to imply a
new doorway. Render paths are footprint access wear, not new movement routes.
Each perimeter approach continues inside the owned footprint to the fixed
front sprite anchor, so small artwork on a 2×2 footprint still meets the path.
Overlapping core and fringe polygons are filled together to avoid dark seams.

Check every perimeter position of 1×1 and 2×2 buildings, all four directions,
multiple contacts, blocked neighbours, map boundaries, road removal/restoration
and placement order. No scene coordinates or mutable render cache may decide
connectivity. Existing house treatment, pathfinding and simulation stay intact.

The above-object road readability pass retains alpha 0.72 and runs before
walkers. It reuses the same road polygons at 45% transverse width in earth
colour. It no longer introduces dark straight ruts or repeated central diamonds.
Shared endpoints and the logical movement centreline remain unchanged.

## Housing stage footprint consistency

All current house levels occupy one logical tile. Asset and generated-sprite
footprints must also remain 1×1, including L3, so a level change does not move
the sprite's ground anchor onto a neighbouring tile. This does not implement
housing merging or larger lots.

L3 uses the accepted slate-roof, half-timbered one-tile source with native alpha
and baked architecture. Keep its 160×192 authored canvas, (80,176) anchor and
2.6 target height ratio. Because its canvas is taller than L2's, the installer
fits its visible width to `88 * L2.renderScale / L3.renderScale` authored pixels
(about 117), retaining L2's approximately 51-world-pixel body width. The old
88-pixel fit made L3 shrink visibly. Verify the full L0–L4 sequence, adjacent
houses, mixed dense clusters, map edges and road-facing placements together.

## Detail panels and gentle UI boundaries (2026-09-19)

Use the existing parchment/vellum contrast to distinguish the tool catalog,
selection details and command groups. Boundary tokens are a 1px inkLight rule,
a 1px parchmentDark inner separator, a 4px corner radius and 8/12px inset spacing.
Outer surfaces retain the earthDark support edge, reduced to 2px on the console.
Avoid a heavy grid of boxes, gradients, blur or shadows. Interactive tool cards
have a quiet parchmentDark border; only selection uses ink and vellum. Category
and description areas have a shared baseline, while the map remains unobstructed.

Inspector text uses the same Korean system sans as the command console: 13px
body with 1.5 line height, 18px identity, 12px secondary labels. The header pairs
an existing asset or truthful fallback glyph with identity and a labelled close
button. Group supply/residents, production/inventory and development facts with
thin rules. Never infer a healthy state from missing diagnostics; display the
existing model's exact facts. Preserve demolition consequences and cancellation
restrictions. Use the shared resource/command height tokens for panel bounds.

Map problems use a compact 20-world-pixel parchment plate with a thin inkLight
edge and a small downward pointer. Water/bread/labour/storage glyphs use subdued
vermilion within that plate, with no size pulsing. Existing condition priority,
world anchor, depth ordering and level-of-detail eligibility stay unchanged.
Settlement status uses a matching outlined symbol and explicit Korean message.

At widths601–767px the resource exclusion height is104px to accommodate wrapped
resource labels; below601px the existing two-row132px exclusion applies.
Inspector and guidance bounds share these values to prevent resource overlap.

## Coherent command furniture (UI v3, 2026-09-19)

Supersedes the v2 surface styling above: use ink/inkMuted timber frames, earth
top trim, gold selection and vellum text. Inset parchment tool slots and detail
pages share a 2px corner and earthDark structural edges. No gradients, blur,
shadows, stretched bitmap frames or ornamental noise. Keep Korean body 13px
and distinct 18px identity headings. Layout owns a 240px desktop command area,
280px tablet area with description below tools, and 340px phone area. Resource
exclusion heights and inspector viewport bounds remain shared tokens.

## Two-lot residential development (2026-09-19)

Players may explicitly join two edge-adjacent, completed, equal-level homes at
level2 or above. The selected ID survives and occupies a horizontal2×1 or
vertical1×2 lot. This is an actual world entity and occupancy change. A joined
lot is not eligible for further joining. The lot persists when services fail
and the housing level decreases; stage-specific architecture follows the
current level. This stage does not implement automatic merging or2×2 blocks.

Preserve residents and bread, the older service/grace timestamp and longer
unmet-requirement duration. Capacity and growth/decline use both original lots;
a distributor can deliver up to two units per encounter, limited by real cargo.
Do not rewrite unrelated hunger/food-consumption rules. Reject active transport
references, claims, invalid occupancy and walls crossing the new lot. Shared
geometry drives roads, service distance, protection, overlays, depth and ground.

The current inspector offers explicit neighbor choices and reasons; retain the
UI v3 frame and keyboard rules. Long lists remain inside the panel scroll area.
Authored compound PNGs at levels2–4 retain native alpha and fixed camera/light;
procedural continuous-lot architecture remains a fallback at the preserved built level.

### Layered farm sprites

Farm soil uses one muted loam material, buffered at 128px and sampled on a
world-aligned 128×64 grid. If unavailable, the interior of the original worked
image remains the fallback. All visible farm soil draws before the object
queue. Separate crop sprites retain aspect ratio and root contact across growth
stages. High-resolution crop art is filtered into three fixed 64px-high buffers
once at load. Crop canopies cache those 144 clumps at 3× resolution, keyed by
position, growth stage and source identity. The cache holds at most 64 entries;
the object queue begins each frame and pins entries used in that frame. Overflow
plots draw their clumps directly, avoiding repeated buffer allocation when the
visible set exceeds capacity. Cold entries still have a rasterization cost.
Crop and new soil blits opt into smoothing; other sprite and wall defaults stay
unchanged. These buffers add no persistent state to the simulation.

### Historical facilities, stone gates and housing condition (2026-09-19)

Use S_England_1300_1450_v1 / AB_2026-09-19_v1 and versioned original assets.
Single L3 uses approved v2, never rejected v3. Facility variants share registration;
market activity follows real sale availability, not a nonexistent production recipe.
Quarry depletion is not simulated and its installed depleted image remains unused.
Windmill sails are static. Preserve existing building footprints and simulation costs.

House level is living grade; builtLevel preserves highest constructed form, with
legacy records defaulting to current level. One lost grade is strained, two or more
neglected; zero residents with a grade gap is vacant. Matching living AND built
grades are required for merge. Do not turn tiled homes back into thatch on service
loss. Small source-aligned procedural condition marks are drawn only over the
matching historical sprites; low-detail/failure fallback retains the built form.
Inspector shows living grade, constructed grade and condition separately.

Completed stone walls share canonical global edge/node topology. Procedural
textured terminal/corner/T/cross joints and gate piers/lintel preserve clearance;
walkers near stone gates participate in depth sorting. As of wall-routing-v1, road pathfinding filters completed wall crossings;
gate openings remain traversable and incomplete sections remain open. Isolate tiny
stone material sampling in a 60×180 buffer to avoid first-frame browser sampling
changes. Buffer creation failures must settle preloads and retain original-image
or procedural fallback, never hang the shared preload Promise.

Runtime evidence lives in ../feudal-lord-simulator/output/city-integration-v1/.
Actual UI house L3→L1/built3→L3 recovery is distinct from the seeded engine
17-section timber/stone construction scenario and synthetic renderer matrices.

### Wall-aware routing (2026-09-19)

World wallTraversal owns completed-wall crossing geometry and shared gate
half-clearance0.8 in unit-step/Chebyshev coordinates. Road centers are tile
coordinates+.5; edge wall coordinates must not be compared directly with road
indices. Inclusive intersections prevent diagonal touching/collinear tunneling.
Road graph connectivity, building/site frontage, active transport and bread
service use the same boundary check. Plain Grid callers without palisade retain
previous behavior. Cache solid fragments by immutable wall identity.

Newly completed barriers increment roadRevision and clear pathCache. Timber to
stone replacement keeps the barrier. Invalid active paths replan/cancel from
the last reached tile; existing disconnected transport resource recovery
remains logical where a physical return route does not exist. Never claim all
returns are physically walked. Preserve cargo when storage is full.

Timber frames and stone piers/lintels use the same gate opening as traversal.
No manual gate closing, combat, wall demolition or freeform routing was added.
Proof: ../feudal-lord-simulator/output/wall-routing-v1. Seeded UI fixtures are
not natural era progression; engine trajectories and UI interaction are reported
separately.

## Settlement progression (2026-09-20)

A compact disclosure in the existing right information rail presents the current
settlement goal, real supplied-house count and household food stock. It reuses
vellum, ink, earth borders and the 12–13px Korean UI typography with 4/8/12px
spacing. Goals and crisis causes are readable text; progress uses native progress
semantics. Achievement does not obstruct play. Abandonment pauses simulation and
exposes an explicit two-step new-settlement action. This replaces arbitrary speed
advice; elapsed requirements are stated in game-time seconds, never engine ticks.

## Wall and settlement coherence (2026-09-20)

Use one full tile of clearance between building footprints and planned/completed
walls, including separate wall sites. Apply the same rule to wall proposals,
manual construction, advisor construction and merges. Automatic placement keeps
a dry-land ring; manual shore placement remains available. Existing saves keep
their wall geometry. Do not carve building holes into the proposed outer wall.

Render walls relative to full building footprints, including merged housing in
both orientations. Keep gate art grounded in the traversable opening; a turning
gate uses a supported straight lintel rather than an unsupported bent beam.
Forest recovery is visual only and preserves terrain and harvest history.
Evidence: ../feudal-lord-simulator/output/world-coherence-v1/README.md.

## Finite household services (2026-09-20)

House and facility inspectors use the same householdServices allocation as the
simulation. Show water/market/church failure causes and actual used residential
lots, not radius-only success. A merged home consumes two lots and vacant homes
retain capacity. Reuse existing inspector typography, disclosure and scroll bounds.
Static wall raster reuse preserves existing depth queue positions and live actors;
do not flatten the complete object scene or freeze tree sway for a cache hit.

## Normal-view occlusion and construction clearance

Road readability polygons belong to the ground pass, before every upright object.
Normal-view buildings remain opaque during hover and in dense neighborhoods;
only the explicit outline diagnostic mode is translucent. Preserve physical
foreground-wall occlusion and full-footprint depth constraints. Wall preview,
automatic proposal and confirmation share completed-building and unfinished
building footprints, with the same one-tile clearance.

## UI-1 cause map (2026-09-23)

Cause markers reuse palette ink/vellum outlines and registered semantic colours.
Their screen-space radius is 13px with 11px Korean badge lettering; a second
2px boundary marks maintenance risk. Ready housing has a small 6px unfilled
ring, without a percentage. At zoom0.6 and below, same-cause markers within
36 screen pixels form a count badge. Problem view fades normal buildings to
40 percent opacity; terrain and roads retain their normal rendering. The
upper-right legend and one-line hover plaque use existing 13px Korean meta
text, parchment surfaces and 8/12px spacing. Long hover text wraps only when
required to stay inside the viewport. Inspector cause summary remains outside
its scrolling details. These presentation tokens do not change simulation.

## UI-2 placement prediction (2026-09-23)

PredictionLine data is rendered by the reusable PredictionPanel, independent of
facilities. Reuse vellum/ink and 13px Korean meta typography, 8/12px padding,
360px maximum width with 12px viewport clearance. Status symbols accompany text;
negative uses vermilion, positive forest, warning earth-dark. The cursor plaque
stays between resource and command bars. Dashed gold isometric ellipses guide
range; thin gold house footprints show the actual grid-rule result. Road land
uses a short solid mark and bridge sections three crossbars, preserving colour
and pattern distinction. Prediction does not change placement or service rules.

## UI-3 compact command contract (2026-09-23)

Body text is 16px, secondary metadata 13px and compact badges 11px. The
11px exceptions are onboarding completion flourishes, build affordability tags,
existing compact status badges and cause-legend secondary labels. No text uses
10px or smaller. Text never shrinks at narrow widths.

The bottom console is 100px: category row, selected-tool summary and one shortcut
line. Categories open a bounded floating tool catalogue; [i] opens its detailed
guidance. The summary retains name, actual cost, configured radius and household
capacity. Map and view controls are disclosures; speed remains directly available.
Automatic development is inside Settings, preserving its scheduler and state.
At narrow widths controls wrap into a 140px console, rather than reducing type.
All disclosures remain keyboard-accessible; drawers scroll within the available
map height. Existing palette, focus rules and artwork remain authoritative.

Placement previews share existing sage at 16% fill for the radius and 28%
for actual target footprints, with solid gold 3 CSS pixel borders compensated
for zoom. Geometry and radius are unchanged; cause glyphs paint afterward.
