# ck_evt_005/b — 빈 좌판 곁의 세금 장부

Status: **FAIL — original failure retained; after-Later JPEG reviewed by parent**.

Official run: `engineB-weight005-later-430d8d6`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `430d8d656aebb5e8896bb666e77e3fa23b40d6a1`.
Selected source observed: `registry:ck_evt_005:b`. Answer: `h-002615`.

| Metric | Observed |
|---|---|
| initialTick | 34009 |
| finalTick | not observed |
| initialYearCount | 6 |
| automaticYearCount | not observed |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: not observed. Absence: not observed.

Original errors and archive checks:

- AssertionError [ERR_ASSERTION]: Normal Later changed game state + actual - expected  + '01acf56be84a7108f07c74db088f56cfcbb572aba4d2e87058620f5d9e907d58' - 'e1715cd5f7c6ff1cacdb7faeed11c865a60bd7e0471ab9f3e48d7e6dec8c5a41' 
- official_exit_code:1
- original_report_valid_is_not_true
- original_report_has_errors
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed

State and unchanged JPEG evidence:

- initial@34009: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `c51353084c66658f3a8e6fe821aee63250836712f0a45a2b87f0305bd3d84f3a`; integrity true.
- first-exact-receipt@36001: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `124782d0fcc27e0eec3c9c6fe70dfc8d348b9c06111a25db30894b0eb8494425`; integrity true.
- result-covered-by-registry-card@36151: [JPEG](result-covered-by-registry-card.jpg), [state](result-covered-by-registry-card.state.json.gz), SHA `e1715cd5f7c6ff1cacdb7faeed11c865a60bd7e0471ab9f3e48d7e6dec8c5a41`; integrity true.
- result-after-normal-later@36151: [JPEG](result-after-normal-later.jpg), [state](result-after-normal-later.state.json.gz), SHA `01acf56be84a7108f07c74db088f56cfcbb572aba4d2e87058620f5d9e907d58`; integrity true.
- failure@36151: [JPEG](failure.jpg), [state](result-after-normal-later.state.json.gz), SHA `01acf56be84a7108f07c74db088f56cfcbb572aba4d2e87058620f5d9e907d58`; integrity true.

Limits:

- No human image review is claimed. Review the original JPEG files before visual acceptance.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

## 사람 화면 검토와 원인

부모가 result-after-normal-later.jpg를 직접 확인했다. 정상042 ‘나중에’ 뒤에1308년 연말 카드가 자동으로 열려 있다. 틱36151은 그대로지만 seen.marks에 `{id:year-review:1308,tick:36151,opened:true}`가 추가됐다. 다른 최상위 상태 필드는 같다.

탐색 전 SHA `e1715cd5f7c6ff1cacdb7faeed11c865a60bd7e0471ab9f3e48d7e6dec8c5a41` → 후 `01acf56be84a7108f07c74db088f56cfcbb572aba4d2e87058620f5d9e907d58`. 원인: 화면 전환 뒤 밀린 연말 카드 자동열림/읽음 표시 기록. src/ui/hud/useStoryPresentation.ts:218–224의 yearDueRef 처리와 markOpened(yearCardId(due.year)). 실제 수입·정확한 답 연결·칩1건 존재와 별개로 전체 화면 관문은 미통과다.

‘나중에’가 영지 규칙을 바꿨다고 주장하지 않는다. 그러나 요구된 전체 상태 SHA 불변은 깨졌으므로 seen을 빼거나 기준선을 새로 잡아 이 탐색을 통과로 만들지 않는다. 제품 수정 없이 렌더 검토 인계. 056을 재검증한 것이 아니다.

## 2026-10-16 005 우선 진단: 담당 렌더 A

기존 두 gzip 증빙을 재귀 비교한 결과는 [navigation-diff.json](navigation-diff.json)에 보존했다. `/seen`: **필드 없음 → {"marks":[{"id":"year-review:1308","tick":36151,"opened":true}]}**. tick은36151→36151이고 그 밖의 모든 경로는 동일하다. 새 실행이나 제품 수정은 하지 않았다.

코드 위치(측정 제품0eddc146 및53407fe69에서 동일): `src/ui/hud/useStoryPresentation.ts:221`이 밀린 연말 카드를 열며 `markOpened`를 호출하고, 같은 파일109줄에서 `{type:"mark_story_seen", id:"year-review:1308", how:"opened"}`를 dispatch한다. `src/state/gameStore.ts:167`이 `src/engine/storySeen.ts:40–51`의 명시적 쓰기 함수로 보내 새 상태의 seen.marks를 만든다. 조회 `storySeen`(31–32줄)은 읽기만 한다.

**담당: 렌더 A — 화면 자동열림이 명령을 보내는 경로이며 엔진 조회 함수가 상태를 고치는 경우가 아니다.** 전체 상태 SHA 불변은 실제 실패다. 저장 읽음 표시 변경만 입증했으며 경제 상태·시뮬레이션 결정성·별도 가드레일 해시의 변화까지 입증한 것은 아니다. 새005실행을 대기열에서 빼고 진단만 인계한다.
