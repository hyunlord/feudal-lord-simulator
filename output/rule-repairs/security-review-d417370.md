# R1fix 최종 delta 보안·출처 검토

- 범위: `8fc019fd7c4b339662b24df98d4c772b00953483..d41737018f042a2d15f3e26e9e1946d10fc11403`, 28개 변경 파일.
- 판정: **PASS — 해당 delta의 구체적 보안·저장 경계 차단 없음.** 이전 `review-security.md`의 저장 필드 수정 완료 판정 및 `review-food-followup.md`의 제한된 반복 억제 해제 판정을 유지한다.
- 방식: 읽기 전용 코드·회귀·출처 문서 검토. 제품 수정, 테스트, 시뮬레이션, 압축 해제, 성능 측정 없음. 5seed 가드레일 실행 중이며 이 검토는 해당 게이트의 통과 판정이 아니다.

## 공유 서비스 증명의 안전 경계

- `autoplayServiceSpace.ts`의 결정 간 메모는 활성 예산에서 완료된 local witness 및 joint result만 보관한다. joint의 `complete:false`와 예산 소진 local 탐색은 영속 메모에 넣지 않는다. inactive 호출은 공유 메모를 사용하지 않는다.
- hit 시 기록한 `work`를 `spendAutoplaySearch`로 먼저 차감한다. 예산이 부족하면 witness를 노출하지 않고 null/incomplete를 반환하므로 캐시 온도로 예산을 우회하는 경로가 추가되지 않았다. 기존 결정 내부 재사용과 결정 간 재사용은 구분돼 있다.
- 키는 지형·도로·점유·지도 크기·건물 ID/종류/위치/점유/일시정지·성벽/문/공사 경로·공급원 membership을 포함하는 signature와 실제 건물/공급원 ID 순서를 사용한다. 재고 변화가 공급원 집합을 바꾸면 무효화한다. 저장 상태 자체에 캐시를 주입하지 않는다.
- 메모는 module 내부 Map이며 최대32 layout을 보관한다. 외부에는 초기화 함수와 숫자 통계만 export한다. 내부 Set을 호출자가 변경할 수 있는 API는 추가되지 않았다. 키가 JSON 문자열이므로 사용자 상태의 ID를 객체 프로퍼티에 대입하는 새 prototype 경로도 없다.
- 테스트는 cold/warm/clear 결과와 비용, 정확한 예산 경계, incomplete→full, inactive→bounded, 건물·공급원 순서, 공급원 변경, 일시정지·도로 변경,32 layout 상한을 검사하도록 구성돼 있다. 이 리뷰는 테스트를 재실행하지 않았다.

## R8 무조치 재시도와 성문 그래프

- UI와 headless는 같은 `shouldRetryAutoplayAfterMillReplenishment`를 사용한다. tick 증가, 동일한 방앗간 ID 집합, 이전 일부 원료0→현재 모두 양수, 전후의 실제 `wheat_transport_blocked` 진단을 요구한다. UI pending 또는 기존에 선택된 조치를 덮어쓰는 추가 경로는 없다.
- 실제 실행 사이120틱 조건은 기존 UI 스케줄러와 headless의 `lastActionTick` 검사에 남아 있다. 재시도는 기존 무조치의 재평가 기회만 바꾸며 생산·배송 수치 또는 저장 필드를 수정하지 않는다. 별도 기록기의120틱 외부 게이트와 완전한 동등성을 주장하지 않는 문서 제한도 명시돼 있다.
- 성문 이웃/열린 edge 정보는 `gatesForExteriorAccess` 한 호출에만 존재한다. 초기 상태에서 열린 edge는 추가 문으로 닫히지 않는다는 단조성만 재사용하고, 막힌 edge는 새 문 조합으로 다시 검사한다. 함수 간 장기 캐시나 새 저장 상태가 없으며 기존 다리/벽 통행 함수를 사용한다.
- 비축 조기 종료는 해당 자원의 양수 비축 floor가 없으면 기존 반환값 false를 즉시 반환하며, 실제 양수 재고의 경로만 조사한다. 인증·네트워크·파일 실행 권한과 무관한 내부 조회 축소다.

## 저장·외부 입력·출처

- 지정 delta에서 `src/save`, `src/engine/engine.types.ts`, `package.json`, lockfile 변경 없음. 기존 GameState v4 저장 경계 판정을 뒤집는 변경을 발견하지 않았다.
- 신규 auth/network endpoint, 외부 URL fetch, eval/명령 실행, HTML 삽입, 의존성, 비밀값 취급 경로 없음. 새 gzip fixture는 저장소 소유의 고정 경로 테스트 데이터로 읽으며 외부 archive extraction API를 추가하지 않는다.
- construction-reserve fixture는 원본 커밋·자연 재생 시점·입력/결과 SHA·전체 상태 동등성·동시 부하 측정 한계를 별도 provenance JSON에 기록한다. exterior-gate fixture는 합성10개와 자연1개, 기존 BFS 기준 커밋과 추출 입력 SHA를 구분한다. service-space fixture도 원본 커밋·seed·tick·SHA를 기록한다.
- 서비스 메모 문서는 cold 최초 비용과 warm 반복 개선, 동일 action/diagnostic, 동시 부하 한계 및 잘못된 시간 변경 표본 제외를 구분한다. 이 수치를 전체 FPS나 최신 가드레일 완료로 표현하지 않는다.
- 출처 문서의 SHA와 실행 기록을 읽어 연결 관계를 확인했으며, 원본 압축 데이터 SHA 재계산이나 과거 실행 결과 재생은 이 리뷰에서 하지 않았다.

## 결론과 잔여 게이트

추가 제품 수정 요청 없음. 최종 자연5seed 안정성·통합 회귀·69개 성능 판정은 담당 실행의 실제 결과로 별도 확정해야 한다. 본 PASS는 그 결과를 대체하지 않는다.
