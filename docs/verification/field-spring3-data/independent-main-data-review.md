# FIELD spring3 main 데이터 적용 독립 검토

판정: **PASS — candidate 데이터 커밋 및 후속 실제 runtime 관문 준비에 blocker 없음.** 새 3개의 main runtime은 아직 NOT_RUN이며 설치 승격 판정이 아니다.

검토 기준 HEAD `a392694c3056b93812a0bcc3de767a387f2f3f3b`. 읽은 적용 자료는 `.omo/evidence/field-spring3-main-{plan,apply,dry-run}.json`, `field-spring3-main-apply.receipt.json` 및 설명이다. 영수증만 신뢰하지 않고 실제 checkout, HEAD의 원래 파일, 원본 PNG와 fixture를 재대조했다. 이전 계획/recipe의 PREPARED 표시는 당시 기록이며 최신 실제 적용 상태는 APPLY receipt와 현재 바이트로 판정했다.

## 독립 재검산

- 코드·script·test·tool/config freeze **2595/2595 SHA 동일**, 변경 0. `src/scripts/tests/tools` 미추적 추가 파일도 0. 제품 실행 코드를 추가하거나 시험을 데이터에 맞춰 수정하지 않았다.
- 보호 목록1662 중 append 대상 CSV를 제외한 **1661/1661 SHA 동일**. 기존 public 이미지, 기존 봄9 및 ledger 보존. 동시 진행 중인 FIELD core 공식 증거 문서 변경은 이 데이터 변경에 포함시키지 않았다.
- HEAD catalog의 기존 모든 bundle 객체·순서 정확 보존: entries **99→102**, rules **91→95**. 마지막 bundle은 승인 recipe의 `wave43-field-spring3`와 전체 deep-equal, 정확 entries3/rules4만 추가.
- 규칙은 ploughed/seedling × spring에만 두 slot을 매핑한다. ploughed는 동일 A를 A/B slot 둘 다 사용, seedling은 A/B 별도. 모든 새 entry는 512×64, repeat x, sourcePixelsPerTile128, origin0/0, fade40, wash none, mirror false. 비봄 기존 규칙을 수정하지 않았다.
- provenance는 HEAD의 **2427개 데이터 행을 포함한 전체 원래 바이트가 prefix로 그대로 보존**되며 정확 candidate3 literal records만 추가되어2430행. 마지막3행은 recipe `candidateCsvRows`와 전체 필드 동일; status candidate, NOT RUNTIME VERIFIED. 모델·일시·seed unknown을 임의 채우지 않았다.
- ledger는 HEAD와 바이트 전체 동일. 아래 원본 ID 각각 유일한1행이고 `installed_by`는 모두 빈 문자열. 기존 W37/봄9 표시도 같은 바이트로 보존.
- 적용 receipt24개 출력(제품 데이터5 + fixture19) 모두 실제 SHA 일치. dry-run과 apply의 계획 결과를 바꿔치기하지 않았다.

| 새 PNG | 실제 source = approved prepared = runtime | SHA256 | 크기 |
|---|---|---|---|
| `public/assets/wave43/ground/ridge_ploughed_spring_a-v1.png` | 바이트 동일 | `47dc7b26825cf49b61655449190e2798ab3674de9b22bc50ef763e979dc2bbe9` | 512×64 |
| `public/assets/wave43/ground/ridge_seedling_spring_a-v1.png` | 바이트 동일 | `7b77d1578990d0031f8828c6bbf1b2d8a47032f78493311346c3272ab5693045` | 512×64 |
| `public/assets/wave43/ground/ridge_seedling_spring_b-v1.png` | 바이트 동일 | `89d3c9898840b91c7e3147c90ec714ae6a3044e15ce41ae2e9b71988ddd7fac2` | 512×64 |

세 source 경로는 각각 `assets-inbox/wave43/candidates-20261002/assets/ground/<동일 파일명>`. Pillow로 실제 PNG를 열고 전체 디코딩 및 dimensions를 확인했다. 새 이미지에 대한 이 검토는 바이트/크기 검증이며 source 시각 승인을 새로 주장하지 않는다. 기존 retired6 public 경로는 여전히 모두 없으며 기존 봄9 runtime 바이트는 보호 SHA 일치다.

## Fixture 경계

`output/art-architecture/field-texture-fixtures`와 `field-spring3-fixtures`를 직접 비교했다. 총19파일 중 states8/save8 및 historical coverage/source-provenance2는 바이트 동일(18). views.json20개 중 **spring8개만 expectedRequests 필드 변경**, 나머지12뷰 객체 전체 동일. 바뀐8개에서도 카메라·상태·계절·zoom·DPR·viewport 등 다른 필드는 동일하다. 실제 URL set delta는 각각 기존 ploughed A/B와 seedling A/B4개 제거, 새 spring3개 추가로 recipe와 정확 일치. 과거 coverage/source-provenance는 역사 fixture 구성 자료이며 새 runtime 성공 영수증이 아니다.

## 저장된 집중 검사와 남은 관문

부모가 실행한 `.omo/evidence/field-spring3-main-focus.log`를 읽어 **196/196 PASS, fail0, skipped0** 확인. `field-spring3-main-static.json`은 typecheck exit0, diff-check0, catalog102 PASS를 기록하고 `field-spring3-main-catalog.json` 실제 offline 결과도 pass=true/count102다. 이 독립 검토에서 시험을 재실행하지 않았다.

이전 core20은 독립 시각 검토를 통과했지만 새 spring3 after20을 대체하지 않는다. 새 데이터의 main 실제 request/decode/pattern paint, 봄8 의도 변화/비봄12 RGBA 보존, A/A, 원본 시각 검토가 남아 있다. 이 관문 전 candidate3 승격이나 ledger3 installed_by 채움을 승인하지 않는다. 자연 플레이/모든 occlusion도 주장하지 않는다.

수정한 파일은 이 검토 보고서 하나뿐이다. 제품·catalog·PNG·provenance·ledger·공식 문서·원격 작업은 변경/실행하지 않았다.
