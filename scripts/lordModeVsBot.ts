// LM-E1b gate ④ (spec docs/design/town-agency.md TA-9…TA-12): the lord-mode town (`lordModeRun.ts`: the lord sets the
// policy and the standard subsidy only) beside the bot's campaign (`archetypeCampaign.ts`) on the same land and seed —
// L4 homes, people and treasury at each decade's first tick, the market charter's year, and each run's time. Prints a
// Markdown table per seed.
//   tsx scripts/lordModeVsBot.ts <lord-seed1.json> <bot-seed1.json> [<lord-seed2.json> <bot-seed2.json> ...] > table.md
import { readFileSync } from "node:fs";

interface LordRun {
  readonly seed: number;
  readonly years: readonly { readonly year: number; readonly population: number; readonly l4: number; readonly treasury: number }[];
  readonly eras?: readonly { readonly era: string; readonly year: number }[];
  readonly elapsedSeconds: number;
  readonly audit: { readonly audited: number; readonly mismatched: number };
  readonly sites?: { readonly compared: number; readonly withRival: number; readonly movedFromPlan: number };
  readonly subsidy: { readonly inForceFrom: number | null } | null;
}
interface BotRun {
  readonly seed: number;
  readonly decades: readonly { readonly year: number; readonly population: number; readonly l4: number; readonly treasury: number }[];
  readonly elapsedSeconds?: number;
}

const read = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const paths = process.argv.slice(2);
const out: string[] = [];
for (let index = 0; index + 1 < paths.length; index += 2) {
  const lord = read<LordRun>(paths[index]!);
  const bot = read<BotRun>(paths[index + 1]!);
  // A lord-mode year's row is read at its last tick, the campaign's decade at the next year's first: the same tick.
  const lordAt = (year: number) => lord.years.find(entry => entry.year === year - 1);
  const charter = lord.eras?.find(entry => entry.era === "palisade")?.year;
  out.push(`### 강가 seed ${lord.seed}`, "",
    `영주 모드: 시장도시 선포 ${lord.eras === undefined ? "(기록 전 판)" : `${charter ?? "없음"}년`}, 표준 장려금 ${lord.subsidy?.inForceFrom ?? "-"}년부터, 영수증 대조 ${lord.audit.mismatched}/${lord.audit.audited}, `
      + `자리 비교 ${lord.sites?.compared ?? 0}건(후보 둘 이상 ${lord.sites?.withRival ?? 0}, 계획과 다른 자리 ${lord.sites?.movedFromPlan ?? 0}). `
      + `판 시간: 영주 모드 ${Math.round(lord.elapsedSeconds)}초, 봇 캠페인 ${bot.elapsedSeconds === undefined ? "-" : Math.round(bot.elapsedSeconds)}초.`, "",
    "| 해(첫 틱) | L4 영주 | L4 봇 | 인구 영주 | 인구 봇 | 금고 영주 d | 금고 봇 d |", "|---|---:|---:|---:|---:|---:|---:|");
  for (const decade of bot.decades) {
    const own = lordAt(decade.year);
    if (own === undefined) continue;
    out.push(`| ${decade.year} | ${own.l4} | ${decade.l4} | ${own.population} | ${decade.population} | ${own.treasury.toLocaleString("en-US")} | ${decade.treasury.toLocaleString("en-US")} |`);
  }
  out.push("");
}
process.stdout.write(`${out.join("\n")}\n`);
