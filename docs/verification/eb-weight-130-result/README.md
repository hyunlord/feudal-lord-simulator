# ck_evt_130/c — 권리 이야기는 내 책상으로

Status: **FAIL_SCREEN_CHIP_CAPACITY — actual result and reader membership confirmed; parent original-JPEG review completed**.

Official run: `engineB-weight130-live-ce1f4ba`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `ce1f4ba8a915336d4e4956ae58c786eaefe9479a`.
Selected source observed: `registry:ck_evt_130:c`. Answer: `h-005112`.

| Metric | Observed |
|---|---|
| initialTick | 67003 |
| finalTick | 74516 |
| initialYearCount | 1 |
| automaticYearCount | not observed |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: bounded_original_first_result_plus_200_ticks. Absence: canonical_membership_exists_but_matching_uncovered_chip_not_observed.

Actual result and screen failure classification:

실제 audit-9가 tick 74320에 생겼다. 드러난 유보액 458 + 오류 77 = 535이며 결과 h-005537은 선택한 답 h-005112를 정확한 부분원인으로 기록한다. 1318년 결과 읽기에는 전체 4건, 대상 「1316년 당신의 결정 때문에: 권리 이야기는 내 책상으로 — 1건」이 있다.

그러나 부모가 최초 실제 결과·최종 원본 JPEG를 직접 검토한 결과 대상 연간 칩은 나타나지 않았다. 최종 화면의 세 칩은 소송·특허 청원·미카엘 축일 감사다. 최종 tick 74516에는 대상 DOM 칩 [], 열린 패널 [], paused=false, 실제 결과 1건이었다. 소스 src/ui/hud/useStoryPresentation.ts:25 및 :81–96의 MAX_CHIPS=3과 표시 우선순위에 따른 칩 자리 부족으로 분류한다(009와 같은 유형). 흔적 누락이나 모달 차단으로 분류하지 않는다.

실행은 첫 결과+200틱의 제한 창에서 종료했다. 결과 카드와 탐색 SHA 쌍은 **미관측**이며 SHA가 바뀌었다고 주장하지 않는다. 영구 접근 불가를 주장하지도 않는다. [첫 실행의 복합 알림 관측 중단](../eb-weight-130-live/README.md)과 [두 번째 실행의 32ms 진행 혼입](../eb-weight-130-notices/README.md)은 당시 실패 조건 그대로 보존하며, 이번 실제 결과 관측으로 과거 판정을 지우지 않는다. 전체 56사건 통과는 아직 아니다.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed

State and unchanged JPEG evidence:

- initial@67003: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/initial.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/initial.state.json.gz`, SHA `af2c19bf4b82e6fb4f62d01c131dac83ebcf85238574a57d6d37f13eb846537d`; integrity true.
- unanswered-notice-1@68001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-1.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-1.state.json.gz`, SHA `5a0a3184d1f78d9febaf07e4f5279d751592659b35456f9f196052ffb74138be`; integrity true.
- information-1@68150: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/information-1.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/information-1.state.json.gz`, SHA `28f72ed28e8a7d80f9ea82d45b514bbf0765fa42621a75b13e3ff58bc1f21417`; integrity true.
- unanswered-notice-2@69001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-2.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-2.state.json.gz`, SHA `059e7bbcd2980630ff8f9e87234c849ec72e2d3dca587e8e36ab5dc141e8f300`; integrity true.
- registry-covered-1@69151: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/registry-covered-1.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/registry-covered-1.state.json.gz`, SHA `6b66b1b440fec70896c47598384e6de90cd8a556366dd718fbee36f878605cd9`; integrity true.
- registry-after-later-1@69151: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/registry-after-later-1.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/registry-covered-1.state.json.gz`, SHA `6b66b1b440fec70896c47598384e6de90cd8a556366dd718fbee36f878605cd9`; integrity true.
- unanswered-notice-3@70001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-3.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-3.state.json.gz`, SHA `b1d393247fe5f860032e59c72c7b65e4372cb81862f6b201bc762c1a549ec7c9`; integrity true.
- unanswered-notice-4@71001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-4.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-4.state.json.gz`, SHA `5af750bbb6cd5699e29c1bc832cff3a5e0f0778b8f71703bba7821b607e0c0f8`; integrity true.
- unanswered-notice-5@72001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-5.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-5.state.json.gz`, SHA `5dc90d3bead5ba3fed0ba4ab9ad016107b72773b8711b21a39f2d50635bbabf6`; integrity true.
- information-2@72150: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/information-2.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/information-2.state.json.gz`, SHA `207c7e750772b5d975a5fe51c78eb88e095984a448fd4f978433fab52e63dd09`; integrity true.
- unanswered-notice-6@73001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-6.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-6.state.json.gz`, SHA `8c574abe03f6cbbb66d053ed7e344dec87655f8ab0738ec018ed693065f9c53d`; integrity true.
- unanswered-notice-7@74001: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-7.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/unanswered-notice-7.state.json.gz`, SHA `9e159d9c693325a6c76530c442d48b324f5e90e18eca61a44b454120ccba5dcf`; integrity true.
- first-exact-receipt@74321: [JPEG in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/first-exact-receipt.jpg`, [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/first-exact-receipt.state.json.gz`, SHA `93b299de78dd39bdf98118e8b5de053bb65f7c6e5d131087ab67b5dfcf72c856`; integrity true.
- final@74516: [JPEG](final.jpg), [state in bundle](originals.tar.xz), member `eb-weight-live56/ck_evt_130/final.state.json.gz`, SHA `af5b7f276936fecb6ff2187fe0446137c6f12075c156515d6825a0aa282544d6`; integrity true.

Limits:

- Parent personally inspected the original first-exact-receipt.jpg and final.jpg: the target annual chip is absent and the final screen shows lawsuit, patent-petition, and Michaelmas-audit chips. Bundled JPEG hashes are in human-review.json.
- The target result card and navigation SHA pair are NOT OBSERVED, not changed. This bounded window does not establish permanent inaccessibility.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- All fetched evidence bytes are preserved in originals.tar.xz; loose review copies duplicate final.jpg, source-revision.txt and the losslessly gzipped report.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.


Lossless size fallback:

The ordinary archive was 3314183 bytes. All 38 original members were extracted and matched by byte length and SHA256 before publication.
archive.json lists each bundled original path/hash and its former loose payload filename in storage.bundledPayloadFiles.
Only storage changed: no JPEG was transformed, no fetched evidence was deleted, and the original result remains unchanged.
Extract outside the repository into a fresh temporary directory, then verify every member:

```sh
archive="$(pwd)"
review_dir="$(mktemp -d "${TMPDIR:-/tmp}/eb-weight-review.XXXXXX")"
tar -xJf "$archive/originals.tar.xz" -C "$review_dir"
(cd "$review_dir" && shasum -a 256 -c "$archive/original-members.SHA256SUMS")
```
