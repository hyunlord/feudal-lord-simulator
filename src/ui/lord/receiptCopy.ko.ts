// LM-R1 (TA-5, lord-mode §3.6): the "왜 여기?" receipt's copy — why the town built a building where it stands.
import type { ActorKind, ReasonName, Temperament } from "../../engine/townAgency.types";

const percent = (permille: number): string => `${(permille / 10).toFixed(1).replace(/\.0$/, "")}%`;

export const RECEIPT_COPY = {
  /** The diagnostic card's button and the receipt's own name. */
  open: "왜 여기?",
  openLabel: (name: string) => `${name}: 왜 여기에 지었는지 영수증 보기`,
  regionLabel: (name: string) => `${name} 영수증`,
  close: "영수증 닫기",
  heading: (name: string) => `${name}: 왜 여기에 들어섰나?`,
  /** The builder, with its subject particle. */
  actors: { households: "가구들이", merchants: "상인 가문이", guild: "길드가", community: "공동체가", church: "교회가" } satisfies Record<ActorKind, string>,
  builtBy: (actor: string, date: string, score: number, start: number) => `${actor} 지음 · ${date} · 점수 ${score}(착수 기준 ${start})`,
  fromNeed: (place: number) => `마을의 필요에서 나온 사업 · 필요 목록 ${place}번째`,
  fromOpportunity: "필요가 아니라 기회를 보고 낸 사업(방침·장려금)",
  reasonsHeading: "이유 상위 다섯",
  reasons: {
    need: "수요", subsidy: "장려금", policy: "영지 방침", dues: "시장 부담", stuck: "쌓인 물자", access: "길 접근",
    land: "땅값", plan: "계획한 자리", relation: "세력 관계", risk: "불 위험", cost: "비용",
  } satisfies Record<ReasonName, string>,
  /** A reason's value: its sign always written (the bar's length is never the only cue). */
  reasonValue: (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0",
  reasonLabel: (name: string, value: string) => `${name} ${value}점`,
  sitesHeading: "후보지 비교",
  chosenSite: (count: number, tx: number, ty: number, score: number) => `후보지 ${count}곳 중 고른 자리 (${tx}, ${ty}) · 점수 ${score}`,
  nextSite: (tx: number, ty: number, score: number, gap: number) =>
    `다음 자리 (${tx}, ${ty}) · 점수 ${score} · ${gap >= 0 ? `${gap}점 차로 밀림` : `${-gap}점 높았지만 확률로 밀림`}`,
  planSite: (tx: number, ty: number) => `처음 계획한 자리는 (${tx}, ${ty})`,
  noRunnerUp: "후보지가 이곳 한 곳뿐이라 비교할 다음 자리가 없음",
  noSites: "자리를 비교한 기록 없음(한 자리 공사이거나 비교 기록 이전의 옛 저장)",
  chanceHeading: "확률로 골랐음",
  temperaments: { cautious: "신중한", bold: "대담한" } satisfies Record<Temperament, string>,
  projectChance: (of: number, place: number, permille: number, temperament: string) =>
    `이번 주 사업 ${of}건 중 점수 ${place}위를 ${percent(permille)}(${permille}‰) 확률로 골랐음 · ${temperament} 성향`,
  siteChance: (of: number, place: number, permille: number) => `자리는 후보 ${of}곳 중 ${place}위를 ${percent(permille)}(${permille}‰) 확률로 골랐음`,
  noChance: "확률 기록 없음: 확률 선택 이전의 옛 저장에서 온 영수증",
  decisionsHeading: "관련된 영주의 결정",
  noDecisions: "이 사업의 점수를 움직인 영주의 결정 없음",
  decisionLabel: (date: string, line: string) => `${date} 결정 장부 열기: ${line}`,
  missingDecision: "장부에서 찾을 수 없는 결정",
  money: (cost: string, subsidy: string, loan: string) => `비용 ${cost} · 장려금 ${subsidy} · 공동체에서 빌림 ${loan}`,
  noneHeading: "영수증 없음",
  noneLord: "영주의 공공사업은 영주가 직접 놓으므로 마을의 영수증이 없음",
  noneTown: "마을이 스스로 짓기 전부터 있던 건물(처음 마을, 영수증 이전의 옛 저장)이거나 오래되어 지워진 기록이라 영수증이 없음",
} as const;
