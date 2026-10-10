# EB-INERT provisional save fixtures

Schema 57 is isolated prototype numbering. Engine integration owns the final number and must reconcile the TRACE-LINK/GROW migration chain before merging.

The standard fixtures in `manifest.json` preserve v56 states, re-encoded through the v56 → v57 migration; they are not new natural-growth runs. Reproduce them with:

```
node --import tsx scripts/buildSaveFixtures.ts --from-version 56
```

`eb-inert-pressure.save.json` is a prepared regression fixture. `prepare-eb-inert.ts` starts from the existing delegated-estate test helper, explicitly sets merchants to −100 and loyalty to 100, then uses the real charter refusal and audit tolerance reducers and one real stewardship season. It contains the remaining three seasons of both pressures, the unrecovered original amount, the realized income losses, and exact answer references on the existing seasonal receipt. It is not evidence of naturally occurring decisions, long-run frequency, or the 125-year gate.

```
node --import tsx fixtures/saves/v57/prepare-eb-inert.ts
node --import tsx scripts/saveSchemaFingerprint.ts --write
node --import tsx --test tests/stewardshipConsequencesSave.test.ts tests/saveSchemaFingerprint.test.ts
```

The fingerprint fixture list includes this state so optional pressure and loss-provenance paths are covered. The fingerprint algorithm is unchanged. Legacy saves do not gain inferred active pressures: the migration changes only the envelope version. Expired charter pressure may retain the retry deadline; exhausted audit pressures are removed by the engine.
