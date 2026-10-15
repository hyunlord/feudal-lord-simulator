# ck_evt_032/roll — 소송 서기가 권하는 증거

Status: **PASS — automated checks and parent JPEG review complete**.

Official run: `engineB-weight032-live-95335f5`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `95335f57aa940375fa399218400aa8dbb4a63f46`.
Selected source observed: `registry:ck_evt_032:roll`. Answer: `h-008835`.

| Metric | Observed |
|---|---|
| initialTick | 137047 |
| finalTick | 138000 |
| initialYearCount | 3 |
| automaticYearCount | 5 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1334년 당신의 결정 때문에: 소송 서기가 권하는 증거 — 1건.
Manual navigation SHA: `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3` → `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@137047: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `dc52e9ff3f1a35912833996412f8abb679a26cde8230e9688c5b43c2a9cc8164`; integrity true.
- first-exact-receipt@138000: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`; integrity true.
- automatic-chip@138000: [JPEG](automatic-chip.jpg), [state](first-exact-receipt.state.json.gz), SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`; integrity true.
- before-manual@138000: [JPEG](before-manual.jpg), [state](first-exact-receipt.state.json.gz), SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`; integrity true.
- manual-card@138000: [JPEG](manual-card.jpg), [state](first-exact-receipt.state.json.gz), SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`; integrity true.
- final@138000: [JPEG](final.jpg), [state](first-exact-receipt.state.json.gz), SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3`; integrity true.

Limits:

- 자동 보관 이후 부모가 automatic-chip.jpg와 manual-card.jpg를 직접 검토했다. 정확한 항목 전체와 칩5가 가림 없이 보인다.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

## 사람 화면 판정

032/roll 한 선택 통과. suit-13 filed→evidence@138000 실제 전이, h-008896→h-008835 부분원인. 연간칩3→5, 대상032 항목0→1. 카드에는 정본 제목 ‘소송 서기가 권하는 증거’가 정확히 한 번 나타나고 전체 문장이 읽힌다. 탐색SHA `23914763fea88548909dba7fbb8d7004ebc8eaca843ac1daffe01940b7131df3` 전후 동일. 이 사건의 다른 선택 모두를 검사했다는 뜻은 아니다.
