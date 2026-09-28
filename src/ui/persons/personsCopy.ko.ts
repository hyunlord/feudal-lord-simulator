import { HISTORY_OCCUPATIONS } from "../../content/historyCopy.ko";

// UI-5 copy: people on screen (the petition's petitioners, the steward, a house's members, a walker's name, the person card).
const ROLES: Readonly<Record<string, string>> = { head: "가구주", spouse: "배우자", child: "자녀", kin: "친척", steward: "청지기" };
/** PERSON-0 trades (PS-4) as what a person is called (CHRON-1's chronicle uses the same words). */
const TITLES: Readonly<Record<string, string>> = {
  miller: "방앗간지기", sawyer: "톱장이", mason: "석공", chapman: "행상", husbandman: "농부", woodward: "산지기", quarrier: "채석공",
  granger: "곡창지기", storekeeper: "창고지기", steward: "청지기", labourer: "일꾼", child: "아이",
  // UI-7: the lord's family's own (PERSON-1a LN-9).
  lord: "영주", lady: "귀부인",
};
/** UI-7: what each of the lord's family is to the lord (their manor role and sex). */
const LORD_FAMILY: Readonly<Record<string, Readonly<Record<"female" | "male", string>>>> = {
  head: { male: "영주", female: "영주" }, spouse: { female: "영주 부인", male: "영주의 부군" }, child: { male: "영주의 아들", female: "영주의 딸" },
  kin: { female: "영주의 친족", male: "영주의 친족" },
};
/** UI-7: the young stages (PERSON-1a LN-6: a baby 0–2, a toddler 3–5 — their faces from the common pool or the lineage set). */
const STAGES: Readonly<Record<string, string>> = { pool: "", baby: "아기", infant: "아기", toddler: "유아", child: "아이", young: "청년", mature: "장년", old: "노년" };
const finalOf = (word: string) => { const last = word.charCodeAt(word.length - 1); return last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0; };
const josa = (word: string, withFinal: string, without: string) => finalOf(word) !== 0 ? withFinal : without;
/** 으로 after a final consonant, 로 after a vowel or ㄹ (final index 8). */
const toward = (word: string) => finalOf(word) !== 0 && finalOf(word) !== 8 ? "으로" : "로";

export const PERSONS_COPY = {
  role: (role: string) => ROLES[role] ?? role,
  occupation: (occupation: string) => TITLES[occupation] ?? HISTORY_OCCUPATIONS[occupation] ?? occupation,
  age: (age: number) => `${age}살`,
  /** UI-6: a faction's leader (the king, an earl, a bishop, a house's head): the faction it leads and the age. */
  leaderLine: (faction: string, age: string) => `${faction}의 수장 · ${age}`,
  memberLine: (role: string, age: string, occupation: string | null) => occupation === null ? `${role} · ${age}` : `${role} · ${age} · ${occupation}`,
  householdOf: (name: string) => `${name}의 집`,
  manor: "영주의 집안",
  /** UI-7: the rights register's house page — the lord's family and the steward. */
  lordHouseholdHeading: "영주의 가솔",
  lordFamilyLine: (role: string, sex: "female" | "male", age: string) => `${LORD_FAMILY[role]?.[sex] ?? ROLES[role] ?? role} · ${age}`,
  membersHeading: "식구",
  membersEmpty: "사는 사람이 없습니다",
  membersAll: (count: number) => `식구 ${count}명 모두 보기`,
  membersFewer: "식구 접기",
  openCard: (name: string) => `${name}의 인물 카드 열기`,
  // Petition and famine.
  petitionersHeading: "청원한 사람들",
  steward: (name: string) => `청지기 ${name}`,
  stewardAdvice: "영주님, 굶는 집이 늘기 전에 정하셔야 합니다",
  // Walkers (visibility design 4절: verb + what + where + progress).
  carrying: (cargo: string, destination: string) => `${cargo}${josa(cargo, "을", "를")} ${destination}${toward(destination)} 나르는 중`,
  delivering: (cargo: string) => `${cargo}${josa(cargo, "을", "를")} 집집마다 나누는 중`,
  returning: (home: string | null) => home === null ? "돌아가는 중" : `${home}${toward(home)} 돌아가는 중`,
  returningHome: "곡창으로 돌아가는 중",
  site: (building: string) => `${building} 공사장`,
  palisadeSite: "목책 공사장",
  stoneWallSite: "석벽 공사장",
  somewhere: "목적지",
  progress: (line: string, delivered: number, required: number) => `${line} · ${delivered}/${required}`,
  walkerName: (name: string, role: string) => `${name} · ${role}`,
  // Person card.
  cardTitle: (name: string) => `${name}의 인물 카드`,
  cardRole: (role: string, occupation: string | null) => occupation === null ? role : `${role} · ${occupation}`,
  cardLife: (born: number, age: number) => `${born}년생 · ${age}살`,
  portraitMatch: (identity: string, stage: string, exact: boolean) =>
    `초상 ${identity}${STAGES[stage] === "" || STAGES[stage] === undefined ? "" : ` ${STAGES[stage]}`} · ${exact ? "성별·나이대·계층 일치" : "가장 가까운 그림"}`,
  /** UI-5 ⑥: the steward's fixed portrait (the P0 steward, whoever holds the office). */
  stewardPortrait: "초상 청지기 고정 인물 · 직책 일치",
  arms: "영주 가문의 문장",
  merchantMark: "상인 가구의 표식",
  noEmblem: "문장·표식 없음",
  biography: "전기 보기",
  close: "닫기",
  closeLabel: "인물 카드 닫기",
} as const;
