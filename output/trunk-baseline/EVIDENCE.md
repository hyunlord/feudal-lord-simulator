# S0 증빙 구성

검토용 JPEG는 제품 렌더러 상태 재생6장과 실제 브라우저 이어하기 전후2장이다. JPEG를 편집하거나 경고를 지우지 않았다. 원래 브라우저 검사 receipt에는 추가 캡처 이름이 포함되며, 그 파일들은 원래 로컬 b8-final-browser 폴더에 보존하되 검토 묶음에서는 전후2장만 선별했다. 첫 비동기 검사 실패 JSON도 보존했다.

`recorded-states.tar.xz`는71개10초 초과 입력+6개최종 상태+6개워커 stderr(83개 항목). 원래 gz를 해제해 중복 압축 효율을 높였으며 각 항목의 해제 SHA가 원본과 일치한다. XZ 해제에는256MiB 사전 메모리가 필요하다. 시간 종료의 마지막 상태 의미는 seeds/state-e97d6a8.json 및 capacity-48-e97d6a8.json의 stateSemantics 참조. 각 capture.json은 같은 상태의 SHA·뷰포트·실제 에셋 로딩 결과다.

`validation/initial-logs.tar.xz`는 최초 새 클론의 npm ci·전체 테스트·typecheck·build와 저장 검사 로그다. 종료 커밋 뒤 실행하는 별도 새 클론 검증의 최종 receipt는 `/tmp/fls-s0-final-verification.json`, 로그는 `/tmp/s0-final-*.log`에 기록한다. 해당 검증이 끝나기 전에는 마지막 커밋 검증 완료를 주장하지 않는다.

출처는 각 git commit과 source-equivalence.json. 소스 스냅샷을 별도로 복제하지 않는다. 최종 ZIP은 검토용 증빙이며 원본 설계 문서는 저장소 docs/design/에서 읽는다.
