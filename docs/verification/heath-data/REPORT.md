# HEATH B/C DATA2 — 실제 DATA30 수락 및 신규2 승격

**상태: DATA30 및 독립 native 검토 PASS, 신규2 승격 적용.** 실제 work-branch commit `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5`의 B/C2를 검증한 뒤 부모 승인으로 provenance2를 runtime, ledger2를 `RENDER-B-HEATH2`로 변경했다. post-promotion reference4와 최종 geometry·최종 HEAD clean clone·publication은 pending이다. 본 문서는 trunk 게시 완료 주장이 아니다.

## 적용 범위와 보존 증거

기준 core HEAD는 `931d780e37307a7dd2f85a697b122656cb29359d`. 부모가 실제 core30 수치와 독립 시각 gate를 묶은 뒤 정확4경로만 적용했다: catalog, public B/C PNG2, provenance CSV. [부모 재검산](parent-check.json)과 [적용 영수증](apply-receipt.json)은 코드2600 변경0, CSV 제외 보호1668 변경0, ledger 변경0을 기록한다. [현재 적용 독립 검토](applied-independent-review.md)도 exact4·코드/보호 SHA·CSV 원문 prefix·원본 B/C와 실제 core gate를 확인했다. parent-bound recipe SHA는 `6976abd0cfcf8ac5709a19f6cf39b904151454cc53bf57515db40a5a0c114470`, apply receipt SHA는 `17fb7725597c9e6462c342c0f147283acac8012163b6bd020dff4cc7a74b6f38`다.

기존103 entries/96 rules의 객체·순서 및 A base rule을 보존하고 B/C entries2와 A/B/C 균등 variant rule1만 추가하여105/97이다. Wave42/Wave20, season잔존14+spring9, FIELD baseline4+spring3과 retired6 public 부재를 유지한다. provenance 기존2430 literal 행의 전체바이트 prefix를 보존하고 candidate2만 붙였다(2432 literal 행). 이 candidate 적용 시점에는 source2의 installed_by가 비어 있었고 ledger를 바꾸지 않았다. 아래 후속 승격은 별도 [promotion.json](promotion.json)으로 기록했다.

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

## 실제 DATA30 및 독립 native 수락

[수치 원본](data-summary.json)은 actual core931 → work-branch DATA fd68의 30 views, 양성14 의도변화, 음성16 RGBA 차이0, A/A30, errors0을 기록한다. 양성14는 physical identity가 같고 expectedRequests만 의도적으로 B/C를 추가했다. 음성16은 expectedRequests까지 동일하다. B/C는 양성14에서 request→decode→captured canvas paint lineage에 도달했다. 부모도 [90개 PNG를 별도 재계산](data-parent-check.json)했다.

[독립 native 보고서](data-independent-native-review.md)는 AFTER30과 BEFORE 양성14 원본을 개별 열람하고 **PASS**로 판정했다. [개별 identity/PNG/RGBA 기록](data-independent-native-review.json)을 보존했다. 새 불투명 사각형·지면 이탈·신규 경계 절단은 발견되지 않았고 겨울 대비 및 저배율 군집 크기가 수락되었다. 0.6배율 세부 꽃/잎 식별과 가림 이후 모든 source 픽셀 노출은 주장하지 않는다. 고정 준비 장면의 수락이며 natural play 검증이 아니다.

수치 summary와 부모 check의 native pending 문구는 시점이 앞선 원본 기록이므로 수정하지 않았다. 뒤의 독립 native PASS와 부모 승인·승격 영수증이 그 gate를 닫는다. repeat request/draw 배열은 저장되지 않아 repeat 소비 부재는 미증명이며 A/A로 대체하지 않는다. 음성16 부재는 first-open에 한정한다.

DATA [export attestation](data-export-attestation.json)은 fd68 전체 tracked export 동일, trackedDirty=false, `TRACKED_CLEAN_EXACT_COMMIT`이다. runtime/fixture4310 freeze와 retired6 부재도 PASS다. 임의 untracked 파일까지 clean이라는 주장은 아니다. 이는 위 core의 과거 문서 drift 판정을 소급 변경하지 않는다. 실제 run `astra-heath-main-data-fd68f12`의 sync128.5s/prepare7.4s/wait0s/command340.1s, exit0과 raw captures SHA·각 native PNG SHA는 data-summary에 보존했다.

아래는 **실제 DATA AFTER JPEG preview**이며 native PNG 수치 증거를 대신하지 않는다.

| data after | preview |
|---|---|
| summer zoom1 | [보기](DATA-AFTER-heath-chalk-summer-z1.jpg) |
| summer zoom0.6 | [보기](DATA-AFTER-heath-chalk-summer-z06.jpg) |
| winter zoom1 | [보기](DATA-AFTER-heath-chalk-winter-z1.jpg) |
| winter zoom0.6 | [보기](DATA-AFTER-heath-chalk-winter-z06.jpg) |

## 승인된 exact2 승격 및 보존

[promotion.json](promotion.json)은 부모의 명시 승인, 고정 runtime/native SHA, 적용 전후 CSV SHA 및 정확한 변경 필드를 기록한다. provenance literal2432행 중 B/C2의 status/notes만 변경하고 다른2430행 raw bytes를 보존했다. ledger literal6122행 중 B/C2 installed_by만 변경하고 다른6120행 및 선택행 나머지 필드·CRLF를 보존했다. generation prompt/tool/model/seed/manualEdits, historical normalization과 raw generation SHA는 유지했다. notes는 published trunk로 오인하지 않도록 “work-branch commit”이라고 명시한다.

승격 전후 code+catalog2601, public1665, source2 SHA는 동일하다. catalog105/97과 PNG는 승격에서 변경하지 않았다. source-candidates.csv, candidate-application.json과 최초 static 기록은 **승격 전 역사 자료**로 보존한다. 현재 status는 promotion.json을 따른다.

준비 fixture42파일은 state/save40 byte 보존, regular positive12 ABC, summer chunk/map edge2 BC만, negative16 객체/sidecar 불변이다. FIELD coverage를 새로 주장하지 않는다. **post-promotion reference4, 최종 신규public14 전체 geometry, 최종 HEAD clean clone 및 publication은 pending**이며 별도 영수증으로만 닫는다.
