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
darker. Shadows are flat translucent diamonds.

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

Forest tiles carry one to three deterministic trees. Interiors are denser than
edges; each tile varies position, scale, silhouette, and sway phase. The result
must read as a woodland canopy with an irregular boundary, not repeated stamps.
Beyond the map, three stepped palette-dark bands form a soft vignette without
gradients or blur.

## 5. Spacing and Layout

The world canvas occupies the complete viewport. A single continuous wood
console overlays the bottom edge at approximately 150 pixels on desktop. It has
three carved recesses:

1. a shield-shaped minimap at the left;
2. a compact four-column build-seal matrix in the centre;
3. timber, tick, camera, and speed readouts at the right.

At 768 pixels the recesses compress without horizontal scrolling. At 375
pixels the minimap and readouts become narrower and the seal grid remains
usable in three rows. The document and every internal surface remain overflow
free at all required widths.

The console art is quiet and architectural: flat horizontal planks, restrained
grain, three unmistakable sunken rectangular recesses, and iron only at the
outer ends. Decorative fragments may not protrude from or be clipped by the far
edges. Scroll art frames content only; its interior remains visually empty.

## 6. Components

- **World canvas:** three explicit passes: ground, depth-sorted objects, and an
  intentionally empty overhang pass reserved for future walls.
- **Terrain tiles:** procedural isometric diamonds with deterministic brightness
  variation, lower-right depth edges, four-neighbour transition marks, and
  connection-aware roads.
- **Buildings:** procedural boxes and roofs with distinct silhouettes and the
  universal outline/light rules.
- **Placement mark:** translucent footprint, ink boundary, and a small
  parchment failure plaque positioned near the pointer.
- **Court console:** one continuous generated wood surface with three clearly
  sunken recesses, never a collection of floating panels.
- **Build seals:** generated seal recesses containing procedural SVG glyphs.
- **Minimap shield:** non-rectangular overview set into the console.
- **Ledger plaque:** compact readouts and speed controls, not separate cards or
  pills.

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

All shadows are hard-edged translucent diamonds. No gradient, blur, glow,
drop-shadow, rounded dashboard container, or one-pixel separator may substitute
for the carved and painted shape language.
