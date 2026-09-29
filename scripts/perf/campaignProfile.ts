// SMOOTH-2E: a CPU profile of one calendar year of a campaign run (the growth bot and the ticks), from `fromYear`.
//   tsx scripts/perf/campaignProfile.ts <archetypeId> <seed> <fromYear> <out.cpuprofile>
import { writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { stateCalendar } from "../../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:fen_drainage", seedText = "1", fromText = "1360", out = "campaign.cpuprofile"] = process.argv.slice(2);
const from = Number(fromText);
const session = new Session();
session.connect();
let profiling = false;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (from - 1300 + 2) * 4000, seed: Number(seedText), archetypeId, onTick: state => {
    const year = stateCalendar(state).year;
    if (!profiling && year >= from) {
      profiling = true;
      session.post("Profiler.enable");
      session.post("Profiler.setSamplingInterval", { interval: 1000 });
      session.post("Profiler.start");
    } else if (profiling && year > from) {
      session.post("Profiler.stop", (error, result) => { if (error === null) writeFileSync(out, JSON.stringify(result.profile)); });
      throw new Stop();
    }
  }, additionalAcceptance: state => stateCalendar(state).year > from });
} catch (error) { if (!(error instanceof Stop)) throw error; }
