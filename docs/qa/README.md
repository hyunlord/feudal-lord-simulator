# Astra 관찰 QA 기록

Astra가 별도 클론에서 게임을 실행하며 관찰한 회차별 QA 기록이다. 그림 장부(`assets-inbox/INBOX_LEDGER.csv`)와는 따로 둔다. QA 회차는 게임 코드를 고치지 않는다.

## 회차 목록

회차마다 한 줄씩 더한다.

| 회차 | 받은 날 | 기준 커밋 | 발견 | 판정 요약 | 저장소 기록 | 전체 증거(저장소 밖) |
|---|---|---|---|---|---|---|
| [01](round01/FINDINGS.md) | 2026-09-30 | `4ad2d2a4` | QA-001~011 (11건: 요청 7 + 새 종류 4) | 재현 9 · 미재현 2(QA-004 반복 도로 건설, QA-007 석벽의 물 내부 횡단). 여섯 장면 매트릭스는 미완료([REGRESSION](round01/REGRESSION.md)) | 문서 4 · `repro/` · `tools/` · 대표 JPEG 10 | `~/feudal-lord-analysis/astra-raw/qa/round01/` — 경량 ZIP(`b94c2666…`)·해시 확인 파일·풀어 둔 전체(JPEG 51·GIF 28) |

## 한 회차에 넣는 것

- `docs/qa/roundNN/`에 `FINDINGS.md`·`CHECKLIST.md`·`REGRESSION.md`·`PLAN.md`와 `repro/`를 받은 그대로 둔다. 재현 스크립트(`tools/`)와 패키지의 `SHA256SUMS`도 함께 둔다.
- 증거는 대표 JPEG 10장 이내만 `roundNN/evidence/`에 둔다(Git LFS, `.gitattributes`의 `docs/qa/**/*.jpg`). 문서가 가장 많이 가리키고 발견을 가장 넓게 덮는 것을 고른다.
- GIF를 포함한 전체 증거와 원본 ZIP은 `~/feudal-lord-analysis/astra-raw/qa/roundNN/`에 둔다. 문서 안의 링크 가운데 저장소에 없는 증거는 그곳에서 연다. 문서는 고쳐 쓰지 않는다.
- 이 표에 한 줄을 더한다.

## 01회차 대표 증거

| 파일 | 덮는 발견 |
|---|---|
| `11-1380-paused-settled.jpg` | QA-002 인물 고정 · QA-003 성벽 개구부 · QA-005 건물 위 인물 · QA-007 호숫가 성벽 |
| `71-ch5-dispute.jpg` | QA-009 빈 예측 줄 · QA-010 나이 문구 충돌 · QA-011 같은 청원 삽화(길드) |
| `77-ch5-church-decision.jpg` | QA-009 · QA-011(교회) |
| `76-early-famine-decision.jpg` | QA-009(대기근) |
| `20-1380-zoom0605.jpg` | QA-007 · QA-008 축소 시 도형·원 숲 |
| `22-1380-zoom1427.jpg` | QA-008 확대 시 손그림 |
| `17-1380-ledger.jpg` | QA-006 장부 틀·버튼 |
| `19-1380-chronicle-settled.jpg` | QA-006 연대기 카드 · QA-010 |
| `96-actors-10second-sheet.jpg` | QA-002 10초 간격 연속판 |
| `66-newgame-ten-minute-end.jpg` | QA-004 새 게임 10분(미재현) |

QA-001 수관 흔들림의 증거는 GIF뿐이라 저장소에 없다(`1380-forest-5x.gif`·`1380-forest-paused.gif`, astra-raw).
