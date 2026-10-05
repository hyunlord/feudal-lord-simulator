# FIELD 봄3 — 실제 main 수치·독립 시각 통과, 정확3행 승격

`a392694c3056b93812a0bcc3de767a387f2f3f3b`의 [FIELD core 실제20쌍 통과](../field-core/REPORT.md) 뒤 적용했다. **APPLIED / STATIC PASS / INDEPENDENT DATA REVIEW PASS / RUNTIME PASS WITH LIMITS**. 이후 아래 별도 승격 영수증에 따라 정확3행을 표시했다. [독립 적용 검토](independent-main-data-review.md)는 PASS이며 실제 main20뷰 수치와 [독립 눈검토](main-data-visual-review.md)는 PASS WITH LIMITS이며 승격 뒤 reference4도 통과했으며 최종 가지 관문·게시가 남아 있다. 과거 detached data20 성공은 이번 main 증거로 사용하지 않는다.

## 적용 경계와 보존

제품 데이터는 정확5파일: `src/render/art/catalog.json`, 아래 public PNG3, `docs/provenance/assets.csv`. 기존 catalog 객체·순서를 보존하고 `wave43-field-spring3` 3 entries/4 rules만 추가했다(99→102 entries, 91→95 rules). 봄 ploughed는 A|A, seedling은 A|B; 비봄 선택은 유지한다. 각 PNG512×64, sourcePixelsPerTile128·origin0·repeat x·fade40·wash none·noMirror를 사용한다.

원본 바이트 무변환, 코드/시험/도구 동결2,595파일 SHA 변경0을 실제 파일로 재확인했다. 원래 봄9·퇴역6 원본과 public 부재, C25/loader/season predecessor는 보호한다. 기존 provenance2,427행 prefix를 보존하고 candidate3행만 추가(2,430행); 데이터 적용 당시 장부 바이트 변경0·이3 source ID의 installed_by 미표시였고, 아래 runtime 이후 승격 단계에서만 변경했다. HEIGHT 요청 문서 동시 커밋 여부는 이 데이터5파일 경계 밖이며 아트 설치 증거가 아니다.

| 승인 원본 | public 사본 | bytes | 동일 SHA256 |
|---|---|---:|---|
| `assets-inbox/wave43/candidates-20261002/assets/ground/ridge_ploughed_spring_a-v1.png` | `public/assets/wave43/ground/ridge_ploughed_spring_a-v1.png` | 74619 | `47dc7b26825cf49b61655449190e2798ab3674de9b22bc50ef763e979dc2bbe9` |
| `assets-inbox/wave43/candidates-20261002/assets/ground/ridge_seedling_spring_a-v1.png` | `public/assets/wave43/ground/ridge_seedling_spring_a-v1.png` | 73547 | `7b77d1578990d0031f8828c6bbf1b2d8a47032f78493311346c3272ab5693045` |
| `assets-inbox/wave43/candidates-20261002/assets/ground/ridge_seedling_spring_b-v1.png` | `public/assets/wave43/ground/ridge_seedling_spring_b-v1.png` | 74931 | `89d3c9898840b91c7e3147c90ec714ae6a3044e15ce41ae2e9b71988ddd7fac2` |

## 현재 증거와 남은 관문

실제 main 집중시험196/196·실패0, typecheck exit0, catalog102/102 PASS, diff-check exit0. 아래 적용 영수증은 mode APPLY, productCodeChanged0, ledgerChanged false를 기록한다. 최초 계획의 NOT_EXECUTED 문구는 계획 당시 상태이며 이 적용 영수증과 구분한다.

- 적용 영수증: `.omo/evidence/field-spring3-main-apply.receipt.json`
- 고정 recipe: `.omo/evidence/field-spring3-main-apply.json`
- 실제 정적 결과: `.omo/evidence/field-spring3-main-static.json`
- 집중시험 원로그: `.omo/evidence/field-spring3-main-focus.log`

원래 raw8/save8 fixture 바이트와20뷰 state·camera·season·zoom·DPR·viewport를 유지한다. 봄8뷰 expectedRequests만 새3 URL로 바꾸며 비봄12 view 객체는 동일하다. 실제 main data20/A-A20/errors0, 봄8의 픽셀 변화·비봄12 RGBA0, source3 request→decode→pattern paint 수치를 확인했다. 독립 원본 눈검토에서도 준비 장면의 설치 blocker를 발견하지 못했다. paint lineage는 최종 픽셀 가시성이나 자연플레이의 증명이 아니다. 그 관문이 통과한 뒤 아래 별도 승격 영수증으로 provenance·installed_by3행을 표시했다.

