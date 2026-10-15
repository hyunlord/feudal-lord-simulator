# ck_evt_124/b — 첫 화면 접근 실패

Status: **FAIL_HARNESS — target observation interrupted before answering**. 제품 실패 판정 아님.

Official run: `engineB-weight124-answer-9f769ee`; exit1, original valid=false. Product `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; tool `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.

진짜 제안 `registry:ck_evt_124:marriage.offer|kin:1:1|est-000002:13`은 tick13000에 offered 상태였고 유효 선택지는 b·c였다. 계획한 b는 「현금40d와 정치적 지지를 제안한다」이며 이번 실패는 선택지 부적합 판정이 아니다. 원본 codec admission은 lossless=true였다.

부모가 failure.jpg를 직접 검토한 결과, 화면에는 별개 코어 「경계 다툼」 모달과 정상 ‘나중에’ 버튼이 있었으며 대상124 카드는 나타나지 않았다. 대상 선택자 개수0에서 1을 기대한 단언이 실패했다. 목표 답을 누르기 전이므로 **답·실제 효과·대상 결과 카드·결과 탐색 SHA 모두 미관측**이다. 무효과나 흔적·화면 제품 결함으로 분류하지 않고 목표 화면에 도달하는 하네스 경로의 누락으로 보존한다.

부모가 정상 입력으로 대상에 도달하는 후속 도구를 준비 중이다. 원본 report의 failureClass=harness_or_screen_requires_classification은 그대로 보존하고, 검토 판정은 이 README와 human-review.json에 추가한다. 재시도나 전체56사건 통과를 주장하지 않는다. offered/failure 저장 SHA는 모두 `0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508`로 같지만 결과 카드 탐색을 수행한 증거는 아니다.

증빙:

- [원본 보고](original/eb-weight-124-b/answer124.json.gz)
- [실패 화면](original/eb-weight-124-b/failure.jpg)
- [실제 입력 저장](original/eb-weight-124-b/admitted.save.json.gz)
- [부모 검토·JPEG 해시](human-review.json)
- [원본→보관본 경로·크기·SHA 매핑](archive.json)

전체 fetched 파일을 보관했고 로그만 손실 없이 gzip했다. JPEG·기존 gzip·보고서 바이트는 변경하지 않았다. archive.json의 originalSha256은 로그 복원 바이트에, storedSha256은 보관 파일에 적용한다. 이 디렉터리에서 `shasum -a 256 -c SHA256SUMS`로 검증한다.
