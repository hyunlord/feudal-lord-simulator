# 계절 보고 하네스 선택자 실패

DGX `engineB-season-report-92bbc7d`는 준비12.7초·대기610.9초·명령42.2초 뒤 종료1했다. 브라우저 소스92bbc7d94b0388259ac8e498e1755195765b0670, 원본 엔진2485af40046793f1856829fa1161dc4431942aa7, Node24.21.0/Playwright1.62.1,1280×800/DPR1이다.

058·034·144·163 네 사례 모두 검증된 preclose 입력의 presentation 비교가 일치했다(차이0). 그 다음 `.autoplay-toggle` 속성 조회가6버튼에 걸려 strict mode violation으로 끝났다. 실제 자동 발전 외에도 소리·곡선 지면·해상도·색약·저장 버튼이 같은 클래스를 쓴다. 모든 사례의 clock 기록은 빈 배열이며 보고 표시 검증까지 도달하지 않았다. **게임 보고 기능 실패나 성공으로 판정하지 않는다.**

하네스의 선택자를 실제 자동 발전 버튼에 한정하는 수정과 새 DGX 실행이 필요하다. UI/src·코어·재현 원본은 수정 대상이 아니다. 기존 실패 결과를 새 결과로 덮어쓰지 않는다. manifest의 cleanupErrors는 빈 배열이며 부모가 실제 scope inactive/dead, Vite PID1127208 부재,4302 리스너 부재를 확인했다.

`manifest.json.gz`는 실제 실패 manifest 원문이다. 압축 해제 SHA-256 `ae82aee64f056e637bd127a5b45b165e6211de1bcafbe6046508cd24d2719f4b`. 압축 파일은 SHA256SUMS로 확인한다. 전체 실행은 `/tmp/engineB-answer-json-92bbc7d/.remote-runs/engineB-season-report-92bbc7d/`와 DGX `_kept/engineB-season-report-92bbc7d`에 보존한다.

수정 도구는 닫힌 설정 패널에서도 실제 `.autoplay-control > button`의 유일성·정확한 “자동 발전” 문구·aria-pressed를 검사한다. 일반 press의 임의 first 선택도 없애고 유일성을 검사한다. 같은 클래스의6버튼 재현 회귀 및 켜짐/누락/중복 거부, 정리·Playwright 메타데이터 포함11시험과 lint 통과. 이는 제한 시험이며 실제 새 DGX 실행은 아직 검증 전이다.
