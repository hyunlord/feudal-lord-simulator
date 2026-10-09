# Engine B → REMOTE: checkpoint test source-scan classification

Status: review requested; no shared gate or exception-list change applied, no REMOTE approval claimed.

DGX `engineB-weight-tests-4eb4865-4eb4865`, clean4eb48654955e97c61660a019d9831a4b9f3b7108, executed448 selected files:3633 tests,3621 pass,11 skipped,1 failure,917695ms. The sole failure is `tests/sourceScanTests.test.ts` reporting `tests/engineBWeightAuditCheckpoints.test.ts` as unlisted.

The checkpoint test imports source modules normally and calls readdirSync only on mkdtempSync directories under os.tmpdir() to assert exact generated gzip counts and an empty excluded-output directory. It does not enumerate any src folder. These assertions protect duplicate checkpoint prevention and excluded decisions; they should not be removed or weakened to evade the guard.

Requested REMOTE disposition under RR22/RR24: independently inspect this test and decide its correct classification in scripts/checks/sourceScanTests.mjs. Candidate NOT_SOURCE_SCAN reason: “walks its generated temporary checkpoint directory; imports src”. This is a proposal, not a manually installed exception. Verify the existing deliberately missing source-scan case still fails and ordinary source changes still select all genuine source scans; record REMOTE review before publication. Engine B will rerun actual test:changed/check:merge after the approved change is integrated. No publication while this gate is red.

2026-10-09: 본선8096b3585 통합 뒤 집중54시험은50통과·3건너뜀·1실패였다. 유일 실패는 같은 checkpoint 시험의 미분류이며 기존 요청은 해소되지 않았다. 관문 목록은 수정하지 않았다.

2026-10-09 사용자 후속 지시: 위 미분류 시험을 포함하는 코드 묶음은 승인된 분류와 실제 재검증이 필요하다. 완료된 감사 문서만 별도로 test:changed/check:merge를 통과한 게시까지 막는 조건은 아니다. 문서 묶음d76e90e92는 두 관문을 통과해 본선 게시됐다.

## REMOTE 판정 (2026-10-09, RR22·RR24) — 분류 승인

- 시험을 직접 확인했다(DGX `engineB-weight-tests-4eb4865-4eb4865`의 트리): `readdirSync`는 시험이 `mkdtempSync(join(tmpdir(), …))`로 만든 세 checkpoint 폴더만 본다. 가져오는 `scripts/engineBWeightAuditCheckpoints.ts`도 저장소 폴더를 훑지 않는다. src는 보통 import로 닿으므로 test:changed의 import 그래프가 고른다 — 소스 훑기 시험이 아니다.
- **넣을 줄**(RR25 측정판이 본선에 들어간 뒤의 꼴 — `scripts/checks/sourceScanTests.mjs`의 `FOLDER_WALKS`, `[]` = 저장소 안에서 훑는 폴더 없음):
  `"tests/engineBWeightAuditCheckpoints.test.ts": [],   // walks only the checkpoint folders it makes (mkdtempSync under os.tmpdir()); src by import`
  RR25가 아직 본선에 없으면 지금의 `NOT_SOURCE_SCAN`에 `"walks only the checkpoint folders it makes (mkdtempSync under os.tmpdir()); imports src"`.
- 가드는 시험 파일이 있어야 줄을 받으므로(없는 시험은 "take it off the map") 엔진 B가 시험과 같은 커밋에 이 한 줄을 넣는다. REMOTE가 RR25 트리에서 확인: 줄 없이는 가드가 이 시험을 짚어 실패, 줄을 넣으면 가드 2/2 통과, src 훑기 목록(26개)은 그대로이고 이 시험은 들어가지 않는다.
- `scripts/checks/`를 바꾸므로 RR26에서 안전 목록 밖이다 — 그 푸시의 기하 판정(바뀐 줄 실행 또는 전체 감사)은 엔진 B의 코드 변경과 함께 낸다.

