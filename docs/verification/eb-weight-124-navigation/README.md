# ck_evt_124/b — 정상 대상 접근 뒤 하네스 예외

Status: **fail_harness**. Official run `engineB-weight124-navigation-2e6a814`, exit1, valid=false.

정상 경계 다툼 ‘나중에’로 대상124 카드에 접근했다. 앞뒤 tick13000과 SHA `0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508`가 같고 실제 제안 identity/status도 유지됐다. 원본 target-offered/answered/failure JPEG를 직접 열어 b/c 선택지가 있는 대상 카드, b의 실제 입력, 상대가 조건을 고쳐 되물었다는 영수증을 확인했다.

답 후 저장에는 정확한 `h-000725@13000`, source `registry:ck_evt_124:b`, target `negotiation:negotiation-1` 결정이 있다. 답 전 trace는 없고 답 후 trace.decisions/acts는 생성돼 있다. 그런데 하네스가 답 전 before.trace.decisions를 필수로 읽어 `TypeError: Cannot read properties of undefined (reading decisions)`로 멈췄다. 정상 답을 누르기 전 멈춘 [첫 실패](../eb-weight-124-first/README.md)와 구분한다.

실제 답과 영수증은 확인했지만 후속 효과 검증·결과 칩·결과 카드·결과 탐색 SHA 관문은 완료되지 않았다. 앞의 정상 ‘나중에’ SHA가 같다는 사실을 결과 카드 관문으로 대체하지 않는다. 코드의 optional preanswer trace 읽기는 부모가 수정했으나 재실행 전이므로 해결 통과를 주장하지 않는다. 제품·화면 실패로 분류하지 않으며 원본 오류는 보존한다.

[원본 보고](answer124.json.gz), [직접 이미지 검토·해시](human-review.json), [전체 원본 매핑](archive.json), [전체 fetched 원본](originals.tar.xz). 모든 원본 20개를 바이트 그대로 보존하고 추출 후 크기/SHA를 검증했다. gzip 컨테이너·로그·JPEG도 변경하지 않았다.

보관 파일: `shasum -a 256 -c SHA256SUMS`. 전체 원본: bundle을 임시 디렉터리에 풀고 그곳에서 original-members.SHA256SUMS 검사.

추가 오프라인 원본 저장 대조(부모 확인): b는 negotiation-1을 status=countered로 만들었고 조항은 현금40·정치적 지지·동의다. 답 h-000725의 출처는 정확하며 acts=[]다. 새 history는 h-000722 registry.answered, h-000723 negotiation.offered, h-000724 countered, h-000725 decision이다. 이는 실제 협상 역제안 상태의 증거이지 혼인 성립이나 현금40 지급 증거가 아니다. 하네스 예외로 칩·카드 관문은 여전히 미검증이며 fail_harness를 유지한다.
