import {
  closeChrome,
  createCdpClient,
  createTarget,
  defaultChromePath,
  launchChrome,
  waitForChrome,
} from "./phase13Part7BuildMenuProofChrome.js";
import { measureScenarios } from "./phase13Part7BuildMenuProofMeasurements.js";

async function main(): Promise<void> {
  const chromePath = process.env.CHROME_PATH ?? defaultChromePath();
  const remoteDebuggingPort = Number.parseInt(process.env.PART7_PROOF_CHROME_PORT ?? "9337", 10);
  const chromeSession = await launchChrome({
    chromePath,
    remoteDebuggingPort,
    userDataPrefix: "phase13-part7-build-menu-proof-",
    extraArgs: ["--no-sandbox"],
  });

  try {
    await waitForChrome(remoteDebuggingPort, chromeSession.stderr, {
      chrome: chromeSession.chrome,
      maxAttempts: 180,
      pollMs: 100,
    });
    const target = await createTarget(remoteDebuggingPort, "about:blank");
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      const proof = await measureScenarios(client);
      process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
      if (proof.verdict !== "PASS") {
        throw new Error(`Part7 browser build-menu proof failed: ${proof.failures.join("; ")}`);
      }
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

await main();
