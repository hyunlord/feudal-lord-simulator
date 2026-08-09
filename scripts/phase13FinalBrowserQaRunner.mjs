import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";
import { assertPhase13FinalBrowserQaEvidence } from "./phase13FinalBrowserQaAssertions.mjs";
import { createPhase13ErrorCollector } from "./phase13FinalBrowserQaErrors.mjs";
import { makePhase13FailureEvidence } from "./phase13FinalBrowserQaFailure.mjs";
import { verifyPhase13GithubDeployment } from "./phase13FinalBrowserQaGithub.mjs";
import { runPhase13BrowserScenarios } from "./phase13FinalBrowserQaScenarios.mjs";

export async function runPhase13FinalBrowserQa(config) {
  let onlineVerification = null;
  let result = null;
  try {
    onlineVerification = await verifyPhase13GithubDeployment({
      proof: config.deploymentProof,
      publicUrl: config.publicUrl,
      revision: config.revision,
      token: config.token,
    });
    result = await runWithChrome({ ...config, deploymentProof: { ...config.deploymentProof, onlineVerification } });
    await writeEvidence(config.out, result);
  } catch (error) {
    await writeEvidence(config.out, makePhase13FailureEvidence(config, error, { onlineVerification }));
    throw error;
  }
  try {
    assertPhase13FinalBrowserQaEvidence(result);
  } catch (error) {
    await writeEvidence(config.out, makePhase13FailureEvidence(config, error, { onlineVerification, ...result }));
    throw error;
  }
  return result;
}

async function runWithChrome(config) {
  const chromeSession = await launchChrome({
    chromePath: config.chromePath,
    remoteDebuggingPort: config.chromePort,
    userDataPrefix: "phase13-final-qa-chrome-",
    extraArgs: chromeSandboxArgs(),
  });
  try {
    await waitForChrome(config.chromePort, chromeSession.stderr);
    const target = await createTarget(config.chromePort);
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await enableBrowserDomains(client);
      await mkdir(config.screenshotDir, { recursive: true });
      const errors = await createPhase13ErrorCollector(client);
      try {
        const scenarios = await runPhase13BrowserScenarios(client, config);
        const observedErrors = await errors.read();
        return buildEvidence(config, scenarios, observedErrors);
      } finally {
        errors.dispose();
      }
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

export function chromeSandboxArgs(uid = process.getuid?.()) {
  return uid === 0 ? ["--no-sandbox"] : [];
}

async function enableBrowserDomains(client) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");
}

function buildEvidence(config, scenarios, errors) {
  return {
    schemaVersion: 1,
    verdict: scenarios.frameProfile.failures.length === 0 && isErrorFree(errors) ? "PASS" : "FAIL",
    publicUrl: config.publicUrl,
    revision: config.revision,
    deploymentProof: config.deploymentProof,
    ...scenarios,
    errors,
  };
}

function isErrorFree(errors) {
  return errors.console.length === 0 &&
    errors.page.length === 0 &&
    errors.resource.length === 0 &&
    errors.network.length === 0 &&
    errors.log.length === 0 &&
    errors.runtime.length === 0;
}

async function writeEvidence(out, evidence) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`);
}
