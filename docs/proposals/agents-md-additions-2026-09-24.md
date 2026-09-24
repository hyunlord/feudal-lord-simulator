# AGENTS.md 상시 규칙 추가안 (2026-09-24)

`AGENTS.md`는 Codex가 A⁗에서 수정 중이라 이 브랜치에서는 고치지 않았다. 병합할 때 아래 블록을 `AGENTS.md` "### 상시 규칙" 목록 끝(현재 7번 다음)에 그대로 붙여 넣는다. 번호는 기존 목록에 맞춰 조정한다.

```markdown
8. **푸시**: 작업이 끝나면 작업 브랜치를 원격에 푸시하고, `git ls-remote origin <브랜치>`로 원격 해시가 로컬 해시와 같은지 보고서에 적는다. main 병합·배포·PR 생성은 명시 지시가 있을 때만 한다. 다른 에이전트의 브랜치는 읽기만 한다.
9. **이름**: 파일·모듈·상수 이름은 작업 번호가 아니라 영역으로 짓는다(`aTriplePrimeWallCopy.ts` ✗ → `wallProgressCopy.ko.ts` ✓). 사용자에게 보이는 문구는 영역별 `*.ko.ts` 파일에 모은다.
10. **캐시**: 캐시를 추가할 때는 (a) 무효화 키로 무엇을 쓰는지, (b) 키에서 빠진 입력이 결과에 영향을 주지 않는 이유, (c) 추가 전후 측정값을 주석과 보고서에 남긴다. 측정 없이 캐시를 추가하지 않는다.
11. **저장 형식**: `GameState` 모양을 바꾸는 작업은 같은 커밋에서 `SAVE_SCHEMA_VERSION`을 올리고 `src/save/migrations/`에 vN→vN+1 단계를 추가한 뒤 `npm run save:fingerprint`로 지문을 갱신한다. 저장 스키마 감시 테스트(`tests/saveSchemaFingerprint.test.ts`)를 끄거나 지문만 바꾸지 않는다.
```

## 근거

- 8: B8 보완 지시서 "필수 조건: 작업 브랜치를 원격에 푸시하고 원격 해시 = 로컬 해시 확인".
- 9: 현재 저장소에 작업 번호 이름이 남아 있다(`src/ui/aTriplePrimeRoadCopy.ts`, `src/ui/aTriplePrimeWallCopy.ts`). 개명은 이 규칙이 적용된 뒤 별도 작업으로 한다.
- 10: 저장 결정론 조사에서 틱 경로에 모듈 수준 캐시가 약 9개 있었고, 그중 `autoplayServiceSpace`의 `layouts`는 이전 레이아웃 결과를 재사용한다(실험상 결과 불변, 증명 없음).
- 11: `GameStateSnapshot = GameState`라서 상태 모양이 바뀌면 저장 형식도 조용히 바뀐다. 감시 테스트는 이를 실패로 드러내고, `save:fingerprint`는 버전이 오르지 않으면 갱신을 거부한다.