- 적용 영수증 SHA256: `71f9d6df01ed5a6222bd98c66bc9df571e512778f1401ea79dc6e2e0973b4bb5`
- recipe SHA256: `1b6532e125f38b694de54a7c830a2dd87e1ea306a7b319179d3ebd4c114a5794`
- 정적 결과 SHA256: `19bd9e0af4acf2ddd805bafc4c59a81b4007cd24e4cf42285269f2f7d4f48abe`
- 집중시험 원로그 SHA256: `e7925f6eacfad9dcb2b33c696e9b37a1d01846fb304e9cf75503676b75e8a703`

## 실제 main 수치 증거 — cd399e4a

실제 `cd399e4abb26fc04b37dc27b5c61bec270934a7d`를 core `a392694c3056b93812a0bcc3de767a387f2f3f3b`와 비교했다. [수치 원영수증](main-data-summary.json), [실행 기록](main-data-watch.json), [원격 해시 대조](main-data-remote-freeze.json), [원본 동결 참조](main-data-source-freeze-reference.json): 원격4,168 SHA 일치·퇴역 public6 부재·실행/수집 exit0, 단일 실행222.7초·대기0초. before/after/repeat PNG60개를 디코딩한 수치 대조이며 독립 시각 판정과 구분한다.

20뷰 A/A 통과·오류0. 비봄12 full identity/RGBA 정확 동일; 봄8은 expectedRequests만 다른 identity이며8개 모두 실제 픽셀 변화가 있다. 봄 각8뷰에서 새3 URL의 요청·정상 decode·성공 image/canvas/pattern paint lineage를 확인했다. 이는 각 소스의 최종 가시 픽셀·모든 가림·자연플레이를 보증하지 않는다. [전체20쌍 identity·원본 PNG/JPEG 경로와 SHA](main-before-after-identities20.json)는 봄8 각각의 전후를 구분한다.

[출처시험5/5](main-provenance-tests.txt), [실제 CLI runtime2,387/CSV2,387](main-provenance-cli.txt), missing/orphan/hash/nonexistent 모두0. CLI의 비열거 public49 목록은 원로그에 보존하며 이 숫자를 orphan으로 바꾸어 해석하지 않는다. [main 정적196/196·타입·catalog102](main-static.json)도 보존했다.

### 원본 JPEG 선택본

아래 JPEG는 실제 캡처 바이트 그대로이며 다시 저장하거나 크기를 줄이지 않았다. 비봄 같은 SHA는 물리 파일 하나를 공유하되 논리 before/after와 raw 경로는 별도다. 양축 DPR2와1.4를 포함한 전체8봄 pair는 위 원본 참조에 남긴다.

| 장면 | core before | data after |
|---|---|---|
| field-x-spring-z1 | [원본 JPEG](images/field-x-spring-z1-before.jpg) | [원본 JPEG](images/field-x-spring-z1-after.jpg) |
| field-x-spring-z06 | [원본 JPEG](images/field-x-spring-z06-before.jpg) | [원본 JPEG](images/field-x-spring-z06-after.jpg) |
| field-x-summer-z06 | [원본 JPEG](images/field-x-summer-z06-before.jpg) | [원본 JPEG](images/field-x-summer-z06-before.jpg) |
| field-x-winter-z06 | [원본 JPEG](images/field-x-winter-z06-before.jpg) | [원본 JPEG](images/field-x-winter-z06-before.jpg) |
| field-y-spring-z1 | [원본 JPEG](images/field-y-spring-z1-before.jpg) | [원본 JPEG](images/field-y-spring-z1-after.jpg) |
| field-y-spring-z06 | [원본 JPEG](images/field-y-spring-z06-before.jpg) | [원본 JPEG](images/field-y-spring-z06-after.jpg) |
| field-x-summer-z1 | [원본 JPEG](images/field-x-summer-z1-before.jpg) | [원본 JPEG](images/field-x-summer-z1-before.jpg) |
| field-x-winter-z1 | [원본 JPEG](images/field-x-winter-z1-before.jpg) | [원본 JPEG](images/field-x-winter-z1-before.jpg) |

