/**
 * LM-E3 human path (NG-10): a lord-mode town from 1300 (opening 1), played by commands only — the chapters' answers as
 * the bot gives them; the marriage offered once a groom of the house is of age (FIX-12: again a year after a refusal), the counterpart's counter taken, the promises
 * kept as the treasury allows, the will-change answered with a favour — through the bride's coming, the first child,
 * the old lord's illness and death to the inheritance: the third neighbour's estate becomes the lord's. No state is
 * edited (`scripts/marriagePath.ts` drives the commands and reads the screens' APIs).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { marriagePath } from "../scripts/marriagePath";

test("humanPath marriage: offer → counter → contract → bride → child → illness → will → death → the neighbour's estate is the lord's", () => {
  const path = marriagePath({ seed: 1, keepState: true });
  assert.equal(path.stage, "inherited");
  assert.deepEqual(path.estate, { titleHolder: "lord", possessor: "lord" });
  assert.deepEqual(Object.keys(path.events).filter(event => ["bride_arrived", "child_born", "father_ill", "father_died"].includes(event)),
    ["bride_arrived", "child_born", "father_ill", "father_died"]);
  // FIX-12: offers refused (no counter the lord's year can carry) are made again a year later; the contract's offer is the last.
  const order = ["propose_marriage", "answer_counter"];
  const sent = path.commands.map(entry => entry.command.replace(/\(.*$/, "")).filter(command => order.includes(command));
  const contracted = path.negotiations.find(entry => entry.status === "accepted")!;
  const last = sent.lastIndexOf("propose_marriage");
  assert.deepEqual(sent.slice(last), contracted.counter === null ? ["propose_marriage"] : order);
  assert.ok(path.promises.filter(promise => promise.promisor === "lord").every(promise => promise.status === "kept"), "every promise the lord's year could carry, kept");
  assert.ok(path.ledger.some(line => line.includes("혼인 계약이 맺어졌다")));
  assert.ok(path.ledger.some(line => line.includes("이웃 영지를 물려받았다")));
  // PLAY-2 §4 (GROW-BLOCK): the first child's record names the child and its father, the one the people say.
  const records = path.state!.history!.records;
  const born = records.find(record => record.template === "marriage.child_born")!;
  const persons = path.state!.persons!;
  const people = [...persons.people, ...persons.past];
  const child = people.find(person => person.id === born.params!.child)!;
  assert.ok(child !== undefined, "the child is named");
  assert.equal(born.params!.father, child.fatherId);
  assert.equal(child.motherId, born.params!.bride);
});
