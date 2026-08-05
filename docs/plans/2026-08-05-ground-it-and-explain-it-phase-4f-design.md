# Phase 4F — Ground It and Explain It Design

## Goal

Make a fresh settlement immediately legible without changing simulation state or
balance: objects must visibly touch the terrain, the normal screen must state a
goal and the highest-priority blocker, every build seal must explain itself, and
all persistent controls must live inside the court console.

## Accepted direction

The supplied Phase 4F brief is the approved product design. The implementation
extends the existing Living Manuscript system rather than introducing a tutorial
state machine or a new dashboard layer.

Three approaches were considered:

1. **Pure presentation models over the existing `GameState` (accepted).** Small
   deterministic selectors derive the goal, status, affordability, icon state,
   shadow geometry, and tree variation. React and Canvas consume those values
   without dispatching simulation actions.
2. **A scripted tutorial state machine (rejected).** It could sequence prompts,
   but would add progression state and conflict with the explicit no-economy,
   no-balance scope.
3. **A console and renderer rewrite (rejected).** It would make the visual changes
   together, but would discard proven Phase 4D/4E render ordering, asset loading,
   accessibility, and performance contracts.

## Rendering architecture

`worldAssets.ts` remains the authority for sprite dimensions. A pure shadow
geometry helper receives the manifest height and display scale, then returns two
integer-snapped, earth-tinted isometric ellipses: a wide faint halo offset toward
the lower-left and a smaller darker core at the contact point. Building and tree
sprite paths call the same helper before either a manifest sprite or procedural
fallback. The formula is bounded so a tall 1×1 manor casts a longer and wider
shadow than a hut without allowing a sprite to flood adjacent tiles.

The ground pass gains a narrow contact-darkening pass. It derives visible
building bases and tree anchors from the same immutable world geometry used by
the object queue, then paints small, low-alpha earth diamonds before objects.
This preserves the three-pass renderer and makes the darkening sit in the land
rather than on top of sprites.

Tree descriptors gain a deterministic palette step derived from their existing
stable identity. The renderer maps that step across the full foliage range.
Forest density becomes one or two trees per tile: exposed edges always use one;
connected interiors use a stable hash to choose one or two. No simulation or
world-generation data changes.

## Guidance and console architecture

Pure presentation functions derive:

- objective text from `state.population` with thresholds 50 and 120;
- a quiet one-time threshold banner held only in React presentation state;
- the status message from a frozen snapshot every 60 simulation ticks;
- build affordability, shortfall, purpose, and placement requirement from the
  current timber and existing building configuration.

Status priority is exactly: dry house, stale bread for at least 200 ticks,
idle workers plus understaffed worksite, missing granary, treasury timber below
30, stable. The selectors return text only and never mutate or dispatch to
`GameState`.

The status line is the only persistent world-adjacent UI and sits immediately
above the console. Objective, ledger, speed controls, and economy overlay legend
share the right recess. Overlay controls no longer mount as a world-floating
section. Build seals retain accessible buttons but are separated into dwelling,
production, storage, and service groups. Their tooltips show Korean name, timber
cost or shortfall, one-line purpose, and road/forest requirement. Unaffordable
buttons are visibly muted and `aria-disabled`, while remaining focusable so the
shortfall tooltip is available. `Escape` returns selection to the neutral road
tool and removes the pressed state from the prior building tool.

## Problem markers

The existing marker boundary is expanded into four deterministic manuscript
glyphs: water drop, loaf, worker figure, and full crate. Each glyph is derived
from actual house or production state, drawn larger, and pulses only through
opacity/scale-compatible Canvas math. No icon appears without its condition.

## Generated UI assets

`scroll_frame.png` and `wood_console.png` are regenerated through the existing
seeded DGX ComfyUI workflow, not hand-painted. Candidate generation preserves
the current dimensions and transparent regions. Release processing quantises to
the canonical palette while explicitly retaining gold, ultramarine, and
vermilion border medallions for the scroll, and plank grain plus raised recess
edges for the console. Existing artifact verifiers are extended before any
candidate is accepted. Before/after files, seeds, candidate selection, hashes,
and visual screenshots become committed evidence.

## Performance and failure behavior

Shadow geometry is pure and cached or derived from already-cached descriptors;
there is no `shadowBlur`, gradient, layout animation, or per-frame asset lookup
beyond the existing manifest map. Two halo fills plus contact fills are measured
on DGX at 1× and 5×. If the 5× average exceeds 12 ms, the contact pass is batched
by fill style and the descriptor list is cached by immutable world geometry
before any visual requirement is weakened.

Missing generated images retain the current procedural or solid-color fallback.
The guidance selectors accept constructed test states and return a stable Korean
message rather than throwing on empty collections.

## Verification design

TDD covers shadow height scaling and palette/alpha, ground-pass ordering, every
status priority, objective purity and threshold transition, affordability and
shortfall, `Escape`, grouping and tooltip content, icon truth conditions,
deterministic full-ramp tree tint, one-to-two forest density, and the absence of
persistent UI over the canvas. Existing source guards continue to prove no hex
literal outside `palette.ts`, no gradients/blur, axis isolation, and coordinate
confinement.

DGX is authoritative for the full Node/Python suites, typecheck, build, economy
harness, generated-asset verification, Playwright interaction QA, screenshots,
and three-run 1×/5× performance evidence. Completion requires remote `main`, DGX
HEAD, and the live port 3200 tree to match exactly.
