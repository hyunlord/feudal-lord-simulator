# ck_evt_092/b — 큰 부담을 거두는 작은 시장

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight092-live-4a61b4a`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_092:b`. Answer: `h-001317`.

| Metric | Observed |
|---|---|
| initialTick | 32059 |
| finalTick | 33627 |
| initialYearCount | 칩 없음 (null; 숫자 0 표시 아님) |
| automaticYearCount | 2 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1308년 당신의 결정 때문에: 큰 부담을 거두는 작은 시장 — 1건.
Manual navigation SHA: `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd` → `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 현금 장부 ledger-000262에 tick 33600의 stall_fee 수입 8d가 기록됐다. 결과 h-001368은 정확한 답 h-001317을 부분원인(part:true)으로 기록한다. 실제 결과 뒤 연간 칩은 없음→2로 나타났고, 대상 결과는 1건이다. 부모가 원본 JPEG 두 장에서 정확한 제목·건수 항목이 완전히 보임을 직접 확인했다. 탐색 전후 전체 SHA는 같다.

원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@32059: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `2ececa75439e5bf1ba43445551fd43299f2eb435eb8a916799a083d97cf17889`; integrity true.
- first-exact-receipt@33601: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `85b1cb2185a2c82200fa4b25b0e58d3847a5718a535114006758dda86210a438`; integrity true.
- automatic-chip@33627: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd`; integrity true.
- before-manual@33627: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd`; integrity true.
- manual-card@33627: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd`; integrity true.
- final@33627: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `8989093be5242721edbf7e4269547749b3ee8b579ede68240fee13f6d6e7afbd`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: the chip count and complete canonical target item are visible. JPEG hashes and the delegated review record are in human-review.json.
- Only b is accepted; other choices and the complete 56-event gate are not implied.
- The initial yearly-results value is null and no yearly-results chip is present. This is 칩 없음→2, not a displayed numeric 0→2.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.
