# REGION canonical30 test-only 수정 독립 검토

**PASS — 회귀 검증 약화가 아닌, 확장 가능한 canonical30 migration 검증으로의 수정.** DATA4 또는 runtime 수락은 포함하지 않는다.

현재 isolated `tests/archetypeGroundDraw.test.ts:74`의 실제 diff는 제출 patch와 정확히 같고, before/after SHA도 영수증과 일치한다. import1개와 assertion1개 교체뿐이며 fixture 자체는 committed442b와 바이트 동일하다. AFTER SHA `8da742d7ac84200a68e841a3f9e54ecabf261ea7f3faf17faaa4400b79d47d66`, patch SHA `b039db3bc69e8c2371d9dddcfa3bafd49fab439be985e4e3d8c84acee361b443`.

기존 assertion은 모든 REGION entry의 개수30만 확인하여 정당한 optional4에도 실패했고, 개수만 같은 잘못된 URL/geometry/provenance는 직접 검출하지 못했다. 새 assertion은 고정 fixture의 unique ID30을 확인하고 해당 entry 전체를 정렬하여 deep-equal한다. canonical 누락, ID 교체, kind/URL/geometry/provenance 변화는 실패한다. registry 생성의 duplicate ID 검증도 그대로다. legacy48, terrain legacy0, v1/unnamed-decal 조건, pivot, startup preload 조건은 변경하지 않았다. isRegionTexture import는 기존 installed resolver에서 계속 사용한다.

독립 Python JSON 비교로 exact HEAD baseline135와 현재139 모두 canonical30 전체 일치, 각각30개를 하나씩 제거한 경우30/30 불일치, 같은 개수에서 URL을 바꾼 경우 불일치를 확인했다. 이는 실제 변경 assertion의 set/deep equality 의미를 재현한 검사이며 tsx registry 실행을 새로 했다는 주장은 아니다. 제공 mutation 영수증의 registry30/30 거부는 `regionTextureValidation.ts:15–29`와 generic reference validation의 소스 동작에 부합한다. 기존 contract 시험도 forty base roles와 optional complete pair/spring-only 제약을 별도로 유지한다.

이 assertion은 현재 추가4만을 화이트리스트로 고정하는 시험은 아니다. 다른 유효한 후속 optional 등록도 canonical30을 훼손하지 않으면 통과하는 것이 의도다. 따라서 정확 DATA4 inventory는 DATA apply/hash/catalog 검증에서, 실제 selection/paint는 별도 runtime에서 검증해야 한다. 이 책임 분리는 data-driven 확장 목표와 일치하며 이번 시험 수정의 blocker가 아니다.

보호 DATA6 각각의 현재 SHA가 적용 영수증과6/6 일치한다. source freeze2,285개를 독립 재해시한 결과 차이는 이 test1개뿐이다. 제품 runtime 소스 변경0이므로 기존442b actual CORE runtime 바이트 증거를 test-only 변경이 무효화하지 않는다. 현재 catalog/PNG DATA 변화가 그 CORE 증거에 포함되는 것은 아니다.

영수증은 집중33/33, typecheck0, lint0, diff-check0 및 기존32/33 실패 로그 보존을 기록한다. 본 리뷰는 이 suite를 반복하지 않았고 원래 실패 raw log는 직접 열람하지 않았다. 실제 patch/fixture/hash 및 baseline/current mutation 결과로 이 제한된 test-only 수정의 타당성을 독립 확인했다. 제품·DATA6·Git·DGX 변경 없이 리뷰 MD/JSON만 작성했다.
