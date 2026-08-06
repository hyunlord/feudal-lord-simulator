# Living Manuscript Design System

## 1. Atmosphere

The game should feel like a courtly manuscript that has begun to move: a flat,
hand-painted world beneath a single carved command console. The world is the
primary surface and fills the viewport. Ornament is concentrated at the bottom
edge so the player reads terrain and placement first, then tools and status. The
lit map must read as one continuous landscape suspended in a quiet, ink-dark
surround; the tile grid is construction geometry, never the dominant motif.

Every visible element must appear to come from one workshop. Terrain,
buildings, icon glyphs, hover marks, tooltips, and generated surface art share
one ink outline, one upper-left light direction, one palette, and one family of
slightly irregular medieval forms. Modern dashboard vocabulary is forbidden.

## 2. Palette and Token Rules

`src/content/palette.ts` is the only source of colour literals. The brief calls
the palette twenty colours, but its canonical object lists nineteen; this
project implements those nineteen values exactly and invents no twentieth.

- Ink outlines use `ink`; secondary lettering may use `inkLight`.
- World fills use the named terrain tokens: `sage`, `forest`, `water`, and
  `stone`.
- Parchment surfaces use `parchment`, `parchmentDark`, and `vellum`.
- Valid and invalid placement use translucent `sage` and `vermilion`.
- Gold is an accent, never a general background.
- Generated images are quantised to the same token set with alpha preserved.
- Hex literals outside `palette.ts`, gradients, blur, CSS box shadows, and
  Canvas `shadowBlur` are prohibited.

All Canvas coordinates are integer-snapped. Outlines are one CSS pixel at 1x
zoom and use `ink`. Lit faces point up-left; down-right faces are twenty percent
darker. Object shadows use two cheap earth-tinted isometric ellipses: a faint
lower-left halo and a darker contact core. Their reach derives from manifest
sprite height and display scale, not footprint alone. A narrow terrain contact
mark is painted in the ground pass immediately beneath every building and tree.

## 3. Typography

The display face is the built-in Georgia serif in small, restrained doses for
the title and tooltips. Readable status text uses the same serif family to avoid
a system-sans rupture. Headings use title case, not dashboard-style all caps.
Text is ink on parchment or vellum, with no pure black or pure white.

Icon-only seals carry `aria-label` text, keyboard focus, and hover/focus
tooltips. The visible control remains a glyph rather than a text button.

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

The world canvas occupies the complete viewport. A single continuous wood
console overlays the bottom edge at approximately 150 pixels on desktop. It has
three carved recesses:

1. a shield-shaped minimap at the left;
2. a compact four-column build-seal matrix in the centre;
3. objective, ledger, blocker status context, overlay legend, and speed readouts
   at the right.

At 768 pixels the recesses compress without horizontal scrolling. At 375
pixels the minimap and readouts become narrower and the seal grid remains
usable in three rows. The document and every internal surface remain overflow
free at all required widths.

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
  purpose, labour, stock, progress, and house service facts. It follows the
  pointer, ignores pointer input, and never enters simulation state.
- **Placement mark:** translucent footprint, ink boundary, and a small
  parchment failure plaque positioned near the pointer.
- **Welcome parchment:** a centered parchment card above the world and the
  court console. It introduces the first interaction, uses the existing
  parchment and ink tokens only, and dismisses locally on click or pointer
  down without affecting the simulation.
- **Onboarding tasks:** the right console shows the current task, the next
  task, the completion flourish, or the open-goal state in that order. Current
  tasks receive the strongest emphasis, next tasks remain legible but quieter,
  and the open goal replaces the ordered list once all tasks are complete.
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
  deterministic manuscript glyphs with a gentle pulse; no generic warning dot
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
textures stay low contrast so procedural ink remains dominant.

All shadows are hard-edged, earth-tinted, stacked isometric ellipses with a
narrow contact mark. No gradient, blur, glow, drop-shadow, rounded dashboard
container, or one-pixel separator may substitute for the carved and painted
shape language.
