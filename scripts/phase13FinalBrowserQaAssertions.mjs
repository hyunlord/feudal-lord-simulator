import {
  isExpectedGithubJobLogUrl,
  PHASE13_CONSTRUCTION_SHOTS,
  PHASE13_FRAME_DURATION_MS,
  PHASE13_SCREENSHOT_IDS,
} from "./phase13FinalBrowserQaConstants.mjs";

export class Phase13FinalBrowserQaError extends Error {
  constructor(message) {
    super(message);
    this.name = "Phase13FinalBrowserQaError";
  }
}

export function assertPhase13FinalBrowserQaEvidence(evidence) {
  if (evidence?.verdict !== "PASS") throw new Phase13FinalBrowserQaError("verdict must be PASS");
  requireDeploymentProof(evidence.deploymentProof, evidence.publicUrl, evidence.revision);
  requireScreenshots(evidence.screenshots);
  requireResources(evidence.loadedResources, evidence.publicUrl);
  requireInteractions(evidence.pageInteractions);
  requireResponsive(evidence.responsive);
  requireWalker(evidence.walker);
  requireConstruction(evidence.construction);
  requireFrameProfile(evidence.frameProfile);
  requireNoErrors(evidence.errors);
  return { ok: true };
}

function requireDeploymentProof(proof, publicUrl, revision) {
  if (proof === undefined || proof === null) throw new Phase13FinalBrowserQaError("deploymentProof is required");
  const runId = proof.workflowRun?.id;
  const deploymentId = proof.deployment?.id;
  const statusId = proof.deploymentStatus?.id;
  if (!Number.isInteger(runId) || runId <= 0) throw new Phase13FinalBrowserQaError("deploymentProof.workflowRun.id must be positive");
  if (proof.workflowRun.html_url !== `https://github.com/hyunlord/feudal-lord-simulator/actions/runs/${runId}`) throw new Phase13FinalBrowserQaError("deploymentProof.workflowRun.html_url mismatch");
  if (!Number.isInteger(deploymentId) || deploymentId <= 0) throw new Phase13FinalBrowserQaError("deploymentProof.deployment.id must be positive");
  if (proof.deployment.url !== `https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/${deploymentId}`) throw new Phase13FinalBrowserQaError("deploymentProof.deployment.url mismatch");
  if (!Number.isInteger(statusId) || statusId <= 0) throw new Phase13FinalBrowserQaError("deploymentProof.deploymentStatus.id must be positive");
  if (proof.deploymentStatus.url !== `${proof.deployment.url}/statuses/${statusId}`) throw new Phase13FinalBrowserQaError("deploymentProof.deploymentStatus.url mismatch");
  if (proof.pageUrl !== publicUrl) throw new Phase13FinalBrowserQaError("deploymentProof.pageUrl mismatch");
  requireOnlineDeploymentProof(proof, publicUrl, revision);
  if (!Number.isFinite(Date.parse(proof.capturedAt ?? ""))) throw new Phase13FinalBrowserQaError("deploymentProof.capturedAt invalid");
}

function requireOnlineDeploymentProof(proof, publicUrl, revision) {
  const online = proof.onlineVerification;
  if (!Number.isFinite(Date.parse(online?.verifiedAt ?? ""))) throw new Phase13FinalBrowserQaError("deploymentProof online verifiedAt invalid");
  const run = online.workflowRun;
  if (run?.id !== proof.workflowRun.id || run.htmlUrl !== proof.workflowRun.html_url) throw new Phase13FinalBrowserQaError("deploymentProof online run identity mismatch");
  if (run.name !== "Deploy to GitHub Pages" || run.event !== "workflow_dispatch") throw new Phase13FinalBrowserQaError("deploymentProof online run name/event mismatch");
  if (run.status !== "completed" || run.conclusion !== "success") throw new Phase13FinalBrowserQaError("deploymentProof online run completion mismatch");
  if (run.headSha !== revision || run.repository !== "hyunlord/feudal-lord-simulator") throw new Phase13FinalBrowserQaError("deploymentProof online run SHA/repo mismatch");
  const deployment = online.deployment;
  if (deployment?.id !== proof.deployment.id || deployment.url !== proof.deployment.url) throw new Phase13FinalBrowserQaError("deploymentProof online deployment identity mismatch");
  if (deployment.sha !== revision || deployment.environment !== "github-pages" || deployment.statusesUrl !== `${proof.deployment.url}/statuses`) throw new Phase13FinalBrowserQaError("deploymentProof online deployment metadata mismatch");
  const status = online.deploymentStatus;
  if (status?.id !== proof.deploymentStatus.id || status.url !== proof.deploymentStatus.url) throw new Phase13FinalBrowserQaError("deploymentProof online status identity mismatch");
  if (status.state !== "success" || status.environment !== "github-pages" || status.environmentUrl !== publicUrl) throw new Phase13FinalBrowserQaError("deploymentProof online status metadata mismatch");
  if (!isExpectedGithubJobLogUrl(status.logUrl, proof.workflowRun.id)) throw new Phase13FinalBrowserQaError("deploymentProof online status logUrl mismatch");
}

