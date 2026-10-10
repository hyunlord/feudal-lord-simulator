# EB-TLINK saturated charter refusal audit (offline, source 23d1226)

- Official measured run: `engineB-tlink-audit125-23d1226`, seeds 1–3, 125 years each, all original manifests valid/replayVerified.
- Mature core `charter_request / refuse` answers with actual merchant relation −100 → −100: **127 = 17 + 61 + 49**. Additional censored answers: **6 = 2 + 0 + 4**. All 133 have zero future own-ID receipts in the original strict window.
- Exact rows and answer-time petition payload/evidence: `tlink-inert-23d-charter.json`, SHA256 `9692d538c0d8dbe6d98408287bf695affdefb314421438eca42f4c792575f1b6`.
- Reproducer: `python3 .omo/evidence/tlink-inert-23d-charter.py`, SHA256 `24421a53c5122847ec51ff7b0b87526329e50a18464e8cc4c5f3c8e980f131e3`.

## Effects excluded before calling these inert

Frozen `src/engine/stewardship.ts:175–188` defines refused charter income 0, tenants 0, merchants −8, neglect false, kept 0. `answerEstatePetition`, lines 471–499, executes no cash posting or neglect action for this branch; it changes no rights, land, person, or persistent order field. Every row's recorded petition payload is identical before/after except status and decidedBy. In particular `rights:true` is an unchanged categorization/escalation flag, not a newly granted right. **No additional rights-changing answers are present among the 127**, so excluding such answers does not reduce this exact count. The prior 86 zero-relation repair/relief grants are not in this set: their positive amount causes real negative cash posting and they cannot be called inert merely because relation clamps.

The measured scalar is merchant relation. Zero on other substantive fields follows the exhaustively bounded pinned handler, not a retained full-state diff and not absence of a history receipt. Parent is preparing a command-time full-state replay to corroborate broader classifications.

## Settlement remains explicitly visible

Each answer still changes petition `open → refused` and adds `decidedBy:lord`, appends history/trace, and increments settlement-derived registry inputs. It leaves the open list (`stewardship.ts:437–439`) and is not eligible for later open-petition lapse (`293–300`). These facts prohibit describing the **entire GameState** as unchanged. They do not grant rights, alter a standing command, or show an actual numeric effect; under the user's new explicit 'processing record alone is not (가)' rule and saturated-charter example, these are processing settlement accompanying an inert domain effect. Do not silently reclassify these as (가) merely because petition status changed. Any future counterfactual avoidance needs its own proof; it is not an observed receipt here.

## Representatives

| Seed | Answer ID | Tick | Ordinal | Petition | Amount | Merchants |
|---|---|---:|---:|---|---:|---|
| 1 | h-014460 | 219025 | 1774 | estate-petition-309 | 56 | −100 → −100 |
| 2 | h-005045 | 66067 | 600 | estate-petition-62 | 70 | −100 → −100 |
| 3 | h-004304 | 91027 | 530 | estate-petition-100 | 95 | −100 → −100 |

All three estates are `estate-neighbour-3`; grants are false and rights is already true. Full source/input pins and all 133 rows are in JSON. Seed 17 is the user's reported example, **not independently measured by this audit**.

## Engine handoff boundary

Core charter-request generation/choice effects are engine-owned. Engine should prevent repeatedly presenting a costly lord decision whose permitted domain effects are saturated, or provide canonical meaningful refusal consequences; this audit does not widen effects or alter rules. No registry-v4 adapter cases are claimed here. No new runtime experiment or simulation was launched by this audit.

## Provenance correction after independent review

The reproducer now additionally pins the frozen `src/state/gameStore.ts`, `src/engine/factions.ts`, `src/engine/decisionTrace.ts`, and `src/engine/decisionTraceAnswerReceipts.ts` bytes against every seed manifest. These complete the reviewed reducer/history/faction/trace pipeline provenance. All eight source pins match the three official manifests. Counts and all 133 evidence rows are unchanged. The previous JSON is retained as `tlink-inert-23d-charter.previous.json`; no engine code or runtime evidence was changed.
