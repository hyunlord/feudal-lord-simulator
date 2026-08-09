export const PHASE13_DEFAULT_PUBLIC_URL = "https://hyunlord.github.io/feudal-lord-simulator/";
export const PHASE13_DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const PHASE13_DEFAULT_CHROME_PORT = 9253;
export const PHASE13_FRAME_DURATION_MS = 30_000;

export const PHASE13_SCREENSHOT_IDS = [
  "opening-1280x720",
  "responsive-920x720",
  "responsive-768x1024",
  "responsive-375x812",
  "terrain-close-up-high-zoom",
  "forest-scene",
  "procedural-walker-close-up",
  "construction-lte25",
  "construction-around55",
  "construction-around85",
  "construction-complete",
  "frame-profile-1x-end",
];

export const PHASE13_RESPONSIVE_VIEWPORTS = [
  { id: "responsive-920x720", width: 920, height: 720, mobile: false },
  { id: "responsive-768x1024", width: 768, height: 1024, mobile: false },
  { id: "responsive-375x812", width: 375, height: 812, mobile: false },
];

export const PHASE13_CONSTRUCTION_SHOTS = [
  { id: "construction-lte25", target: 0.25 },
  { id: "construction-around55", target: 0.55 },
  { id: "construction-around85", target: 0.85 },
  { id: "construction-complete", target: 1 },
];

export function phase13ProofUrl(publicUrl) {
  const url = new URL(publicUrl);
  url.searchParams.set("phase10-proof", "1");
  return url.href;
}

export function isExpectedGithubJobLogUrl(value, runId) {
  if (typeof value !== "string") return false;
  return new RegExp(`^https://github\\.com/hyunlord/feudal-lord-simulator/actions/runs/${runId}/job/[1-9][0-9]*$`).test(value);
}
