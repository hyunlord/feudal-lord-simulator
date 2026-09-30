// UI-10 chapter 5 cards in the game (tests/helpers/ui10Course.ts: the chapter-4 town run into chapter 5, each card left
// open): the heir's card with its three candidates, the Crown's tax, the nave's (Wave 33) — each at 1280×800 and on a
// touch tablet at 1180×820. Per shot: the card's JPEG and its measures (no horizontal scroll of the page or the card,
// the card inside the viewport, the answers' and [나중에 정하기]'s heights, the smallest text). captures.json.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui10CardsCaptures.ts <out-dir> --url <game>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui10CardsCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui10CardsCaptures.ts …", entry: import.meta.url });
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { ui10Course } from "../tests/helpers/ui10Course";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T>(expression: string) => Promise<T>; locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];
const VIEWPORTS = [{ name: "desktop", width: 1280, height: 800, touch: false }, { name: "tablet", width: 1180, height: 820, touch: true }] as const;

async function card(state: GameState, defId: string, viewport: (typeof VIEWPORTS)[number], file: string) {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { context, page } = await openScene(browser, { state, tile: [keep.tx, keep.ty], baseUrl: url, width: viewport.width, height: viewport.height, zoom: 1.2, run: false,
    hasTouch: viewport.touch, isMobile: false, initScript: TUTORIAL_OFF, query: "&story-delay=600&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  await page.waitForTimeout(2_000);
  // As a player opens it: the chip, then the event card's [결정하기].
  if (await page.locator(".petition-card").count() === 0 && await page.locator(".event-chip").count() > 0) {
    await page.locator(".event-chip").first().click({ timeout: 5_000 }); await page.waitForTimeout(600);
    await page.getByRole("button", { name: "결정하기" }).first().click({ timeout: 5_000 }); await page.waitForTimeout(600);
  }
  await page.locator(`.petition-card[data-def='${defId}']`).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await page.locator(".petition-card").first().screenshot({ path: join(out!, file), type: "jpeg", quality: 70 });
  files.push(file);
  // A string, not a function: tsx's names (`__name`) do not exist in the page.
  const measures = await page.evaluate<Record<string, unknown>>(`(() => {
    const cardNode = document.querySelector(".petition-card");
    const rect = cardNode.getBoundingClientRect();
    const heights = selector => [...cardNode.querySelectorAll(selector)].map(node => Math.round(node.getBoundingClientRect().height));
    const fonts = [...cardNode.querySelectorAll("*")].filter(node => [...node.childNodes].some(child => child.nodeType === 3 && (child.textContent || "").trim() !== ""))
      .map(node => parseFloat(getComputedStyle(node).fontSize));
    return {
      pageScrollX: document.documentElement.scrollWidth - window.innerWidth,
      cardScrollX: cardNode.scrollWidth - cardNode.clientWidth,
      bodyScrollX: [...cardNode.querySelectorAll(".petition-body")].map(node => node.scrollWidth - node.clientWidth),
      card: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), inside: rect.left >= 0 && rect.right <= window.innerWidth },
      answers: heights(".petition-option"), later: heights(".story-modal-later"), heirs: cardNode.querySelectorAll(".petition-heir").length,
      smallestText: Math.min(...fonts), titled: cardNode.querySelectorAll("[title]").length,
      lines: [...cardNode.querySelectorAll(".petition-option")].map(node => (node.textContent || "").trim()),
    };
  })()`);
  await context.close();
  return measures;
}
async function step(name: string, run: () => Promise<unknown>) {
  try { result[name] = await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}

const course = ui10Course();
for (const viewport of VIEWPORTS) {
  await step(`heir-${viewport.name}`, () => card(course.heir, "heir_choice", viewport, `heir-${viewport.name}.jpg`));
  await step(`royal-tax-${viewport.name}`, () => card(course.envoy, "royal_tax", viewport, `royal-tax-${viewport.name}.jpg`));
  await step(`church-${viewport.name}`, () => card(course.nave, "church_rebuilding", viewport, `church-${viewport.name}.jpg`));
}
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ steps: result, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: result, errors }).slice(0, 3000));
process.exitCode = errors.length === 0 ? 0 : 1;
