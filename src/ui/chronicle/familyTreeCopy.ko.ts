import type { NamedLineageKind } from "../../engine/persons.types";

// UI-7 the biography's family tree (가계도): the tab, the banner, the generation labels and the node lines.
export const FAMILY_TREE_COPY = {
  biographyTab: "전기",
  treeTab: "가계도",
  tabsLabel: "인물 쪽",
  treeLabel: (name: string) => `${name}의 가계도`,
  /** The banner: the lineage's surname and, for a named lineage, its kind. */
  banner: (surname: string | null, kind: NamedLineageKind | null) =>
    surname === null ? (kind === null ? "가문" : LINEAGE_KINDS[kind]) : kind === null ? `${surname} 가문` : `${surname} 가문 · ${LINEAGE_KINDS[kind]}`,
  generation: (index: number) => `${index + 1}대`,
  years: (born: number, end: number | null, alive: boolean) => end === null ? (alive ? `${born}–` : `${born}`) : `${born}–${end}`,
  outsideSpouse: "혼인으로 든 사람",
  deceased: "고인",
  // UI-8 (F3-A PL-2): plague-dead persons show the cause in the node's aria-label and as a visible line.
  plagueDeath: (year: number) => `역병으로 죽음 (${year})`,
  node: (name: string, years: string, outside: boolean, dead: boolean, deathCause?: string) =>
    [name, years, ...(outside ? ["혼인으로 든 사람"] : []), ...(dead ? [deathCause ?? "고인"] : [])].join(", "),
  collapse: (name: string, count: number) => `${name}의 자손 ${count}명 접기`,
  expand: (name: string, count: number) => `${name}의 자손 ${count}명 펼치기`,
  hidden: (count: number) => `자손 ${count}명`,
  empty: "이 사람의 가계는 아직 기록이 없습니다",
} as const;

const LINEAGE_KINDS: Readonly<Record<NamedLineageKind, string>> = {
  lord: "영주 가문", overlord: "상급 영주 가문", neighbour: "이웃 영주 가문", merchant: "상인 가문", reeve: "촌장 가문", miller: "방앗간 가문",
};
