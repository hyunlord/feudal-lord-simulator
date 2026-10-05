# REGION core 독립 코드 검토

**PASS — 정적 코드 검토 통과, runtime은 미검증.** `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5` 기반 isolated `fls-astra-renderB-region-core`의 실제 20개 변경을 검토했다. 승인 계획 §7의 R1/R2를 만족하며 현재 범위에서 수정이 필요한 차단 결함은 발견하지 못했다. 이 판정은 DATA4 설치나 화면 동등성 승인이 아니다.

## 직접 확인한 경계

- `artContract.schema.json:1653`의 기존 FIELD X schema는 이전 객체와 완전히 동일하다. XY만 별도 oneOf 분기로 추가됐고 256×128, 128/64, origin0, wash none, mirror false, 지원 base5가 닫혀 있다. 기존 catalog105 전체 entry/rule은 append 전후 객체가 동일하며 신규 기존원본30만 더해 총135다.
- `fieldTextureValidation.ts:13`은 land-region 접두사가 아닌 모든 ground-texture rule을 받으며, `regionTextureValidation.ts:11`은 그 나머지를 받는다. 따라서 unknown slot이 양쪽에서 버려지지 않는다. 각각 별도 X/XY byId로 foreign source를 거절한다. REGION은 baseId/season 정확2조건, 단위 variant1, priority0, base 일치, 유한40개 base role 및 봄 optional0/2를 검증한다. `artRegistry.ts:44`에서 registry 생성 전에 실제 호출된다.
- `regionTextureArt.ts:23`은 seasonal 양쪽 image와 준비된 pattern을 모두 얻은 뒤 둘 다 있을 때만 반환한다. `archetypeGroundDraw.ts:104`의 adapter가 createPattern null/throw 및 transform throw를 context-local null로 보존한다. 실제 painter는 region 첫 fill 전 pair를 결정한다. base는 종전처럼 한쪽만 준비돼도 그쪽을 그리며, 같은 이미지 A/A도 가능하다. transform `.25,.125,-.5,.25,0,-16`, region evenodd 및 B block clip의 기존 의미는 유지된다.
- 기존 WeakMap/context/image pattern cache와 land artKeys/preloaded/allReady를 재사용한다. 새 지속 callback, per-cell cache, engine 사실, placement 또는 public 변경은 없다. 한 개 lazy shared image loader facade이며 decode/치수 검증은 완화하지 않았다. terminal 실패는 재요청하지 않는다. cold onload 시간선은 의도적으로 달라졌으므로 안정화된 readiness에서만 동등성을 판단해야 한다.
- `archetypeGroundModel.ts:141`과 `archetypeGroundDraw.ts:52`는 최초 4계절 warm 및 poll token에 optional ID까지 포함한다. 따라서 base만 준비됐을 때 allReady를 조기에 고정하지 않는다. 원래 summer→autumn→winter source 요청 순서가 유지되고 spring은 summer base를 재사용한다. context pattern 실패 자체는 image readiness를 바꾸지 않으며 실패를 매 프레임 epoch로 만들지 않는다.
- `wave22CatalogOwnership.ts:12`는 등록된 각 summer/autumn/winter A/B URL을 canonical terrain30키에 대조한다. Python은 canonical79에서 terrain30+HEATH1 소유31을 제외한다. 생성기 fixture는 두 번 생성해 잔여48, owned PNG·해당 provenance·설치 기록 보존과 불완전 ownership의 write 이전 실패를 검사한다.

## 독립 검증

20개 파일 SHA 및 실제 git status 집합이 freeze와 일치했다. source freeze2285개를 직접 해시 대조했고, 원본30↔runtime30 바이트 SHA가 준비 기록과 일치했다. patch SHA는 `9546b9beff4983d15e8f9a716efddd200b7bbbcd73fd7a4cb7f619279653ca89`이다. 기존 catalog105 및 FIELD schema 객체를 git HEAD와 직접 비교했다. `git diff --check`도 통과했다. 26775개 전체 비변경 파일의 재해시는 하지 않았으며 그 전수 수치는 executor freeze의 증거다. 실제 tracked/untracked 변경 집합에는 승인20 외 제품/engine/public/ledger 파일이 없다.

독립 실행: `node_modules/.bin/tsx --test tests/regionTextureArt.test.ts tests/regionTextureContract.test.ts tests/regionTextureReadiness.test.ts tests/installWave22Ownership.test.ts` → **11 PASS / 0 FAIL**. 생성기는 임시 fixture 안에서만 실행됐다. supplied 최신 `region-core-prep-focused-verified.log`는 **174 PASS / 0 FAIL**이며 초기 요청의169와 구별한다. 이 174 전체를 다시 실행한 것은 아니다. type/lint final 로그는 오류 출력이 없고 catalog receipt는135/errors0이다.

Graft의 readiness→landChunkToken 및 validateRegistryData→createArtRegistry caller를 실제 소스로 확인했다. Graft는 탐색 자료일 뿐 승인 증거를 대신하지 않는다.

## 남은 검사와 한계

새 시험은 한쪽 readiness, decode/치수 실패, optional 절반 실패, pattern/transform 실패의 실제 seasonal fill0, context 분리·무재시도, A/A 공유, unknown role/base/조건 및 불완전40규칙을 의미 있게 검사한다. 성공 optional pair는 반환 pattern까지 확인한다. **성공 optional의 native Canvas paint와 실제 chunk/지역 이음새, fixed transform 및 baseline/core 안정화 pixel parity는 향후 runtime gate**다. synthetic Canvas는 이를 증명하지 않는다.

비차단 coverage 참고: REGION→FIELD foreign target mutation은 직접 있지만 역방향 FIELD→XY의 별도 이름 있는 mutation은 없다. 현재 분리된 byId가 그 역방향도 거절하므로 코드 결함으로 보고하지 않는다. A/B cold timing 변경은 승인된 R1의 제한이며 회귀 없음이라는 무조건 주장으로 확대하지 않는다. DATA4 원본/설치는 이번20개에 없다.

작성 범위: 본 MD와 JSON만. 제품·공식 문서·원본·장부 수정, 원격 작업, commit, 하위 agent 없음.
