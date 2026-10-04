# R06: 청원 완료 뒤 방향 잠금과 자율창고 원인 표시 공백

판정: 정책·혼인 실행과 성장 원인 화면 관문 미통과. 정상 저장에 원인 receipt가 존재하는 자율창고를 열었지만 이 inspector에는 그 원인을 표시하지 않았다. 엔진 receipt 부재가 아니다.

## 실행과 범위
공식 DGX runner nice19/detach/keep, 고정 HEAD5fb1aebf. 최초 준비 실수 exit127/명령0초는 하네스 실패로 보존. R06b 실제 UI43.8초, R06c 스크롤 보완42.8초, 모두exit0. 브라우저 합61JPEG/61DOM. source7hash통과. 두 실행의 runner/Chrome 종료와 포트해제 CLEANUP*에 기록. 자연 첫플레이 아님. 기존 R04 1325년 seed1 tick100000 실저장 fixture를 정상codec/IndexedDb adapter로 적재했다. 현재 UI에서 직접 마우스만 조작했고 엔진명령·state injection으로 잠금을 우회하지 않았다.

## B02: 높은 우선순위 방향 모드 연결 누락
[코드] tutorialAccess의 전 분기에서 direction:false, App은 그대로 LayerSwitch로 전달한다(SOURCE_DIAGNOSIS.md). [저장] market_charter@25000 accept/respondedTick25000. [화면] 1325년에서도 방향을 누르면 ‘첫 청원 뒤에 열립니다’라고 한다. 이 조합은 단순 청원 전 정상잠금과 다르다. 정책 선택을 실행하지 못했고, 선택했다고 보고하지 않는다.

## B03: 특정 자율창고 inspector에는 성장 이유 없음
[저장] construction-site-000039, storehouse (41,45), logs92+timber4, reservedlogs8. receipt-98(tick49764)은 merchants/storage/rank15, 점수40, 비용240, 사유 need46/cost−6/plan4/access−2/land−2. [입력] 실제 장부 ‘창고 2 · 92’ 버튼 hit-test reachable 후 클릭. fixture에서 logs92를 가진 storehouse는 이 한 곳이다. [화면] inspector96/200·들어올몫8, logs92/목재4로 대응된다.

R06b wheel은 화면을 이동하지 못했다. 원인 미확정이다. R06c native scrollbar drag 전후 `scrollTop0→447`, clientHeight458/scrollHeight905로 **최하단까지 도달**했다. 상단/하단 두 화면은 겹치는 재고구간이 있어 전체세로내용을 덮으며 전체 DOM에도 성장 사유가 없다. 보이는 내용은 재고·받는품목·물자운송·위치로다. ‘왜 여기에?’ 영수증은 이 창고 inspector에서 관찰하지 못했다. 다른 건물이나 별도 화면 모두를 검사했다고 일반화하지 않는다. drag 별도 hit-test는 남기지 않았고 실제 scroll 측정과 그림으로 이동을 검증했다.

## 혼인·이웃
권리 장부 전체 DOM과 화면에는 가문/권리 정보가 있으나 현재 보이는 혼인 제출 버튼은 없었다. fixture 협상1은 이미 accepted, 혼인stage lost이며 pending협상 없음. 새 혼인 제안이 가능한 상황을 검증하지 않았으므로 혼인 기능 전체 부재·불능으로 판정하지 않는다. 추가 버튼 탐색을 반복하지 않았다.

## 검수 그림
- executed-scrollbar/0009-policy-surface.jpg: 청원 완료 판의 방향 잠금.
- executed-scrollbar/0014-rights-marriage-surface.jpg: 권리 장부 관찰 범위.
- executed-scrollbar/0024-autonomous-store-000039-before.jpg: 클릭할 ‘창고2·92’.
- executed-scrollbar/0026-autonomous-inspector-top.jpg: 일치하는 자율창고 상단.
- executed-scrollbar/0028-autonomous-inspector-end.jpg: native scrollbar 최하단과 위치로 버튼.

helper summary default not_reached 필드는 판정에서 제외한다. 실행자는 R06b 상단·끝, R06c 하단 JPEG를 직접 열어 판정했다. 부모 별도 visual review는 별도파일로 추가할 수 있다.
