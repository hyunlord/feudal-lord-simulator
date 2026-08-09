import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const QA_SCRIPT = new URL("../scripts/phase13FinalBrowserQa.mjs", import.meta.url);
const QA_BROWSER = new URL("../scripts/phase13FinalBrowserQaBrowser.mjs", import.meta.url);
const QA_ERRORS = new URL("../scripts/phase13FinalBrowserQaErrors.mjs", import.meta.url);
const QA_RUNNER = new URL("../scripts/phase13FinalBrowserQaRunner.mjs", import.meta.url);
const QA_SCENARIOS = new URL("../scripts/phase13FinalBrowserQaScenarios.mjs", import.meta.url);
const CDP_CLIENT = new URL("../scripts/phase8Task10CdpClient.mjs", import.meta.url);
const PUBLIC_URL = "https://hyunlord.github.io/feudal-lord-simulator/";
const REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";

const ONLINE_VERIFICATION = {
  verifiedAt: "2026-08-09T00:00:01.000Z",
  workflowRun: {
    id: 1,
    htmlUrl: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/1",
    name: "Deploy to GitHub Pages",
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    headSha: REVISION,
    repository: "hyunlord/feudal-lord-simulator",
  },
  deployment: {
    id: 2,
    url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/2",
    sha: REVISION,
    environment: "github-pages",
    statusesUrl: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/2/statuses",
  },
  deploymentStatus: {
    id: 3,
    url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/2/statuses/3",
    state: "success",
    environment: "github-pages",
    environmentUrl: PUBLIC_URL,
    logUrl: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/1/job/123",
  },
};

function evalQa(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import * as qa from ${JSON.stringify(QA_SCRIPT.href)}; ${source}`], {
    encoding: "utf8",
  });
}

function evalErrors(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import { createPhase13ErrorCollector } from ${JSON.stringify(QA_ERRORS.href)}; ${source}`], {
    encoding: "utf8",
  });
}

function evalRunner(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import * as runner from ${JSON.stringify(QA_RUNNER.href)}; ${source}`], {
    encoding: "utf8",
  });
}

function evalScenarios(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import * as scenarios from ${JSON.stringify(QA_SCENARIOS.href)}; ${source}`], {
    encoding: "utf8",
  });
}

test("Given the real construction-site diagnostic title When sampling progress Then the house stage is accepted", () => {
  const output = evalScenarios(`
    const site = { id: "site-1", kind: "house" };
    const actualCard = { name: "오두막 부지", progress: 0, progressText: "0/240틱 · 일꾼 0명" };
    const buildingTitle = { ...actualCard, name: "오두막" };
    process.stdout.write(JSON.stringify({
      actual: scenarios.isMatchingHouseConstructionProgress(site, actualCard, 0.25),
      wrongTitle: scenarios.isMatchingHouseConstructionProgress(site, buildingTitle, 0.25),
      prematureComplete: scenarios.isMatchingHouseConstructionProgress(site, { ...actualCard, progress: 224 / 240 }, 1),
    }));
  `);

  assert.deepEqual(JSON.parse(output), { actual: true, wrongTitle: false, prematureComplete: false });
});

