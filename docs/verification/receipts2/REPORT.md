# 기근과 정치 청원의 영수증 — 렌더 A 보고

렌더 A, 2026-10-10. 사용자 지시: 기근 청원과 정치 청원도 무거운 결정이라 같은 영수증 흐름이어야 한다. 앞 작업(답의 영수증, 본선 `ad4c6f72`, 결정 RCP-D1)의 뒤. 엔진 파일 0줄.

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-receipts2`(가지 `claude/receipts2`, 에이전트 receipts2; 마지막 단계는 리드) — 본선 `ad4c6f72` 병합.
- 상태(DGX, 읽기만): ui5 famine-arrival·petition-open, ui6·ui8·ui9·ui10 청원 상태, ui10 extra heir_choice.
- 기하 관문(--gate --keep, 마지막 트리, trailer `UI-Geometry-Run`): `render-RECEIPTS2-geometry2-94b1371-94b1371` — 7줄(famine-answered, modal.receipt.famine-relief·famine-laissez·petition-charter·petition-wool·petition-autonomy·petition-heir), 140칸, 실패 0·열지 못함 0·등록 안 된 틀 0, `retried: []`
- 단계별: `render-RECEIPTS2-geometry-04f256d-04f256d`(같은 7줄, 병합 전, 실패 0·재시도 0).
- 캡처: `render-RECEIPTS2-captures-04f256d`(4/4: 기근 구휼, 5장 자치, 카드와 영수증, 1280×800·태블릿) — `docs/verification/receipts2/` 552 KB.
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록).

## 1. 무엇이 바뀌었나
- 기근 카드의 답(넷)과 정치·장 청원(21종)이 영주 카드와 같은 흐름으로 — 답하면 같은 모달에서 영수증("바로 바뀐 것" · "앞으로" · [확인] 하나). 연결은 `src/ui/screens/AppModals.tsx`의 `answered("decision"|"petition", …)`.
- 새 줄은 `src/ui/decisionCard/politicalReceiptRows.ts`(엔진 접근자 lordshipOf·legacyOf·legacyScores·warTaxPermille로 답 직전·직후를 읽음, 엔진 규칙 베끼지 않음)와 `politicalReceiptCopy.ko.ts`.

## 2. 답 × 실제 변화 × 영수증 줄
| 결정 · 답 | 실제로 바뀐 것 | 영수증 |
|---|---|---|
| 기근 구휼 / 값 묶기 / 방관 / 투기 | 세력 관계만(주교·농민) — 곡창·구휼 지출·떠나는 사람은 철마다 | 관계 줄, 카드의 나중 줄은 "앞으로"에 |
| 시장 특허 받음 / 값 붙여 / 거절 | 관계, 상인 마음, 권리 시장권(+ 값에 좌판세) | 관계, 마음, "권리: 시장권(좌판세 %)", 금고 |
| 권리 회복 받음 / 흥정 / 거절 | 금고, 칭호 강등, 쇠퇴 풀림, 칭호 돌아오는 때, 청원이 다시 오는 때, 마음 | 금고, 영주 칭호, 영지의 쇠퇴, 되산 권리(통행세 되삼), 날짜 둘, 마음 |
| 양모 공납 받음 / 값 붙여 / 거절 | 분납, 금고, 왕실의 신임 | "양모 공납(철마다 × 철)", 금고, "왕실의 신임 있음 → 잃음" |
| 징집 | 징집 인원, 금고, 신임 | "징집 N명 · 돌아오는 때", 금고, 신임 |
| 전쟁 자금 | 빚 분납, 마음, 전쟁세 철, 금고, 신임 | "상인에게 진 빚", 마음, "전쟁세 N계절 · 세율", 금고, 신임 |
| 피난민 받기 | 인구, 사는 집, 금고 | "인구 ±N", "사람이 사는 집 ±N", 금고 |
| 석벽이냐 장이냐 | 성벽 사업, 마음 | "석벽과 장(석벽 사업 / 성벽세 / 넓힌 장)", 마음 |
| 빈 사제 자리 | 사제(누가·언제), 금고 | "교회의 사제(수도원 사제 날짜 / 평신도 서기)", 금고 |
| 품삯·땅 다시 나눔·옷감이냐 곡식이냐·세금 거두기·길드 다툼 | 관계만 | 관계 줄 |
| 화폐 지대 받음 | 권리 화폐 지대 | "권리: 화폐 지대" |
| 길드 칙허 받음 | 직물 길드 | "직물 길드 인가 · 우두머리 이름" |
| 자치 도시 칙허 받음 | 시장 통행세·다리 통행세 권리 | 권리 줄 |
| 왕실 보조세 | 금고, 왕실 보조세, 가문 점수 | 금고, "국왕에게 낸 왕실 보조세", "가문 유산 점수" |
| 교회 다시 짓기 | 금고, 회중석, 교회 점수 | 금고, "교회 회중석 새로 지음", 점수 |
| 후계 고르기(셋) | 금고(구휼), 가문의 가장, 사람들의 몫·떠남·듦 | 금고, "가문의 가장 옛 → 새", "영지를 떠난 사람 / 가문에 든 사람", 점수 |
| 자치 받음 / 거절 | 금고, 시장직·도시 인장(+ 통행세), 자치 연납금, 시장 / 반발 | 금고, 권리, "자치 연납금", "시장 없음 → 이름" / "도시의 반발 ±N", 점수 |
| 남길 유산 | 금고, 기부금, 유산의 축 | 금고, "유산 기부금", "남길 유산 없음 → …", 점수 |
- 시험 `tests/answerReceipts.test.ts`: 기근 넷과 청원 21종의 모든 답을 늘 도는 상태(deccardCampaignStates, DGX 상태가 없는 권리 회복 포함)에서, 그리고 실제 상태(ui5~ui10, 청원 답 20 이상)에서 — 상태의 바뀐 잎마다 같은 숫자의 영수증 줄. 빠진 것 0(줄을 지운 변이는 실패).

## 3. 기하 줄과 옛 캡처 스크립트
- `hud.event-card.famine-answered`: 방관을 누른 뒤 영수증을 닫는 걸음(`closeReceipt("famine")`), 나머지 같음. 기근·정치 답을 누르는 다른 줄은 없다.
- 새 줄: `modal.receipt.famine-relief`·`famine-laissez`(ui5 famine-arrival), `petition-charter`(ui5 petition-open), `petition-wool`(ui6 양모 공납 거절), `petition-autonomy`(ui10 자치 받음, 가장 긴 영수증 10줄), `petition-heir`(ui10 extra 후계).
- 관문이 아닌 캡처 스크립트: 답을 누른 뒤 영수증의 [확인]을 누른다(새 도움 `scripts/answerReceiptPress.mjs`). eventArtCaptures(통과)·play2Captures famine-campaign(통과)·deccardCampaignCaptures(10줄 모두 영수증 닫힘, 스크립트 자신의 그림 예산 790 KB > 600 KB로만 exit 1 — 예산은 그대로)·lmr1PetitionCaptures(홈 청원 12종 × 허가/거절 모두 영수증 닫힘·금고 맞음; 도시의 청 칸 하나는 이 작업 전부터 깨져 있던 대로 카드에 닿지 못함 — 남은 일). scripts/ui4Captures.mjs는 DEC-CARD 이전 고르개라 답을 누르지 못해 영수증을 만나지 않는다.

## 결정(렌더 A 판단, 2026-10-10)
- RCP-D3 기근 카드와 정치·장 청원도 답하면 같은 영수증으로 뒤집힌다(RCP-D1과 같은 흐름·같은 시험). 해마다·철마다 오는 효과(곡창, 구휼 지출, 반란 압력)는 영수증의 "앞으로"(카드의 나중 줄)에 남는다.

## 엔진에 남은 것
- 없음 — 바로 바뀐 것마다 읽을 잎이 있다. 엔진 B의 답 효과 읽기(`answerEffects`, TRACE-LINK, 계약 `docs/requests/render-A-answer-effects.md`)가 들어오면 영수증 전체를 그 읽기로 바꾼다(RCP-D1).

## 원칙 점검
- 엔진 파일 0줄. 한국어는 `*.ko.ts`에만, 색은 palette.ts에만, `title=` 0. AppModals.tsx 214줄, 새 파일 250줄 이하.
- 화면마다 주 단추 하나([확인]). 누르기는 이름 붙은 명령(R4). 글자 12px 이상.
- 감사·판정 규칙은 바꾸지 않았다(deccardCampaignCaptures의 그림 예산도 그대로).
