# Render B Phase 2 공식 증거

이 폴더는 공식 증거 위치 `docs/verification/renderb-phase2`다. 기하 실제 측정은 PASS이며 최종 commit·merge·clone·push는 아직 PENDING이다. 준비 원본은 `.omo/prepared-delivery/phase2-final-proof`에 그대로 보존한다.

[REPORT](REPORT.md), [관문 상태](gates.json), [일곱 패키지 연결](packages.json), [원본 경로·SHA](external-evidence.json), [실제 기하 영수증](geometry-final-receipt.json)을 함께 읽는다. `SHA256SUMS`는 자기 자신을 제외한 모든 파일을 검증한다. 큰 PNG·로그·freeze는 외부 경로에 있어 이 패키지만으로 전체 실행을 재현할 수 없다.

측정 HEAD는 fd68f124, 현재 runtime 입력 연결은 db17321a다. 미래 HEAD는 `null`이며 최종 merge/clone/push 슬롯은 실제 결과 도착 후 채운다. 과거 영수증이나 assembly history를 새 HEAD 결과로 재명명하지 않는다. 변경 후 SHA 목록과 3 MiB 상한을 다시 검증한다.
