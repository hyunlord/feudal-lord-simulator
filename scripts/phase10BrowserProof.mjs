import {
  assertOmittedRoadFlow,
  assertPart6Playthrough,
  assertPlaythroughPreflight,
  parsePhase10BrowserProofArgs,
  readCleanRevision,
  summarizeFrameBudget,
} from "./phase10BrowserProofAssertions.mjs";
import { runPhase10BrowserProof } from "./phase10BrowserProofRunner.mjs";

export {
  assertOmittedRoadFlow,
  assertPart6Playthrough,
  assertPlaythroughPreflight,
  parsePhase10BrowserProofArgs,
  readCleanRevision,
  summarizeFrameBudget,
};

if (isDirectRun()) {
  const result = await runPhase10BrowserProof(parsePhase10BrowserProofArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
