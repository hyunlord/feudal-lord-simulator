/**
 * LM-E3 human path (NG-10): a lord-mode town from 1300 (opening 1), played by commands only — the chapters' answers as
 * the bot gives them; the marriage offered once the lord's son is of age, the counterpart's counter taken, the promises
 * kept as the treasury allows, the will-change answered with a favour — through the bride's coming, the first child,
 * the old lord's illness and death to the inheritance: the third neighbour's estate becomes the lord's. No state is
 * edited (`scripts/marriagePath.ts` drives the commands and reads the screens' APIs).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { marriagePath } from "../scripts/marriagePath";

test("humanPath marriage: offer → counter → contract → bride → child → illness → will → death → the neighbour's estate is the lord's", () => {
  const path = marriagePath({ seed: 1 });
  assert.equal(path.stage, "inherited");
  assert.deepEqual(path.estate, { titleHolder: "lord", possessor: "lord" });
  assert.deepEqual(Object.keys(path.events).filter(event => ["bride_arrived", "child_born", "father_ill", "father_died"].includes(event)),
    ["bride_arrived", "child_born", "father_ill", "father_died"]);
  const order = ["propose_marriage", "answer_counter"];
  const sent = path.commands.map(entry => entry.command.replace(/\(.*$/, "")).filter(command => order.includes(command));
  assert.deepEqual(sent.slice(0, 2), path.negotiations[0]!.status === "accepted" && path.negotiations[0]!.counter === null ? ["propose_marriage"] : order);
  assert.ok(path.ledger.some(line => line.includes("혼인 계약이 맺어졌다")));
  assert.ok(path.ledger.some(line => line.includes("이웃 영지를 물려받았다")));
});
