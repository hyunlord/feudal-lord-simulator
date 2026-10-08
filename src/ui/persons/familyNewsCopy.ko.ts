// PLAY-2 (Astra's second lord-mode play, friction 9): who a birth, a marriage or a death names, by their part in it.
import type { FamilyRole } from "./familyNews";

export const FAMILY_NEWS_COPY = {
  roles: { child: "아이", mother: "어머니", father: "아버지", groom: "신랑", bride: "신부", spouse: "배우자", deceased: "고인" } satisfies Record<FamilyRole, string>,
  /** One person with the part: "어머니 앨리스". */
  named: (role: string, name: string) => `${role} ${name}`,
  joiner: " · ",
  /** A record's sentence with the people it names after it. */
  withPeople: (sentence: string, people: string) => `${sentence} — ${people}`,
  /** A lord's moment's way to its record in the chronicle (where each person's biography opens). */
  openLabel: (title: string) => `${title} — 연대기에서 이 사람들 보기`,
  /** The biography button's name. */
  biographyLabel: (role: string, name: string) => `${role} ${name}의 전기 보기`,
} as const;
