# Independent hands-on QA / visual Pass A

Status: PASS — bounded road/wall rendering, natural-growth evidence, and actual browser road delete/rebuild checks.

## Evidence reviewed

- `capture-town.mjs`: loads an engine-grown state only through the isolated browser's initial state module response; uses real UI road-tool clicks and real inspector text. No product files or state mutation API are used for road removal/rebuilding. HMR is closed to avoid changing source during a capture.
- `verify-interactions.mjs`: actual reducer road actions, 401 real simulation ticks for deterioration, actual road replacement, and a required fresh post-repair `lastServicedTick` plus positive food and L4. This avoids treating road repair alone as delivery proof.
- `occlusion/after.png`: opened and visually inspected. Rear road stripes are absent from roofs; normal hovered and dense houses remain opaque; the front-wall case preserves ordinary depth occlusion. Compound house silhouette remains readable.
- `occlusion/matrix.json` and README: 240 fixtures are clearly labeled synthetic, use actual renderer/assets, and quantify opaque interior pixels with edge erosion. Software-Chrome stress results are not claimed as universal GPU parity or performance.
- `docs/TOWN_SYSTEMS_V2.md`: clearly distinguishes snapshot browser rendering from full browser growth; market service/export from food delivery; service allocation from individual citizen visits; existing invalid saves are not silently relocated.

## Independent browser execution

Command: `node output/town-systems-v2/capture-town.mjs output/town-systems-v2/growth/final-state.json independent-qa house-46-40-0 interactive`.

Exit 0. Default GPU Chrome, 1600×1100. Loaded natural tick415877 state, then used the actual road tool to delete three access roads and replace them. Real Korean inspector reported both market/church disconnected, then both available. Tick stayed paused at415877; population remained256. No browser page errors. Evidence: `independent-qa-overview.png`, `independent-qa-house.png`, `independent-qa-ui-disconnected.png`, `independent-qa-ui-restored.png`, and `evidence/independent-qa-browser.json`.

Opened all four PNGs. Normal houses are opaque; no normal road strips run through roofs. Rear walls remain behind the housing. Korean labels and complete house inspector remain readable, with no inspector/menu collision at this tested viewport. The disconnected screen's translucent placement/diagnostic highlight is intentional and must not be mislabeled as a normal road painted over a house.

## Natural growth and recovery cross-check

Read final current-source report: unchanged DEFAULT_GAME_STATE; real advisor/reducer/advanceTick; tick415877, population256, eight L4 houses each32 residents and12 bread; water/market/church8/8; sustained12000 ticks; no rejected advisor actions or invalid negative/nonfinite storage ledgers. This is engine growth evidence, not a claim that the entire run was performed by browser clicks.

Read refreshed actual-engine interaction report: road deletion at415877 makes market/church unreachable; tick416278 shows living L3 and builtLevel4; rebuilt roads restore service; tick416301 has L4, bread12, fresh delivery timestamp416301. Recovery took23 additional ticks after repair. This trace proves fresh food arrived, rather than merely inferring delivery from restored road connectivity.

## Remaining limitations

- Initial isolated-snapshot overview briefly shows stale onboarding '우물을 지어 물을 공급하세요' although water8/8. After actual selection, UI updates to '기초 운영 완료'. Capture presentation caveat was reported to root; house/restored images are internally consistent.
- Visual naturalness still includes highly regular plots, repeated assets, and rougher wall/gate art; these are outside this bounded rendering and systems change.
- Only the stated desktop browser viewport was manually inspected here. The240 renderer matrix fixtures cover other render scales, not responsive UI layout.
- No universal hardware/GPU parity, large-city FPS, or independently repeated full415877-tick simulation claim is made.
- Earlier520000-tick captures are not evidence of sustained food stability and are not the final reviewed result.
