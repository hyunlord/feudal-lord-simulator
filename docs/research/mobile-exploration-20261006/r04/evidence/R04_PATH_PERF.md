# Pathfinding optimization plan (before edit)

2026-10-06. Scope: pathfinding implementation only; gameplay arithmetic, neighbor order, distance tie ordering (distance,y,x), routes, complete battle output must remain identical.

1. Save pre-change SHA and 200 golden battles: all5 terrains × training seeds1–5 ×4entries ×raid/siege, growth48, including damaged gate fixture. Save exact frozen inputs/results and output hashes before edit.
2. Capture existing training smoke timings with unchanged league.
3. Replace repeated string-key sorting and full tile/post scans per edge with per-route coordinate cost table + binary heap ordered distance,y,x. Never cache across mutable battle snapshots.
4. Deep-compare all200 entire battle results, run battle/league tests, rerun same training smoke. Fail on any outcome difference.

Before SHA256: pathfinding.ts d25164dd5953f8f521311fa6e944b1f12a0fcafa9ef16074ced35ae597de4616; battle.ts 5550f36d04a15227ddabfed9e358c1178376c7690ae7ac0897a408c5a6137860.

## Results and exact-output gate

Golden artifact: `path-golden-hashes.json` has all200 case hashes. `path-golden-before.json` and `path-golden-after.json` share aggregate result SHA256 **fe16267b5695e16c1119073ec130f8adb73cfe40b51aa7535b2d899e4a81c99e**. The exact (not only JSON-normalized) results were deepStrictEqual compared against the original implementation for all200 cases. Reconstruction of the original temporary modules was verified against both original source SHA values (`path-legacy-source-proof.json`). JSON alone erases -0, so comparison additionally executes original code and stores V8 exact golden data.

The first optimized trial dropped extra fields carried by the original entry Tile object in route[0]/trace. This failed the golden gate. The final route retains that exact original start object. No original gameplay bug was changed. Ledger negative zero was likewise preserved rather than normalized in implementation.

Per-route indexed cost tables + binary min-heap use distance then row-major index (=y,x); neighbor relaxation order stays north/west/east/south. Gate damage/guard scans during actual combat remain dynamic. There is no cross-snapshot route cache.

Isolated200-route batches, alternating order over5 repetitions (`path-isolated-timing.json`): legacy median86.876ms, optimized6.484ms (~13.4×). All200 isolated routes also deepStrictEqual. Whole training5-game smoke only improved3341.11→3112.06ms at this stage, showing routing was not the dominant remaining cost.

## Additional authorized immutable-record copy optimization

Leader then authorized profiling/copy optimization in battle.ts. `path-clone-timing.json`:400 copies legacy structuredClone median272.769ms vs mutable-branch copy3.606ms. City mutable branches (policy, stocks, market, services, households + skill records, facilities, tiles) are copied. The readonly initial stock baselines and deep-readonly ledger/receipt records are shared; ledger/receipt arrays themselves are new. Explicit City construction means newly added required City fields trigger a typecheck obligation. Readonly records must remain immutable.

After both optimizations, same5 training games totaled454.873ms vs3341.112ms (~7.35× faster;86.4% elapsed reduction). Cached growth telemetry forecast535.383→23.064ms; actual battle56.757→2.071ms. This is one local Mac training smoke, not a guarantee for all terrains/checkpoints/player counts or a mobile measurement. `path-smoke-before.json`, `path-smoke-after.json` (routing only), `path-smoke-after-clone.json` preserve the measurements. No held-out seeds were read, bot constants changed, or forecasts skipped.

Final strict TypeScript check passed; battle+league tests **14/14** passed (`path-tests-after.txt`). Added regression for tie order/entry object and advancing both resulting cities24steps without mutating either input, plus direct mutable tile/skills/services/policy isolation. All200 complete battle golden results still exact after clone optimization.

Final SHA256: pathfinding.ts **208e92edb059b0a13ee3d8d7b76fdd7896a3b5535de736e2180ed74fcce05162**; battle.ts **1910ac80e7e61934eae4c5beec5bb160ec141e37a3f6a7a3605cc14da6f12931**.

Temporary local golden files: `path-golden-temporary.json` (~107MB), `path-golden-exact-temporary.bin` (~96MB). **Exclude these from the light delivery ZIP**; retain small hashes/results/timings/proof documents. Reproduction drivers are `/tmp/astra-path-golden.ts`, `/tmp/astra-route-perf.ts`, `/tmp/astra-clone-perf.ts`; legacy modules `/tmp/astra-original-pathfinding.ts` and `/tmp/astra-original-battle.ts`. Every batch ran under5seconds in this observation; noDGX/newdependencies/source-repo changes.
