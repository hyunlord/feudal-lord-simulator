import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";
import { runScenario } from "./phase12PublishedProofScenarios.mjs";

export async function runPhase12PublishedProof(config) {
  const chromeSession = await launchChrome({
    chromePath: config.chromePath,
    remoteDebuggingPort: config.chromePort,
    userDataPrefix: "phase12-proof-chrome-",
    extraArgs: ["--no-sandbox"],
  });
  try {
    await waitForChrome(config.chromePort, chromeSession.stderr);
    const target = await createTarget(config.chromePort);
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const result = await runScenario(client, config);
      await mkdir(path.dirname(config.out), { recursive: true });
      await writeFile(config.out, `${JSON.stringify(result, null, 2)}\n`);
      return result;
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}
