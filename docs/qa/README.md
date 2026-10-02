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
| [16](round16/README.md) | 2026-10-01 | `c52e6634`(QA034 수정 `e531560e` 포함) | 재검증 5건(QA034·016·010·035·015) + 돈 표기 회귀 관찰 + 새 후보 QA036 (1건). 누적 36개 번호: 열림 13 · 닫힘 12 · 지원 범위 밖 5 · 미재현 3 · 후보 2 · 미검증 1 | 닫힘 3(QA034 과세 본문, QA016 길드 보류 버튼, QA010 82살 ‘젊은’→‘작은’; 같은 원본·사건 범위만). 열림 유지 2(QA015 전기 장식선, QA035 설정 저장행 가림). 돈 표기 £·s 통과 표본(원시 d 보조합계는 남음). 새 후보 **QA036: 1349 임금 청원 첫 대표가 ‘세상을 떠남’**(원인 미확정, 선택은 됨; 소형 ZIP 먼저 전달). 청원 7종 × 3폭 = 21화면 확인 | 문서 7 · `early/QA036.md` · `ISSUES.csv`·`DELIVERY_MANIFEST.json`·`POLICY.json`·`PROVENANCE.json`·`VALIDATION.json`·`SHA256SUMS.txt` · `repro/` · `tools/` · 재현 저장 4(`PROVENANCE.json`이 가리키는 것만, 아래) · 증거 JPEG 7(발견마다 1장 이상) | `~/feudal-lord-analysis/astra-raw/qa/round16/` — 경량 ZIP(`767d5500…`)·QA036 먼저 받은 ZIP·ZIP 검증 JSON·풀어 둔 전체(JPEG 38) · `work/QA_ROUND_16`(작업 폴더 전체, JPEG 116) |
| [17](round17/README.md) | 2026-10-02 | `5a15e62d` | 새 땅 5종 × 여름·겨울 10장면 관측 + 지정 재검증 4건(QA015·035·034·016) + 새 발견 QA037~040 (4건) + 여울 추가 탐색([FORD](round17/FORD.md)). 누적 40개 번호: 열림 15 · 닫힘 14 · 지원 범위 밖 5 · 미재현 3 · 확정 열림 1(QA036 엔진) · 후보 1 · 미검증 1 | 닫힘 2(QA015 전기 장식선, QA035 설정 저장행 — 같은 원본·3폭 범위만). 닫힘 유지 1(QA034), 과세 표본 통과 1(QA016, 길드 미검증). 열림 유지 2(QA014 직함 `king` 영문, QA027 영주관이 흰 상자·단색 지붕). 새 결함 4: QA037 10배속 진입을 찾지 못함 · QA038 해안 지도2→강가 선택 시 1로 고정·± 비활성, 무작위 선택 없음 · QA039 백악 바위 면의 마름모 절단·검은 사각 윤곽 · QA040 숲 바닥이 직각 판처럼 빈 땅을 자름. 여울은 실제 길 드래그로 목교만 확인, 여울·개선 단계는 미검증 | 문서 7(`FORD.md`·작업 폴더의 `PLAN.md` 포함) · `early/`(먼저 받은 소형 ZIP 3개의 문서 3) · `ISSUES.csv`·`PROVENANCE.json`·`VERIFICATION.json`·`SHA256SUMS` · `repro/` · `tools/` · 재현 저장 1(`repro/ui-provenance.json`이 가리키는 것만, 아래) · 증거 JPEG 17(발견마다 1장 이상 + FORD 4) | `~/feudal-lord-analysis/astra-raw/qa/round17/` — 경량 ZIP(`e7f9748b…`)·해시 파일·먼저 받은 소형 ZIP 3(`early-controls`·`early-rock`·`early-forest`)·풀어 둔 전체(JPEG 38·GIF 1) · `work/QA_ROUND_17`(작업 폴더 전체, JPEG 87) |
| [처음 하는 사람 플레이](playtest-20261002/PLAY_DIARY.md) | 2026-10-02 | `5a15e62d` | 막힘 10([TOP10](playtest-20261002/TOP10_FRICTION.md)) · 재미 5([TOP5](playtest-20261002/TOP5_FUN.md)). 결함 번호를 매기는 QA 회차가 아니라, 소스·사전 문서를 보지 않고 화면과 입력만으로 강가 시장도시·목표형·튜토리얼 켬으로 1장을 끝까지 한 감상 | 실플레이 60분 27초에 1장 끝(1322년 여름, 인구 164, 식량 277일, 금고 £5 15s, 수동 저장 확인). 시장은 성벽이 운반 경로를 막아 미완성. 가장 큰 막힘: 다음 목표를 찾아 메뉴를 돎 · 목재 238에서 창고 포화를 늦게 앎 · 시장을 성벽이 막음 · 목책이 긴 자원 대기로 바뀜. 재미: 상인 수용·기근 때 금고 사용 결정 · 내가 낸 길을 따라 마을이 자람 · 창고 하나로 생산을 다시 돌림 · 목책 완성 · 불탄 집이 월터의 이야기가 됨. 도구 연결 끊김으로 1회 재시작(플레이 시간에서 뺌, 게임 결함으로 보지 않음) | 문서 3(`PLAY_DIARY.md`·`TOP10_FRICTION.md`·`TOP5_FUN.md`) · `session.json` · `chapter-one-ending-visible.txt` · `SHA256SUMS` · 캡처 JPEG 41 전부(`captures/`, LFS) | `~/feudal-lord-analysis/astra-raw/qa/playtest-20261002/` — ZIP(`6676dbc2f3fb08eb…`)·풀어 둔 전체(저장소와 같은 파일) |
| [시각 검사기 1차](vision-check-20261002/PRECISION.md) | 2026-10-02 | `3e3192c5` | 자동 후보 21건 직접 판정, 상위 10([TOP10](vision-check-20261002/report/TOP10.md)): 숲 바닥 판 절단 · 습지 수평 색 경계 · 큰 도시 과대 빗물통. 결함 번호를 매기는 QA 회차가 아니라 검사 도구의 정밀도 측정 | 직각·직선 땅 경계 11/13(84.6%), 크기 비율 7/8(87.5%). 타일 이음새·멈춘 사람·지붕 위 사람·반복 밀도는 후보 0이라 **여섯 검출기 모두 80% 이상은 미입증**. QA17 바위 마름모 절단은 화면에 보이지만 자동 검출 못함(재현율 개선 필요). 본선 36장면·720프레임 + 별도 숲 6장면, 사람 대체·자동 병합 승인 불가 | `README.md`·`PRECISION.md`·`SHA256SUMS` · `report/`(TOP10·PROVENANCE, 본선·holdout·보정 전 판정 JSON과 문서) · 256KB 넘는 메타데이터 `.json.gz` 28개는 안내 파일 · 주석 JPEG 15(TOP10이 가리키는 7 + `representative/` 8). 도구 소스 `tools/vision-check/`는 넣지 않음(재현율 확인 뒤 저장소 도구로 들일 예정) 재현율 회차는 [`recall/`](vision-check-20261002/recall/PRECISION.md): 동결 정답 19건으로 TP 17·FP 2·FN 2, 여섯 검출기 모두 목표 달성은 실패(경계·타일 이음새·멈춘 사람·지붕/성벽 겹침 네 개만 재현율·정밀도 80% 이상, 크기 비율 재현율 50%, 반복 밀도 정밀도 50%; 보정 세트라 독립 검증 아님). 보고서·결과표·동결 정답·판정표·대표 JPEG 13, 256KB 넘는 `capture.json.gz` 10개는 안내 파일, 도구 소스·`baseline-tool/`은 넣지 않음(ZIP `43802f4cf8e9dce5…`) 확장 회차는 [`expansion/`](vision-check-20261002/expansion/report/expansion/PRECISION.md): 검출 전에 동결한 양성 38개(검출기마다 5개 이상)·14장면에서 여섯 검출기 모두 재현율 70%·정밀도 80% 충족(경계 77.8%/87.5%, 반복 밀도 80%/80%; 동결 표본으로 문턱을 바꾼 교정 수치). 결과표·`MATCHES.json`·동결 정답·판정 문서, 대표 접촉판 JPEG 10, 256KB 넘는 기록 12개는 안내 파일, 도구 소스·`baseline-tool/`은 넣지 않음(ZIP `1d40b643…`) 홀드아웃 회차는 [`holdout/`](vision-check-20261002/holdout/README.md): 교정판을 고정한 채 새 지도 12장면·시간 홀드아웃 3장면(15장면·300프레임, 정답 90개)에서 **여섯 모두의 목표를 입증하지 못함**(경계 재현율 44.8%·정밀도 14.3%, 이음새 50%/100%, 크기 재현율 0%, 나머지는 양성이 없어 N/A 또는 정밀도 0%). 이전 미평가 후보 무작위 50개 직접 판독은 참 36·오탐 5·불확실 9(정밀도 72~90%). 보고서·점수·동결 정답·후검토 문서, 대표 JPEG 10, 256KB 넘는 기록 10개는 안내 파일, 도구 소스는 넣지 않음(ZIP `e317e643b92ba955…`). 같은 ZIP에 들어 있던 이전 확장 보고서의 누락 그림 `OBJECT_MATCH_*.jpg` 4장은 `expansion/`에 넣어 끊긴 링크를 이음 | `~/feudal-lord-analysis/astra-raw/qa/vision-check-20261002/` — ZIP(`cf051a24…`)·풀어 둔 전체(도구 소스·JPEG 45). 원본 PNG(약 3.6GB)는 Astra 로컬 `/Users/rexxa/fls-astra-vision/report/full-{main,holdout}/raw`에만 |

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

