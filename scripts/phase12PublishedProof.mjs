import {
  assertAutoplayTenMinuteEvidence,
  assertFrameBudgetEvidence,
  assertGuidedFiveMinuteEvidence,
  assertHonestOneMinuteEvidence,
  assertPressPlayThirtySecondEvidence,
  parsePhase12PublishedProofArgs,
  PHASE12_PUBLISHED_URL,
  readCleanRevision,
} from "./phase12PublishedProofAssertions.mjs";
import { runPhase12PublishedProof } from "./phase12PublishedProofRunner.mjs";

export {
  assertAutoplayTenMinuteEvidence,
  assertFrameBudgetEvidence,
  assertGuidedFiveMinuteEvidence,
  assertHonestOneMinuteEvidence,
  assertPressPlayThirtySecondEvidence,
  parsePhase12PublishedProofArgs,
  PHASE12_PUBLISHED_URL,
  readCleanRevision,
  runPhase12PublishedProof,
};

if (isDirectRun()) {
  const result = await runPhase12PublishedProof(parsePhase12PublishedProofArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
