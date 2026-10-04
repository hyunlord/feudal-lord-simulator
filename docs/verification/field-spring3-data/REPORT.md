# FIELD 봄3 — 실제 main 데이터 후보, runtime 미실행

`a392694c3056b93812a0bcc3de767a387f2f3f3b`의 [FIELD core 실제20쌍 통과](../field-core/REPORT.md) 뒤 적용했다. **APPLIED / STATIC PASS / INDEPENDENT REVIEW PASS / RUNTIME NOT_RUN**. 이는 설치 완료나 실제 그림 사용의 판정이 아니다. [독립 적용 검토](independent-main-data-review.md)는 PASS이며 실제 main20뷰·눈검토·최종 게시가 남아 있다. 과거 detached data20 성공은 이번 main 증거로 사용하지 않는다.

## 적용 경계와 보존

제품 데이터는 정확5파일: `src/render/art/catalog.json`, 아래 public PNG3, `docs/provenance/assets.csv`. 기존 catalog 객체·순서를 보존하고 `wave43-field-spring3` 3 entries/4 rules만 추가했다(99→102 entries, 91→95 rules). 봄 ploughed는 A|A, seedling은 A|B; 비봄 선택은 유지한다. 각 PNG512×64, sourcePixelsPerTile128·origin0·repeat x·fade40·wash none·noMirror를 사용한다.

원본 바이트 무변환, 코드/시험/도구 동결2,595파일 SHA 변경0을 실제 파일로 재확인했다. 원래 봄9·퇴역6 원본과 public 부재, C25/loader/season predecessor는 보호한다. 기존 provenance2,427행 prefix를 보존하고 candidate3행만 추가(2,430행); 장부 바이트 변경0이며 이3 source ID의 installed_by는 미표시 상태를 유지한다. HEIGHT 요청 문서 동시 커밋 여부는 이 데이터5파일 경계 밖이며 아트 설치 증거가 아니다.

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

원래 raw8/save8 fixture 바이트와20뷰 state·camera·season·zoom·DPR·viewport를 유지한다. 봄8뷰 expectedRequests만 새3 URL로 바꾸며 비봄12 view 객체는 동일하다. 앞으로 실제 main data20/A-A20/errors0, 봄8의 의도된 변화·비봄12 RGBA0, source3 request→decode→pattern paint와 원본 눈검토를 확인해야 한다. paint lineage는 최종 픽셀 가시성이나 자연플레이의 증명이 아니다. 이 관문 전 provenance 승격·installed_by 표시를 하지 않는다.

- 적용 영수증 SHA256: `71f9d6df01ed5a6222bd98c66bc9df571e512778f1401ea79dc6e2e0973b4bb5`
- recipe SHA256: `1b6532e125f38b694de54a7c830a2dd87e1ea306a7b319179d3ebd4c114a5794`
- 정적 결과 SHA256: `19bd9e0af4acf2ddd805bafc4c59a81b4007cd24e4cf42285269f2f7d4f48abe`
- 집중시험 원로그 SHA256: `e7925f6eacfad9dcb2b33c696e9b37a1d01846fb304e9cf75503676b75e8a703`
