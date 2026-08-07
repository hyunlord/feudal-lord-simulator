import {
  closeChrome,
  createCdpClient,
  createTarget,
  frames,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";

if (isDirectRun()) {
  await main();
}

async function main() {
  const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const baseUrl = process.env.PROOF_URL ?? "http://127.0.0.1:3200";
  const revision = readProofRevision(process.env);
  const hostLabel = process.env.PROOF_HOST_LABEL ?? "local";
  const remoteDebuggingPort = Number.parseInt(process.env.PROOF_CHROME_PORT ?? "9229", 10);
  const chromeSession = await launchChrome({
    chromePath,
    remoteDebuggingPort,
    userDataPrefix: "phase8-task10-chrome-",
  });

  try {
    await waitForChrome(remoteDebuggingPort, chromeSession.stderr);
    const target = await createTarget(remoteDebuggingPort);
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
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: "localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1', 'true');",
      });
      await navigate(client, baseUrl);
      await waitForCanvas(client);
      const initial = await stableCanvasHash(client);
      const away = await panAwayAndBack(client, {
        fromX: 640,
        fromY: 360,
        toX: 760,
        toY: 430,
      });
      const restored = await stableCanvasHash(client);
      if (initial.hash === away.hash) {
        throw new Error("pan-away canvas hash did not change");
      }
      if (initial.hash !== restored.hash) {
        throw new Error(`pan-back hash mismatch: initial=${initial.hash} restored=${restored.hash}`);
      }
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        hostLabel,
        revision,
        baseUrl,
        userAgent: await userAgent(client),
        viewport: { width: 1280, height: 720 },
        initial,
        away,
        restored,
        identity: initial.hash === restored.hash,
        awayChanged: initial.hash !== away.hash,
      }, null, 2)}\n`);
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await frames(8);
}

async function waitForCanvas(client) {
  await client.evaluate(`(async () => {
    for (let i = 0; i < 120; i += 1) {
      const canvas = document.querySelector("canvas.game-canvas");
      if (canvas !== null && canvas.width > 0 && canvas.height > 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("game canvas did not become ready");
  })()`, true);
  await frames(12);
}

async function stableCanvasHash(client) {
  let previous = await canvasHash(client);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await frames(12);
    const next = await canvasHash(client);
    if (next.hash === previous.hash) return next;
    previous = next;
  }
  throw new Error(`canvas hash did not settle; last=${previous.hash}`);
}

async function panAwayAndBack(client, input) {
  return client.evaluate(`(async () => {
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2d context missing");
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const hashCanvas = () => {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      let hash = 2166136261;
      let visiblePixels = 0;
      for (let index = 0; index < image.data.length; index += 4) {
        hash ^= image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16) + (image.data[index + 3] << 24);
        hash = Math.imul(hash, 16777619) >>> 0;
        if (image.data[index + 3] !== 0) visiblePixels += 1;
      }
      return {
        hash: hash.toString(16).padStart(8, "0"),
        width: canvas.width,
        height: canvas.height,
        visiblePixels,
      };
    };
    const keyOptions = { key: " ", code: "Space", bubbles: true, cancelable: true };
    window.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      button: 0,
      buttons: 1,
      clientX: ${input.toX},
      clientY: ${input.toY},
      bubbles: true,
      cancelable: true,
    }));
    await frame();
    await frame();
    const away = hashCanvas();
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      button: 0,
      buttons: 1,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    window.dispatchEvent(new MouseEvent("mouseup", {
      button: 0,
      buttons: 0,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    window.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
    return away;
  })()`, true);
}

async function canvasHash(client) {
  return client.evaluate(`(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2d context missing");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    let visiblePixels = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      hash ^= image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16) + (image.data[index + 3] << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
      if (image.data[index + 3] !== 0) visiblePixels += 1;
    }
    return {
      hash: hash.toString(16).padStart(8, "0"),
      width: canvas.width,
      height: canvas.height,
      visiblePixels,
    };
  })()`, true);
}

async function userAgent(client) {
  return client.evaluate("navigator.userAgent", false);
}

export function readProofRevision(env) {
  const value = env.PROOF_REVISION ?? env.PHASE8_REVISION ?? "";
  const normalized = value.trim();
  if (!/^[0-9a-f]{40}$/i.test(normalized)) {
    throw new Error("Set PROOF_REVISION or PHASE8_REVISION to a clean 40-hex revision.");
  }
  return normalized;
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
