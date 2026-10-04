# Wave37 기존 사용16행 장부 조정

**상태: installed_by16 적용 완료 / 작업 commit·post-ledger after4 촬영 대기.** 게시된 `90d9b5865bee4dc012f49f6eded135ac85975e78` 위에서 기존 LM-R1 사용의 미표시16행을 `RENDER-B-W37`로 표시했다. 신규 코드·PNG·출처행 설치가 아니다.

[application.json](application.json)은 실제 적용 전후 장부 SHA, exact16행, CRLF 보존, 기존 LM-R1 12와 unsupported fisher/shepherd4 공란 보존을 기록한다. 장부6,122 records의 나머지 열·행은 모두 byte/field 동일하다. source/public SHA 및 provenance의 모든 원문 열과 원행 번호를 prepared manifest에 재대조했다. 현재 원425는 **150표시+4byteproof 미표시+255활성 미입증+16퇴역=425**이며 byteproof154는 그대로다.

## 과거 증거와 아직 없는 작업 이후 증거

- `astra-W37-before-v2-ab67dcb`: 실제21뷰, 대상16 request/decode/canvas paint 확인. 기록상 before snapshot의 geometry 문서 dirty 상태는 유지한다.
- `astra-W37-after-reference-d6776f2`: clean d677의 실제4뷰 참조. 같은 before identity/RGBA SHA, differingPixels0. **이번 ledger 변경 commit 뒤 촬영이 아니다.**
- 향후 post-ledger after: **NOT_RUN**. 부모의 작업 commit 이후 같은 저장·camera summer/winter×zoom1/.6의4뷰를 새 run/HEAD로 촬영해야 한다. 여기의 과거 reference JPEG를 이름만 바꾸어 새 after로 제시하지 않는다.

[reconciliation.json](reconciliation.json), [capture-index.json](capture-index.json), [visual-review.md](visual-review.md)는 과거 prepared 증거를 바이트 그대로 옮겼다. 이 파일들의 proposed/notApplied는 당시 상태다. 현재 적용 상태는 application.json이며 원래 준비 보고서는 [PREPARED_REPORT.md](PREPARED_REPORT.md)에 보존했다. PREPARED.json의 파일해시는 원래 `.omo/prepared-delivery/wave37-reconcile/` 내용의 동결로서 REPORT.md 해시는 이곳 PREPARED_REPORT.md에 대응한다.

독립 시각 검토의 접지·가림·작은 glyph NOTE, 비참조15 target의 겨울 미촬영, prepared facts와 자연진화 gameplay의 차이는 그대로 남는다. JPEG6은 열람 증거이며 PNG/RGBA 해시를 대신하지 않는다. 본선 ARCH1 완료는 별도이며 이번 W37 후속 task의 commit·after4·정식 관문 완료를 뜻하지 않는다.
