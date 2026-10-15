# v56 보고서 — TRACE-LINK + INERT + growthBlock의 since, 저장 v56

관문: 통과 — 엔진 B INERT 판정(결과 보임 669/669 = 100 %, 효과 없음 0, 답 총수 682 ≤ 836, 한 해 4건 넘는 해 17 ≤ 26), 가드레일 해시 불변(5/5가 `baseline-096eb86`과 같음), 바뀐 줄 기하 실패 0. 지정 10사건 시험과 바뀐 파일의 시험은 마지막 커밋의 test:changed로 본다(아래).

- **지시**: 사용자 판정 2026-10-10(TRACE-LINK·INERT를 한 저장 버전에), 10-13(`since`를 철 단위로, 감사 묵인 영수증 a안), 10-14(relationStage, 엔진 B 고정값 갱신 `738a1c6f9`·INERT 결과를 기다려 올림), 10-15(증빙 압축은 엔진 B가).
- **결정**: SAVE-56, V56-1~V56-4. 렌더 A의 LS11-D2(관계 단계 칩), RCP-D1(답의 영수증)과 함께 간다.
- **엔진 B 몫**: TRACE-LINK·INERT의 규칙·측정·증빙은 엔진 B의 가지(`codex/engine-b-tlink`·`engine-b-inert`·`engine-b-v56-pins`)에서 왔다. 엔진 B의 검토 고정값(`engineBTlink*` 시험, INERT·phase history 출처 해시)은 엔진 B가 `738a1c6f9`에서 고쳤고, 나는 바꾸지 않았다.

## 만든 것
| 결정 | 무엇 |
|---|---|
| SAVE-56 | 저장 v56: 새 필드는 모두 선택 칸이라 v55→v56은 버전만 올린다. 지문 `schemaFingerprint.v56.json`, 저장 판 `fixtures/saves/v56/`(표준 13개 + 엔진 B 7개). 엔진 B의 v57 임시 번호를 대체 |
| V56-1 | 억제된 헌장 청원은 철의 자리를 비우지 않는다: 청지기가 선례로 닫고, 그 철의 자리는 다른 종류에서 다시 뽑는다 |
| V56-2 | growthBlock의 `since`는 집 수나 인구가 늘었던 마지막 철 끝(`agency.seasonGrowth`, 영주 모드) |
| V56-3 | `relationStage(value)` → `{ id, rank }`: DTR-4의 ±30·±60으로 다섯 단계, 읽기만 |
| V56-4 | 엔진 B의 INERT 판정(아래) |
| (렌더 A) | 감사 묵인 영수증 줄(`c45282188`), 관계 단계 넘김 칩(LS11-D2, `79fa055e7`) |

## 관문 결과
### INERT — 엔진 B, DGX `engineB-V56-inert-d4c9249`(seed 1–3 × 125년, 출처 `d4c9249`)
| 기준 | 전(EB-TLINK `71bc336`) | v56 | 기준값 |
|---|---|---|---|
| 결과 보임(성숙 답 중) | 622/816(76 %) | 669/669(100 %) | ≥ 80 % |
| 효과 없음 | 194 | 0 | 0 |
| 답 총수 | 836 | 682 | ≤ 836 |
| 한 해 4건 넘는 해 | 26 | 17 | ≤ 26 |
| 한 해 답 수 중앙값 / 최대 | 2 / 6 | 2 / 6 | — |

- 관측 부족 13은 분모 밖이다. seed별로 1: 206/206, 2: 216/216, 3: 247/247.
- 증빙 `docs/verification/eb-inert-v56/official-125/`, 판정서 `docs/requests/engine-B-v56-result.md`, 청원별 전후와 선례로 바꾼 답 `petition-comparison.json`. 원본 관측 파일은 보존 실행에 있다.
- 옛 채점기(`legacy-scorer-exit-code`)는 1이다. 엔진 B의 공식 관문(`official/exit-code`)과 네 범주 채점기는 0이다. 옛 채점기는 이 관문의 기준이 아니다(엔진 B 판정서).
- 엔진 B의 관문은 비영주 가드레일 해시, 지정 10사건 시험, 화면 받아들임을 빼고 잰다. 셋은 아래에서 따로 본다.

### 가드레일 해시 — DGX `engine-V56-guard-f42b0a0`
- 5/5 통과(seed 1–5 끝 틱 372,667 · 281,540 · 299,309 · 281,572 · 333,724), 사람 경로 12/12.
- 끝 상태 해시가 다섯 seed 모두 `baseline-096eb86`과 같다. 그 뒤 v56에 더한 것은 읽기 함수(`relationStage`), 화면, 시험, 문서와 본선 합침뿐이다(본선의 SIM-SPEED·RR28은 각자 해시 불변을 보였다).

### 기하(바뀐 줄) — DGX `engine-V56-geometry-145be2e`(RR26 trailer)
- 144줄, 2,860칸, 실패 0, 못 연 조건 0, 등록 안 된 틀 0, 다시 잰 것 없음, 축 좁힘 없음, 깨끗한 트리.
- 영수증·영주 카드·사건 칩과 카드(관계 단계 칩 `hud.event-card.relation-stage.market` 포함)·기록·연말·마감·철 장부와 청지기·영주 화면·장부 칸·성장 줄·상태 알약.
- 다 다시 잴 까닭은 없었다: 앞 판 `engine-V56-geometry-f42b0a0` 뒤로 바뀐 UI 입력은 관계 단계 칩 쪽뿐이었다. 다음부터는 바뀐 줄만 잰다(사용자 지적 2026-10-15).

## 필수 조건
- typecheck: 통과 — Mac.
- 저장 지문·relationStage·since·청지기 빈자리 시험 5/5, 지정 10사건 파일 `engineBTlinkSpecifiedTown` 7/7 — Mac.
- 바뀐 파일에 걸린 시험(지정 10사건 포함): 이 보고서를 고친 마지막 커밋에서 DGX `engine-V56-tested-…`로 돌리고, 그 뒤로는 커밋하지 않고 푸시한다.
- check:merge: 푸시 훅 — Mac.

## 고친 시험(까닭)
- `tests/ledger.test.ts` L-3: 장부 분류에 INERT의 `audit_tolerance_loss`(묵인한 감사의 철마다 손실, 음수 항목)를 더했다.
- `scripts/checks/sourceScanTests.mjs`: `tests/engineBInertCapture.test.ts`를 폴더 지도에 올렸다(그 시험은 자기 임시 폴더의 캡처 폴더만 읽는다).
- 엔진 B의 저장 시험 셋(`answerEffects`·`engineBTlinkSave`·`stewardshipConsequencesSave`)은 임시 v57에서 56으로. `charterWall`의 growthBlock 검사는 `since`가 철 단위가 된 데 맞췄다.
