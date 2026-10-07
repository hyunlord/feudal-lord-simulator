# 원목 독립 장면 검증 기록

- 요청 범위: 7f3dc1a7 대 정확한 부모 8936a469. 본선 병합/설치 장부/관문과 분리한 공식 light 실제 장면 증거이다.
- WALKER 마지막 두 실행의 종료 기록과 관련 프로세스 부재를 확인한 뒤 순차 실행을 시작했다. drawproof exit1은 후속 missing2 exit0으로 해결된 담당 기록이며 원목 결과가 아니다.
- 최초 baseline 실행 astra-LOGS-before-8936a46은 초기 observer로 시작했다. 시작 뒤 정적 재검토에서 Playwright Browser의 context 이벤트에 감시를 걸면 새 페이지 오류 수집을 보장하지 못함을 발견했다. state/좌표/스크린샷은 기록되지만 이 실행의 errors=[]를 page-error 0건의 증거로 쓰지 않는다.
- 최종 하네스는 newContext 반환 직후 context의 page 이벤트를 감시한다. 오류면 다음 17뷰를 반복하지 않고 첫 실패에서 종료한다. 같은 오류를 숨기거나 codec/재고를 조작하지 않는다.
- 현재 public 원목4장과 원본 PNG는 SHA256 바이트까지 같다. caBX 제거 복사 과정이 이 네 파일을 바꾸지 않았음을 확인했다.

- contact 첫2뷰의 seed5 벌목소(50,9)도 전면 집/곡물창고로 가려졌다. draw/계절 확인은 유효하지만 a의 완전 접지 증거로 쓰지 않는다. source provenance에 이미 있는 외곽 벌목소 construction-site-000064(겨울37,2 / 봄61,11)로 추가2뷰를 확인한다. 서로 다른 시점 좌표를 같다고 주장하지 않는다.
