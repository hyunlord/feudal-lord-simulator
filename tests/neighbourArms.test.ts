/**
 * LM-R2-E ①: every neighbouring lord's house has exact arms that keep the project's conventions — no ermine (an earl's
 * house or the Crown only), no royal combination, the rule of tincture — each coat its own, read in Korean.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { NEIGHBOUR_SURNAMES } from "../src/content/gentryNames";
import { METALS, NEIGHBOUR_ARMS, neighbourArms, type Tincture } from "../src/content/neighbourArms";
import { NEIGHBOUR_ARMS_KO } from "../src/content/neighbourArmsCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { initialAgency } from "../src/engine/townAgency";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { newGameState } from "../src/state/newGame";

test("every neighbouring house's name has its coat and its Korean reading; no two coats alike", () => {
  for (const name of NEIGHBOUR_SURNAMES) {
    assert.ok(neighbourArms(name) !== null, `${name} has arms`);
    assert.ok((NEIGHBOUR_ARMS_KO[name] ?? "").length > 0, `${name} is read in Korean`);
  }
  assert.deepEqual(Object.keys(NEIGHBOUR_ARMS).sort(), [...NEIGHBOUR_SURNAMES].sort());
  const coats = Object.values(NEIGHBOUR_ARMS).map(coat => JSON.stringify({ ...coat, en: "" }));
  assert.equal(new Set(coats).size, coats.length);
  assert.equal(neighbourArms("de Haverel"), null, "the player's house is not a neighbour's");
});

test("the conventions: no ermine, no royal combination, a metal on a colour or a colour on a metal", () => {
  const contrasts = (a: Tincture, b: Tincture) => METALS.has(a) !== METALS.has(b);
  for (const [name, coat] of Object.entries(NEIGHBOUR_ARMS)) {
    const tinctures = [coat.field, coat.ordinary?.tincture, coat.charges?.tincture].filter((value): value is Tincture => value !== undefined);
    assert.ok(!tinctures.includes("ermine"), `${name}: ermine is an earl's or the Crown's`);
    assert.ok(!(coat.field === "gules" && coat.charges?.kind === "lion" && coat.charges.tincture === "or"), `${name}: the royal lions`);
    assert.ok(!(coat.field === "azure" && coat.charges?.kind === "fleur-de-lis" && coat.charges.tincture === "or"), `${name}: the royal lilies`);
    if (coat.ordinary !== undefined) assert.ok(contrasts(coat.field, coat.ordinary.tincture), `${name}: the ordinary on its field`);
    // A charge lies on the field (around the ordinary): it contrasts with the field.
    if (coat.charges !== undefined) assert.ok(contrasts(coat.field, coat.charges.tincture), `${name}: the charges on the field`);
  }
});

test("the neighbour estates' houses in a new lord-mode game all have arms (the old lord's house included)", () => {
  const state = { ...newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!, agency: initialAgency() } as GameState;
  const houses = estatesOf(state).estates.filter(estate => estate.offMap && estate.house !== undefined).map(estate => estate.house!.name);
  assert.ok(houses.length >= 3);
  for (const name of houses) assert.ok(neighbourArms(name) !== null, `${name} has arms`);
});
