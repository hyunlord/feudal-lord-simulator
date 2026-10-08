# SUIT-THREAD 화면 배선 — 렌더 A 보고

렌더 A, 2026-10-09. 엔진 요청 [render-suit-defence-lordplay2.md](../../requests/render-suit-defence-lordplay2.md) 1~9절, 엔진 SUIT-THREAD(본선 `c7f107a6`, 푸시 동결 해제 `5dad7458`) 뒤. 근거: Astra 둘째 영주 플레이 [TOP10_FRICTION](../../qa/lordplay2-20261008/TOP10_FRICTION.md), 결정 DTR-22·DTR-23·LP2-E. 엔진 파일 0줄. 모든 수치·거절·판결은 엔진 읽기에서 온다(P-D4).

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-suit`(가지 `claude/suit`) — 두 에이전트 가지 `claude/suit-ledger`(1·2·4·5절, 9절 소송 몫)·`claude/suit-rest`(3·6·7·8절, 9절 지렛대)를 병합.
- 상태: DGX — lord2 neighbour-suit에서 이어 플레이(`scripts/suitLedgerStates.ts`, 명령만, 대답 않는 영주와 영주 봇), `~/fls-lmr2-states/suit-*.json` 다섯(기존 파일 변경 없음). 혼인·흉년·전기 상태는 `scripts/suitRestStates.ts`(lmr2 will-change를 답 없이 이어 감, 영주 봇 seed 1 1304 dearth_rehearsal, Astra 1306 저장).
- 기하(--gate --keep): `render-SUIT-lead-geometry-5c7df26-5c7df26` — 병합 트리 `5c7df267`, 바뀐 줄 17(lord.ledger.* 7·혼인과 유언·소송과 예고 칩·상시 방침·전기·권리 슬롯·조각 끝 쪽), 340칸, 실패 0·열지 못함 0, 기준선 대비 새 실패 0, 23분
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록) — 에이전트 단계 `render-SUIT-rest-tests-4736c31-4736c31`(766 통과·0 실패)·`render-SUIT-ledger-tests-1e31989-1e31989`(620 통과·0 실패). Mac: tsc 0, eslint 0, 바뀐 시험 넷 25 통과·1 건너뜀(DGX 상태 폴더)
- 캡처(light, --keep): `render-SUIT-ledger-captures-3439108-3439108`(15장, 각 82 KB 이하) · `render-SUIT-rest-captures-4736c31-4736c31`(13줄 통과, 13장 42~149 KB). 증거 `docs/verification/suit/suit-ledger/`(824 KB)·`suit-rest/`(1.4 MB).
- 에이전트 단계 기하: `render-SUIT-ledger-geometry-aa8eff5-aa8eff5`(lord.ledger.* 7줄 140칸 실패 0) · `render-SUIT-rest-geometry-4736c31-4736c31`(9줄 180칸 실패 0).

## 1. 영주를 상대로 한 소송: 방어 줄(1절)
- `neighbourNote`("영주가 막을 명령은 없습니다")를 지우고 `suitDefenceActions`의 방어 줄: 증거 종류별 비용·가중치, 후원자(엔진이 받아 줄 세력), 합의 "돈을 주고 지키기 · 값"·"땅을 내주기", 버티기(지금 힘·더할 힘·비용).
- 누르면 이름 붙은 명령: `add_defence_evidence`·`seek_defence_patron`·`settle_suit {pay|yield}`·`hold_possession`. 엔진 거절은 문장(증거: 단계·이미 냄·금고, 후원: 단계·이미 고름·관계, 합의: 금고, 버티기: 단계·점유자 아님·이미 버팀·금고). 모두 보조 단추. 끝난 합의는 엔진 문장 `estate.suit_settled`와 날짜.
- 가문의 소송에서 "쓴 비용" 줄을 뺐다 — 원고의 지출이 영주의 것처럼 보였다(SUIT-D1).

## 2. 강제 점거 예고(2절)
- 장부의 새 칸 "강제 점거 예고": `entryThreats`(가문·예고한 날·오는 철), 엔진 문장 `estate.entry_threatened`, 보조 단추 "지킬 사람 들이기 · 비용"(`guard_possession`)·"선물로 달래기 · 비용"(`appease_neighbour`), 비용은 `entryDefenceCosts`. 그 아래 "지난 강제 점거" 최근 셋(막음·물러남·들어옴, 엔진 문장).
- 들어온 뒤의 청구(`claim.novel`)는 "점유 침탈 소송 · 접수 다음 철에 바로 심리로 갑니다", 단계 줄은 엔진 `nextSuitStage`(제기→심리→판결).
- 칩 `entry-threat:<id>`: 엔진의 예고 문장, 오는 철, [예고 보기] → 장부의 그 예고 줄.

## 3. 미응답 목록(3절)
- 어댑터 `lordMattersDueNow`를 엔진 `lordMattersDue`로: 유언 변경(`dueTick`, 두 철)·상속 다툼·영주를 상대로 한 소송(다음 단계의 철)·강제 점거 예고. 감사와 바깥 영지 청원은 엔진 목록에 없어 화면 목록에 그대로 둔다(PLAY-2 동작 유지, SUIT-D5).
- 유언 칩: 기한을 철로("1304년 봄까지 답하지 않으면…"), 단추 "혼인 화면 보기" → 영주 화면 혼인 쪽(사용자 지시). 혼인 쪽에 기한과 보조 [결정하기](유언 카드). 기한은 날이 아니라 철(용어집 규칙 5, SUIT-D4).
- 칩 `suit-defence:<id>`: 엔진의 접수 문장·단계·다음 단계의 철, [소송 보기] → 장부의 그 소송. 그 소송의 접수 순간 칩을 대신한다(한 칩).
- `marriage.willLapsed`: 혼인 타임라인 "유언 변경에 한 답: 기한이 지나 그대로 두었다".

## 4. 득실의 주어(4절)
- 장부: 가문의 집행은 "<가문>이(가) 점유를 가져갔습니다", 판결은 "판결: <가문>이 이겼습니다 — 영주가 권원을 잃었습니다(점유는 따로)" / "…졌습니다 — 영주가 지켰습니다".
- 순간 그림: `wave40RecordSide`가 원고 ≠ 영주·피고 = 영주면 "against" — 그림은 같고 제목·조언이 "이웃이 점유를 가져갔다" / "영주가 버텼다". 원고 없는 옛 기록은 영주의 것.
- 리드 고침: neighbour-took 상태에서 이 손실 순간이 칩 셋 밖으로 밀렸다(답 기다리는 칩 둘 + 더 새 칩 하나). 영주가 점유를 잃은 순간은 가문 소식처럼 치울 때까지 밀리지 않는다(`StoryBeat.lasting`, SUIT-D3). 버틴 순간은 보통 칩.

## 5. 패소 뒤 상속 카드(5절)
- `decisionCardsModel.ts`는 닫힌 소송을 "소송 없음"으로 세지 않는다: "영주의 소송: 끝남 · 판결: 영주가 졌습니다 · 1308년 여름"(Astra 마지막 저장), 카드는 장부의 그 소송을 연다.

## 6. 원인과 대비(6절)
- `because.key === "crisis_prepared"`만 있는 결정은 "○○년 결정이 남긴 대비": 연대기 줄·연대기 실·연말 카드 머리·소식 칩 제목, 그리고 리드가 고친 수직 조각 끝 쪽의 "도시를 만든 결정".
- 흉년 칩: `relation === "preparedness"`마다 "그때 이 결정이 남긴 대비 — <결정>"(사용자 문구).

## 7. 전기의 부모(7절)
- 부모는 `persons.parents`(아버지·어머니, 어디 살든 먼저), 혼인 부부는 서로 배우자, 영주관의 친척은 가장을 영주로. 부모를 아는 아이는 부모 아닌 가장을 "부모"라 하지 않는다.
- 가솔 목록 `lord-kin:<관계>_child` → "영주의 사촌의 아들/딸", 손자·손녀, 동생·조카·사촌; 혼인 계획으로 아는 친척의 신부 → "영주의 사촌의 아내". Astra 1306 저장에서 확인.

## 8. 청지기 위임 설명(8절)
- 상시 방침 설명: "지속 세율 변경은 영주에게 옵니다. 시장 좌판세처럼 계속 걷는 세율을 바꾸는 답이 있는 일은 청지기가 답하지 않습니다."

## 9. 엔진 읽기로 바꾼 것(9절)
- 접수: `claimOutlook.ts`를 지우고 `suitFilingOutlook` — 거절이어도 "소송 걸기 · 비용"과 거절 문장.
- 심리 줄(사용자 문구): "지금 판결하면 방어 쪽이 이깁니다 · 남은 증거와 후원을 다 더해도 넘기 어렵습니다 / …다 더하면 넘을 수 있습니다", 청구가 앞서면 "지금 판결하면 청구 쪽이 이깁니다". 영주를 상대로 한 소송은 "청구 쪽(원고) X · 방어 쪽(영주) Y".
- 남은 단계: `stageCosts`로 "앞으로 들 비용: 심리 … · 점유 집행 시도마다 …", 증거 종류별 비용·가중치는 `suitActions`.
- 흉년 뒤 지렛대: `preparedness().levers`(`zone:arable` → 밭), 화면의 약점→사업 대응을 지움. 약점 낱말은 엔진의 `WEAK_POINTS`, 화면 사본 삭제.

## 결정(렌더 A 판단, 2026-10-09)
- SUIT-D1 가문의 소송에 원고의 "쓴 비용"을 보이지 않는다.
- SUIT-D2 버티기·합의 칸은 모든 단계에 보이고, 쓸 수 없을 땐 엔진의 거절 문장(단계 등).
- SUIT-D3 영주가 점유를 잃은 순간 칩은 치울 때까지 밀리지 않는다(가문 소식과 같은 고정). 버틴 순간은 고정하지 않는다.
- SUIT-D4 미응답 칩·혼인 쪽의 기한은 철로 쓴다(날 아님).
- SUIT-D5 감사·바깥 영지 청원은 엔진 `lordMattersDue`에 없어 화면이 계속 고정한다.
- SUIT-D6 칩이 영주 화면의 쪽을 열 수 있다(`StoryBeat.screen`: 유언 → 혼인, 소송·예고 → 약속·소송), 열면 카드는 닫힌다.

## 엔진에 남은 것(요청 후보)
1. `guard_possession`·`appease_neighbour`의 거절 사유가 읽기에 없다 — 화면은 명령을 상태에 시험해 거절이면 중립 줄을 보인다.
2. 영주를 상대로 한 소송의 단계 비용이 없다(`suitActions`가 null) — 심리에서 방어에 드는 돈을 말할 수 없다.
3. 방어 쪽의 닿음(영주의 증거·후원으로 아직 심리를 뒤집을 수 있는지)이 없다 — 원고 쪽 `reachable`만 있다.
4. 점유 침탈 소송의 빠른 길은 화면이 낱말로 말한다 — 엔진 읽기·문구 없음.
- 합의한 소송 상태는 플레이로 나오지 않았다(영주 봇 40년 동안 합의 0) — 캡처는 합의 단추를 누른 상태.

## 원칙 점검
- 엔진 파일 0줄(`git diff --stat 본선 HEAD -- src/engine` 비어 있음). 한국어 문구는 `*.ko.ts`에만, 색은 palette.ts에만(새 hex 0), `title=` 0, 그림 문자 0.
- 새 파일은 모두 250줄 이하(장부를 ledgerWords·suitsModel·suitDefenceModel·SuitItems·suitDefenceCopy.ko로 나눔 — LedgerPanel 114줄, ledgerModel 128줄). 250줄이 넘는 바뀐 파일 여섯(App.tsx·hudShell.css·chronicleScreenModel·eventStory·NegotiationPanel·negotiationModel)은 본선에서도 넘었고, NegotiationPanel은 267 → 263.
- 같은 무게의 선택은 모두 보조 단추(방어 넷·지키기·달래기), 화면마다 주 단추 하나. 누르기는 이름 붙은 명령(R4 입력 경계).
- 글자 12px 이상, 터치 44/48px — 기하 감사.
- 검사 목록 한 줄: `scripts/checks/sourceScanTests.mjs`의 `NOT_SOURCE_SCAN`에 `tests/suitLedger.test.ts`(DGX 상태 폴더를 걷는다, src는 걷지 않음) — 지침대로 까닭을 단 분류, 판정 변경 아님(RR22, REMOTE에 한 줄).
