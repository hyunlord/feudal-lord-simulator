export const PHASE13_CDP_ERROR_EVENTS = [
  "Network.requestWillBeSent",
  "Network.responseReceived",
  "Network.loadingFailed",
  "Log.entryAdded",
  "Runtime.consoleAPICalled",
  "Runtime.exceptionThrown",
];

export async function createPhase13ErrorCollector(client) {
  const observed = { console: [], page: [], resource: [], network: [], log: [], runtime: [] };
  const requests = new Map();
  const subscriptions = [];
  subscriptions.push(client.on("Network.requestWillBeSent", (event) => {
    if (typeof event.requestId === "string") requests.set(event.requestId, event.request?.url ?? "");
  }));
  subscriptions.push(client.on("Network.responseReceived", (event) => {
    const response = event.response;
    if (response?.status >= 400) {
      const entry = { url: response.url, status: response.status, statusText: response.statusText ?? "" };
      observed.network.push(entry);
      observed.resource.push(entry);
    }
  }));
  subscriptions.push(client.on("Network.loadingFailed", (event) => {
    if (event.canceled === true || event.errorText === "net::ERR_ABORTED") return;
    const entry = { url: requests.get(event.requestId) ?? event.requestId ?? "", status: 0, errorText: event.errorText ?? "loading failed" };
    observed.network.push(entry);
    observed.resource.push(entry);
  }));
  subscriptions.push(client.on("Log.entryAdded", (event) => {
    if (event.entry?.level === "error") observed.log.push(event.entry);
  }));
  subscriptions.push(client.on("Runtime.consoleAPICalled", (event) => {
    if (event.type === "error") observed.console.push((event.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" "));
  }));
  subscriptions.push(client.on("Runtime.exceptionThrown", (event) => {
    observed.runtime.push(event.exceptionDetails ?? event);
    observed.page.push(event.exceptionDetails?.text ?? "Runtime.exceptionThrown");
  }));
  await installPageErrorProbe(client);
  return {
    read: async () => mergeErrors(observed, await readPageErrors(client)),
    dispose: () => subscriptions.forEach((unsubscribe) => unsubscribe()),
  };
}

async function installPageErrorProbe(client) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    window.__PHASE13_ERRORS__ = { console: [], page: [] };
    const originalError = console.error.bind(console);
    console.error = (...args) => { window.__PHASE13_ERRORS__.console.push(args.map(String).join(" ")); originalError(...args); };
    window.addEventListener("error", (event) => window.__PHASE13_ERRORS__.page.push(event.message));
    window.addEventListener("unhandledrejection", (event) => window.__PHASE13_ERRORS__.page.push(String(event.reason)));
  })();` });
}

async function readPageErrors(client) {
  return client.evaluate(`(() => {
    const resource = performance.getEntriesByType("resource")
      .filter((entry) => entry.responseStatus >= 400 || (
        entry.responseStatus === 0 &&
        entry.transferSize === 0 &&
        entry.decodedBodySize === 0 &&
        entry.deliveryType !== "cache" &&
        /\\.(?:js|css|png)(?:[?#].*)?$/.test(entry.name)
      ))
      .map((entry) => ({ url: entry.name, status: entry.responseStatus }));
    return { ...(window.__PHASE13_ERRORS__ ?? { console: [], page: [] }), resource };
  })()`, false);
}

function mergeErrors(observed, pageErrors) {
  return {
    console: [...observed.console, ...(pageErrors.console ?? [])],
    page: [...observed.page, ...(pageErrors.page ?? [])],
    resource: [...observed.resource, ...(pageErrors.resource ?? [])],
    network: observed.network,
    log: observed.log,
    runtime: observed.runtime,
  };
}
