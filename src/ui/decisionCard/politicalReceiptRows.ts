import { MERCHANT_GAUGE_START } from "../../content/chapterConfig";
import { LEGACY_AXIS_COPY } from "../../content/legacyCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { legacyOf, legacyScores } from "../../engine/legacy";
import { lordshipOf } from "../../engine/lordshipState";
import { warTaxPermille } from "../../engine/war";
import { ANSWER_RECEIPT_COPY as COPY } from "./answerReceiptCopy.ko";
import type { ReceiptRow } from "./answerReceiptModel";
import { dateWord, holderName } from "./answerWords";
import { POLITICAL_RECEIPT_COPY as WORDS } from "./politicalReceiptCopy.ko";

// RECEIPTS-2 (user 2026-10-10): what the famine's and the political petitions' answers change at once, read off the
// store's state just before and after the answer (the engine's reducer ran it; nothing here decides what an answer does,
// P-D4) — the receipt's rows besides the treasury and the factions' relations (answerReceiptModel.ts): the people and
// the lived-in homes, the merchants' gauge, a right granted, the lordship's decline and title, the war's favour, men,
// instalments, tax and wall, the curacy, the guild, chapter 5's sums, mayor, heir, legacy and the family's seat, the
// family's people who left or came, and the legacy's scores. The famine's answers move only the factions at once; what
// they do to the granary and the treasury comes each season while it lasts (its "later" lines).

const row = (key: string, what: string, change: string): ReceiptRow => ({ key, what, change });
const person = (state: GameState, id: string | null | undefined) => id === null || id === undefined ? COPY.none_ : holderName(state, `person:${id}`);
const lived = (state: GameState) => state.houses.filter(house => house.residents > 0).length;

/** The people, the lived-in homes and the merchants' gauge (the card's own now lines, FC-3). */
function townRows(before: GameState, after: GameState): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  if (after.population !== before.population) rows.push(row("population", WORDS.population, COPY.points(after.population - before.population, before.population, after.population)));
  const [homesWas, homesNow] = [lived(before), lived(after)];
  if (homesNow !== homesWas) rows.push(row("houses", WORDS.livedHouses, COPY.points(homesNow - homesWas, homesWas, homesNow)));
  const [gaugeWas, gaugeNow] = [before.politics?.merchantGauge ?? MERCHANT_GAUGE_START, after.politics?.merchantGauge ?? MERCHANT_GAUGE_START];
  if (gaugeNow !== gaugeWas) rows.push(row("gauge", WORDS.gauge, COPY.points(gaugeNow - gaugeWas, gaugeWas, gaugeNow)));
  return rows;
}

/** A right granted to (or taken from) the merchants or the town (FC-3, PL-8, RG-7, LG-2). */
function rightRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [before.politics?.rights ?? [], after.politics?.rights ?? []];
  const held = new Set(was.map(right => right.id)), still = new Set(now.map(right => right.id));
  return [...now.filter(right => !held.has(right.id)).map(right => row(`right:${right.id}`, WORDS.right(right.id),
    WORDS.rightGranted(right.holder, right.id === "market_charter" ? right.stallFeePermille : null))),
  ...was.filter(right => !still.has(right.id)).map(right => row(`right:${right.id}`, WORDS.right(right.id), WORDS.rightTaken(right.holder)))];
}

/** The decline, the right bought back and the title (FL-6). */
function lordshipRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [lordshipOf(before), lordshipOf(after)];
  const rows: ReceiptRow[] = [];
  if (now.titleDemoted !== was.titleDemoted) rows.push(row("title", WORDS.title, COPY.change(WORDS.titleValue(was.titleDemoted), WORDS.titleValue(now.titleDemoted))));
  if (now.titleReturnsTick !== undefined && now.titleReturnsTick !== was.titleReturnsTick) rows.push(row("title:returns", WORDS.title, WORDS.titleReturns(dateWord(after, now.titleReturnsTick))));
  if ((now.decline === null) !== (was.decline === null)) {
    rows.push(row("decline", WORDS.decline, COPY.change(WORDS.declineValue(was.decline !== null), WORDS.declineValue(now.decline !== null))));
    if (now.decline === null && was.decline?.lost != null) rows.push(row(`right-back:${was.decline.lost}`, WORDS.lostRight(was.decline.lost), WORDS.rightBack));
  }
  const again = now.decline?.petitionFrom;
  if (again !== undefined && again !== was.decline?.petitionFrom) rows.push(row("decline:again", WORDS.again, WORDS.againValue(dateWord(after, again))));
  return rows;
}

/** The war's favour, the men levied, the instalments, the war tax and the wall or the market (WR-2…WR-8). */
function warRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [before.war, after.war];
  if (now === undefined) return [];
  const rows: ReceiptRow[] = [];
  if (was !== undefined && now.favour !== was.favour) rows.push(row("favour", WORDS.favour, COPY.change(WORDS.favourValue(was.favour), WORDS.favourValue(now.favour))));
  if (now.conscripts !== undefined && now.conscripts !== was?.conscripts) {
    rows.push(row("conscripts", WORDS.conscripts, WORDS.conscriptsValue(now.conscripts.men, dateWord(after, now.conscripts.returnTick))));
  }
  for (const [index, due] of now.instalments.slice(was?.instalments.length ?? 0).entries()) {
    rows.push(row(`instalment:${due.category}:${index}`, WORDS.instalment(due.category), WORDS.instalmentValue(due.perSeason, due.seasonsLeft)));
  }
  const [taxWas, taxNow] = [was?.taxSeasonsLeft ?? 0, now.taxSeasonsLeft ?? 0];
  if (taxNow > taxWas) rows.push(row("war-tax", WORDS.warTax, WORDS.warTaxValue(taxNow, warTaxPermille(after))));
  if (now.wall !== undefined && now.wall !== was?.wall) rows.push(row("war-wall", WORDS.wall, WORDS.wallValue[now.wall] ?? now.wall));
  return rows;
}

