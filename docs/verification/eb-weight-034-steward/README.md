# ck_evt_034/precedent — 청지기 철 보고 경로

Status: **STEWARD_ROUTE_VERIFIED**, **lord56Pass=false**. 영주 56사건 결과 화면 통과가 아니다.

Official run: `engineB-weight034-steward-9f769ee`; exit0, valid=true, errors=[]. Product `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; tool `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.

역사 입력에는 이미 청지기가 답한 occurrence `registry:ck_evt_034:steward.precedent|:171`이 있었다. 선택 precedent, 답 `h-011244@171000`, decision.steward·by=steward·관습 방침이 정확히 대응한다. 입력171999에서 정상 시간이172000으로 진행하여 실제 철 보고가 표시되는 경로를 관측했다. 새로운 영주 답을 실행한 것이 아니다.

부모가 before/closed/expanded/detail0–3 원본 JPEG를 직접 확인했다. 철 띠의 **청지기가 작은 일 3건 처리**, 제목 「청원을 어디까지 직접 들을까」, precedent 선택 「큰 금액·권리·혼인만 올리고 같은 종류는 선례를 따른다」, 상세 네 항목과 결과가 정상 스크롤 뒤 완전히 보였고 정본과 일치했다. 탐색·스크롤 전후 전체 SHA는 `4db501d45f2c088a9bf78f243e27def207fe62cc728451ebd3a46188b3f93458`로 같다. 연간 영주 결과에 청지기 답이 잘못 포함된 목록은 wronglyIncluded=[]다.

**문구 행위자 불일치:** 실제 decidedBy=steward인데 정본 결과는 「영주는 앞으로 청원을 어디까지 직접 들을지 기준을 정했다.」라고 한다. 정본 문구를 정확히 보여 준 사실과 행위자 표현의 정확성은 별개다. 렌더 A 검토 대상으로 넘기며 화면·정본은 수정하지 않았다.

Limits: 이 보고서는 역사 청지기 답과 실제 철 보고 경로·표시·탐색 SHA를 입증한다. 답 전후의 실제 상태 효과는 입증하지 않는다. 해당 occurrence 한 건만 관측했으므로 034 전체가 청지기 전용이라고 주장하지 않으며, 영주 LS1-4 결과 관문 통과나 전체56통과로 세지 않는다.

증빙:

- [원본 보고](original/eb-weight-live56/steward-034/steward.json.gz)
- [철 띠](original/eb-weight-live56/steward-034/closed.jpg)
- [펼친 보고](original/eb-weight-live56/steward-034/expanded.jpg)
- [결과 상세](original/eb-weight-live56/steward-034/detail-3.jpg)
- [부모 검토·전체 JPEG 해시](human-review.json)
- [전체 원본→보관본 SHA 매핑](archive.json)

전체 fetched 파일을 보관하고 로그만 손실 없이 gzip했다. JPEG·기존 gzip·보고서 바이트는 변경하지 않았다. `shasum -a 256 -c SHA256SUMS`로 보관 파일을 검증한다.
