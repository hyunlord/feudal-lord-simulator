# R02 컨셉 설계

가제 ‘저마다의 영지’. 8개 연속 혼합 축, 실제 경제와 공간의 전투 연결, 짧은 방문, 상품 정책과 PC 원칙 충돌을 정리했다.

읽는 순서: CONCEPT.md → WAR_AND_SOCIAL.md → MONETIZATION.md → PRINCIPLES.md → VALIDATION_CONTRACT.md.

핵심 발견:
1. 혼합형의 재미는 이름 붙인 직업이 아니라 공통 예산과 생산·수송의 연결에서 나와야 한다.
2. 자동 도시의 모양을 전투가 실제로 읽어야 ‘내가 만든 조건의 결과’라는 차별점이 성립한다.
3. 짧은 방문에 필요한 위임을 유료 편의로 팔면 실질 성능 판매가 되므로 무료 기본 기능으로 둔다.

설계는 구현/사용자 승인/밸런스 통과가 아니다. 이번 ZIP에는 시제품·플레이 캡처가 아직 없다. R03 실제 엔진 측정과 재사용 분석, R04 시제품/리그/독립 검수를 이어간다.

근거:
- R01의7게임 문헌 비교 및 자료 공백. 이 문서의 계수·시즌 길이·목표 방문 횟수·상품 매출 시나리오는 모두 설계 가정이다.
- game-principles.md 및 extensibility.md, 지정 가지843e52d 정본. [게임 원칙](https://github.com/hyunlord/feudal-lord-simulator/blob/843e52d18c0cadb272d9f54544788db723ee13dc/docs/design/game-principles.md), [확장성](https://github.com/hyunlord/feudal-lord-simulator/blob/843e52d18c0cadb272d9f54544788db723ee13dc/docs/design/extensibility.md).
- [기초 설계](https://github.com/hyunlord/feudal-lord-simulator/blob/eeccc92a6c3c67b82859d325492b8166f1e6a3be/docs/design/foundation.md), [영주 모드](https://github.com/hyunlord/feudal-lord-simulator/blob/eeccc92a6c3c67b82859d325492b8166f1e6a3be/docs/design/lord-mode.md), [직업과 무력](https://github.com/hyunlord/feudal-lord-simulator/blob/eeccc92a6c3c67b82859d325492b8166f1e6a3be/docs/design/trades-and-force.md).

원본 저장소 수정·커밋·푸시·DGX 사용 없음. 별도 mobile-study 폴더의 문서 후보다.

독립 설계 검토에서 외교의 측정 누락, 승패 정의, 좌석 순환, 탐색 통계 한계, 약탈 재고 잠금 악용을 지적받아 보완했다. 원 검토와 수정 대응은 REVIEW.md에 함께 남겼다. R02는 설계 결과물이며 R04 실험 결과로 가정을 반박할 수 있다.
