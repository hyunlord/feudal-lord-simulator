# 009/c 준비 — 연결 장애로 실행 pending

2026-10-12. [기존 입력 목록](screen-resume-readiness.md)의 다음009/c를 선택했다. seed1 h-006591@101011, 압축 입력 SHA `86f9ef14661b241b2383a8fda7da4d9459a4b143d306ffdd2a5003d21a3734d4`. manifest는 기존 e4615d5…다. 정본009/c AST·estateSuits·decisionTrace는2485af4와a5776a8e에서 동일하다. court_roll 증거 추가 뒤 조건부 suit_turned를 기대하며, 원래989틱 뒤 결과의 다른 원인 h-006523와 이 답의 part:true를 유지한다.

도구 설정 커밋2c91ff5be, 본선칩 대조 인계 포함 준비0a5ba7226을 원격에 게시했다. 공식 runner의 `engineB-live-009-0a5ba72` 제출2회 모두 lock 획득 전 exit255였다. 사용자 명령/queue를 제출한 단계에 도달하지 않았다. 원격 폴더 조회 역시 연결되지 않았으므로 실제 폴더 부재를 확인했다고 주장하지 않는다.

실측 stderr(두 제출과 직접 연결/별칭 검사에서 동일):
```
ssh: connect to host 100.70.109.50 port 22: Operation timed out
```
runner는 `remote: could not lock engineB-live-009-0a5ba72 on the DGX:`와 위 오류를 출력했다. ConnectTimeout15초다. Tailscale backend Running·DGX peer Online=true였지만 `tailscale ping --c 1 --timeout 10s 100.70.109.50`도 timeout/exit1이었다. SSH config의 dgx-spark 별칭과 REMOTE_RUNS는 모두 같은 주소/22포트만 지정한다. 별칭 연결도exit255. 자격·네트워크 설정 변경, 다른 호스트 우회, 로컬 게임 실행, 추가 실험은 하지 않았다. 새009 화면/시험 결과는 아직 없다.

이번 보고 공간 확보를 위해 기존005의 provenance.json을 gzip으로 옮겼다. 이전 커밋 원문 SHA와 복원 SHA가 모두 `b9084e356611b94c10f4d5afa1a8565641c5cbe92a347352b19682b1ea6a52cf`이며 gzip SHA는 `090c22c5ba39ef3bd8ad8f4ad7996751b46c698aab7ac756bcfec1165599856d`다. 상대 참조/SHA목록도 갱신했다. 캡처·입력·검사 분류/한도는 바꾸지 않았다.