function requireScreenshots(screenshots) {
  if (!Array.isArray(screenshots)) throw new Phase13FinalBrowserQaError("screenshots must be an array");
  if (screenshots.length !== PHASE13_SCREENSHOT_IDS.length) throw new Phase13FinalBrowserQaError("exactly 12 screenshots are required");
  const ids = screenshots.map((entry) => entry?.id);
  const paths = screenshots.map((entry) => entry?.path);
  const missing = PHASE13_SCREENSHOT_IDS.filter((id) => !ids.includes(id));
  const extras = ids.filter((id) => !PHASE13_SCREENSHOT_IDS.includes(id));
  if (missing.length > 0) throw new Phase13FinalBrowserQaError(`missing screenshots: ${missing.join(",")}`);
  if (extras.length > 0 || new Set(ids).size !== ids.length) throw new Phase13FinalBrowserQaError("screenshots must use exact unique ids");
  if (new Set(paths).size !== paths.length) throw new Phase13FinalBrowserQaError("screenshots must have unique paths");
  for (const screenshot of screenshots) {
    if (typeof screenshot.path !== "string" || !screenshot.path.endsWith(".png")) throw new Phase13FinalBrowserQaError(`${screenshot.id} screenshot path invalid`);
    if (!Number.isInteger(screenshot.byteLength) || screenshot.byteLength <= 0) throw new Phase13FinalBrowserQaError(`${screenshot.id} screenshot byteLength invalid`);
    if (!/^[0-9a-f]{64}$/i.test(screenshot.sha256 ?? "")) throw new Phase13FinalBrowserQaError(`${screenshot.id} screenshot sha256 invalid`);
  }
}

function requireResources(resources, publicUrl) {
  if (!Array.isArray(resources) || resources.length === 0) throw new Phase13FinalBrowserQaError("loadedResources are required");
  if (!resources.some((resource) => resource.kind === "script")) throw new Phase13FinalBrowserQaError("loadedResources require at least one JS");
  if (!resources.some((resource) => resource.kind === "stylesheet")) throw new Phase13FinalBrowserQaError("loadedResources require at least one CSS");
  for (const resource of resources) {
    if (!["script", "stylesheet"].includes(resource?.kind)) throw new Phase13FinalBrowserQaError("loadedResources kind must be script or stylesheet");
    if (typeof resource.url !== "string" || !resource.url.startsWith(publicUrl)) throw new Phase13FinalBrowserQaError("loadedResources url must be public");
    if (resource.fetchedUrl !== resource.url) throw new Phase13FinalBrowserQaError("loadedResources fetchedUrl must match url");
    if (resource.status !== 200) throw new Phase13FinalBrowserQaError(`loadedResources status invalid for ${resource.url}`);
    if (!Number.isInteger(resource.byteLength) || resource.byteLength <= 0) throw new Phase13FinalBrowserQaError(`loadedResources byteLength invalid for ${resource.url}`);
    if (resource.kind === "script" && !/javascript/i.test(resource.contentType)) throw new Phase13FinalBrowserQaError(`loadedResources contentType invalid for ${resource.url}`);
    if (resource.kind === "stylesheet" && !/text\/css/i.test(resource.contentType)) throw new Phase13FinalBrowserQaError(`loadedResources contentType invalid for ${resource.url}`);
    if (!/^[0-9a-f]{64}$/i.test(resource.sha256 ?? "")) throw new Phase13FinalBrowserQaError(`loadedResources sha256 invalid for ${resource.url}`);
  }
}

function requireInteractions(interactions) {
  if (!Array.isArray(interactions) || interactions.length !== 8) throw new Phase13FinalBrowserQaError("exactly 8 fresh page dismissal interactions are required");
  for (const entry of interactions) {
    if (entry?.label !== "dismiss visible welcome guidance" || entry.method !== "Input.dispatchMouseEvent") {
      throw new Phase13FinalBrowserQaError("fresh page dismissal interactions are required");
    }
  }
}

function requireResponsive(responsive) {
  if (!Array.isArray(responsive)) throw new Phase13FinalBrowserQaError("responsive evidence is required");
  for (const id of ["opening-1280x720", "responsive-920x720", "responsive-768x1024", "responsive-375x812"]) {
    const entry = responsive.find((item) => item?.id === id);
    if (entry === undefined) throw new Phase13FinalBrowserQaError(`missing responsive evidence ${id}`);
    if (entry.mobile !== false) throw new Phase13FinalBrowserQaError(`${id} must be captured with mobile=false`);
    if (!Array.isArray(entry.clipped) || entry.clipped.length > 0) throw new Phase13FinalBrowserQaError(`${id} has clipped UI`);
    for (const key of ["document", "body", "buildSeals", "console"]) requireNoOverflow(entry[key], `${id}.${key}`);
  }
}

