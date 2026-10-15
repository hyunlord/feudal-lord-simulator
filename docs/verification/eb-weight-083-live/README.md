# ck_evt_083/a — 목재가 도착할 장터

Status: **PASS_ONE_CHOICE — automated checks and parent original-JPEG review passed**.

Official run: `engineB-weight083-live-4a61b4a`; exit 0; original valid: true.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_083:a`. Answer: `h-003391`.

| Metric | Observed |
|---|---|
| initialTick | 73009 |
| finalTick | 73084 |
| initialYearCount | 7 |
| automaticYearCount | 8 |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 1 |
| progressAtTen | true |
| manualTargetCaptured | true |
| navigationUnchanged | true |

Canonical title in actual manual expected fact: true. Fact: 1318년 당신의 결정 때문에: 목재가 도착할 장터 — 1건.
Manual navigation SHA: `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a` → `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a`.
Stop: new_exact_result_in_automatic_year_chip. Absence: not observed.

Actual effect and reviewed screen evidence:

실측: tick 73040에 목재 주문 잔량이 16→14로 줄었다(2단 배송). 결과 h-003392(goods_delivered, brought:2)는 정확한 답 h-003391을 직접 원인으로 기록한다. 다른 선택지의 세율 명령을 근거로 삼지 않았다.

칩은 7→8로 갱신됐고, 대상 카드 0→1건의 정확한 제목·건수 항목이 완전히 보였다. 탐색 전후 전체 SHA가 같다. 원본 archive.json의 자동 검사 당시 human-review-pending 기록은 그대로 보존하며, 이후 부모의 직접 이미지 검토는 human-review.json과 이 README에 추가한다.

Original errors and archive checks:

- None.

State and unchanged JPEG evidence:

- initial@73009: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `51e44b7118d78b121924dc37fc9f7c69fdd3b7dd9dceab54cefe0c511d546506`; integrity true.
- first-exact-receipt@73041: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `da5bd696d5116b47c0d9bca93233548475ee4c1676d6d7d4940f6d56326a715e`; integrity true.
- automatic-chip@73084: [JPEG](automatic-chip.jpg), [state](automatic-chip.state.json.gz), SHA `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a`; integrity true.
- before-manual@73084: [JPEG](before-manual.jpg), [state](automatic-chip.state.json.gz), SHA `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a`; integrity true.
- manual-card@73084: [JPEG](manual-card.jpg), [state](automatic-chip.state.json.gz), SHA `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a`; integrity true.
- final@73084: [JPEG](final.jpg), [state](automatic-chip.state.json.gz), SHA `014df0a4721fb1d4093bd1005f298771e6cdb85472d4eca5278df8c054b8123a`; integrity true.

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
