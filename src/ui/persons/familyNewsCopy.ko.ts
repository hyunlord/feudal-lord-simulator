// PLAY-2 (Astra's second lord-mode play, friction 9): who a birth, a marriage or a death names, by their part in it.
import { particle, withParticle } from "../particle.ko";
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
  /** LS1-6: the family chip (persons/familyBeats.ts) — a birth, a death, a marriage in the lord's family, by given names. */
  chip: {
    born: (given: string) => `${withParticle(given, "이/가")} 태어났습니다`,
    died: (given: string) => `${withParticle(given, "이/가")} 세상을 떠났습니다`,
    married: (one: string, other: string | null) => other === null ? `${withParticle(one, "이/가")} 혼인했습니다` : `${one}${particle(one, "과/와")} ${withParticle(other, "이/가")} 혼인했습니다`,
    bornLine: (year: number, season: string) => `${year}년 ${season}, 영주 집안에 아이가 태어났습니다`,
    advice: "연대기에서 이 사람들의 전기를 볼 수 있습니다.",
    bornAdvice: "영주 집안에 아이가 하나 늘었습니다.",
  },
} as const;
