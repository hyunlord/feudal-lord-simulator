# ck_evt_053/roll — 가문의 증서와 장원 법정 기록

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight053-live-4a61b4a`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_053:roll`. Answer: `h-005003`.

| Metric | Observed |
|---|---|
| initialTick | 77065 |
| finalTick | 78001 |
| initialYearCount | 1 |
| automaticYearCount | 3 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1319년 당신의 결정 때문에: 가문의 증서와 장원 법정 기록 — 1건.
Manual navigation SHA: `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4` → `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실제 suit-4가 tick 78000에 filed→evidence로 바뀌었다. 결과 h-005067은 답 h-005003을 부분원인(part:true)으로, 소송 시작 답 h-004944를 함께 원인으로 기록한다. 대상 카드가 0→1건이 됐다.

칩은 1→3로 갱신됐고, 정확한 대상 카드 항목이 완전히 보였다. 탐색 전후 전체 SHA가 같다. 원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@77065: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `47377546b4f6ccd967ae7670b60733840db7bc7db8a0e2093fb75ade02ecd5a0`; integrity true.
- first-exact-receipt@78001: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`; integrity true.
- automatic-chip@78001: [JPEG](automatic-chip.jpg), [state](first-exact-receipt.state.json.gz), SHA `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`; integrity true.
- before-manual@78001: [JPEG](before-manual.jpg), [state](first-exact-receipt.state.json.gz), SHA `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`; integrity true.
- manual-card@78001: [JPEG](manual-card.jpg), [state](first-exact-receipt.state.json.gz), SHA `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`; integrity true.
- final@78001: [JPEG](final.jpg), [state](first-exact-receipt.state.json.gz), SHA `6418783fc93019b55f20d449b39bc070cb037b1572538ab6a07764e1176a59d4`; integrity true.

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
