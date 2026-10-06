# RB-SPRING 원본 장면 시각 검토

대상 HEAD: `3929f8bdcce5d514df7ab543d34cfa78879ea021`. 실행 `astra-SPRING-after-bankfix-3929f8b`의 완료된 원본 캡처 하위 작업에서 읽기 전용 복사한 임시 자료다. 부모는 이후 정식 fetch 완료와 임시 복사본 148파일 전체 해시 일치를 보고했다. 본 검수자는 직접 연 PNG 20장의 해시를 별도로 기록했다.

실제 PNG 20장(변경 후 12장, 변경 전 8장)을 직접 열었다. pasture·orchard·yard·hedge 각각 줌 1.0·0.6 전후, 변경 후 1.4를 보았다. 원본 49장 전체 검토는 아니다.

동일 저장 비교 8쌍의 save/state/presented-state SHA, tick, tile, zoom이 모두 일치한다. 챕터 4 실제 저장에서 과수원 구역을 그리는 정상 도구를 사용하고 계절 tick을 400 옮긴 준비 상태다. 자연 진행 장면이라고 부르지 않는다.

## ewe A/B

visible, scale plausible; variant identity uses source-coordinate mapping

spring-pasture z1: B at rect (371,274.16,23,17.25), A at (598,291.60,23,17.25). Both contain visible cream sheep pixels; A is lower/head-down, B more upright. At z1.4 the silhouettes are clearer. At z0.6 they remain tiny animal marks, not reliably distinguishable by variant unaided.

Selected A/B examples unobscured on pasture; other sheep by shrubs overlap naturally.

## cherry

visible, scale plausible

spring-orchard z1 source rect (682.5,295.35,43,43) coincides with the pink blossom tree on north-east edge. It differs from surrounding pale orchard trees and is visible before/after. z1.4 branches/trunk read; z0.6 pink crown remains but species cannot be certified by pixels alone.

No floating ground contact or foreground-order break apparent in inspected examples.

## hawthorn

visible flowering hedgerow replacement; final source propagation incomplete

Before/after spring-hedge and pasture z1 and z0.6 show formerly brown-green pasture boundaries acquiring continuous white flower flecks. z1.4 follows the same perimeter and remains below nearby adults and shrubs.

No hawthorn final deviceDestinationRect in sourceProvenance.records. Legacy draw records show source crops into intermediate 64x64 canvas, not final viewport. Do not count raw duplicate legacy draw counts as visible instances. Visual flowering-boundary outcome established, exact source attribution needs consumer/cache-chain evidence.

## laundry

unverified in this slice

spring-yard z1,z0.6,z1.4 are dense urban views. No new laundry source appears in sourceProvenance and no 27.5-world-pixel laundry sprite can be positively located by pixels.

Large blue cloth frames at right in z0.6 already exist in BEFORE, so they are not proof of new laundry. Parent owns sparse-laundry supplemental review.

각 실제로 연 PNG의 SHA256과 중복 제거한 source+deviceDestinationRect를 JSON에 기록했다. 계측된 draw 호출 수를 가시 개체 수로 취급하지 않았다. 빨랫줄과 hawthorn의 정확한 출처 연결은 이 검토만으로 확정하지 않는다.

흰 꽃 변화는 hedge 줌 1.0의 서북 지그재그 경계 약 (200,410)→(390,310)→(580,410), 남쪽 (320,600)→(540,705)에서 전후 모두 직접 확인했다. 부모가 소비자를 확인한 결과 기존 hedgerow를 봄 꽃 띠로 교체하는 경로다. 본 검토는 그 코드 자체를 읽지는 않았으며, 최종 deviceDestinationRect 전파의 빈칸을 가시 실패로 해석하지 않는다.
