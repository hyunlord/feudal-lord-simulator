# HEATH main DATA2 적용 독립 검토

**PASS — candidate-only 적용 4개 경로가 승인 준비본과 일치한다.** 검토 기준 HEAD는 `931d780e37307a7dd2f85a697b122656cb29359d`. DATA2 실제 runtime/native 검토와 installed 승인은 아직 별도다.

직접 재검산한 결과:

- 변경 product/provenance 경로는 `src/render/art/catalog.json`, `public/assets/wave22/decals/heath_patch_b.png`, `public/assets/wave22/decals/heath_patch_c.png`, `docs/provenance/assets.csv` 정확히 4개다. tracked diff와 source/public/scripts/tests/inbox untracked 목록을 대조했으며 다른 product 경로 변경은 없다. 동시 진행 중인 공식 증거·상태 문서 갱신은 별도 문서 범위다.
- 코드 2,600개 및 CSV를 제외한 보호 입력 1,668개 전체 SHA 일치. 장부는 committed 931 바이트와 동일하다. retired public 6개는 계속 부재다. new9/FIELD3/기존 public·loader 보존은 이 byte freeze에 포함된다.
- catalog의 committed 931 전체 구조는 준비본 beforeCatalog와 같고, 적용 전체 구조는 승인 afterCatalog와 같다(103→105). 따라서 구 catalog를 복원하지 않았다. B/C PNG는 준비본 및 canonical source와 각 SHA/바이트가 같다.
- provenance는 committed 931의 전체 literal 바이트를 prefix로 그대로 유지한다. CSV 파싱에서도 기존 모든 행 동일 + 승인 candidate 행 정확히 2개만 추가했다. installed_by/장부 변경 0.
- apply recipe SHA `6976abd0cfcf8ac5709a19f6cf39b904151454cc53bf57515db40a5a0c114470`, apply receipt SHA `17fb7725597c9e6462c342c0f147283acac8012163b6bd020dff4cc7a74b6f38`; 출력 4개는 receipt의 준비본 SHA·크기와 전부 일치한다.

core gate는 실제 d367 before30/931 core30 capture, 독립 native 보고서, final core summary, first-open negative16 JSON, doc-drift 분류 및 독립 검토를 정확한 SHA로 연결했다. 모든 연결 SHA를 재확인했고 HEAD/성공/native30/negative16 내용을 확인했다. `NON_RUNTIME_DOCUMENT_DRIFT`(proof 문서 2개 차이, runtime 4,308 입력 일치) 한정이며 whole-export-clean 증거로 승격하지 않았다. repeat 요청/draw 부재는 여전히 배열 미보존으로 미증명이다.

부모의 static receipt와 각 로그 SHA 연결을 확인했다: focused 24파일 305/305, typecheck 0, catalog 105, provenance runtime 2,389=검사대상 행 2,389, missing/orphan/hash mismatch 0. 이 검토에서는 테스트를 반복 실행하지 않았다. provenance 전체 역사 행 수와 active runtime 검사 건수는 구별한다.

정확한 candidate DATA2 commit을 막는 적용 결함은 없다. 이후 실제 DATA2 30장 및 최종 publication gate는 미완료 상태를 유지해야 한다. 본 검토는 이 Markdown 한 파일만 기록했다.
