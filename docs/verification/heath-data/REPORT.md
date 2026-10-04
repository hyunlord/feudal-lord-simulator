# HEATH B/C DATA2 — 적용된 candidate, 실제 data30 대기

**상태: CANDIDATE_APPLIED_DATA_RUNTIME_NOT_RUN.** 기존 HEATH A core를 통과한 뒤 B/C2를 데이터만으로 추가했다. 이 문서는 신규2의 설치 완료/최종 게시 완료 주장이 아니다. 실제 main DATA30·독립 native 시각 검토·후속 승격/reference와 최종 publication 관문은 아직 남아 있다.

## 적용 범위와 보존 증거

기준 core HEAD는 `931d780e37307a7dd2f85a697b122656cb29359d`. 부모가 실제 core30 수치와 독립 시각 gate를 묶은 뒤 정확4경로만 적용했다: catalog, public B/C PNG2, provenance CSV. [부모 재검산](parent-check.json)과 [적용 영수증](apply-receipt.json)은 코드2600 변경0, CSV 제외 보호1668 변경0, ledger 변경0을 기록한다. [현재 적용 독립 검토](applied-independent-review.md)도 exact4·코드/보호 SHA·CSV 원문 prefix·원본 B/C와 실제 core gate를 확인했다. parent-bound recipe SHA는 `6976abd0cfcf8ac5709a19f6cf39b904151454cc53bf57515db40a5a0c114470`, apply receipt SHA는 `17fb7725597c9e6462c342c0f147283acac8012163b6bd020dff4cc7a74b6f38`다.

기존103 entries/96 rules의 객체·순서 및 A base rule을 보존하고 B/C entries2와 A/B/C 균등 variant rule1만 추가하여105/97이다. Wave42/Wave20, season잔존14+spring9, FIELD baseline4+spring3과 retired6 public 부재를 유지한다. provenance 기존2430 literal 행의 전체바이트 prefix를 보존하고 candidate2만 붙였다(2432 literal 행). source2의 installed_by는 아직 비어 있으며 이번 적용은 ledger를 바꾸지 않았다.

## 원본 후보2

| asset | native source | runtime | 크기/피벗/scale | source=runtime SHA256 |
|---|---|---|---|---|
| HEATH B | [원본 PNG](../../../assets-inbox/wave22/rework-20260927/assets/decals/heath_patch_b-v1.png) | [runtime PNG](../../../public/assets/wave22/decals/heath_patch_b.png) | 96×64 /48,56 /0.5 | `8bc85a500ad5de03a34e76f7eadfdda9908217824ba7fb25b41daca56217d565` |
| HEATH C | [원본 PNG](../../../assets-inbox/wave22/rework-20260927/assets/decals/heath_patch_c-v1.png) | [runtime PNG](../../../public/assets/wave22/decals/heath_patch_c.png) | 128×96 /64,88 /0.5 | `4031ebe921cbfdb7cc4fa42905bfaa4b3bf4f255c39d1189fc800be79f2b0458` |

기존 canonical source와 승인된 detached public, 이번 준비·적용 PNG는 byte 동일하며 새 변환/그림 생성은 없다. native PNG는 repo 원본 경로를 참조하며 이 증거 폴더에 중복 복사하지 않았다. [candidate CSV2](source-candidates.csv)는 실제 원본 [records/assets.csv](../../../assets-inbox/wave22/rework-20260927/records/assets.csv)의 prompt/tool/model/time/seed/manualEdits를 보존한다. 과거 normalization은 역사기록이며 이번 설치에서 새로 수행하지 않았다. [부모의 원본2 열람 기록](source-visual-review.md)은 source 확인이고 도시 내 크기·가림·반복 수락이 아니다.

## 실제 core30을 DATA before로 사용

실제 predecessor `d367382392a4806e683b91463f3996b7654704d6` → core931의 [수치 결과](core-summary.json)는 identity30/RGBA0/A-A30/errors0, 양성·경계14와 first-open 음성16을 기록한다. [독립 native 시각 보고서](core-independent-visual-review.md)와 [core view identity/RGBA](core-views.json)를 함께 읽는다. raw 캡처는 `output/art-architecture/heath-main-before-d3673823` 및 `output/art-architecture/heath-main-core-931d780e`에 있고 원본 captures/PNG SHA 연결은 [candidate-application.json](candidate-application.json)에 있다.

아래4개는 **실제 core A-only BEFORE JPEG preview**이며 B/C DATA AFTER가 아니다. native 판단은 원본PNG와 독립 보고서를 기준으로 하며 JPEG를 픽셀 동일성 증거로 사용하지 않는다.

| core before | preview |
|---|---|
| summer zoom1 | [보기](CORE-BEFORE-heath-chalk-summer-z1.jpg) |
| summer zoom0.6 | [보기](CORE-BEFORE-heath-chalk-summer-z06.jpg) |
| winter zoom1 | [보기](CORE-BEFORE-heath-chalk-winter-z1.jpg) |
| winter zoom0.6 | [보기](CORE-BEFORE-heath-chalk-winter-z06.jpg) |

### Core export 한정 수락

Core export는 **NON_RUNTIME_DOCUMENT_DRIFT**, `actualTrackedDirty=true`다. 시작메타데이터 dirty=false와 실제 export가 달랐고 FIELD3 proof REPORT/SHA256SUMS 두 문서가 수정되어 있었다. [정확 경로/해시 판정](core-doc-drift-review.md)과 [export classification](core-export-classification.json)을 보존한다. 실제 runtime 제품·fixture4308 입력은 committed931과 정확히 일치했으므로 부모가 **committed-product runtime** 범위로 수락했다. 전체 export tracked-clean이라고 주장하지 않는다. 원래 시작 영수증을 고쳐 쓰지 않았다. 최종 clean clone 관문은 별도다.

## 현재 정적 관문

[static.json](static.json): focused305/305 PASS, skipped0, typecheck0, catalog105, provenance runtime2389/검사행2389·missing0/orphan0/hashMismatch0, diff-check0. provenance2389는 활성 runtime 검사집합이며 CSV literal2432행과 다른 수치다. unreferenced public49는 informational이다. TS/code 변경0이므로 core13개 lint PASS를2600 bytefreeze로 보존한다. 새 lint 실행으로 오해하지 않는다. 저장된 원문 결과는 함께 복사한 focused.txt/typecheck.txt/provenance.txt이며 원래 경로/SHA는 static.json에 남겼다.

## 남은 DATA30 관문

준비 fixture는 `output/art-architecture/heath-main-data-fixtures`42파일: state/save40개 byte 보존, positive12 ABC, summer chunk/map edge2 BC만, negative16 객체/sidecar 불변. 최신 season URL을 유지하며 FIELD coverage를 새로 발명하지 않았다. 정적 admission은 runtime PASS가 아니다.

실제 committed DATA30에서 양성·경계14의 의도변화와 negative16 RGBA0, 동일 physical identity 및 A/A30/errors0, B/C request→decode→actual paint를 검증하고 native 시각 검토를 수행해야 한다. first-open absence와 반복이미지 동일성은 다르다. 현재 harness는 repeat request/draw 배열을 저장하지 않으므로 repeat 소비 부재는 미증명이다. paint lineage도 최종 모든 픽셀의 가시성/모든 occlusion 증명이 아니다.

위 관문 이후만 candidate2/ledger2 승격, task reference 및 최종 신규public14 전체 geometry·최종HEAD clean clone/publication을 진행한다. 이 폴더는 초기 candidate 증거이며 실제 DATA30은 **NOT_RUN**으로 남긴다.