test("Given mocked GitHub REST responses When online proof is verified Then real run deployment and status facts are embedded", () => {
  const output = evalQa(`
    const proof = {
      workflowRun: { id: 8123456789, html_url: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/8123456789" },
      deployment: { id: 9123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789" },
      deploymentStatus: { id: 7123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789/statuses/7123456789" },
      pageUrl: ${JSON.stringify(PUBLIC_URL)},
      capturedAt: "2026-08-09T00:00:00.000Z"
    };
    const bodies = [
      { id: 8123456789, html_url: proof.workflowRun.html_url, name: "Deploy to GitHub Pages", event: "workflow_dispatch", status: "completed", conclusion: "success", head_sha: ${JSON.stringify(REVISION)}, repository: { full_name: "hyunlord/feudal-lord-simulator" } },
      { id: 9123456789, url: proof.deployment.url, sha: ${JSON.stringify(REVISION)}, environment: "github-pages", statuses_url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789/statuses" },
      [{ id: 7123456789, url: proof.deploymentStatus.url, state: "success", environment: "github-pages", environment_url: ${JSON.stringify(PUBLIC_URL)}, log_url: proof.workflowRun.html_url + "/job/123" }]
    ];
    const urls = [];
    const headers = [];
    const fetchImpl = async (url, options) => {
      urls.push(url);
      headers.push(options.headers);
      return { ok: true, status: 200, json: async () => bodies.shift() };
    };
    const result = await qa.verifyPhase13GithubDeployment({ proof, publicUrl: ${JSON.stringify(PUBLIC_URL)}, revision: ${JSON.stringify(REVISION)}, token: "secret-token" }, fetchImpl);
    process.stdout.write(JSON.stringify({ result, urls, headers }));
  `);

  const observed = JSON.parse(output);
  assert.equal(observed.result.workflowRun.id, 8123456789);
  assert.equal(observed.result.workflowRun.status, "completed");
  assert.equal(observed.result.deploymentStatus.state, "success");
  assert.equal(observed.result.authHeaderUsed, true);
  assert.equal(JSON.stringify(observed.result).includes("secret-token"), false);
  assert.equal(observed.urls.length, 3);
  assert.match(observed.headers[0].authorization, /^Bearer /);
});

test("Given strict Round2 evidence When asserted Then mobile false exact shots interactions walker construction and frame metrics are enforced", () => {
  const output = evalQa(`
    const ids = qa.PHASE13_SCREENSHOT_IDS;
    const screenshots = ids.map((id, index) => ({ id, path: "/tmp/" + index + "-" + id + ".png", byteLength: 10, sha256: String(index).padStart(64, "a").slice(0, 64) }));
    const responsive = [
      "opening-1280x720:1280:720", "responsive-920x720:920:720", "responsive-768x1024:768:1024", "responsive-375x812:375:812"
    ].map((item) => {
      const [id, width, height] = item.split(":");
      return { id, width: Number(width), height: Number(height), mobile: false, clipped: [], document: { scrollWidth: Number(width), clientWidth: Number(width), scrollHeight: Number(height), clientHeight: Number(height) }, body: { scrollWidth: Number(width), clientWidth: Number(width), scrollHeight: Number(height), clientHeight: Number(height) }, buildSeals: { scrollWidth: 10, clientWidth: 10, scrollHeight: 10, clientHeight: 10 }, console: { scrollWidth: 10, clientWidth: 10, scrollHeight: 10, clientHeight: 10 } };
    });
    const evidence = qa.makePhase13FailureEvidence({ publicUrl: ${JSON.stringify(PUBLIC_URL)}, revision: ${JSON.stringify(REVISION)}, out: "/tmp/browser_qa.json" }, new Error("seed"));
    Object.assign(evidence, {
      verdict: "PASS",
      deploymentProof: { workflowRun: { id: 1, html_url: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/1" }, deployment: { id: 2, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/2" }, deploymentStatus: { id: 3, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/2/statuses/3" }, pageUrl: ${JSON.stringify(PUBLIC_URL)}, capturedAt: "2026-08-09T00:00:00.000Z", onlineVerification: ${JSON.stringify(ONLINE_VERIFICATION)} },
      screenshots,
      loadedResources: [
        { url: ${JSON.stringify(`${PUBLIC_URL}assets/app.js`)}, fetchedUrl: ${JSON.stringify(`${PUBLIC_URL}assets/app.js`)}, kind: "script", status: 200, contentType: "application/javascript", byteLength: 1, sha256: "b".repeat(64) },
        { url: ${JSON.stringify(`${PUBLIC_URL}assets/app.css`)}, fetchedUrl: ${JSON.stringify(`${PUBLIC_URL}assets/app.css`)}, kind: "stylesheet", status: 200, contentType: "text/css", byteLength: 1, sha256: "c".repeat(64) }
      ],
      responsive,
      pageInteractions: Array.from({ length: 8 }, (_, index) => ({ atMs: index, label: "dismiss visible welcome guidance", method: "Input.dispatchMouseEvent" })),
      walker: { kind: "roaming", start: { id: "w1", x: 1, y: 1 }, end: { id: "w1", x: 2, y: 2 }, moved: true, focus: { distanceFromCenterPx: 22 } },
      construction: [
        { id: "construction-lte25", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.25, progressText: "60/240틱" },
        { id: "construction-around55", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.56, progressText: "134/240틱" },
        { id: "construction-around85", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.84, progressText: "202/240틱" },
        { id: "construction-complete", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 1, progressText: "complete", completed: true, houseTile: { tx: 45, ty: 40 }, completedBuildingId: "site-1" }
      ],
      frameProfile: { durationMs: 30000, elapsedMs: 30050, startedAt: 1, endedAt: 30051, measuredFrameCount: 4, metrics: { minMs: 8, p50Ms: 10, p75Ms: 12, p90Ms: 12, p95Ms: 12, p99Ms: 12, maxMs: 12, avgMs: 10.5, over16_67: 0, over20: 0 }, failures: [] },
      errors: { console: [], page: [], resource: [], log: [], runtime: [], network: [] }
    });
    const accepted = qa.assertPhase13FinalBrowserQaEvidence(evidence).ok;
    evidence.screenshots.push({ ...evidence.screenshots[0], path: "/tmp/extra.png" });
    let rejected = "";
    try { qa.assertPhase13FinalBrowserQaEvidence(evidence); } catch (error) { rejected = error instanceof Error ? error.message : String(error); }
    process.stdout.write(JSON.stringify({ accepted, rejected }));
  `);

  const observed = JSON.parse(output);
  assert.equal(observed.accepted, true);
  assert.match(observed.rejected, /exactly 12 screenshots/);
});

