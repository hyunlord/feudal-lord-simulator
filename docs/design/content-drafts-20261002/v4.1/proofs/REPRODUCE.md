# 검사 재현 범위

`../validate.sh`는 압축을 푼 위치에서 Schema·249개 구조/증거 해시 검사·SHA256SUMS를 확인한다. 게임 소스가 없어도 실행 가능하다(Python jsonschema 필요).

`scripts/`는 이번 단위 검사의 **실제 사용 스크립트**다. 소스 복사본과 esbuild 번들은 경량 납품에서 제외했다. 스크립트의 절대 경로는 실행 당시 위치를 그대로 기록한다. 자동 설치 도구가 아니다.

같은 머신에서 실행 당시 위치:

- 패키지 `/tmp/astra-content-v4.1-20261005`
- 하네스 `/tmp/astra-content41-harness`
- 읽기용 엔진 `/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill-lme9b`
- 소스 복사본 `/tmp/astra-content41-harness/snapshot/src`
- 저장 fixture 복사본 `/tmp/astra-content41-harness/snapshot/fixtures/saves/v49`
- 정본 `/Users/rexxa/fls-astra-content41/docs/design/content-drafts-20261002/v4`

다른 환경에서는 위 경로를 외부 복사본으로 조정한다. `contracts/INPUTS.json`의 소스 해시와 HEAD를 먼저 맞춘다. 소스와 v49 fixture를 읽기용 폴더에 복사한 뒤 scripts를 하네스 폴더에 놓는다. 의존 esbuild는 해당 엔진의 이미 설치된 node_modules에서 읽는다. **원 저장소의 생성기를 실행하거나 소스에 delta를 덮어쓸 필요가 없다.**

검사 순서:

```
node /tmp/astra-content41-harness/qa.mjs
node /tmp/astra-content41-harness/surface.mjs
node /tmp/astra-content41-harness/missing.mjs
node /tmp/astra-content41-harness/dues-boundaries.mjs
node /tmp/astra-content41-harness/revision-boundaries.mjs
```

이 스크립트는 원 엔진 함수에 합성 fixture를 통과시킨다. 새 콘텐츠를 실제 게임에 설치하거나 125년 판을 돌린 것으로 바꾸어 해석하지 않는다. `proofs/baseline/`은 이번 단위 검사와 별개의 기존 v4e 장기 판 원자료다.
