// DEC-CARD A1 (Astra's lord-mode play 2026-10-06): in lord mode the lord does not build — the town does. Advice names
// what the lord can really do (the estate policy, a subsidy, the encouraged zones, the town's requests) and, while he
// must wait, what the town is doing about it now and what holds it. The steward speaks ("~합니다"); a lever names the
// place on screen where the lord sets it (명령 › 방향, 명령 › 장려 구역).
import type { ActorKind } from "../../../engine/townAgency.types";

const finalOf = (word: string): number => {
  const last = word.charCodeAt(word.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
};
const pick = (word: string, withFinal: string, without: string): string => `${word}${finalOf(word) !== 0 ? withFinal : without}`;
/** 을/를, 이/가, 은/는. */
const object = (word: string) => pick(word, "을", "를");
const subject = (word: string) => pick(word, "이", "가");
const topic = (word: string) => pick(word, "은", "는");

export const LORD_ADVICE_COPY = {
  /** Who builds (the town agency's actors), without a particle. */
  actors: { households: "가구들", merchants: "상인 가문", guild: "길드", community: "공동체", church: "교회" } satisfies Record<ActorKind, string>,
  /** What a town project is, for the kinds that are not buildings. */
  projects: { road: "길", house: "집", arable: "경작지", burgage: "필지" } as const,
  // --- what the town is doing about it (the town agency's own state) ---
  underway: (name: string) => `마을이 ${object(name)} 짓고 있습니다. 다 지을 때까지 기다리면 됩니다`,
  charterHold: (since: string) => `마을은 ${since}부터 시장도시 선포를 기다리며 새 건물을 미루고 있습니다`,
  sitesFull: (open: number, max: number) => `마을의 공사장 ${open}곳이 모두 차 있습니다(한 번에 ${max}곳까지)`,
  candidate: (name: string, actor: string, score: number, start: number) =>
    `마을의 사업 후보에 ${subject(name)} 있습니다: ${actor}의 사업, 점수 ${score}(착수 기준 ${start})`,
  funds: (actor: string, funds: string, cost: string) => `${actor}의 돈 ${funds} · 드는 돈 ${cost}`,
  notProposed: (name: string) => `마을의 사업 후보에 ${topic(name)} 아직 없습니다`,
  started: (names: string) => `이번 주 마을이 시작한 일: ${names}`,
  startedNone: "이번 주 마을이 시작한 일은 없습니다",
  // --- what the lord can do ---
  policyOn: (policy: string, name: string, points: number) => `지금 '${policy}' 방침이 ${name}에 점수 +${points}를 줍니다`,
  policyOff: (policy: string, name: string, points: number) => `명령 › 방향: '${policy}' 방침을 두면 ${name}에 점수 +${points}`,
  subsidyOn: (name: string, amount: string) => `${name} 장려금이 한 건에 ${amount} 걸려 있습니다`,
  subsidyOff: (name: string, points: number) => `명령 › 방향: ${name}에 장려금을 걸면 10d마다 점수 +${points}`,
  zone: (zone: string) => `명령 › 장려 구역: ${object(zone)} 칠해 두면 마을이 그 안에 짓습니다`,
  request: (what: string) => `마을의 청이 영주를 기다립니다: ${what}`,
  /** The town's request that holds its buildings (TA-12: the charter). */
  requests: { proclaim_era: "시장도시 선포" } as const,
  /** The settlement panel's larder rule, as lord mode reads it. */
  larderRule: "가구별 세 끼를 비축합니다. 가구가 늘면 마을이 경작지·방앗간·길을 늘립니다. 영주는 방침과 장려금으로 그 순서를 움직입니다.",
  /** The season card's hint, for the food the town needs. */
  seasonHint: (needs: string, lever: string) => `${needs} — 마을이 짓습니다. ${lever}`,
  /** The lean season's card (the first winter's warning). */
  leanWhy: (lever: string) => `곳간과 들판의 식량이 겨울과 봄을 넘기지 못합니다. 곡창과 밭은 마을이 짓습니다. ${lever}`,
  leanSteward: "영주님, 이대로면 보릿고개를 못 넘깁니다. 방침과 장려금으로 곡창과 밭을 앞당기십시오.",
  /** The steward's forecast lines on a sign of a fire, a dearth, the great famine: the omen, then who builds against it and
   *  the lord's lever (a rumour keeps the sandbox's line: nothing to do yet). */
  forecast: { fire: "마른 여름이 옵니다", dearth: "밭이 젖을 조짐입니다", famine: "큰 기근의 조짐이 보입니다" },
  builds: (name: string, actor: string) => `${object(name)} ${subject(actor)} 짓습니다`,
  /** An event card's [조언] for the fire's aftermath: the burnt house's household rebuilds it (LM-R1 burnt house). */
  fireAftermath: "불탄 집은 마을 사람들이 다시 짓습니다. 불탄 집을 누르면 공사가 어디까지 왔는지 보입니다",
  /** Joins the steward's lines into one [조언]. */
  join: (lines: readonly string[]) => lines.join(". "),
} as const;
