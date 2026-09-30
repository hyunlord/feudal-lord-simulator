# UI-AUDIT-1 frame tokens: skin audit (DGX)

Run `render-UIAUDIT-tokens-361348f` (2026-09-30, DGX, `scripts/uiauditTokensVerification.sh 4bd84c52`: UI-6's skin audit
set, this build at 361348f beside the trunk 4bd84c52).

- `audit.json`: this build, every block (UI-5 … UI-10 states, the gallery): 1271 elements, **0 skinless, 0 native,
  0 frameless**, 0 errors, nothing missing.
- `audit-base.json`: the trunk, UI-5 states: 767 elements, 0 skinless.
- `sheet-desktop.jpg`: every state's capture (downscaled).

The first two tries (c72579c, 28240d6) audited nothing: the run's Vite died at start with ENOSPC (65536 inotify watches;
with-base-build.sh keeps the base worktree inside the watched run folder). The run script keeps it in /tmp instead.
Before / after crops of four framed surfaces: `../tokens-shots/` (`captures.json` has each one's computed border and
padding; the goal chip is not in a tutorial-off save, so the objective frame is shown from the kit gallery).
