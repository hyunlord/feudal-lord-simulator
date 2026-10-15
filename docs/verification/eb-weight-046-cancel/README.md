# ck_evt_046/cancel — 바람이 잦아든 뒤의 주문서

Status: **FAIL_IMMEDIATE_EFFECT_MISSING_TRACE**. 실제 효과와 결정 영수증은 확인했으나 LS1-4로 이어지는 즉시 효과 흔적이 없다.

Official run: `engineB-weight046-answer-9f769ee`; exit 1, original valid=false, errors=[]. Product `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; tool `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.

진짜 제안 `registry:ck_evt_046:timber.order|:298`을 tick298000에 정상 화면에서 cancel로 답했다. 정확한 답 ID는 `h-019506`, source=`registry:ck_evt_046:cancel`이다. 실제 목재 주문이 **350→0, 차이−350**으로 바뀌고 timberOrder 필드가 제거됐다. 부모가 원본 offered/answered/chip JPEG를 직접 검토하여 정상 취소와 영수증의 **350단 → 0단**을 확인했다. 따라서 무효과도 영수증 실패도 아니다.

| 관문 | 결과 |
|---|---|
| 실제 즉시 변화 | 목재 주문350→0, 필드 제거 |
| 결정 영수증 | 정확한 이전→이후 노출 |
| 정확한 효과 trace | 없음, effectTrace=[] |
| LS1-4 칩 | 1374년30→30, 해당 답 항목 없음 |
| 결과 카드 | 미관측 |
| 결과 카드 탐색 SHA | 미관측, 변경 판정 아님 |

새 history는 `h-019505 registry.answered` 및 `h-019506 decision.card`뿐이다. 처리·접수 기록을 효과 흔적으로 세지 않는다. 취소는 즉시 완결이며 뒤의 재주문 배송을 이 답에 귀속해 통과시키지 않는다. 코어 trace 연결 검토 대상으로 넘기며 제품·화면은 수정하지 않았다.

확인 버튼 전후 answered/chip 저장 SHA는 `3bdb9213f51da456642720c3d46690c560b09d46f67c998996b8aae4c16bdd3d`로 같지만, 이는 영수증 확인 단계이며 결과 카드 탐색 SHA 검사를 대신하지 않는다. navigation.attempted=false이고 정확한 답 항목이 없으므로 다른 카드로 대체하지 않았다.

증빙:

- [원본 보고](original/eb-weight-046-cancel/answer046.json.gz)
- [제안 화면](original/eb-weight-046-cancel/offered.jpg)
- [실제 영수증](original/eb-weight-046-cancel/answered.jpg)
- [확인 뒤 칩](original/eb-weight-046-cancel/chip.jpg)
- [부모 검토와 JPEG 해시](human-review.json)
- [전체 원본→보관본 경로·크기·SHA 매핑](archive.json)

Limits: cancel 한 실제 사례이며 다른 선택이나 전체56사건 통과를 주장하지 않는다. fetched run의 모든 파일을 보관했다. 로그만 손실 없이 gzip했고 JPEG·기존 gzip·보고서 원본 바이트는 변경하지 않았다. archive.json의 원본 SHA는 로그 복원 바이트에 적용하며 storedSha256은 보관 파일에 적용한다.

이 디렉터리에서 `shasum -a 256 -c SHA256SUMS`로 보관 파일을 검증한다.
