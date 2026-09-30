// FIX-10 diagnosis: what the bot's food step decides while the granaries run down. Every season in [firstYear,
// lastYear]: the bot's next action with its food diagnostic, the measured food decision and the grain need.
// tsx scripts/perf/foodDecisionProbe.ts <archetypeId> <seed> [firstYear] [lastYear]
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { decideNextAction } from "../../src/engine/autoplay";
import type { FoodDiagnosticCollector } from "../../src/engine/autoplayFoodDiagnostic";
import { measuredFoodDecision } from "../../src/engine/autoplayFoodMeasuredDecision";
import { annualWheatNeed, arableSupplyShort, untendedArableCells } from "../../src/engine/autoplayArable";
import { foodEfficiencyMetrics } from "../../src/engine/autoplayFoodEfficiency";
import { foodFacilityCount, foodFacilityWithinLimit } from "../../src/engine/autoplayFoodLimits";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:coastal_port", seedText = "3", firstText = "1362", lastText = "1372"] = process.argv.slice(2);
const first = Number(firstText);
const last = Number(lastText);
class Stop extends Error {}
let seen = -1;

try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * 4000, seed: Number(seedText), archetypeId, onTick: (state: GameState) => {
    const { year, season } = stateCalendar(state);
    if (year > last) throw new Stop();
    const key = year * 4 + season;
    if (year < first || key === seen) return;
    seen = key;
    const collector: FoodDiagnosticCollector = {};
    const action = decideNextAction(state, { maxHousingLots: 24 }, collector);
    const sample = foodEfficiencyMetrics(state);
    const food = collector.food;
    process.stdout.write(`${JSON.stringify({
      year, season, pop: state.population, era: state.era,
      next: JSON.stringify(action).slice(0, 160),
      food: food === undefined ? null : { reached: food.reached, reason: food.reason, counts: food.counts, recovery: food.recovery, evaluation: food.evaluation, observation: food.observation },
      measured: measuredFoodDecision(state), grainShort: arableSupplyShort(state), wheatNeed: annualWheatNeed(state),
      untended: untendedArableCells(state).length, farmsteads: foodFacilityCount(state, "farmstead"), mills: foodFacilityCount(state, "mill"),
      millOk: foodFacilityWithinLimit(state, "mill"), granaryOk: foodFacilityWithinLimit(state, "granary"),
      window: { full: sample.fullWindow, produced: sample.breadProduced, requested: sample.requestedBread, consumed: sample.consumedBread, exported: sample.breadExported,
        wheatProduced: sample.wheatProduced, wheatConsumed: sample.wheatConsumed, starved: sample.rawStarvedTicks, millTicks: sample.eligibleMillTicks },
      arable: (state.zones ?? []).filter(zone => zone.kind === "arable").reduce((sum, zone) => sum + zone.membership.length, 0),
    })}\n`);
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
