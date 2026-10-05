# REGION canonical30 시험 수정 — test-only

`tests/archetypeGroundDraw.test.ts` 한 파일만 변경했다. 기존 immutable migration fixture의 exact30 ID를 선택한 뒤 등록 전체를 deep-equal한다. 따라서 optional DATA4는 별개로 허용하면서 기존30의 누락·URL·geometry·provenance 변경을 숨기지 않는다. 전역 개수를34로 바꾸거나 최소30으로 약화하지 않았다. legacy48/noTerrain/startup 규칙은 그대로다.

- 기준 `442b71822c189a245877cc1da1af86831e19448a`.
- BEFORE `f4fb1564ef5d295a3e0deaa8b93d16c1927beb38abc7eb40251b4a0afc9be35b`.
- AFTER `8da742d7ac84200a68e841a3f9e54ecabf261ea7f3faf17faaa4400b79d47d66`.
- patch `b039db3bc69e8c2371d9dddcfa3bafd49fab439be985e4e3d8c84acee361b443` (`region-core-test-fix.patch`).
- 기존 실패32/33 원본 로그는 `region4-data-apply-focused.log` 그대로 보존했다.
- 현재 catalog139에서 집중33/33 PASS, typecheck0, 해당 test lint0, scoped diff-check0.
- exact HEAD baseline135 JSON과 현재139 JSON 양쪽에서 canonical30 동일을 확인했다. 각각30개를 하나씩 제거하면 exact-set assertion과 실제 registry가 모두30/30 거부했다. 개수를 유지한 잘못된 source URL도 거부했다. `region-core-test-fix-baseline-mutations.json` 참조.
- DATA6 각각의 SHA를 적용 영수증과 다시 비교:6/6 동일. 추가 제품·PNG·CSV·catalog 변경0. stage/commit/DGX 없음.

## 기존 runtime 증거와의 관계

기존 source freeze2,285파일 중 달라진 것은 이 test1개뿐이며 나머지2,284파일의 바이트가 같다. runtime 제품 코드 변경0이고 이 테스트는 제품에서 import하지 않는다. 따라서 test-only fix가 기존 committed442b core20의 actual runtime 바이트 증거를 무효화하지 않는다. 이는 현재 DATA6를 이미 검증했다는 뜻은 아니다. DATA4의 catalog/PNG 변화는 별도 후보·별도 runtime 관문이다.

부모가 test1+coreproof를 먼저 커밋하고 DATA6는 stage에서 제외한 뒤, 다음 DATA6-only 커밋을 만드는 계획을 따른다. 본 작업자는 staging/commit을 하지 않았다. 정확 명령·SHA·보존6경로는 JSON에 있다.
