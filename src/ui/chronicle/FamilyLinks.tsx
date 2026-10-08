import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { Button } from "../kit";
import { familyPeople } from "../persons/familyNews";
import { FAMILY_NEWS_COPY } from "../persons/familyNewsCopy.ko";
import { UiIcon } from "../UiIcon";
import type { RecordCard } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";

// PLAY-2 (friction 9): the picked record's people as biography buttons — a birth's child and parents, a marriage's couple,
// a death's deceased (familyPeople: the record's own subject and params) — each "어머니 앨리스", opening that biography in
// place of the list. Any other record keeps the one [인물] button for its person.
export function FamilyLinks({ state, record, card, onPerson }: {
  readonly state: GameState; readonly record: HistoryRecord; readonly card: RecordCard; readonly onPerson: (personId: string) => void;
}) {
  const people = familyPeople(state, record).filter(person => person.biography);
  if (people.length === 0) {
    return card.personId === null || card.personName === null ? null : <Button type="button" className="chronicle-detail-action" aria-label={COPY.personLabelFor(card.personName)}
      onPress={() => { if (card.personId !== null) onPerson(card.personId); }} variant="secondary"><UiIcon sheet="resource" cell="population" />{COPY.person}</Button>;
  }
  return <>{people.map(person => {
    const role = FAMILY_NEWS_COPY.roles[person.role];
    return <Button key={`${person.role}:${person.personId}`} type="button" className="chronicle-detail-action" data-family={person.role}
      aria-label={FAMILY_NEWS_COPY.biographyLabel(role, person.name)} onPress={() => onPerson(person.personId)} variant="secondary">
      <UiIcon sheet="resource" cell="population" />{FAMILY_NEWS_COPY.named(role, person.name)}</Button>;
  })}</>;
}
