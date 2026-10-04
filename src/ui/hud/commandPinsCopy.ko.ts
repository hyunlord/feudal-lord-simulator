// LM-R1 (lord-mode design §2, §4): in lord mode the build drawer is the lord's command pins — the public works he
// still places himself and the zones he marks out for the town; the town builds everything else.
export const COMMAND_PINS_COPY = {
  region: "영주의 명령",
  dock: "명령",
  /** The public work the lord places (TA-1 `LORD_PUBLIC_WORKS`). */
  publicWork: (name: string) => `${name} 짓기`,
  publicWorkNote: "공공사업 · 영주가 자리를 정합니다",
  standing: (name: string) => `${name} — 이미 섰습니다`,
  building: (name: string) => `${name} — 짓는 중`,
  locked: (stage: string) => `${stage} 이후`,
  zone: "장려 구역",
  zoneNote: "구역을 칠하면 마을이 그 안에 짓습니다",
  /** Astra B02: the direction layer — the lord's conditions in the ledger's lord tab. */
  direction: "방향",
  directionNote: "방침·장려금·시장 부담",
  directionLocked: "첫 청원에 답한 뒤",
  /** The town builds the rest (the drawer's catalogue is the sandbox's). */
  townBuilds: "다른 건물은 마을이 스스로 짓습니다",
  close: "닫기",
} as const;
