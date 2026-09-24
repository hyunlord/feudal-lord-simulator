import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { closeChrome, createCdpClient, createTarget, defaultChromePath, launchChrome, waitForChrome } from './phase13Part7BuildMenuProofChrome';

/** Product-renderer state replay only. Never evaluates growth acceptance or advances ticks. */
export async function captureGrowthState(directory: string, origin: string, port: number) {
  const raw = readFileSync(resolve(directory, 'final-state.json'), 'utf8');
  const stateHash = createHash('sha256').update(JSON.stringify(JSON.parse(raw))).digest('hex');
  const imagePath = resolve(directory, 'final-city.jpg');
  const receiptPath = resolve(directory, 'capture.json');
  if (existsSync(imagePath) || existsSync(receiptPath)) throw new Error('Capture already exists; preserve original evidence');
  const chrome = await launchChrome({ chromePath: process.env.CHROME_PATH ?? defaultChromePath(), remoteDebuggingPort: port, userDataPrefix: 'growth-state-capture-' });
  try {
    await waitForChrome(port, chrome.stderr, { chrome: chrome.chrome });
    const pageUrl = new URL('/scripts/efficientGrowthCapture.html', origin).href;
    const target = await createTarget(port, 'about:blank');
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send('Page.navigate', { url: pageUrl });
      let ready = false;
      for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
        await delay(50);
        try { ready = await client.evaluate(`location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, false) === true; }
        catch (error) { if (!(error instanceof Error) || !error.message.includes('navigated')) throw error; }
      }
      if (!ready) throw new Error('Capture document did not load');
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
      const response = await client.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        const { captureEfficientCity } = await import('/scripts/efficientGrowthCapture.ts');
        return captureEfficientCity(JSON.parse(${JSON.stringify(raw)}));
      })()` });
      const envelope = response.result;
      if (typeof envelope !== 'object' || envelope === null || !('result' in envelope) || 'exceptionDetails' in envelope) throw new Error(`Capture evaluation failed: ${JSON.stringify(response)}`);
      const remote = envelope.result;
      if (typeof remote !== 'object' || remote === null || !('value' in remote) || typeof remote.value !== 'object' || remote.value === null || Array.isArray(remote.value)) throw new Error('Capture returned no object');
      const captured: Record<string, unknown> = Object.fromEntries(Object.entries(remote.value));
      const { jpeg, ...metadata } = captured;
      if (captured.stateSha256 !== stateHash) throw new Error('Renderer receipt does not match final-state.json');
      if (typeof jpeg !== 'string' || !jpeg.startsWith('data:image/jpeg;base64,')) throw new Error('Capture returned no JPEG');
      const bytes = Buffer.from(jpeg.slice('data:image/jpeg;base64,'.length), 'base64');
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('Invalid JPEG bytes');
      const assetFailures = captured.assetFailures;
      if (!Array.isArray(assetFailures)) throw new Error('Capture returned no asset loading evidence');
      const result = { ...metadata, filename: 'final-city.jpg', jpegSha256: createHash('sha256').update(bytes).digest('hex'),
        status: captured.assetsLoaded === true && assetFailures.length === 0 ? 'captured' : 'asset-loading-failed',
        classification: 'Product renderer replay of unmodified recorded state; not live UI play; no growth acceptance judgment' };
      writeFileSync(imagePath, bytes);
      writeFileSync(receiptPath, JSON.stringify(result, null, 2));
      return result;
    } finally { client.close(); }
  } finally { await closeChrome(chrome); }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const origin = process.argv[3];
  const port = Number(process.argv[4] ?? 9371);
  if (directory === undefined || origin === undefined || !Number.isInteger(port) || port < 1024 || port > 65535) throw new RangeError('Usage: growthStateRecordCapture.ts directory viteOrigin [unusedChromePort=9371]');
  const result = await captureGrowthState(directory, origin, port);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'captured') process.exitCode = 1;
}