독립 검토는 AFTER20·봄 BEFORE8 원본과 DPR2 부분4개를 개별 확인했다. 작은 배율에서 A/B 개별 변형 구분·가림·자연플레이는 한계로 남는다. repeat source 기록이 없어 A/A를 반복 요청/paint 부재로 해석하지 않는다. [독립 수치 감사](main-data-visual-audit.json)와 [부모 재검산](main-data-parent-check.json)을 보존한다. 원래 summary/watch의 visual PENDING은 캡처 당시 상태이며 이후 독립 검토로 해소했다. 후속 승격은 아래 별도 영수증으로 구분하며 reference4 성공을 미리 주장하지 않는다. [현재 판정](proof-status.json).

## 실제 runtime 이후 정확3행 승격

[부모 적용 영수증](main-promotion.json)은 `cd399e4abb26fc04b37dc27b5c61bec270934a7d` / `astra-field-main-spring3-cd399e4` 실제20 및 독립 시각 PASS 뒤 적용됐다. 장부6,122행 중 정확 source3행의 installed_by만 표시하고6,119 literal records·헤더·CRLF를 보존했다. provenance2,430행 중 동일3행 status/notes만 승격하고2,427 literal records·헤더·줄바꿈을 보존했다. 원본 생성 모델/시각/seed unknown을 새로 채우지 않았다. 승격 후 실제 두 CSV SHA가 영수증과 동일함을 확인했다.

원본425 집계는 marked150→153, runtime-status/byte-verified154→157, physical-byte-matched157→157이다. 서로 다른 집계를 설치 수로 합치지 않는다. 코드·public4,259파일 변경0은 승격 실행자 영수증의 보고 수치다(이 패키지에 개별4,259 해시 목록은 없다). [부모 독립 재검토](main-promotion-parent-review.json)는 실제 CSV records와 근거4 SHA를 재확인했다. 앞 단계의 코드2,595 및 원격4,168은 서로 다른 범위의 동결이며4,259와 혼동하지 않는다. 직접 참조 가능한 실제 원격 동결은 앞의4,168 입력 영수증이며 존재하지 않는4,259 raw 파일 참조를 만들지 않는다.

승격 영수증 SHA256: `b3b1df3672bad59f055e18cffa1264148c961777a481f2ff32d0d2a2b6367a0d`. **승격 커밋 뒤 실제 summer/winter ×1/.6 reference4도 PASS**. 아래 영수증은 기존20뷰의 봄3 소비 검증과 별도로 동일 identity·RGBA0·A/A4·오류0·실행자 원본 눈검토를 확인한다. 최종 가지 관문·게시도 별도다.

## 승격 후 d367 실제 reference4 통과

실제 `d367382392a4806e683b91463f3996b7654704d6` / `astra-field-spring3-ledger-reference-d367382`를 직전 데이터 `cd399e4abb26fc04b37dc27b5c61bec270934a7d`와 대조했다. [원영수증](post-promotion-reference4-summary.json), [실행/수집 기록](post-promotion-reference4-watch.json), [원격 동결 대조](post-promotion-reference4-remote-freeze.json), [전체 raw 동결·capture 참조](post-promotion-reference4-source-reference.json)를 보존한다. 원격4,281 SHA 일치·퇴역 public6 부재·실행/수집 exit0.

여름/겨울 ×1/.6 네 장면 full identity4·RGBA 차이0·A/A4·오류0. 요구 source 요청·정상 decode·paint lineage 확인. 실행자가 native PNG4개를 각각 열어 PASS_EXECUTOR4로 기록했으며 독립 검토로 이름을 바꾸지 않는다. 이전 장식/반복 지면/작은 crop 세부 한계는 유지한다.

[before/after 실제 PNG/JPEG 별도 경로·SHA·identity](post-promotion-reference4-raw-index.json)를 확인했다. JPEG4개는 기존 패키지의 동일 바이트4개와 일치하여 추가 물리 이미지 없이 공유한다. 다시 저장하거나 리샘플링하지 않았다. 이 네 장면에는 봄이 없으므로 **cd399 실제20뷰 중 봄8의 새3 소비·독립 시각 증거를 대체하지 않는다**. 원래 data20, 승격, 독립 시각 영수증은 바이트 그대로 보존했다. 장시간 자연플레이·가림·저장되지 않은 repeat 요청/paint 부재나 최종 게시를 새로 주장하지 않는다.

출처시험 원로그의 기존 `.log` 사본은 ignored 파일이어서 과거 커밋에 포함되지 않았다. 현재 게시본은 동일 바이트의 [main-provenance-tests.txt](main-provenance-tests.txt)이며 SHA256 `654b804878c9203dbbabe3a3760b5fe8a354e68693be8cb531776bc44e74d6a7`이다. 로컬 `.log` 원본은 보존하되 현재 게시 해시 목록에서는 제외했다.
