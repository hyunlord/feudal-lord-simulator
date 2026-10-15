# ck_evt_165/a — 눈길에 앞서 올린 주문

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight165-live-6308a7d`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `6308a7dd3b41475546da378198b46e6bfcff6d8c`.
Selected source observed: `registry:ck_evt_165:a`. Answer: `h-026606`.

| Metric | Observed |
|---|---|
| initialTick | 366055 |
| finalTick | 366080 |
| initialYearCount | 1 |
| automaticYearCount | 2 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1391년 당신의 결정 때문에: 눈길에 앞서 올린 주문 — 2건.
Manual navigation SHA: `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a` → `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 목재 주문 잔량이 tick 366080에 12→10으로 줄었다(배송 2단). 결과 h-026607은 정확한 답 h-026606을 직접 원인으로 기록한다. 칩과 대상 건수 모두 1→2로 갱신됐고, 부모가 원본 JPEG 두 장에서 「눈길에 앞서 올린 주문 — 2건」이 정확히 한 항목으로 완전히 보임을 직접 확인했다. 탐색 전후 전체 SHA는 같다.

원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@366055: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `abcb29a532e61f265a50ff80a5686860f2dccae5033496812faa77cd980fd89b`; integrity true.
- first-exact-receipt@366080: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`; integrity true.
- automatic-chip@366080: [JPEG](automatic-chip.jpg), [state](first-exact-receipt.state.json.gz), SHA `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`; integrity true.
- before-manual@366080: [JPEG](before-manual.jpg), [state](first-exact-receipt.state.json.gz), SHA `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`; integrity true.
- manual-card@366080: [JPEG](manual-card.jpg), [state](first-exact-receipt.state.json.gz), SHA `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`; integrity true.
- final@366080: [JPEG](final.jpg), [state](first-exact-receipt.state.json.gz), SHA `ed1741ab108767c1721cc8fc0fc46afe652521429a5ba01c06ccdbb521f78e5a`; integrity true.

Limits:

- Parent personally reviewed automatic-chip.jpg and manual-card.jpg: chip 2 and the complete canonical target item with 2 results are visible. JPEG hashes are in human-review.json.
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
