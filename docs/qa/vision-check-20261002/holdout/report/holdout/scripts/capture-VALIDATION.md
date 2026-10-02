# Capture helper validation

- Immutable detector package: no detector imports or calls. Both scripts import only capture/replay/contracts helpers from `report/holdout/frozen-tool` through explicit PYTHONPATH.
- Frozen detector thresholds/configuration are never changed.
- Strict Ruff uses the frozen package's ALL rules. Basedpyright `typeCheckingMode=all` uses `capture-pyright.json`; the only additional diagnostic exception is `reportPrivateUsage=none`, because reusing frozen `_frames` is the explicitly authorized collection seam. It does not disable type checks or unknown-type checks.
- New-game land runtime seed is checked against the picker before time advancement. Mismatch raises; no fallback to fabricated metadata.
- River seeds 3–5 are unavailable through the actual game's native UI at the pinned commit: `src/ui/landChoice.ts:26-43` locks river seed 1. No state injection or synthetic save was used. River year1301 is only temporal holdout, not an unseen map.
- The river's declared seed 1 follows the default native new-game branch; unlike the 12 nonriver starts it is not separately read back into provenance by this helper. The native default branch and UI lock are its evidence.
- Playwright controls the browser clock, but normal simulation/input processes advance calendar, camera and walkers. This is image/motion collection, not a wall-clock performance benchmark.
- The collection plan and extra scenario addendum are each SHA256-fixed before their respective captures. Formatting/type improvements to helper scripts after starting the first run do not alter scene parameters or frozen detector code.
