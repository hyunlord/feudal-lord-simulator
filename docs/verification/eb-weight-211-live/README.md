# ck_evt_211/b — 상인 가문 대표와 처음 정할 몫

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight211-live-9f769ee`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.
Selected source observed: `registry:ck_evt_211:b`. Answer: `h-002496`.

| Metric | Observed |
|---|---|
| initialTick | 33073 |
| finalTick | 33649 |
| initialYearCount | 2 |
| automaticYearCount | 4 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1308년 당신의 결정 때문에: 상인 가문 대표와 처음 정할 몫 — 1건.
Manual navigation SHA: `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f` → `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 현금 장부 ledger-000312에 tick 33600의 stall_fee 수입 16d가 기록됐다. 결과 h-002538은 정확한 답 h-002496을 부분원인으로 기록한다. 칩은 2→4, 대상 결과는 0→1건으로 갱신됐으며 부모가 원본 JPEG 두 장에서 「1308년 당신의 결정 때문에: 상인 가문 대표와 처음 정할 몫 — 1건」이 한 항목으로 완전히 보임을 직접 확인했다. 탐색 전후 전체 SHA는 같다.

원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@33073: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `9f28fb31a2d71afa042f2def409efa7d5249ca5fc85e4ae2817d9eaca402b42e`; integrity true.
- first-exact-receipt@33601: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `321c40addf5a5b15677158ad4d8caaabddf43a74a03b3345f0a3b67c3c209994`; integrity true.
- automatic-chip@33649: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f`; integrity true.
- before-manual@33649: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f`; integrity true.
- manual-card@33649: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f`; integrity true.
- final@33649: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `8579df7f46c2d3d6e6d1c8cb7ae35d2108b4b95a7839e2a9e005f43ddaf6802f`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: chip 4 and the exact canonical target item with 1 result are fully exposed once. JPEG hashes are in human-review.json.
- Only choice b is accepted; other choices and the complete 56-event gate are not implied.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.
