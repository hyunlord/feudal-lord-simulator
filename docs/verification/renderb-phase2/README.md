# Render B Phase 2 공식 증거

이 폴더는 공식 증거 위치 `docs/verification/renderb-phase2`다. 기하 실제 측정과 최종 be576dbe merge·깨끗한 클론4,886/4,886·보호 본선 push는 PASS다. 준비 원본은 `.omo/prepared-delivery/phase2-final-proof`에 그대로 보존한다.

[REPORT](REPORT.md), [관문 상태](gates.json), [일곱 패키지 연결](packages.json), [원본 경로·SHA](external-evidence.json), [실제 기하 영수증](geometry-final-receipt.json)을 함께 읽는다. `SHA256SUMS`는 자기 자신을 제외한 모든 파일을 검증한다. 큰 PNG·로그·freeze는 외부 경로에 있어 이 패키지만으로 전체 실행을 재현할 수 없다.

측정 HEAD는 fd68f124, 현재 runtime 입력 연결은 db17321a다. 최종 실제 검사·게시 HEAD는 be576dbe이고 영수증은 gates.json에서 연결한다. 후속 통합 가지는 이 게시 판정에 포함하지 않는다. 과거 영수증이나 assembly history를 새 HEAD 결과로 재명명하지 않는다. 변경 후 SHA 목록과 3 MiB 상한을 다시 검증한다.

게시판 be576의 [공식 성능 추이](be576-official-trend.md)·[실제 영수증](be576-official-trend.json): DGX exit0, 자동 A/B 확인의 두 장면 네 지표 모두 95% 폭에서 소음 안. 후속 통합 가지의 성능 검증으로 확장하지 않는다.
