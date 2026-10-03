/** LM-E9 (ER-1): the registry entries' words — titles, bodies and choice labels (the imported drafts'; docs/design/glossary.md). */

export interface RegistryEntryCopy {
  readonly title: string;
  readonly body: string;
  readonly choices: Readonly<Record<string, { readonly label: string; readonly ledger: string }>>;
}

/** The imported drafts' words, by entry id (content drafts v2 events.json, as written; ER-10). */
export const REGISTRY_COPY: Readonly<Record<string, RegistryEntryCopy>> = {
  "ck_evt_005": { title: "빈 좌판 곁의 세금 장부", body: "상인들은 새 좌판이 늘기 전에 시장 좌판세부터 낮춰 달라고 합니다. 수입관리인은 그 돈으로 다른 지출을 치러야 한다고 답합니다.",
    choices: { "a": { label: "시장 좌판세를 낮춘다", ledger: "시장 좌판세를 기본의 750‰로 정했다." }, "b": { label: "시장 좌판세를 높여 세입을 구한다", ledger: "시장 좌판세를 기본의 1250‰로 정했다." }, "c": { label: "기존 세율을 지키며 다음 거래를 지켜본다", ledger: "시장 부담1000‰ 유지. 즉시 금고 이동 없음." } } },
  "ck_evt_009": { title: "수도원 문서함에서 고를 증거", body: "수도원 문서함에 특허장과 재산 증서, 법정의 장부가 남아 있다는 답이 왔습니다. 모두 옮겨 적기에는 비용이 큽니다. 먼저 소송에 낼 기록을 골라야 합니다.",
    choices: { "a": { label: "특허장 사본을 증거로 갖춘다", ledger: "진행 소송에 특허장 증거 등록, 40d 지출." }, "b": { label: "재산 증서를 증거로 갖춘다", ledger: "진행 소송에 재산 증서 등록, 30d 지출." }, "c": { label: "법정 장부의 짧은 등본만 갖춘다", ledger: "법정 장부 증거 비용20d, 청구 증거 가중치+10." } } },
  "ck_evt_013": { title: "연줄 있는 청지기의 빈 장부", body: "미카엘마스 감사에서 청지기가 감춘 돈이 드러났습니다. 그의 연줄을 생각할지, 드러난 돈을 거둬들이고 사람을 바꿀지 정해야 합니다.",
    choices: { "a": { label: "돈을 회수하고 청지기를 해임한다", ledger: "감사 징계: Rd 회수, 청지기 해임과 후임 기록." }, "b": { label: "드러난 일을 덮고 유임한다", ledger: "감사 관용: 회수 없음, 청지기 유임." }, "c": { label: "회수 없이 해임하고 후임에게 넘긴다", ledger: "감사 결과 청지기 교체. 회수액0d, 연줄 세력 징벌 변화 없음." } } },
  "ck_evt_027": { title: "왕의 징발을 기다리는 길목", body: "왕실 조달에 관한 소식이 돌자 관리인은 창고와 길을 먼저 살피자 합니다. 장터 대표는 새 집터와 시장 쪽 일을 뒤로 미루지 말아 달라 합니다. 관리인은 방침은 두고 목재부터 사 둘 수도 있다고 덧붙입니다.",
    choices: { "defence": { label: "방어 방침으로 돌린다", ledger: "영지 방침 defence; 즉시 현금·병력 변화 없음." }, "growth": { label: "성장 방침을 택한다", ledger: "영지 방침 growth; 즉시 현금·병력 변화 없음." }, "supply": { label: "방침은 두고 창고용 목재 8단을 주문한다", ledger: "목재8단 주문; 방침 유지, 시장일 실제 구매분만 지급." } } },
  "ck_evt_032": { title: "두 묶음의 증거", body: "이웃 가문과의 소송에 보탤 문서가 두 묶음 들어왔습니다. 서기는 특허장 쪽이 힘이 세지만 법정 기록을 내는 편이 덜 든다 합니다.",
    choices: { "charter": { label: "특허장을 증거로 낸다", ledger: "소송 특허장 증거 비용40d; 가중치20 추가." }, "roll": { label: "법정 기록을 증거로 낸다", ledger: "소송 법정 기록 비용20d; 가중치10 추가." }, "both": { label: "두 묶음을 함께 낸다", ledger: "특허장40d와 법정 기록20d를 순차 제출; 모두 성공 시총60d·가중치30." } } },
  "ck_evt_033": { title: "교회 궤짝에 맡긴 증서", body: "진행 중인 소송의 옛 증서가 교회 궤짝에 보관되어 있다는 말이 왔습니다. 교회 서기는 증서를 옮겨 적어 내거나, 내용을 기억하는 증인들을 부르자고 합니다.",
    choices: { "deed": { label: "보관한 증서를 증거로 낸다", ledger: "증서 증거 비용30d 지출; 소송 증거 가중치15 추가." }, "witnesses": { label: "기억하는 증인들을 불러 증언을 낸다", ledger: "증인 증거 비용24d 지출; 소송 증거 가중치8 추가." }, "both": { label: "증서와 증인을 함께 제출한다", ledger: "증서30d·증인24d 순차 제출; 모두 성공 시54d·가중치23." } } },
  "ck_evt_034": { title: "같은 청원이 또 올라오다", body: "지난번과 같은 장원 청원이 다시 책상에 쌓였습니다. 청지기는 앞선 판결대로 처리하겠다 하지만, 소작인 대표는 영주가 다시 들어 주길 바랍니다. 영주는 금액의 크기와 권리·혼인 안건을 갈라 들을 수도 있습니다.",
    choices: { "precedent": { label: "같은 종류는 선례를 따르게 한다", ledger: "반복 예외 상신 해제; 기존 선례 처리 허용." }, "hear": { label: "반복 청원도 다시 올리게 한다", ledger: "반복 청원 예외 상신 유지; 현금 변동 없음." }, "rights_only": { label: "금액 대신 권리·혼인 안건만 다시 올리게 한다", ledger: "전역예외: 금액없음, 권리·혼인true, 반복true; 기존 열린 청원은 미결유지." } } },
  "ck_evt_038": { title: "판결 뒤에도 닫힌 문", body: "소송의 판결은 나왔지만 다투던 권리의 점유는 아직 이웃에게 있습니다. 관리인은 집행비를 내고 절차를 밟을지, 당분간 금고를 지킬지 묻습니다.",
    choices: { "enforce": { label: "점유 집행을 시도한다", ledger: "점유 집행비80d; 성공 여부와 남은 저항값을 실제 결과로 기록." }, "defer": { label: "집행을 미룬다", ledger: "집행 미실시; 금고·점유 변화 없음." } } },
  "ck_evt_050": { title: "교구의 살림을 먼저 봐 주십시오", body: "교구 대표가 곡물 보관과 물 긷는 일이 불편하다는 말을 모아 왔습니다. 집안 서기는 새집과 장터를 기다리는 사람들의 사정도 함께 전합니다.",
    choices: { "stability": { label: "살림의 안정을 먼저 살핀다", ledger: "영지 방침: 안정; 즉시 지출 없음." }, "growth": { label: "새 살림을 받아들이는 일을 앞세운다", ledger: "영지 방침: 성장; 즉시 지출 없음." }, "revenue": { label: "수입을 낳는 사업부터 장려한다", ledger: "영지 방침을 수입으로 변경; 즉시 현금 이동 없음." } } },
  "ck_evt_052": { title: "빠진 돈과 청지기의 후원자", body: "감사에서 장부와 맞지 않는 돈이 드러났습니다. 청지기를 밀어 준 세력의 대리인은 처벌을 거두어 달라고 하고, 소작인들은 설명을 기다립니다.",
    choices: { "punish": { label: "해임하고 드러난 돈을 회수한다", ledger: "감사 처분: {recovered}d 회수; 청지기 해임 및 후임 지정." }, "replace": { label: "회수 없이 청지기만 바꾼다", ledger: "감사 처분: 회수 없음; 청지기 교체." }, "tolerate": { label: "현직을 남겨 둔다", ledger: "감사 처분: 현직 유임; 회수 없음." } } },
  "ck_evt_053": { title: "할머니의 증서와 장원 법정 기록", body: "가문의 서기가 할머니 때 작성한 증서와 장원 법정 기록을 나란히 펼쳤습니다. 진행 중인 권리 소송에 어느 쪽을 먼저 갖추어 낼지, 돈과 증거의 무게를 살펴 달라고 합니다.",
    choices: { "deed": { label: "재산 증서를 먼저 갖춘다", ledger: "재산 증서 증거 준비비30d 지출." }, "roll": { label: "장원 법정 기록을 먼저 갖춘다", ledger: "법정 기록 증거 준비비20d 지출." }, "both": { label: "증서와 법정 기록을 함께 낸다", ledger: "성공한 증서30d·법정 기록20d 제출을 각각 기록." } } },
};

export const REGISTRY_TERM_WORDS: Readonly<Record<string, string>> = {
  remission: "감면", installments: "분할 납부", market_dues: "좌판세",
};

export function registryTitle(entryId: string): string {
  return REGISTRY_COPY[entryId]?.title ?? "등록기 사건";
}

export function registryChoiceLedger(entryId: string, choiceId: string): string {
  return REGISTRY_COPY[entryId]?.choices[choiceId]?.ledger ?? "답했다";
}
