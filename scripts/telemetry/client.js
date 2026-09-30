// Always-on performance telemetry of the dev build (user decision 2026-09-30), injected by scripts/telemetry/vitePlugin.ts
// before the app's own module. Nothing is thrown away: every 10 s window is sent with the conditions it ran under, and
// scripts/telemetry/report.ts splits the samples by those conditions. Kept cheap (≤ 1 %): one rAF callback that files
// the interval into a histogram, the browser's Long Animation Frame entries (≥ 50 ms), a heap read once a second,
// counters on canvas / bitmap creation, and one POST per window. No game code is touched; game-side hooks
// (zoom, cache rebuilds by name) are requested from the render session (docs/requests/render-telemetry-hooks.md).
(() => {
  if (window.__flsTelemetry) return;
  const ENDPOINT = "/@fls-telemetry/sample";
  const BUCKETS = [9, 17, 25, 33, 50, 100, 250, Infinity];   // frame interval upper bounds, ms
  const session = Math.random().toString(36).slice(2, 10);
  const fresh = () => ({ start: performance.now(), histogram: BUCKETS.map(() => 0), frames: 0, sum: 0, max: 0, over33: 0, over50: 0,
    longFrames: [], heap: { first: null, last: null, rises: 0, falls: 0, gcs: 0, max: 0 }, made: { canvas: 0, offscreen: 0, bitmap: 0, getImageData: 0 },
    moments: { season: 0, autosave: 0, dialog: 0 }, events: {}, selfMs: 0, hidden: 0, blurred: 0, speeds: {}, marks: [] });
  let win = fresh(); let last = null;
  window.__flsTelemetry = { session, current: () => win };
  // The render session's hooks (docs/requests/render-telemetry-hooks.md): named events such as a cache rebuild
  // (`globalThis.__flsTelemetryEvent?.("groundChunk.rebuild")`) and the camera zoom (`window.__FLS_TELEMETRY_ZOOM__`).
  window.__flsTelemetryEvent = (name) => { win.events[name] = (win.events[name] ?? 0) + 1; };

  // Its own cost, measured: every handler below adds its time to selfMs (sent per window; the report shows ms/s).
  const now = () => performance.now();
  const frame = (t) => {
    const t0 = now();
    if (last !== null && document.visibilityState === "visible") {
      const interval = t - last; win.frames += 1; win.sum += interval; if (interval > win.max) win.max = interval;
      let i = 0; while (interval >= BUCKETS[i]) i += 1; win.histogram[i] += 1;
      if (interval > 33) win.over33 += 1; if (interval > 50) win.over50 += 1;
    }
    last = t; requestAnimationFrame(frame); win.selfMs += now() - t0;
  };
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => { last = null; if (document.visibilityState === "hidden") win.hidden += 1; });
  window.addEventListener("blur", () => { win.blurred += 1; });

  // Long Animation Frames: which of our functions spent the frame (dev build: sourceURL is the src/ file).
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (win.longFrames.length >= 40) break;
        const scripts = (entry.scripts ?? []).slice().sort((a, b) => b.duration - a.duration).slice(0, 3).map((script) => ({
          fn: script.sourceFunctionName || script.invoker || "", url: String(script.sourceURL || "").replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, ""),
          ms: Math.round(script.duration), forcedLayoutMs: Math.round(script.forcedStyleAndLayoutDuration || 0) }));
        win.longFrames.push({ at: Math.round(entry.startTime - win.start), ms: Math.round(entry.duration), blockingMs: Math.round(entry.blockingDuration || 0),
          renderMs: Math.round(entry.duration - ((entry.renderStart || entry.startTime) - entry.startTime)), scripts });
      }
    }).observe({ type: "long-animation-frame", buffered: false });
  } catch { /* an older Chrome: frames only */ }

  // The JS heap once a second: rises are allocation, a fall of 1 MB or more a GC (performance.memory, Chrome).
  setInterval(() => {
    const t0 = now(); const used = performance.memory?.usedJSHeapSize; if (typeof used !== "number") return;
    const heap = win.heap; if (heap.first === null) heap.first = used;
    if (heap.last !== null) { const change = used - heap.last; if (change > 0) heap.rises += change; else if (change < -1e6) { heap.falls -= change; heap.gcs += 1; } }
    heap.last = used; if (used > heap.max) heap.max = used; win.selfMs += now() - t0;
  }, 1000);

  // Pixel owners made (a cache rebuilding makes them again) and pixel reads.
  const count = (kind) => { win.made[kind] += 1; };
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (name, options) { const element = createElement.call(this, name, options); if (String(name).toLowerCase() === "canvas") count("canvas"); return element; };
  if (globalThis.OffscreenCanvas) {
    const Offscreen = globalThis.OffscreenCanvas; const Wrapped = function OffscreenCanvas(w, h) { count("offscreen"); return new Offscreen(w, h); };
    Wrapped.prototype = Offscreen.prototype; globalThis.OffscreenCanvas = Wrapped;
    const transfer = Offscreen.prototype.transferToImageBitmap; Offscreen.prototype.transferToImageBitmap = function () { count("bitmap"); return transfer.call(this); };
  }
  const createBitmap = globalThis.createImageBitmap; if (createBitmap) globalThis.createImageBitmap = function (...args) { count("bitmap"); return createBitmap.apply(this, args); };
  for (const proto of [globalThis.CanvasRenderingContext2D?.prototype, globalThis.OffscreenCanvasRenderingContext2D?.prototype].filter(Boolean)) {
    const read = proto.getImageData; proto.getImageData = function (...args) { count("getImageData"); return read.apply(this, args); };
  }

  // Moments: an autosave (IndexedDB slot write), a season turn (the HUD date's season word), a dialog opening.
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) { if (this.name === "slots") { win.moments.autosave += 1; win.marks.push({ kind: "autosave", at: Math.round(performance.now() - win.start) }); } return put.apply(this, args); };
  let season = null;
  const hud = () => {
    const cells = [...document.querySelectorAll(".status-pill-cell")].map((cell) => (cell.textContent || "").trim());
    const pressed = document.querySelector('.speed-seal[aria-pressed="true"]');
    return { date: cells[0] ?? null, population: cells[1] ?? null, speed: pressed ? pressed.getAttribute("aria-label") : null };
  };
  setInterval(() => {
    const t0 = now(); const state = hud(); if (state.speed) win.speeds[state.speed] = (win.speeds[state.speed] ?? 0) + 1;
    const word = /봄|여름|가을|겨울/.exec(state.date ?? "")?.[0] ?? null;
    if (word !== null && season !== null && word !== season) { win.moments.season += 1; win.marks.push({ kind: "season", at: Math.round(performance.now() - win.start) }); }
    if (word !== null) season = word; win.selfMs += now() - t0;
  }, 500);
  new MutationObserver((records) => { for (const record of records) for (const node of record.addedNodes)
    if (node.nodeType === 1 && (node.matches?.('[role="dialog"]') || node.querySelector?.('[role="dialog"]'))) win.moments.dialog += 1; })
    .observe(document.documentElement, { childList: true, subtree: true });

  const send = () => {
    const t0 = now(); const ended = win; win = fresh();
    if (ended.frames === 0 && ended.longFrames.length === 0) return;
    const state = hud();
    const body = JSON.stringify({ session, page: location.pathname + location.search, sent: Date.now(), seconds: Math.round((performance.now() - ended.start) / 100) / 10,
      window: { ...ended, heap: { ...ended.heap, firstMB: ended.heap.first === null ? null : Math.round(ended.heap.first / 1e5) / 10, lastMB: ended.heap.last === null ? null : Math.round(ended.heap.last / 1e5) / 10 } },
      env: { visible: document.visibilityState === "visible", focus: document.hasFocus(), dpr: devicePixelRatio, width: innerWidth, height: innerHeight,
        date: state.date, population: state.population, speed: state.speed, zoom: window.__FLS_TELEMETRY_ZOOM__?.() ?? null } });
    try { fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {}); } catch { /* never in the game's way */ }
    win.selfMs += now() - t0;   // the send's own time lands in the next window
  };
  setInterval(send, 10_000);
  addEventListener("pagehide", send);
})();