test("Given Chrome runs as an ordinary user When final QA launches Then the browser sandbox stays enabled", () => {
  const output = evalRunner(`process.stdout.write(JSON.stringify({ root: runner.chromeSandboxArgs(0), user: runner.chromeSandboxArgs(501) }));`);

  assert.deepEqual(JSON.parse(output), { root: ["--no-sandbox"], user: [] });
});

test("Given source guards When inspected Then text button lookup CDP subscriptions and real event constants are present", () => {
  const source = `${readFileSync(QA_BROWSER, "utf8")}\n${readFileSync(CDP_CLIENT, "utf8")}`;

  assert.match(source, /textContent/);
  assert.match(source, /aria-label/);
  assert.match(source, /on\(method, handler\)/);
  assert.match(source, /listeners/);
});

test("Given prior navigation CDP events When error collector reads final page Then retained errors persist and canceled aborts are ignored", () => {
  const output = evalErrors(`
    const handlers = new Map();
    const client = {
      async send() {},
      on(method, handler) {
        const list = handlers.get(method) ?? [];
        list.push(handler);
        handlers.set(method, list);
        return () => {};
      },
      async evaluate() {
        return { console: ["final console"], page: ["final page"], resource: [{ url: "final.css", status: 404 }] };
      }
    };
    const collector = await createPhase13ErrorCollector(client);
    const emit = (method, payload) => (handlers.get(method) ?? []).forEach((handler) => handler(payload));
    emit("Network.requestWillBeSent", { requestId: "a", request: { url: "https://example.test/missing.js" } });
    emit("Network.loadingFailed", { requestId: "a", errorText: "net::ERR_FAILED" });
    emit("Network.requestWillBeSent", { requestId: "b", request: { url: "https://example.test/old" } });
    emit("Network.loadingFailed", { requestId: "b", errorText: "net::ERR_ABORTED", canceled: true });
    emit("Runtime.consoleAPICalled", { type: "error", args: [{ value: "prior console" }] });
    emit("Runtime.exceptionThrown", { exceptionDetails: { text: "prior runtime" } });
    emit("Log.entryAdded", { entry: { level: "error", text: "prior log" } });
    const errors = await collector.read();
    process.stdout.write(JSON.stringify(errors));
  `);

  const errors = JSON.parse(output);
  assert.deepEqual(errors.console, ["prior console", "final console"]);
  assert.deepEqual(errors.page, ["prior runtime", "final page"]);
  assert.equal(errors.network.length, 1);
  assert.equal(errors.network[0].url, "https://example.test/missing.js");
  assert.equal(errors.log.length, 1);
  assert.equal(errors.runtime.length, 1);
});
