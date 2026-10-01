# Astra 관찰 QA 기록

Astra가 별도 클론에서 게임을 실행하며 관찰한 회차별 QA 기록이다. 그림 장부(`assets-inbox/INBOX_LEDGER.csv`)와는 따로 둔다. QA 회차는 게임 코드를 고치지 않는다.

## 회차 목록

회차마다 한 줄씩 더한다.

| 회차 | 받은 날 | 기준 커밋 | 발견 | 판정 요약 | 저장소 기록 | 전체 증거(저장소 밖) |
|---|---|---|---|---|---|---|
| [01](round01/FINDINGS.md) | 2026-09-30 | `4ad2d2a4` | QA-001~011 (11건: 요청 7 + 새 종류 4) | 재현 9 · 미재현 2(QA-004 반복 도로 건설, QA-007 석벽의 물 내부 횡단). 여섯 장면 매트릭스는 미완료([REGRESSION](round01/REGRESSION.md)) | 문서 4 · `repro/` · `tools/` · 증거 JPEG 11(발견마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round01/` — 경량 ZIP(`b94c2666…`)·해시 확인 파일·풀어 둔 전체(JPEG 51·GIF 28) |
| [02](round02/FINDINGS.md) | 2026-09-30 | `d5b3f88a` | 새 발견 QA-012~013 (2건) + 기존 11항목 재검토 | 새 발견 2건 재현(QA-012 계절 외형 급교체·달력 한 샘플 지연, QA-013 목표 패널이 사건 칩을 가림). 기존 11: 재현된 실패 7 · 미재현 3(QA-001 독립 나무 1개 표본, QA-004, QA-007) · 판정 보류 1(QA-011, 삽화 설치 전). 해안·습지 새 지형은 접근 경로가 없어 미검증 | 문서 6 · `repro/` · `tools/` · 증거 JPEG 11(발견마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round02/` — 경량 ZIP(`d7d8242d…`)·해시 파일·풀어 둔 전체(JPEG 54·GIF 15)·`raw-sequences/`(1600×1100 원본 연속 촬영 634MB, Astra의 `/tmp/fls-qa-raw-round02`) |
| [03~14 통합](round03-14/FINDINGS.md) · [판정](round03-14/TRIAGE.md) | 2026-10-01 | `267b43b8`(마지막 관찰. 통합 중 원격 `3acc04ff` UI-AUDIT-1 이후는 미검증) | QA001~033 (33개 번호: 열림 24 · 닫힘 4 · 미재현 3 · 미검증 1 · 후보 1) + 번호 없는 후보 12묶음([CANDIDATES](round03-14/CANDIDATES.md)) | 사용자 판정([TRIAGE](round03-14/TRIAGE.md)): 최소 지원 폭 1024px — 375px에서만 나온 013·017·023·024·029는 범위 밖으로 닫음. 높음: 030 저장 왕복 식량 일수 · 032 장 결산 재노출 · 025 목표 보기가 정지를 풂. 015·016·018~021·031은 UI-AUDIT-1 이후 본선에서 재확인. 닫힘 006·008·009·011 인정, 미재현 001·004·007 · 미검증 002 유지 | 문서 8(`TRIAGE.md` 포함) · `ISSUES.csv`·`PROVENANCE.json`·`VALIDATION.json`·`SHA256SUMS.txt` · `history/`(3~14회차 원 보고 52) · `repro/` · `tools/` · 재현 저장 2(12회차 묶음에서, 아래) · 증거 JPEG 35(발견 번호마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round03-14/` — 통합 ZIP(`afe8c6e6…`)·검증 전 ZIP·검증 JSON·풀어 둔 전체(JPEG 91·GIF 6) · `rounds/`(회차별 `QA_ROUND_03~14`·전달 폴더·회차 ZIP 03~13과 검증 JSON) · `raw-sequences/round03~14`(원시 연속 프레임) · 합계 약 14GB |
| [15](round15/README.md) | 2026-10-01 | `3acc04ff`(UI-AUDIT-1 이후) | UI-AUDIT-1 지정 7건 재검증 + 새 발견 QA034~035 (2건). 누적 35개 번호: 열림 16 · 닫힘 9 · 지원 범위 밖 5 · 미재현 3 · 미검증 1 · 후보 1 | 수정 확인 5(018·019·020·021·031, 같은 조건 범위만) · 재현 1(015 전기 장식선) · 미검증 1(016, QA034 때문에 판독 불가). 새 결함: **QA034 결정창 제목·본문·선택지가 안 보임(높음, 긴급 ZIP 먼저 전달)** · QA035 설정 최하단 불러오기 행을 건설·장부·청지기 버튼이 덮음(1024·1280). 1024px 미만은 이번부터 시험 안 함 | 문서 7 · `ISSUES.csv`·`POLICY.json`·`PROVENANCE.json`·`SHA256SUMS.txt` · `repro/` · `tools/` · `urgent/`(QA034 긴급 묶음 그대로: JPEG 4 · JSON 5 · README) · 재현 저장 2(03·04회차 묶음에서, 아래) · 증거 JPEG 9(발견 번호마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round15/` — 경량 ZIP(`241ef2d1…`)·긴급 ZIP(`5851e2fa…`, `urgent/`와 같은 내용)·풀어 둔 전체(JPEG 39) |

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

## 03~14회차 통합 증거

발견 번호마다 `FINDINGS.md` 그 줄이 처음 가리키는 JPEG를 넣었다. 전후 비교가 발견의 내용인 011·022·025·030과 사례가 둘인 032는 두 장씩 넣었다. GIF뿐인 움직임(012·032)은 묶음의 전체 펼침 JPEG를 넣었다. GIF 6개와 나머지 JPEG 56장은 astra-raw에 있다.

| 발견 | 파일 |
|---|---|
| QA001 수목 움직임(미재현) | `14-wall14-tree-paused20-detail.jpg` |
| QA002 주민 움직임(미검증) | `14-wall14-idle1-valid120-detail.jpg` |
| QA003 목책 접합 틈 · QA007 물가 성벽(미재현) | `14-wall14-exact003.jpg` |
| QA004 반복 길(미재현) | `14-root14-020-auto-paused-end.jpg` |
| QA005 운반꾼이 성벽 위에 겹침 | `14-wall14-roger80-detail.jpg` |
| QA006 장부 틀(닫힘) | `03-26-ledger.jpg` |
| QA008 먼 줌 화풍(닫힘) | `03-04-zoom056.jpg` |
| QA009 빈 예측(닫힘) | `14-ui14-025-tax-paused.jpg` |
| QA010 호칭·나이 · QA011 사건 삽화(닫힘) · QA016 결정 버튼 | `14-ui14-064-guild1600.jpg` |
| QA011 사건 삽화(교회) | `14-ui14-067-church1396.jpg` |
| QA012 계절 경계 | `13-root13-firstwinter-build100-unfolded.jpg`(GIF 펼침) |
| QA013 목표·칩 가림(375) | `09-ui9-74-fullgoalchip375.jpg` |
| QA014 국왕 역할 영문 | `14-ui14-026-king-card.jpg` |
| QA015 전기 장식선 | `14-ui14-009-thomas-biography.jpg` |
| QA017 건설 분류(375) | `14-ui14-043-build375.jpg` |
| QA018 설정 겹침 | `14-ui14-004-settings1280.jpg` |
| QA019 설정 잘림 | `14-ui14-003-settings1600.jpg` |
| QA020 가계도 이름 | `13-ui13-019-successor-tree.jpg` |
| QA021 닫기 기호 | `14-ui14-037-house1600.jpg` |
| QA022 더보기 | `14-ui14-087-winter-before.jpg` · `14-ui14-088-winter-after.jpg` |
| QA023 사건칩·상세 가림(375) | `14-ui14-038-market375.jpg` |
| QA024 인물창 닫기(375) | `14-ui14-046-person375.jpg` |
| QA025 목표 보기가 정지를 풂 | `14-ui14-053-goal-before.jpg` · `14-ui14-054-goal-after.jpg` |
| QA026 수레꾼 걸음 | `14-wall14-john-click.jpg` |
| QA027 영주관 화풍 | `14-wall14-manor-selected2.jpg` |
| QA028 인구 기록 빈 띠 | `13-ui13-037-population-reopen.jpg` |
| QA029 연대기 접근(375) | `14-ui14-015-record375.jpg` |
| QA030 재개 후 식량 일수 | `14-control14-004-saved.jpg` · `14-control14-005-manual-immediate.jpg` |
| QA031 문제 범례 | `14-ui14-041-problem1600.jpg` |
| QA032 장 결산 재노출 | `14-control14-006-manual4s.jpg` · `14-control14-1322-immediate100-unfolded.jpg`(GIF 펼침) |
| QA033 서비스 거리 설명(후보) | `14-root14-008-service-market-church.jpg` |

**재현 저장.** 통합 ZIP에는 저장이 없지만, `CHECKLIST.md`(장전환-02, QA032)가 `repro/saves/natural1340-ch3-reload-repro.json.gz`를 가리킨다. 그래서 12회차 묶음(`/tmp/QA_ROUND_12/repro/saves/`, astra-raw `rounds/QA_ROUND_12`)의 저장 2개를 출처 파일과 함께 `round03-14/repro/saves/`에 넣었다. 1340 3장 재로드 저장(`7b6814f1…`, `14-control14-observation.md`의 SHA와 같음)과 1362 4장 시작 저장(`ec321e87…`)이다. 이 4개 파일은 통합판 `SHA256SUMS.txt`에 없다. 다른 회차의 저장(약 21MB)은 astra-raw `rounds/QA_ROUND_NN/`에만 있다.

## 15회차 증거

| 발견 | 파일 |
|---|---|
| QA015 전기 장식선(재현, 열림) | `ui15-13-emptybio1600.jpg` |
| QA034 결정 내용 안 보임(새, 높음) · QA016 결정 버튼(미검증) | `ui15-12-tax-settled1600.jpg`. 1024·1280·처음 화면은 `urgent/`의 JPEG 4장 |
| QA018 설정 겹침(닫힘) | `root15-019-settings-bottom1280.jpg` |
| QA019 설정 잘림(닫힘) | `root15-003-settings1600.jpg` |
| QA020 가계도 이름(닫힘) | `before08-QA020-tree1600.jpg`(이전) · `ui15-03-tree-expanded1600.jpg`(현재) |
| QA021 닫기 기호(닫힘) | `root15-012-market-close.jpg` |
| QA031 문제 범례(닫힘) | `root15-014-problems1384-qa-off.jpg` |
| QA035 설정 하단 가림(새) | `root15-020-settings-bottom1280-after-scroll.jpg` |

`urgent/`는 먼저 받은 긴급 ZIP(`fls-qa-round15-urgent-decision.zip`)과 같은 내용이다. 이 폴더의 JPEG·JSON은 그대로 저장소에 둔다(사용자 지시).

**재현 저장.** 경량 ZIP에는 저장이 없다. 그러나 `PROVENANCE.json`과 `urgent/README.md`가 QA034 재현 출발점으로 원본 저장 2개를 가리킨다. 그래서 그 둘을 `round15/repro/saves/`에 넣었다. 둘 다 `PROVENANCE.json`의 sha256과 같다.
- `normal-ui-1384-before-tax.json.gz`(`faa99495…`): 04회차 묶음에서 가져왔다. QA034의 1384 과세 결정 재현 출발점이다.
- `normal-ui-1407.json.gz`(`86678ba1…`): 03회차 묶음에서 가져왔다. QA020 가계도 재현 출발점이다.

두 파일은 astra-raw `round03-14/rounds/`에도 있다. 15회차 `SHA256SUMS.txt`에는 없다.