/** The plague's curacy filled (PL-4) and chapter 4's guild founded (RG-5). */
function churchAndGuildRows(before: GameState, after: GameState): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const [curacyWas, curacyNow] = [before.plague?.curacy, after.plague?.curacy];
  if (curacyNow?.by !== undefined && curacyNow.by !== curacyWas?.by) {
    const comes = curacyNow.filledTick !== undefined && curacyNow.filledTick > after.tick ? dateWord(after, curacyNow.filledTick) : null;
    rows.push(row("curacy", WORDS.curacy, WORDS.curacyValue(curacyNow.by, comes)));
  }
  const guild = after.reorganisation?.guild ?? null;
  if (guild !== null && (before.reorganisation?.guild ?? null) === null) rows.push(row("guild", WORDS.guild, WORDS.guildValue(guild.headId === null ? null : person(after, guild.headId))));
  return rows;
}

/** Chapter 5's sums, the nave, the legacy, the mayor, the heir and the family's seat (LG-2…LG-5, LG-13), and the scores (LG-7). */
function legacyRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [legacyOf(before), legacyOf(after)];
  if (now === undefined) return [];
  const rows: ReceiptRow[] = [];
  for (const [key, what] of [["royalSubsidy", WORDS.royalSubsidy], ["endowment", WORDS.endowment], ["feeFarm", WORDS.feeFarm]] as const) {
    const [from, to] = [was?.[key] ?? 0, now[key]];
    if (to !== from) rows.push(row(`legacy:${key}`, what, COPY.money(to - from, from, to)));
  }
  const [backlashWas, backlashNow] = [was?.backlash ?? 0, now.backlash];
  if (backlashNow !== backlashWas) rows.push(row("legacy:backlash", WORDS.backlash, COPY.points(backlashNow - backlashWas, backlashWas, backlashNow)));
  if (now.naveRebuilt === true && was?.naveRebuilt !== true) rows.push(row("legacy:nave", WORDS.nave, WORDS.naveValue));
  const axis = (id: string | null | undefined) => id === null || id === undefined ? COPY.none_ : LEGACY_AXIS_COPY[id]?.legacy ?? id;
  if (now.legacy !== undefined && now.legacy !== was?.legacy) rows.push(row("legacy:legacy", WORDS.legacy, COPY.change(axis(was?.legacy), axis(now.legacy))));
  if (now.mayorId !== undefined && now.mayorId !== was?.mayorId) rows.push(row("legacy:mayor", WORDS.mayor, COPY.change(person(before, was?.mayorId), person(after, now.mayorId))));
  if (now.heir !== undefined && now.heir.personId !== was?.heir?.personId) {
    rows.push(row("legacy:heir", WORDS.head, COPY.change(person(before, now.heir.previousHeadId), person(after, now.heir.personId))));
  }
  if (now.family !== undefined && now.family !== was?.family) {
    rows.push(row("legacy:family", WORDS.family, COPY.change(WORDS.familyValue[was?.family ?? "stayed"] ?? COPY.none_, WORDS.familyValue[now.family] ?? now.family)));
  }
  if (was !== undefined) {
    const [scoresWas, scoresNow] = [legacyScores(before), legacyScores(after)];
    for (const key of ["town", "family", "church"] as const) {
      if (scoresNow[key] !== scoresWas[key]) {
        rows.push(row(`legacy:score:${key}`, WORDS.legacyScore(LEGACY_AXIS_COPY[key]?.name ?? key), COPY.points(scoresNow[key] - scoresWas[key], scoresWas[key], scoresNow[key])));
      }
    }
  }
  return rows;
}

/** The family's people who left the estate or came into it with the answer (LG-3: the candidates not chosen go). */
function peopleRows(before: GameState, after: GameState): ReceiptRow[] {
  const [was, now] = [before.persons?.people ?? [], after.persons?.people ?? []];
  const [ids, still] = [new Set(was.map(entry => entry.id)), new Set(now.map(entry => entry.id))];
  const left = was.filter(entry => !still.has(entry.id)).map(entry => person(before, entry.id));
  const joined = now.filter(entry => !ids.has(entry.id)).map(entry => person(after, entry.id));
  return [...(left.length === 0 ? [] : [row("people:left", WORDS.left, WORDS.people(left))]),
    ...(joined.length === 0 ? [] : [row("people:joined", WORDS.joined, WORDS.people(joined))])];
}

/** Every number a famine's or a political petition's answer changed at once, besides the treasury and the relations. */
export function politicalReceiptRows(before: GameState, after: GameState): readonly ReceiptRow[] {
  return [...townRows(before, after), ...rightRows(before, after), ...lordshipRows(before, after), ...warRows(before, after),
    ...churchAndGuildRows(before, after), ...legacyRows(before, after), ...peopleRows(before, after)];
}
