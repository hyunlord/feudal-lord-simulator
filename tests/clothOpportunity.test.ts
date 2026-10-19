/**
 * CLOTH-1 (the user's ruling 2026-10-19, lord mode): before the cloth's time (`clothTime`, 1364 in lord mode, decision
 * CL7) the merchants' opportunities propose no cloth building, though the revenue policy backs them; from it they may.
 * The state: seed 1 at its charter, 1317 (lord slice, natural save, `fixtures/charter/seed1-1317-charter.save.json.gz`), no
 * cloth building yet, its policy set to revenue.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { CLOTH_OPPORTUNITY_KINDS } from "../src/content/townAgencyConfig";
import { clothTime } from "../src/engine/autoplayCloth";
import type { GameState } from "../src/engine/engine.types";
import { townProposals } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const saved = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed1-1317-charter.save.json.gz")))).envelope.state as GameState;
const revenue: GameState = { ...saved, agency: { ...saved.agency!, policy: "revenue" } };
const clothProposals = (state: GameState) => townProposals(state).filter(proposal => (CLOTH_OPPORTUNITY_KINDS as readonly string[]).includes(proposal.what));

test("CLOTH-1: before the cloth's time the revenue policy brings no cloth building among the town's proposals", () => {
  assert.equal(clothTime(revenue), false);
  assert.deepEqual(clothProposals(revenue).map(proposal => proposal.what), []);
});

test("CLOTH-1: from the cloth's time (1364) the same town proposes them again", () => {
  const later: GameState = { ...revenue, tick: (1364 - 1300) * 4_000 };
  assert.equal(clothTime(later), true);
  assert.ok(clothProposals(later).length > 0, "a cloth opportunity once its time has come");
});
