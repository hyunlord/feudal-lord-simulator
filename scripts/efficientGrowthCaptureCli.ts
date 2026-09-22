import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { closeChrome, createCdpClient, createTarget, defaultChromePath, launchChrome, waitForChrome } from './phase13Part7BuildMenuProofChrome';
import { finalizeEfficientGrowth } from './efficientGrowthFinalize';

export async function captureEfficientGrowth(directory: string, origin: string, port: number) {
  const raw = readFileSync(resolve(directory, 'final-state.json'), 'utf8');
  const receiptPath = resolve(directory, 'capture-result.json');
  if (existsSync(receiptPath)) throw new Error('Capture receipt already exists; preserve original evidence');
  const chrome = await launchChrome({ chromePath: process.env.CHROME_PATH ?? defaultChromePath(), remoteDebuggingPort: port,
    userDataPrefix: 'efficient-growth-capture-' });
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
        try {
          ready = await client.evaluate(`location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, false) === true;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('navigated')) throw error;
        }
      }
      if (!ready) throw new Error('Capture document did not load');
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
      const response = await client.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        await new Promise(resolve => document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true }));
        const { captureEfficientCity } = await import('/scripts/efficientGrowthCapture.ts');
        return captureEfficientCity(JSON.parse(${JSON.stringify(raw)}));
      })()` });
      const envelope = response.result;
      if (typeof envelope !== 'object' || envelope === null || !('result' in envelope) || 'exceptionDetails' in envelope) {
        throw new Error(`Capture evaluation failed: ${JSON.stringify(response)}`);
      }
      const remote = envelope.result;
      if (typeof remote !== 'object' || remote === null || !('value' in remote)) throw new Error('Capture returned no value');
      writeFileSync(receiptPath, JSON.stringify(remote.value));
    } finally { client.close(); }
  } finally { await closeChrome(chrome); }
  return finalizeEfficientGrowth(directory, receiptPath);
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const origin = process.argv[3];
  const port = Number(process.argv[4] ?? 9371);
  if (directory === undefined || origin === undefined || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new RangeError('Usage: efficientGrowthCaptureCli.ts outputDirectory http://127.0.0.1:VITEPORT [unusedChromePort=9371]');
  }
  const result = await captureEfficientGrowth(directory, origin, port);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'passed') process.exitCode = 1;
}
