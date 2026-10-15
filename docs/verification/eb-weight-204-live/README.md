# ck_evt_204/a — 직물 꾸러미가 놓인 장터

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight204-live-ce1f4ba`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `ce1f4ba8a915336d4e4956ae58c786eaefe9479a`.
Selected source observed: `registry:ck_evt_204:a`. Answer: `h-023122`.

| Metric | Observed |
|---|---|
| initialTick | 326041 |
| finalTick | 326441 |
| initialYearCount | 3 |
| automaticYearCount | 5 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1381년 당신의 결정 때문에: 직물 꾸러미가 놓인 장터 — 2건.
Manual navigation SHA: `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c` → `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 현금 장부 ledger-013028에 tick 326400의 stall_fee 수입 20d가 기록됐다. 결과 h-023125는 정확한 답 h-023122를 부분원인으로 기록한다. 칩은 3→5, 대상 결과는 1→2건으로 갱신됐으며 부모가 원본 JPEG 두 장에서 「1381년 당신의 결정 때문에: 직물 꾸러미가 놓인 장터 — 2건」이 한 항목으로 완전히 보임을 직접 확인했다. 탐색 전후 전체 SHA는 같다.

원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@326041: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `91ea1be4fb4cc1710b5001b8d5567d35453515bf3fef1ce6e2ceb0e44ef5539c`; integrity true.
- first-exact-receipt@326401: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `5964a88e11592f858b3c99c548cf2de1e558bf5a73cfa1aeb03d876b6d656096`; integrity true.
- automatic-chip@326441: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c`; integrity true.
- before-manual@326441: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c`; integrity true.
- manual-card@326441: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c`; integrity true.
- final@326441: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `5cb266e4a7f4012fe7ef0c335fcbc754404ffeae408e0e7470b41f52a6a5803c`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: chip 5 and the exact canonical target item with 2 results are fully visible once. JPEG hashes are in human-review.json.
- Only choice a is accepted; other choices and the complete 56-event gate are not implied.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.
