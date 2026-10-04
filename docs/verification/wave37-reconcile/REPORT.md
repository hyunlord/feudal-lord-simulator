# Wave37 기존 사용16행 장부 조정

**상태: installed_by16 commit 및 실제 post-ledger after4 runtime PASS / 최종 phase2 게시 관문 대기.** 게시된 `90d9b5865bee4dc012f49f6eded135ac85975e78` 위에서 기존 LM-R1 사용의 미표시16행을 `RENDER-B-W37`로 표시했다. 신규 코드·PNG·출처행 설치가 아니다.

[application.json](application.json)은 실제 적용 전후 장부 SHA, exact16행, CRLF 보존, 기존 LM-R1 12와 unsupported fisher/shepherd4 공란 보존을 기록한다. 장부6,122 records의 나머지 열·행은 모두 byte/field 동일하다. source/public SHA 및 provenance의 모든 원문 열과 원행 번호를 prepared manifest에 재대조했다. 현재 원425는 **150표시+4byteproof 미표시+255활성 미입증+16퇴역=425**이며 byteproof154는 그대로다.

## 과거 증거와 별도 작업 이후 증거

- `astra-W37-before-v2-ab67dcb`: 실제21뷰, 대상16 request/decode/canvas paint 확인. 기록상 before snapshot의 geometry 문서 dirty 상태는 유지한다.
- `astra-W37-after-reference-d6776f2`: clean d677의 실제4뷰 참조. 같은 before identity/RGBA SHA, differingPixels0. **이번 ledger 변경 commit 뒤 촬영이 아니다.**
- 실제 post-ledger after: `astra-W37-ledger-after-bc29f6b`, ledger commit `bc29f6b254292a7e2080aebc0c23b3cd4368a9f6`의 **4/4 PASS**, 독립 A/A4/4·오류0. 기존 before와 전체 identity 및 RGBA 동일, differingPixels0. [실제 이후 촬영 영수증](post-ledger-after.json)에 새 원본 경로·PNG/JPEG SHA와 실행 식별을 별도로 보존한다.

[reconciliation.json](reconciliation.json)과 [visual-review.md](visual-review.md)는 과거 prepared 증거를 바이트 그대로 유지한다. 그 proposed/notApplied는 당시 상태다. [capture-index.json](capture-index.json)은 기존 before6 records를 보존하고 새 post-ledger4를 추가했다. 현재 적용·commit·runtime 상태는 application.json이며 원래 준비 보고서는 [PREPARED_REPORT.md](PREPARED_REPORT.md)에 보존했다. PREPARED.json의 파일해시는 원래 `.omo/prepared-delivery/wave37-reconcile/` 내용의 동결이다. REPORT.md 해시는 이곳 PREPARED_REPORT.md에 대응하며, capture-index.json은 그 역사적 동결 이후 이번에 새 논리4개가 추가됐다.

독립 시각 검토의 접지·가림·작은 glyph NOTE, 비참조15 target의 겨울 미촬영, prepared facts와 자연진화 gameplay의 차이는 그대로 남는다. JPEG6은 열람 증거이며 PNG/RGBA 해시를 대신하지 않는다. 본선 ARCH1 완료는 별도이며 이번 W37 후속 task의 최종 phase2 병합·clone·게시 관문 완료를 뜻하지 않는다.

## Ledger commit 이후 실제4뷰

원격 입력은 위 bc29 commit의 tracked-clean 상태이며4,172개 SHA 검사 mismatch0이다. 새 before/after 비교와 독립 A/A 모두4/4·RGBA 차이0이고 부모가 실제 native PNG4장을 각각 열어 샘플 장면의 새 시각 회귀가 없음을 확인했다. 기존 금색 고리, 작은 줌 간판, 영주관 눈 및 숲 반복의 한계는 유지한다. 전체16종의 겨울·자연플레이 검증으로 확대하지 않는다.

새 JPEG4개를 기존 공식 JPEG와 각각 SHA 및 실제 byte equality로 대조한 뒤에만 같은 물리파일을 공유했다. 새 촬영을 과거 촬영으로 대체한 것이 아니며, 새 run/commit/원본PNG·RGBA·JPEG hash가 독립 기록된다. 현재 capture-index는 기존 before6+새 post-ledger4의 논리10개/물리JPEG6개다. 역사적 d677 reference4는 reconciliation.json의 referenceComparisons/viewReceipts에 별도로 보존되어 있다. 새 이미지를 복사하거나 재인코딩하지 않았다. 최종 phase2 check:merge·최종 clone/build·보호된 게시 관문은 아직 대기다.
