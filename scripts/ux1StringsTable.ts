// UX-1 copy table: every string of the copy modules UX-1 added (docs/verification/ux1-onboarding/strings.md).
// Usage: npx tsx scripts/ux1StringsTable.ts > docs/verification/ux1-onboarding/strings.md
import { TUTORIAL_COPY } from "../src/ui/tutorial/tutorialCopy.ko";
import { BUILD_CARD_PURPOSE, BUILD_MENU_COPY } from "../src/ui/buildMenuCopy.ko";
import { ALERT_STACK_COPY } from "../src/ui/alertStackCopy.ko";
import { INSPECTOR_COPY } from "../src/ui/inspectorCopy.ko";
import { CAUSE_MARKER_COPY } from "../src/ui/causeMarkerCopy.ko";
import { GAME_TIME_COPY } from "../src/ui/gameTimeCopy.ko";
import { SETTLEMENT_PANEL_COPY } from "../src/ui/settlementPanelCopy.ko";

const SAMPLE = ["{name}", "{n}", "{m}"];
function rows(module: string, value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") return [`| ${module} | \`${path.join(".")}\` | ${value.replaceAll("|", "\\|")} |`];
  if (typeof value === "function") {
    const args = Array.from({ length: value.length }, (_, index) => SAMPLE[index] ?? `{${index}}`);
    let text: string;
    try { text = String((value as (...a: unknown[]) => unknown)(...args.map((arg, index) => index === 0 ? 3 : arg))); } catch { text = "(함수)"; }
    return [`| ${module} | \`${path.join(".")}()\` | ${text.replaceAll("|", "\\|")} |`];
  }
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => rows(module, child, [...path, key]));
  return [];
}
const modules: [string, unknown][] = [["tutorialCopy", TUTORIAL_COPY], ["buildMenuCopy", { BUILD_MENU_COPY, BUILD_CARD_PURPOSE }], ["alertStackCopy", ALERT_STACK_COPY],
  ["inspectorCopy", INSPECTOR_COPY], ["causeMarkerCopy", CAUSE_MARKER_COPY], ["gameTimeCopy", GAME_TIME_COPY], ["settlementPanelCopy", SETTLEMENT_PANEL_COPY]];
console.log("# UX-1 문구 표\n\n`*.ko.ts`에 새로 둔 문구 전부(`scripts/ux1StringsTable.ts`가 생성). 함수 문구는 예시 인자로 펼쳤다.\n");
console.log("| 모듈 | 키 | 문구 |\n|---|---|---|");
for (const [module, value] of modules) for (const row of rows(module, value)) console.log(row);
