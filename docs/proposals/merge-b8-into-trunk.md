# B8 저장 시스템을 본선에 합치는 절차 (A⁵ 종료 후, Codex 실행용)

`claude/b8-save`는 본선 `origin/codex/phase15-organic-ground` `4592211`을 이미 병합했다(머지 커밋 `d1ca871`). 그 시점 기준 충돌 파일은 없고, 저장 스키마 지문도 그대로였다. A⁵가 그 뒤로 바꾼 부분만 새로 맞추면 된다.

## 1. 병합 (본선 브랜치에서)

```bash
git fetch origin
git switch codex/phase15-organic-ground
git merge origin/claude/b8-save        # rebase·force push 금지
```

충돌이 나기 쉬운 파일: `src/App.tsx`(환영 화면의 이어하기·새 게임, 목책 초안), `src/state/gameStore.ts`(`load_saved_state` 액션, 자동 저장 연결), `src/ui/SpeedControls.tsx`(설정 팝업의 저장 컨트롤), `package.json` 스크립트. 본선 동작을 유지하고 저장 연결을 그 위에 얹는다.

## 2. A⁵가 `GameState` 모양을 바꿨다면

`tests/saveSchemaFingerprint.test.ts`가 다음 문구로 실패한다.

> 게임 상태 모양이 바뀌었습니다. SAVE_SCHEMA_VERSION을 올리고 migrations/에 vN→vN+1을 추가한 뒤 지문을 갱신하세요 (npm run save:fingerprint).

실패 메시지의 `added:`·`removed:` 경로를 보고 다음 순서로 한다. 모두 같은 커밋에서 한다.

1. `src/save/saveTypes.ts`의 `SAVE_SCHEMA_VERSION`을 2로 올린다.
2. `src/save/migrations/v1ToV2.ts`를 만들고 `SAVE_MIGRATIONS`에 `{ from: 1, to: 2, migrate }`를 추가한다. 새 필드에는 옛 저장에서 올바른 기본값을 넣고, 없어진 필드는 지우고, 이름이 바뀐 필드는 옮긴다.
3. `npm run build:save-fixtures`로 `fixtures/saves/v1/*`를 새 스키마로 다시 만든다. 옛 v1 파일은 `fixtures/saves/v1/`에 남기고 새 파일은 `fixtures/saves/v2/`에 둔다. 옛 fixture가 마이그레이션되는지 CI가 계속 확인해야 한다.
4. `npm run save:fingerprint`로 지문을 갱신한다. 버전을 올리지 않으면 갱신을 거부한다.

모양이 안 바뀌었으면 이 절차는 건너뛴다.

## 3. 확인할 테스트

| 명령 | 확인 내용 | 예상 소요 |
|---|---|---|
| `npx tsx --test tests/saveSchemaFingerprint.test.ts tests/saveSystem.test.ts tests/saveFixtures.test.ts tests/saveDeterminism.test.ts` | 저장 관련 전부(`output/` 없이 동작) | 약 30초 |
| `npx tsx scripts/verifySaveDeterminism.ts --cases seed1,newgame --seed-dir fixtures/determinism` | 저장→새 프로세스 불러오기→24,000틱 결정론 | 약 1.5분 |
| `npm run verify:save-determinism` | 이식 가능한 관문(추적된 seed 1 + 새 게임, `output/` 불필요). 추가 seed는 `--cases`·`--seed-dir`로 지정 | 약 1.5분 |
| `npm run play` 후 `B8_URL=… node scripts/verifyBrowserContinue.mjs <dir> 60` | 브라우저 새로고침·탭 닫기 후 이어하기 | 약 2.5분 |
| `node scripts/verifyBrowserNewGameArchive.mjs` | 새 게임 확인 줄, 이전 도시 보관 | 약 1.5분 |
| `npm test`, `npm run typecheck`, `npm run build` | 전체 회귀 | 약 4~5분 |

브라우저 스크립트는 4173 포트가 쓰이고 있으면 `vite preview --port 4183`로 띄우고 `B8_URL`을 맞춘다.

## 4. 알려진 사항

- 자동 성장 가드레일은 필요 없다. 저장 시스템은 게임 규칙을 바꾸지 않고, 결정론 관문이 이를 증명한다.
- 이전 `pathCache` 비움 실험의 상태 해시에는 캐시 자체가 포함되어 있어 게임 상태 차이로 잘못 해석했다. R1 확인에서 캐시를 제외한 게임 상태는 24,000틱 매 틱 동일했다. S0 결정론 해시는 루트 `pathCache`를 제외한다. 저장에 캐시를 포함할지 여부는 별도 결정이며 이번에는 저장 형식을 이 이유로 변경하지 않는다. 기존 `docs/verification/b8-save/path-cache.json`은 정정 전 측정 이력이다.
- S0 이식성 작업에서 `tests/autoplayServices.test.ts`의 `output/` 입력을 추적된 fixture로 옮긴다.
- 상시 규칙 추가안: `docs/proposals/agents-md-additions-2026-09-24.md`

## S0 병합 적용 기록

- A⁵-1의 선택적 목재 관측 필드 두 개를 schema v2에 등록했다. v1→v2는 원래 state를 그대로 보존한다. 관측값이 없는 구형 저장은 실제 균형/목재 비축 틱에서 처음 관측하며, 과거 시각을 만들어 교착으로 오판하지 않는다.
- 체크섬은 변환 전에 원본 state에 검증한다. 손상된 v1과 문자열이 아닌 체크섬도 거절한다. 저장 본문에는 기존처럼 pathCache가 포함된다.
- 자연 성장 fixture 재생성은 96,360틱에서 목책 0/29와 긴 서비스 후보 탐색을 관측해 중단했다. S0는 성장 규칙을 고치지 않는다. `npm run build:save-fixtures -- --from-version 1`로 기존 자연 상태를 정식 migration 후 v2로 재저장했다. manifest의 원본 경로·SHA가 출처이며 새 성장 결과가 아니다. 인자 없는 자연 성장 생성 경로도 유지한다.
- `npm run save:fingerprint`는 현재 버전 지문을 별도 파일로 작성한다. v1 fixture·지문은 보존한다. 결정론 결과 파일은 `npm run verify:save-determinism -- --out <새 파일>`로 지정해 이전 증빙을 덮어쓰지 않는다.
