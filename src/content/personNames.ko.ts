/**
 * FIX-6 ③ (decision FX6-4): the Korean readings of every person's name — each given name and surname the game gives
 * (`personNames.ts`, the steward's, the gentry's `GENTRY_NAMES_KO`), the kings' regnal names, and the bynames that tell
 * namesakes apart, read as a Korean epithet before the name ("큰 토머스 애덤슨"). The period English stays in the
 * state; screens show `personDisplayName`.
 */
import { GENTRY_NAMES_KO } from "./gentryNames";

export const GIVEN_NAMES_KO: Readonly<Record<string, string>> = {
  John: "존", William: "윌리엄", Thomas: "토머스", Richard: "리처드", Robert: "로버트", Walter: "월터", Henry: "헨리", Roger: "로저",
  Hugh: "휴", Nicholas: "니컬러스", Adam: "애덤", Simon: "사이먼", Geoffrey: "제프리", Ralph: "랠프", Stephen: "스티븐", Gilbert: "길버트",
  Peter: "피터", Philip: "필립", Reginald: "레지널드", Alan: "앨런", Laurence: "로런스", Hamo: "해모", Osbert: "오즈버트", Elias: "일라이어스",
  Jordan: "조던", Bartholomew: "바살러뮤", Martin: "마틴", Andrew: "앤드루", Edmund: "에드먼드", Matthew: "매슈",
  Alice: "앨리스", Agnes: "애그니스", Joan: "조앤", Matilda: "머틸다", Margery: "마저리", Emma: "에마", Isabel: "이저벨", Juliana: "줄리애나",
  Christina: "크리스티나", Cecily: "시슬리", Margaret: "마거릿", Edith: "이디스", Beatrice: "비어트리스", Avice: "에이비스", Lucy: "루시",
  Petronilla: "페트로닐라", Amice: "에이미스", Sibyl: "시빌", Mabel: "메이블", Rose: "로즈", Katherine: "캐서린", Elena: "엘레나",
  Denise: "드니즈", Felicia: "펄리시아", Hawise: "하와이즈", Idonea: "이도니아", Letitia: "레티시아", Gillian: "질리언", Clarice: "클래리스",
  Eleanor: "엘리너",
};

/** The town's surnames (trade, place, father's name, the steward's) and the gentry's invented houses. */
export const SURNAMES_KO: Readonly<Record<string, string>> = {
  Miller: "밀러", Baker: "베이커", Smith: "스미스", Carter: "카터", Granger: "그레인저", Sawyer: "소여", Woodward: "우드워드", Mason: "메이슨",
  Quarrier: "쿼리어", Hayward: "헤이워드", Chapman: "채프먼", Spenser: "스펜서", Reeve: "리브",
  "atte Well": "아트웰", "atte Wood": "아트우드", "atte Brook": "아트브룩", "atte Hill": "아트힐", "atte Green": "아트그린", "atte Mill": "아트밀",
  "atte Bridge": "아트브리지", "atte Lane": "아트레인", "atte Moor": "아트무어", "atte Field": "아트필드", Bywater: "바이워터", Underwood: "언더우드",
  Townsend: "타운센드", Hatch: "해치", Westbrook: "웨스트브룩", Northwood: "노스우드",
  Johnson: "존슨", Williamson: "윌리엄슨", Thomson: "톰슨", Richardson: "리처드슨", Robertson: "로버트슨", Watson: "왓슨", Harrison: "해리슨",
  Hodgson: "호지슨", Hewson: "휴슨", Nicholson: "니컬슨", Adamson: "애덤슨", Simmonds: "시먼즈", Jefferson: "제퍼슨", Rawlinson: "롤린슨",
  Stevenson: "스티븐슨", Gibson: "깁슨", Pearson: "피어슨", Phillipson: "필립슨",
  "de Stratton": "드 스트래턴", "de Ashby": "드 애시비", "de Wendover": "드 웬도버", "de Merton": "드 머턴", "de Harpden": "드 하프든", "de Cumbe": "드 쿰",
  ...GENTRY_NAMES_KO,
};

/** The namesakes' bynames as a Korean epithet before the name (the elder → 큰 존). QA010: the elder and the younger of a
 * pair are 큰/작은 as senior and junior are — the pair's order, not an age ("젊은" for an 82-year-old read wrong). */
export const EPITHETS_KO: Readonly<Record<string, string>> = {
  "senior": "큰", "junior": "작은", "the father": "아버지", "the son": "아들",
  "the elder": "큰", "the younger": "작은", "le Rous": "붉은 머리", "le Brun": "갈색 머리", "le Blund": "금발", "le Long": "키다리",
  "le Petit": "꼬마", "le Wyte": "하얀", "le Neve": "조카", "le Gode": "착한",
  "the third": "셋째", "the fourth": "넷째", "the fifth": "다섯째", "the sixth": "여섯째", "the seventh": "일곱째", "the eighth": "여덟째",
  "the ninth": "아홉째", "the tenth": "열째",
};

/** FIX-12 (item 4): the pair epithets the ledger's sentences wrote before QA010 (v40 saves), read as epithets in v41. */
export const OLD_EPITHETS_KO: readonly string[] = ["젊은", "늙은"];

/** FX-5 England's kings by their Korean regnal names. */
export const KING_NAMES_KO: Readonly<Record<string, string>> = {
  "Edward I": "에드워드 1세", "Edward II": "에드워드 2세", "Edward III": "에드워드 3세", "Richard II": "리처드 2세",
  "Henry IV": "헨리 4세", "Henry V": "헨리 5세", "Henry VI": "헨리 6세",
};

export const PERSON_NAME_COPY = {
  /** The last byname a town runs to (`no. 000123`, after the tenth namesake). */
  numberedEpithet: (number: string) => `${number}번`,
  fullName: (epithet: string | null, given: string, surname: string | null) =>
    epithet === null ? (surname === null ? given : `${given} ${surname}`) : surname === null ? `${epithet} ${given}` : `${epithet} ${given} ${surname}`,
};
