import type { PersonStateId } from "./personStates";

// INSTALL-23 ④ copy: what a portrait's state ornament means, in words (the portrait's accessible name and the line
// beside a chip or on the card: the 48 px ornament is small, so its meaning is also written).
const LABELS: Readonly<Record<PersonStateId, string>> = {
  dead: "세상을 떠남",
  hunger: "굶주림",
  sick: "병",
  injury: "부상",
  mourning: "상중",
  child_born: "아이를 얻음",
  pregnant: "임신",
  marriage: "혼인",
  pilgrim: "순례 중",
  steward: "청지기",
  bailiff: "집행관",
  reeve: "마을 대표(reeve)",
};

export const PERSON_STATE_COPY = {
  label: (state: PersonStateId) => LABELS[state],
  /** The chip's button name with the state ("…의 인물 카드 열기 · 상중"). */
  openCard: (name: string, state: string) => `${name}의 인물 카드 열기 · ${state}`,
  /** The card's line under the name. */
  cardLine: (state: string) => `지금: ${state}`,
  /** A portrait's accessible name with its state (the biography's great circle, a faction leader). */
  withState: (line: string, state: string) => `${line} · ${state}`,
  // The kit gallery's section (a developer screen).
  gallerySection: "인물 상태 장식",
  galleryNote: "초상 틀 오른쪽 아래 · 96px(카드·전기)와 48px(칩) · 사망은 초상을 흑백으로",
  galleryEngine: "엔진에서 파생",
  galleryChipName: "앨리스 애덤슨",
  galleryChipLine: "가구주 · 31살",
} as const;
