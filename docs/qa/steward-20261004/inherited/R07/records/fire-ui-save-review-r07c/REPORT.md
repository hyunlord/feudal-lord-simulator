# r07c 화재 후 주택: 수동 저장 완료 독립 검수

판정: **PASS_BOUNDED_MANUAL_SAVE_COMPLETION**. 공식 실행 원자료를 Ruby로 재집계했으며 엔진·브라우저·원격 작업을 실행하지 않았다. 검수 쓰기는 이 폴더로 한정했다. 전체 이미지 판독은 별도 검수 범위다.

## 실제 저장과 완료 표본

| 항목 | 첫 저장 actual-before | 두 번째 저장 actual-after |
|---|---|---|
| 클릭 시각(UTC) | 00:36:27.181 | 00:36:33.213 |
| 완료 표본 관측 | 00:36:27.582 | 00:36:34.454 |
| 성공 표본 배열 길이 | 0 → 1 | 1 → 2 |
| 실제 슬롯 savedAt | 2026-10-04T00:36:27.290Z | 2026-10-04T00:36:34.255Z |
| 표본 reason / slotId / tick | manual / manual / 9460 | manual / manual / 9460 |
| 표본 writeMs | 14.30 | 11.40 |

두 클릭 모두 reachable=true, disabled=false다. 클릭 직전 배열의 접두부가 그대로 유지되고 manual 성공 표본이 정확히 하나씩 추가됐다. 배열은 32개 상한에 도달하지 않았으므로 cap 순환으로 표본 수가 왜곡되는 경우가 없다. 기록된 completion은 실제 배열의 마지막 manual 표본과 같다.

`src/state/saveSystem.ts:150`의 성공 promise 분기에서만 metric이 기록되고, `src/save/saveService.ts:100`은 storage.write 완료를 기다린다. 따라서 여기서 확인한 것은 클릭 시도 둘뿐 아니라 성공 완료 표본 둘이다. 실제 슬롯에서 읽은 savedAt도 각각 새 값이며, 표본 tick과 실제 슬롯 tick이 일치한다.

클릭부터 완료 **관측**까지 401ms와 1,241ms였다. 이 간격에는 예약·유휴 실행·프레임 및 관측 비용이 들어간다. 특히 1,241ms를 저장소 쓰기 시간으로 해석하면 안 된다. 표본의 writeMs는 위 표에 별도로 기록했다. r07b의 고정 700ms 이후 읽기 실패 원자료는 변경하지 않았으며, 이 재검수로 과거 두 번째 저장의 미관측 결과를 소급 확정하지 않는다.

## 동일 장면과 선택 보존

입력 fixture SHA256은 `3483cf2fe3a085072ba95ebd39b34a608a5ed40aa3fa4cfc688b90d9daa0054f`이며 실행 fixture-setup 및 준비 manifest와 일치한다. fixture/setup/두 실제 저장 tick은 모두 9460이다.

두 슬롯 추출의 state SHA256은 모두 `53670a99f74a28626618691943a8bc6903cad92b3e350225d50aaaf8ceac7dc2`다. 대상 `construction-site-000011`은 level 0, residents 8, burntTick 9460, burntByEventId `first_fire@9`로 같다. burning과 rebuildSites는 비어 있다. phase 검사는 burnt-house만 참이고, 실제 선택은 이 building ID다. summary의 8개 결과도 전부 참이지만 이에만 의존하지 않고 위 값을 직접 대조했다.

## 빈 metric_records의 의미

부모 `PARENT_CHECK.json`의 `metric_records: []`는 실제 표본 부재를 뜻하지 않는다. `burnt-house/actions.jsonl`에는 kind가 `save-completion-baseline`인 행 둘과 `save-completion-observed`인 행 둘이 있고, 각 label은 actual-before / actual-after다. 본 검수는 이 kind와 label로 대조했다. 부모 집계의 검색 불일치로 정리할 수 있으나, 부모 생성 스크립트를 검수 입력으로 확보하지 않았으므로 정확히 어떤 잘못된 문자열을 검색했는지는 단정하지 않는다. 부모 파일은 수정하지 않았다.

## 핀·종료·범위

실행 폴더 SHA256SUMS 77개 항목 전부 일치. source-before/after 각 1,095개와 artifact-before/after 각 8개가 모두 OK다. 현재 읽은 source 및 helper와 모든 입력 파일 해시는 INPUT_SHA256.json에 별도 보존했다.

stage-exits는 `burnt-house 0`; termination은 normal/probe_exited_zero/exitCode 0. fatal·save-completion-timeout·deadline 행은 없다. cleanup-ok가 있고 process-after는 비어 있으며 listeners-after에 4301·14301 포트가 없다. 다른 포트가 있으므로 호스트의 모든 포트가 비었다는 뜻은 아니다. 원격 scope inactive/dead는 부모 보고이며 이 검수에서 원격 조회하지 않았다.

실제 저장 자료는 helper가 슬롯을 읽고 디코딩해 기록한 추출값이다. 전체 manual envelope의 독립 복사본은 없어 전체 바이트를 별도로 재디코딩했다고 주장하지 않는다. 성공 표본·실제 슬롯 추출·핀·정확한 단계/선택 보존이라는 제한 범위에서 통과다. 일반적인 모든 저장 타이밍이나 다른 화재 단계의 재실행을 포괄하지 않는다.

재현 가능한 오프라인 검사: `ruby review.rb`. 산출물: REVIEW.json, INPUT_SHA256.json, review.rb, 본 보고서 및 SHA256SUMS.
