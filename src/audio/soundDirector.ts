import type { GameState } from "../engine/engine.types";
import { stateCalendar } from "../engine/scenarioState";
import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { isPalisadeConstructionSite, isStoneWallConstructionSite } from "../economy/palisadeConstruction";
import { constructionMaterialShare, constructionPhase, constructionStageIndex, constructionWorkProgress } from "../render/constructionVisibility";
import { tileToScreen } from "../render/iso";
import { presentationSpeed } from "../render/presentationSpeed";
import { playSound, setAudioListener, setLoop, type SoundId } from "./audioEngine";

// F0-V world sounds from what the state shows, once per drawn frame (the canvas runtime calls it). Construction: a
// delivery (the site's delivered share rising) unloads timber or stone, a stage change thuds, a completion plays the
// completion sound; builders at work hammer (the two sites nearest the view, every HAMMER_MS or so). Carters on the
// move keep the cart loop (louder with more of them in view); spring keeps the ambience. Paused, nothing hammers or
// rolls. Presentation memory keyed by site id (never reused); gone sites are dropped every frame.
const HAMMER_MS = 650;
const HAMMER_SITES = 2;
type SiteMemory = { share: number; stage: number; x: number; y: number };
const memory = new Map<string, SiteMemory>();
const lastHammer = new Map<string, number>();

function siteScreen(site: ConstructionSite): { readonly x: number; readonly y: number } {
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}

export function observeSoundFrame(state: GameState, camera: { readonly zoom: number; readonly panX: number; readonly panY: number },
  viewport: { readonly width: number; readonly height: number }, nowMs: number): void {
  const centre = { x: (viewport.width / 2 - camera.panX) / camera.zoom, y: (viewport.height / 2 - camera.panY) / camera.zoom };
  const reach = Math.hypot(viewport.width, viewport.height) / 2 / camera.zoom;
  setAudioListener(centre.x, centre.y, reach);
  const running = presentationSpeed() > 0;
  const live = new Set<string>();
  const working: { readonly site: ConstructionSite; readonly at: { readonly x: number; readonly y: number } }[] = [];
  for (const site of state.constructionSites) {
    if (isPalisadeConstructionSite(site) || isStoneWallConstructionSite(site)) continue;
    live.add(site.id);
    const at = siteScreen(site);
    const share = constructionMaterialShare(site);
    const stage = constructionStageIndex(constructionWorkProgress(site));
    const before = memory.get(site.id);
    if (before !== undefined) {
      if (share > before.share) playSound(((site.required.stone ?? 0) > 0 && (site.delivered.stone ?? 0) > 0 && (site.required.timber ?? 0) === 0) ? "unload_stone" : "unload_wood", at);
      if (stage > before.stage) playSound("stage_thud", at);
    }
    memory.set(site.id, { share, stage, x: at.x, y: at.y });
    if (running && constructionPhase(site) === "work" && site.assignedBuilders > 0) working.push({ site, at });
  }
  const built = new Set(state.buildings.map(building => building.id));
  for (const [id, entry] of memory) {
    if (live.has(id)) continue;
    if (built.has(id)) playSound("complete", entry);
    memory.delete(id); lastHammer.delete(id);
  }
  const nearest = working.sort((a, b) => Math.hypot(a.at.x - centre.x, a.at.y - centre.y) - Math.hypot(b.at.x - centre.x, b.at.y - centre.y)).slice(0, HAMMER_SITES);
  for (const { site, at } of nearest) {
    const last = lastHammer.get(site.id) ?? 0;
    const jitter = (site.id.charCodeAt(site.id.length - 1) % 5) * 40;
    if (nowMs - last < HAMMER_MS + jitter) continue;
    lastHammer.set(site.id, nowMs);
    playSound((["hammer_1", "hammer_2", "hammer_3"] as const satisfies readonly SoundId[])[Math.floor(nowMs / HAMMER_MS) % 3]!, at);
  }
  const carters = running ? state.walkers.filter(walker => {
    if (walker.kind !== "carter") return false;
    const at = tileToScreen(walker.position.tx, walker.position.ty);
    return Math.hypot(at.sx - centre.x, at.sy - centre.y) < reach;
  }).length : 0;
  setLoop("cart", "cart_loop", Math.min(1, carters / 3));
  setLoop("spring", "spring_ambience", stateCalendar(state).season === 0 ? 1 : 0);
}

/** A placement attempt's answer: placed (an action dispatched) or refused (a failure message). */
export function playPlacementSound(attempt: { readonly action: unknown | null; readonly feedback: { readonly kind: string } | null } | null): void {
  if (attempt === null) return;
  if (attempt.action !== null) playSound("place_ok");
  else if (attempt.feedback?.kind === "failure") playSound("place_blocked");
}
