// TEST-1: every timer wakes 30 ms late, as on a busy machine (the DGX while other sessions run). Preloaded into a test
// run (`tsx --import ./scripts/test1LateTimers.mjs --test …`) it turns a real-time wait into an overshoot on demand.
const late = globalThis.setTimeout;
globalThis.setTimeout = (callback, ms = 0, ...rest) => late(callback, ms + 30, ...rest);
