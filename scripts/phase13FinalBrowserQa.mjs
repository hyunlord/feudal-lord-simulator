import { assertPhase13FinalBrowserQaEvidence } from "./phase13FinalBrowserQaAssertions.mjs";
import { parsePhase13FinalBrowserQaArgs, readCleanRevision } from "./phase13FinalBrowserQaConfig.mjs";
import { PHASE13_SCREENSHOT_IDS } from "./phase13FinalBrowserQaConstants.mjs";
import { makePhase13FailureEvidence } from "./phase13FinalBrowserQaFailure.mjs";
import { summarizePhase13FrameProfile } from "./phase13FinalBrowserQaFrame.mjs";
import { verifyPhase13GithubDeployment } from "./phase13FinalBrowserQaGithub.mjs";
import { runPhase13FinalBrowserQa } from "./phase13FinalBrowserQaRunner.mjs";

export {
  assertPhase13FinalBrowserQaEvidence,
  makePhase13FailureEvidence,
  parsePhase13FinalBrowserQaArgs,
  PHASE13_SCREENSHOT_IDS,
  readCleanRevision,
  runPhase13FinalBrowserQa,
  summarizePhase13FrameProfile,
  verifyPhase13GithubDeployment,
};

if (isDirectRun()) {
  try {
    const result = await runPhase13FinalBrowserQa(parsePhase13FinalBrowserQaArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
