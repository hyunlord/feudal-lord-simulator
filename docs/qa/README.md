# Astra 관찰 QA 기록

Astra가 별도 클론에서 게임을 실행하며 관찰한 회차별 QA 기록이다. 그림 장부(`assets-inbox/INBOX_LEDGER.csv`)와는 따로 둔다. QA 회차는 게임 코드를 고치지 않는다.

## 회차 목록

회차마다 한 줄씩 더한다.

| 회차 | 받은 날 | 기준 커밋 | 발견 | 판정 요약 | 저장소 기록 | 전체 증거(저장소 밖) |
|---|---|---|---|---|---|---|
| [01](round01/FINDINGS.md) | 2026-09-30 | `4ad2d2a4` | QA-001~011 (11건: 요청 7 + 새 종류 4) | 재현 9 · 미재현 2(QA-004 반복 도로 건설, QA-007 석벽의 물 내부 횡단). 여섯 장면 매트릭스는 미완료([REGRESSION](round01/REGRESSION.md)) | 문서 4 · `repro/` · `tools/` · 증거 JPEG 11(발견마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round01/` — 경량 ZIP(`b94c2666…`)·해시 확인 파일·풀어 둔 전체(JPEG 51·GIF 28) |
| [02](round02/FINDINGS.md) | 2026-09-30 | `d5b3f88a` | 새 발견 QA-012~013 (2건) + 기존 11항목 재검토 | 새 발견 2건 재현(QA-012 계절 외형 급교체·달력 한 샘플 지연, QA-013 목표 패널이 사건 칩을 가림). 기존 11: 재현된 실패 7 · 미재현 3(QA-001 독립 나무 1개 표본, QA-004, QA-007) · 판정 보류 1(QA-011, 삽화 설치 전). 해안·습지 새 지형은 접근 경로가 없어 미검증 | 문서 6 · `repro/` · `tools/` · 증거 JPEG 11(발견마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round02/` — 경량 ZIP(`d7d8242d…`)·해시 파일·풀어 둔 전체(JPEG 54·GIF 15)·`raw-sequences/`(1600×1100 원본 연속 촬영 634MB, Astra의 `/tmp/fls-qa-raw-round02`) |

## 한 회차에 넣는 것

- `docs/qa/roundNN/`에 `FINDINGS.md`·`CHECKLIST.md`·`REGRESSION.md`·`PLAN.md`와 `repro/`를 받은 그대로 둔다(아래 256KB 규칙의 안내 파일과 gzip한 저장만 예외). 재현 스크립트(`tools/`)와 패키지의 `SHA256SUMS`도 함께 둔다.
- 증거는 JPEG만 `roundNN/evidence/`에 둔다(Git LFS, `.gitattributes`의 `docs/qa/**/*.jpg`). **발견 하나당 저장소 안 JPEG 최소 한 장**(2026-09-30부터 원칙): 증거가 GIF뿐인 발견은 묶음에서 프레임을 펼친 JPEG를 찾아 넣는다. 그 위에 더하는 대표 그림은 문서가 가장 많이 가리키고 발견을 가장 넓게 덮는 것으로, 합계 10장 안팎을 넘기지 않는다.
- GIF를 포함한 전체 증거와 원본 ZIP은 `~/feudal-lord-analysis/astra-raw/qa/roundNN/`에 둔다. 문서 안의 링크 가운데 저장소에 없는 증거는 그곳에서 연다. 문서는 고쳐 쓰지 않는다.
- 이 표에 한 줄을 더한다.
- **큰 기계 기록은 astra-raw에만**(2026-09-30 사용자 규칙, 03회차부터): 기계가 만든 기록 파일(JSON·JSONL·CSV·TSV·TXT·LOG·XML 등, `.gz`로 압축된 기록은 압축된 크기로 본다)이 256KB(262,144바이트)를 넘으면 저장소에 넣지 않는다. 원본은 `~/feudal-lord-analysis/astra-raw/qa/roundNN/`(받은 ZIP과 풀어 둔 묶음)에만 두고, 저장소의 같은 자리에는 `<파일 이름>.astra-raw.txt` 안내 파일 하나를 둔다. 안내 파일은 한 줄: `<파일 이름> · <바이트> bytes · sha256 <64자> · ~/feudal-lord-analysis/astra-raw/qa/roundNN/<ZIP>::<묶음 안 경로>; ~/feudal-lord-analysis/astra-raw/qa/roundNN/<풀어 둔 폴더>/<묶음 안 경로>`. 규칙의 원문은 [`docs/ASSET_INBOX.md`](../ASSET_INBOX.md) 8절과 같다.
  - 사람이 읽는 문서(`FINDINGS`·`CHECKLIST`·`REGRESSION`·`PLAN`·`README` 같은 `.md`)와 증거 JPEG, 재현 스크립트(`tools/`, `repro/*.cjs` 같은 코드)는 크기와 관계없이 그대로 둔다.
  - **재현용 게임 저장은 예외**로 크기와 관계없이 저장소에 둔다(`repro/saves/` 아래 파일과 `*.save.json*` 이름의 저장). 개발 세션이 이 저장을 열어 버그를 재현하기 때문이다. 압축되지 않은 저장(`*.json`)이 오면 `gzip -n -9`로 줄여 `<파일 이름>.gz`로 넣는다(`-n`은 이름·시각을 넣지 않아 같은 입력이면 같은 바이트가 나온다). `gunzip -k`로 받은 바이트가 그대로 돌아오며, 패키지 `SHA256SUMS`는 풀어서 확인한다.
  - 깨끗한 클론 확인에서 `SHA256SUMS`와 어긋나도 되는 것은 일부러 뺀 증거, 안내 파일로 바꾼 기록(안내 파일의 sha256이 SUMS와 같아야 함), gzip한 저장(푼 바이트가 SUMS와 같아야 함)뿐이다.
  - 이미 들어간 01·02회차는 그대로 둔다(사용자 판정).

## 01회차 대표 증거

| 파일 | 덮는 발견 |
|---|---|
| `1380-forest-5x-tree-sheet.jpg` | QA-001 수관 흔들림(5배속 프레임을 펼친 판) |
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

QA-001은 문서가 가리키는 증거가 GIF뿐이라(`1380-forest-5x.gif`·`1380-forest-paused.gif`, astra-raw) 묶음의 프레임 펼침 JPEG를 더했다. 이로써 QA-001~011 모두 저장소 안 JPEG가 한 장 이상 있다.

## 02회차 증거

| 파일 | 덮는 발견 |
|---|---|
| `33-season-exact-boundary.jpg` | QA-012 계절 경계(가을→겨울 0034→0035, 겨울→봄 0135→0136, 달력은 0137) |
| `19-goal-obscures-event.jpg` | QA-013 목표 패널이 사건 칩을 가림 |
| `20-famine-access-after-goal-close.jpg` | QA-013 패널을 닫으면 같은 사건에 접근됨 |
| `35-tree-motion-contact.jpg` | QA-001 재검(80프레임, 독립 나무 1개 — 미재현) |
| `26-actors-contact.jpg` | QA-002 인물 위치 고정 · QA-005 건물 위 인물 |
| `05-city1380-settled.jpg` | QA-003 성벽 개구부 · QA-005 · QA-007 호숫가 성벽 |
| `36-autoplay-active1331.jpg` | QA-004 자동 발전 준비 구간(미재현) |
| `09-chronicle.jpg` | QA-006 연대기 장식 틀 · QA-010 나이 문구 충돌 |
| `14-zoom0605-valid.jpg` | QA-008 축소 시 도형·원형 나무 |
| `34-royal-tax-empty-forecast.jpg` | QA-009 1384 왕실 과세 선택지 3개 빈 예측 |
| `51-guild1394-choice.jpg` | QA-010 109·115살 · QA-011 같은 청원 삽화 |

QA-012의 연속 변화는 GIF(`clips/season-autumn-winter.gif`·`season-winter-spring.gif`)와 원본 연속 촬영이 astra-raw에 있다.