function requireWalker(walker) {
  if (walker?.moved !== true) throw new Phase13FinalBrowserQaError("walker proof must move");
  if (walker.start?.id !== walker.end?.id) throw new Phase13FinalBrowserQaError("walker proof must track one walker");
  if (walker.start.x === walker.end.x && walker.start.y === walker.end.y) throw new Phase13FinalBrowserQaError("walker x/y did not change");
  if (!Number.isFinite(walker.focus?.distanceFromCenterPx) || walker.focus.distanceFromCenterPx > 80) {
    throw new Phase13FinalBrowserQaError("walker endpoint must be focused near canvas center");
  }
}

function requireConstruction(construction) {
  if (!Array.isArray(construction)) throw new Phase13FinalBrowserQaError("construction evidence is required");
  const siteIds = new Set(construction.map((entry) => entry?.siteId));
  if (siteIds.size !== 1) throw new Phase13FinalBrowserQaError("construction captures must share one site identity");
  for (const shot of PHASE13_CONSTRUCTION_SHOTS) {
    const entry = construction.find((item) => item?.id === shot.id);
    if (entry === undefined) throw new Phase13FinalBrowserQaError(`missing construction evidence ${shot.id}`);
    if (entry.siteKind !== "house" || entry.building !== "house" || entry.label !== "오두막") throw new Phase13FinalBrowserQaError(`${shot.id} must use real 오두막 house flow`);
    if (typeof entry.siteId !== "string" || entry.siteId.trim() === "") throw new Phase13FinalBrowserQaError(`${shot.id} missing site identity`);
    if (typeof entry.progressText !== "string" || entry.progressText.trim() === "") throw new Phase13FinalBrowserQaError(`${shot.id} missing progress text`);
    if (!Number.isFinite(entry.progress) || entry.progress < 0 || entry.progress > 1) {
      throw new Phase13FinalBrowserQaError(`${shot.id} progress must be 0..1`);
    }
    if (shot.target <= 0.25 && (entry.progress < 0 || entry.progress > 0.25)) throw new Phase13FinalBrowserQaError(`${shot.id} progress outside <=25 range`);
    if (shot.target > 0.25 && shot.target < 1 && Math.abs(entry.progress - shot.target) > 0.08) throw new Phase13FinalBrowserQaError(`${shot.id} progress outside tolerance`);
    if (shot.target >= 1 && (entry.completed !== true || entry.houseTile?.tx !== 45 || entry.houseTile?.ty !== 40)) throw new Phase13FinalBrowserQaError("construction completion must produce house at HOUSE_TILE");
  }
}

function requireFrameProfile(frameProfile) {
  if (frameProfile?.durationMs !== PHASE13_FRAME_DURATION_MS) throw new Phase13FinalBrowserQaError("frameProfile.durationMs must be exactly 30000");
  if (!Number.isFinite(frameProfile.elapsedMs) || frameProfile.elapsedMs < 30_000 || frameProfile.elapsedMs > 31_500) {
    throw new Phase13FinalBrowserQaError("frameProfile.elapsedMs must be 30000..31500");
  }
  if (!Number.isInteger(frameProfile.measuredFrameCount) || frameProfile.measuredFrameCount <= 0) {
    throw new Phase13FinalBrowserQaError("frameProfile.measuredFrameCount must be positive");
  }
  for (const key of ["minMs", "p50Ms", "p75Ms", "p90Ms", "p95Ms", "p99Ms", "maxMs", "avgMs", "over16_67", "over20"]) {
    if (!Number.isFinite(frameProfile.metrics?.[key])) throw new Phase13FinalBrowserQaError(`frameProfile.metrics.${key} is required`);
  }
  if (frameProfile.metrics?.over20 !== 0) throw new Phase13FinalBrowserQaError("frameProfile.metrics.over20 must be exactly 0");
  if (!Array.isArray(frameProfile.failures) || frameProfile.failures.length !== 0) {
    throw new Phase13FinalBrowserQaError("frameProfile.failures must be empty");
  }
}

function requireNoErrors(errors) {
  for (const key of ["console", "page", "resource", "network", "log", "runtime"]) {
    if (!Array.isArray(errors?.[key])) throw new Phase13FinalBrowserQaError("errors console/page/resource/network/log/runtime arrays are required");
  }
  if (errors.console.length > 0 || errors.page.length > 0 || errors.resource.length > 0 || errors.network.length > 0 || errors.log.length > 0 || errors.runtime.length > 0) {
    throw new Phase13FinalBrowserQaError("console/page/resource errors must be empty");
  }
}

function requireNoOverflow(metrics, label) {
  if (metrics === null || metrics === undefined) throw new Phase13FinalBrowserQaError(`${label} metrics are required`);
  if (metrics.scrollWidth > metrics.clientWidth || metrics.scrollHeight > metrics.clientHeight) {
    throw new Phase13FinalBrowserQaError(`${label} overflows`);
  }
}
