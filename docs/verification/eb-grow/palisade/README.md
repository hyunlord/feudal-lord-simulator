# Saved-state palisade diagnosis journal

Scope: local read-only probe of old-start seed 9 at 1319; no time advancement, no product edits, no held-out seeds. Source d703a6e10b732955ccd702502ed9a33ea59415c2.

Hypotheses before execution:
1. Era resources fail confirmation although geometric projection succeeds. Evidence: unmet rows, confirm/project identity.
2. Geometry/core membership fails before gates. Evidence: exact validatePalisadeCandidate reason and excluded core IDs.
3. Existing road gates miss road/frontage crossings, disconnecting buildings after completion. Evidence: baseline/projected completed-wall ports/components and lost-edge IDs.
4. The claimed 13 disconnected buildings are actually unreachable wall construction sites or already disconnected buildings. Evidence: compare both ID namespaces and baseline connectivity.

Artifacts: retain `probe.mjs` and `seed9.json` here as reproducible evidence. No debugger instrumentation or running server introduced. Read debugging Node runtime and setup/investigation references.

## 실행과 결과

- 실행 위치: Mac, Node v25.8.2. 시간 전진 없음. 제품 코드는 바꾸지 않았다.
- 재현: `node --import tsx docs/verification/eb-grow/palisade/probe.mjs`
- 소스: `d703a6e10b732955ccd702502ed9a33ea59415c2`.
- 입력: `fixtures/charter/seed9-1319.save.json.gz`, SHA256 `704e64927c759ac216a4e5019bb7b03486f073cdc98016e89acfce42b657f1c2`.
- 구 시작 자리 seed 9, 1319년, 76000틱, 인구 528. 최종 2a 자연 실행 저장으로 취급하지 않는다.
- 호출 전후 입력 상태 직렬화 동일: SHA256 `e06d53c97e4e359734ef2af88231eaf9e05e838ffde8b4abc91cecb96bbef06d`.
- 시대 조건은 모두 충족(목재 322/250, 곡창 5/1, 예배당 1/1, 인구 528/60). H1 기각.
- 생산 탐색 `computePalisadeProposalForState`가 수락 콜백에 전달한 후보는 **0**. 실패는 `building_clearance`. 반환한 시도 경로를 실제 선포 검사에 넣으면 `insufficient_enclosure`: 핵심 `construction-site-000048`이 밖이다. 경로 부분 진단은 `manor-house-45-25-0` 여백 침범도 기록한다. H2 확인.
- 반환 경로는 정점 95개, 실제 둘레 94칸이다. `path.length`를 둘레 칸수로 보고하지 않는다.

| 구분 | 실제 둘레 | 선포 검사 | 완성 벽의 도로 간선 단절 | 기존 연결 건물 단절 | 목책 공사장 길 없음 |
|---|---:|---|---:|---:|---:|
| 생산 탐색 실패 경로 | 94 | 핵심 미포함 | 측정 불가 | 측정 불가 | 선포 불가 |
| 진단용 핵심 여백 2 | 89 | 건물 여백 침범 | 측정 불가 | 측정 불가 | 선포 불가 |
| 진단용 핵심 여백 3 | 97 | 건물 여백 침범 | 측정 불가 | 측정 불가 | 선포 불가 |
| 진단용 전체 여백 2 | 105 | 통과 | 0 | 0 | 1 |
| 진단용 전체 여백 3 | 113 | 통과 | 0 | 0 | 12 |

진단용 전체 경로는 **영주 저택까지 앵커에 포함한 반사실 비교**다. 생산 탐색은 저택을 앵커에서 빼므로 실제 선택된 후보가 아니다. 성벽 완성 표시는 길 연결 검사에만 사용하며 공사 완료/자재 지급/틱 진행을 하지 않는다.

전체 여백 2의 성문은 `(61,18)`, `(39,54)`, 여백 3은 `(64,35)`, `(38,53)`이다. 두 경로 모두 기존 도로 간선과 건물 진입로를 보존한다. 길이 끊긴 건물 ID 목록은 빈 목록이다. 입력부터 창고 길망과 연결되지 않은 건물은 `manor-house-45-25-0` 하나다. 현재 저장/소스에서는 H3을 원인으로 확인하지 못했다.

공사장 ID와 건물 ID를 구분한다. 여백 2의 미접근 공사장은 `palisade-000051-segment-006`. 여백 3은 `palisade-000051-segment-000`부터 `011`까지 12개다. 두 경로 합계 13이지만 이를 인계 문서의 ‘건물 13채’와 같은 관측이라고 단정하지 않는다. `previewPalisadeRouteAccess`가 반환하는 미접근 ID는 건물이 아니라 목책 공사장이다. H4의 관측 종류 혼동 가능성은 남고, 당시 진단 원본 없이는 확정할 수 없다.

인계 문서의 작은 경로 다섯 개·13채 단절은 이 입력/소스로 재현되지 않았다. 제품 고침 전 최종 2a 정체 저장으로 같은 분해를 반복해야 한다. 성문만 고치면 해결된다고 결론내리지 않는다. 원본 수치/경로/건물별 전후 진입로는 `seed9.json`에 보존했다.
