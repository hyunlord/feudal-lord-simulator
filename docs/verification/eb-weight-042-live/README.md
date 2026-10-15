# ck_evt_042/firm — 옆 시장으로 향하는 수레

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight042-live-4a61b4a`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_042:firm`. Answer: `h-002984`.

| Metric | Observed |
|---|---|
| initialTick | 38065 |
| finalTick | 38441 |
| initialYearCount | 2 |
| automaticYearCount | 4 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1309년 당신의 결정 때문에: 옆 시장으로 향하는 수레 — 2건.
Manual navigation SHA: `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560` → `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 현금 장부 ledger-000393에 tick 38400의 stall_fee 수입 23d가 기록됐다. 결과 h-003000은 답 h-002984의 부분원인(part:true)으로 이어진다. 기존 관계 −6 항목과 새 수입 항목을 합쳐 대상 카드가 1→2건이 됐다.

칩은 2→4로 갱신됐고, 정확한 대상 카드 항목이 완전히 보였다. 탐색 전후 전체 SHA가 같다. 원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@38065: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `63ba06e54fcf8f28ffbe725bca83b5d8a97c9c6a1274ea8c3411c4cc22847c3e`; integrity true.
- first-exact-receipt@38401: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `9bcbd2e4c3438a3ae9ced236bfd01b6c8945ae8ce3797885638b1b6a72393c50`; integrity true.
- automatic-chip@38441: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560`; integrity true.
- before-manual@38441: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560`; integrity true.
- manual-card@38441: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560`; integrity true.
- final@38441: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `c5dcdbf78c80008db522e6b0f81794ce61fd49e2990dc671bcb0b44d58e18560`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: the chip count and complete canonical target item are visible. JPEG hashes and the delegated review record are in human-review.json.
- Only this selected choice is accepted; other choices and the complete 56-event gate are not implied.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.