## 16회차 증거

| 발견 | 파일 |
|---|---|
| QA034 결정 내용(닫힘) | `ui16-03-tax1600.jpg` |
| QA016 결정 버튼 겹침(닫힘) | `ui16-18-guild1024.jpg` |
| QA010 호칭·나이(닫힘) | `root16-007-tree-expanded.jpg` |
| QA035 설정 저장행 가림(열림) | `root16-020-settings-bottom1024-after-scroll.jpg` |
| 돈 표기(회귀 관찰, 통과 표본) | `root16-018-history-1351.jpg` |
| QA015 전기 장식선(열림) | `ui16-30-king-empty-bio1600.jpg` |
| QA036 청원자 ‘세상을 떠남’(새 후보) | `root16-025-wages.jpg` |

`early/`는 그대로 넣었다(사용자 지시). 먼저 받은 소형 ZIP `fls-qa-round16-early-petitioner.zip`은 `early/QA036.md`·`evidence/root16-025-wages.jpg`·`repro/root16-025-wages.json` 세 파일이고, 경량 ZIP의 같은 파일과 바이트가 같다.

**재현 저장.** `PROVENANCE.json` `sources`가 가리키는 4개만 `round16/repro/saves/`에 넣었다. 모두 그 sha256과 같다.
- `normal-ui-1407.json.gz`(`86678ba1…`, 03회차)
- `normal-ui-1384-before-tax.json.gz`(`faa99495…`, 04회차)
- `chapter3-plague1348.json.gz`(`71bb71e7…`, 02회차)
- `natural1362-ch4-start.json.gz`(`ec321e87…`, 09회차)

