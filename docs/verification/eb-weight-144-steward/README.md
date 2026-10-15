# ck_evt_144/b — 상인 돈으로 켠 널빤지

Status: **steward_route_only**, **lord56Pass=false**. 영주 56사건 결과 화면 통과로 세지 않는다.

Official run: `engineB-weight144-steward-9f769ee`; exit0, valid=true, errors=[]. Product `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; tool `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.

역사 청지기 답 `h-026951@415000`, 선택 b, occurrence `registry:ck_evt_144:ck_evt_144|:415`를 실제 철 보고와 대조했다. 이번 입력 전에 이미 답한 상태이며 새 영주 답은 실행하지 않았다.

원본 closed.jpg와 detail-3.jpg를 직접 열어 철 띠 「청지기가 작은 일 1건 처리」, 사건 제목, 선택 「공동 재고용 목재 주문을 8단위로 정한다」, 본문 및 결과가 보임을 확인했다. 상세 항목은 정본/보고 기대와 실제 DOM이 같고 정상 탐색 뒤 모두 노출됐다. 탐색 전후 전체 SHA는 `f60736e3073b1efb5b63e92b90f34c4e0922eea113e8e0f03a3ee9fa2e593f85`로 같다. 청지기 답이 연간 영주 결과에 잘못 포함된 목록은 wronglyIncluded=[]다.

표시 결과: 목재 여덟 단의 미입고 주문을 정했다.. 이 문자열을 관측했지만 이번 보고로 답 전후 실제 상태 효과까지 입증한 것은 아니다.

Limits: 청지기 철 보고 경로만 확인했다. 실제 상태 변화 전후값·조건부 미래 효과·영주 LS1-4 결과 관문은 미검증이다. 한 occurrence를 검증했으며 사건ID 전체가 청지기 전용이라는 뜻도 아니다. 전체56통과를 주장하지 않는다.

[원본 보고](steward.json.gz), [직접 이미지 검토·해시](human-review.json), [전체 원본 매핑](archive.json), [모든 fetched 원본](originals.tar.xz). 모든 원본 25개를 tar.xz에 바이트 그대로 보존하고 추출 후 SHA/크기를 검증했다. 원래 gzip 컨테이너와 로그도 그대로다.

`shasum -a 256 -c SHA256SUMS`로 보관파일을 검증한다. originals.tar.xz를 임시 디렉터리에 풀고 그곳에서 이 폴더의 original-members.SHA256SUMS를 검사하면 전체 원본을 검증할 수 있다.
