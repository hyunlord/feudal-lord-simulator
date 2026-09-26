// playwright-core for the DGX (REMOTE-1). Chrome has no linux-arm64 build, so evidence scripts that launch with
// `channel: 'chrome'` get Playwright's own Chromium (FLS_CHROMIUM_PATH, installed by scripts/remote/setup-dgx.sh) instead.
// Everything else is playwright-core unchanged. remote-exec.sh sets PLAYWRIGHT_MODULE to this file and
// FLS_PLAYWRIGHT_CORE to the real playwright-core/index.mjs.
import { pathToFileURL } from 'node:url';

const corePath = process.env.FLS_PLAYWRIGHT_CORE;
if (!corePath) throw new Error('FLS_PLAYWRIGHT_CORE is not set (run through scripts/remote/run.sh)');
const core = await import(pathToFileURL(corePath).href);
const executablePath = process.env.FLS_CHROMIUM_PATH;

const withChromium = options => {
  if (!options?.channel?.startsWith('chrome') || !executablePath) return options;
  const { channel: _channel, ...rest } = options;
  return { ...rest, executablePath };
};

export const chromium = new Proxy(core.chromium, {
  get(target, property) {
    if (property === 'launch' || property === 'launchServer') return options => target[property](withChromium(options));
    if (property === 'launchPersistentContext') return (dir, options) => target.launchPersistentContext(dir, withChromium(options));
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
export const { firefox, webkit, devices, errors, request, selectors } = core;
export default { ...(core.default ?? core), chromium };