앞의 회차 폴더에 같은 바이트가 이미 있어서 Git 저장 공간은 늘지 않는다. 탐색 중 열었지만 판정에서 뺀 `fixtures/perf-gate/ch4-1380.save.json.gz`는 넣지 않았다.

## 17회차 증거

| 발견 | 파일 |
|---|---|
| QA015 전기 장식선(닫힘) · QA014 직함 `king` 영문(열림) | `ui17-09-kingbio1600.jpg` |
| QA035 설정 저장행 가림(닫힘) | `ui17-02-settings1600-top.jpg` · `ui17-03-settings-bottom1024.jpg` |
| QA034 결정 본문(닫힘 유지) | `ui17-06-tax1600.jpg` |
| QA016 결정 버튼(과세 표본 통과) | `ui17-11-taxside1024.jpg` · `ui17-12-taxreopened1024.jpg` |
| QA027 영주관 화풍(열림) · QA040 숲 바닥 직각 경계(새) | `17-031-forest-edge.jpg` · `17-032-forest-winter-edge.jpg` |
| QA037 10배속 진입 없음(새) | `17-003-river-settings.jpg` |
| QA038 지도 선택 고정·무작위 없음(새) | `17-014-coast-map2.jpg` · `17-015-river-map-locked.jpg` |
| QA039 백악 바위 절단·사각 윤곽(새) | `17-025-chalk-rock-gaps.jpg` · `17-026-chalk-winter-rock.jpg` |
| 여울 추가 탐색([FORD](round17/FORD.md), 목교만 확인) | `fordf-05-drag.jpg` · `fordf-06-result.jpg` · `fordf-07-bridgezoom.jpg` · `fordf-08-bridgeclick.jpg` |

`FINDINGS.md`가 함께 가리키는 `ui17-10`(1024·1280)·`ui17-07`·`17-044`와 나머지 땅 장면, 강 물결 GIF와 프레임판, 5종 계절 비교판은 astra-raw에서 연다.

`early/`에는 경량 ZIP보다 먼저 받은 소형 ZIP 3개(`fls-qa-round17-early-controls`·`-rock`·`-forest`)의 문서를 넣었다. 작업 폴더 `/tmp/QA_ROUND_17/early/`의 `FINDINGS.md`·`QA039.md`·`QA040.md`와 바이트가 같다. 소형 ZIP의 JPEG 가운데 4장은 경량 ZIP 증거와 바이트가 같고, `17-007-river-summer.jpg`·`17-023-chalk-start.jpg` 2장은 경량 ZIP에 없어 astra-raw에만 있다. 경량 ZIP에 `PLAN.md`가 없어 작업 폴더의 것(완료 표시)을 넣었다(패키지 `SHA256SUMS`에는 없음).

**재현 저장.** 이번 `PROVENANCE.json`에는 저장 출처가 없고, UI 회귀에 쓴 저장은 `repro/ui-provenance.json` `source`가 가리킨다. 그 하나만 `round17/repro/saves/`에 넣었고, sha256이 `sourceGzipSHA256`과 같다.
- `normal-ui-1384-before-tax.json.gz`(`faa99495…`, 04회차, 16회차 폴더와 같은 바이트)

새 땅 장면은 화면에서 새 게임을 만들어 관측했으므로 저장이 없다.
