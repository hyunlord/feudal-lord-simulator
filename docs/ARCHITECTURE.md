# Architecture

Feudal Lord Simulator separates pure simulation axes from orchestration, state,
rendering, and React UI.

## Dependency direction

```text
content
   ^
world  economy  population  agents
   ^       ^         ^         ^
              engine
                 ^
               state
                 ^
             render  ui
```

`content/` contains dependency-free data and shared type contracts. `world/`,
`economy/`, `population/`, and `agents/` may depend on content but never import
one another. `engine/` is the only simulation layer that combines the four axes.
`state/` exposes engine state to the application. `render/` reads state and owns
all screen-coordinate knowledge. `ui/` contains React controls without inline
simulation math.

The four simulation axes and `engine/` are pure TypeScript. They do not use
React, the DOM, or Canvas APIs.

## Delivery and roaming stay separate

Delivery walkers have a destination, a planned road path, and cargo. Roaming
walkers choose local directions and distribute services within a limited route.
These behaviors must remain separate modules because they optimize for different
goals and have different failure modes. Sharing only the `Walker` shape and the
movement step prevents destination pathfinding from being distorted by roaming
rules, and prevents pseudo-random roaming from becoming hidden delivery logic.

## Phase 1 boundary

All simulation, pathfinding, production, storage, housing, labour, and drawing
functions are compile-safe stubs. Only the isometric coordinate transforms are
implemented in this phase.
