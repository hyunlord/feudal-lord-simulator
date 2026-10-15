# ck_evt_201/b — 이번 철 좌판의 몫

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight201-live-ce1f4ba`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `ce1f4ba8a915336d4e4956ae58c786eaefe9479a`.
Selected source observed: `registry:ck_evt_201:b`. Answer: `h-003145`.

| Metric | Observed |
|---|---|
| initialTick | 40015 |
| finalTick | 40840 |
| initialYearCount | 2 |
| automaticYearCount | 3 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1310년 당신의 결정 때문에: 이번 철 좌판의 몫 — 2건.
Manual navigation SHA: `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47` → `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 현금 장부 ledger-000441에 tick 40800의 stall_fee 수입 24d가 기록됐다. 결과 h-003172는 정확한 답 h-003145를 부분원인으로 기록한다. 칩은 2→3, 대상 결과는 1→2건으로 갱신됐으며 부모가 원본 JPEG 두 장에서 「1310년 당신의 결정 때문에: 이번 철 좌판의 몫 — 2건」이 한 항목으로 완전히 보임을 직접 확인했다. 탐색 전후 전체 SHA는 같다.

원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@40015: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `82165c2566c0d7cff3fc1bbb5364115c6dcdcace1504556903ea75f60f244bc5`; integrity true.
- first-exact-receipt@40800: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `17b46787764f08d40781cffd577c1544840c608dd68d150f80e479535cb73eb7`; integrity true.
- automatic-chip@40840: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47`; integrity true.
- before-manual@40840: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47`; integrity true.
- manual-card@40840: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47`; integrity true.
- final@40840: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `44fb0c27993c269a91aecb2bf03f0fda0929cae2f80709e195fdfb3888eedf47`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: chip 3 and the exact canonical target item with 2 results are fully visible once. JPEG hashes are in human-review.json.
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
