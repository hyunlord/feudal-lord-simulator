# REGION 승격 참조4 독립 native 검토

**PASS_WITH_LIMITS.** actual `a5ae207a4625b6bd3e7780bdb468369dd8ee204f`, run `astra-region-promotion-reference-a5ae207`. 비교 기준은 `bd84351abb1e36d6b03f7fa03d4ec4f9484ed23d`의 region-data-v1 참조4다. 부모 판정을 복사하지 않고 AFTER 원본4와 baseline 원본4를 각각 열고, 원본12 PNG를 직접 RGBA decode하여 비교했다.

- 저장된 전체 capture identity4/4 동일. before/after RGBA4/4, AFTER 첫/반복 A/A4/4 동일, 차이 픽셀0. errors/repeatErrors0.
- 기존 여름/겨울 chalk A/B 각각 request·decode·first-open paint를 확인하여 총8 view/URL쌍 통과.
- 신규 spring4 URL은 네 뷰의 첫-open draws에 없음. 반복 source 목록은 저장되지 않았으므로 repeat paint absence는 판정하지 않는다. request0도 주장하지 않는다.
- raw pre/post guard 모두 PASS/trackedClean이며 HEAD, freeze/inputMap SHA, tracked26887/exported27186/LFS6384, 외부 실행파일 기록이 동일하다. 이 리뷰는 저장된 attestation 비교이며 원격 파일 전수 재해시는 하지 않았다.

| 뷰 | 직접 본 화면 / 비교 | 판정 |
|---|---|---|
| summer-z1 | 강 굽이·버드나무·백악/진흙 패치·빗줄기·하단 건물이 baseline과 동일 | 제한 PASS |
| winter-z1 | 같은 강변 배치, 낙엽수·얇은 적설·건물 눈 표현 동일 | 제한 PASS |
| summer-z06 | 넓은 강/숲/마을 배치, 우상단 지도 밖 갈색 경계와 지도 밖 비도 baseline에 동일하게 존재 | 제한 PASS |
| winter-z06 | 넓은 강/숲/눈/마을과 지도 경계 동일 | 제한 PASS |

촬영 범위는 chalk_downs, tile(37,19), 여름/겨울 × zoom1/.6,1280×800,DPR1의4뷰다. 봄 신규4개 그림의 양성 판독, 다른3 지도유형, 모든 카메라/DPR, 인간 접촉·해부학, 장시간 움직임·성능 합격으로 확대하지 않는다. 조밀한 반복 소품·지도 밖 경계는 이번 승격의 새 회귀가 아니며 이 검토로 기존 미술 문제를 수락한 것도 아니다. full identity는 저장된 capture identity 전체 비교이며 별도의 engine/presented full JSON 재검사라고 부르지 않는다.

## 원본과 고정 증거

- `region4-chalk_downs-summer-z1`: [baseline](/Users/rexxa/fls-astra-renderB-region-core/output/art-architecture/region-data-v1/captures/region4-chalk_downs-summer-z1.png), [AFTER original](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/region4-chalk_downs-summer-z1.png), [repeat](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/repeat/region4-chalk_downs-summer-z1.png).
- `region4-chalk_downs-winter-z1`: [baseline](/Users/rexxa/fls-astra-renderB-region-core/output/art-architecture/region-data-v1/captures/region4-chalk_downs-winter-z1.png), [AFTER original](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/region4-chalk_downs-winter-z1.png), [repeat](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/repeat/region4-chalk_downs-winter-z1.png).
- `region4-chalk_downs-summer-z06`: [baseline](/Users/rexxa/fls-astra-renderB-region-core/output/art-architecture/region-data-v1/captures/region4-chalk_downs-summer-z06.png), [AFTER original](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/region4-chalk_downs-summer-z06.png), [repeat](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/repeat/region4-chalk_downs-summer-z06.png).
- `region4-chalk_downs-winter-z06`: [baseline](/Users/rexxa/fls-astra-renderB-region-core/output/art-architecture/region-data-v1/captures/region4-chalk_downs-winter-z06.png), [AFTER original](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/region4-chalk_downs-winter-z06.png), [repeat](/Users/rexxa/fls-astra-renderB-region-core/.remote-runs/astra-region-promotion-reference-a5ae207/region-promotion-reference/captures/repeat/region4-chalk_downs-winter-z06.png).

정확한 identity·PNG/RGBA SHA·원본 receipt SHA·new4 URL은 동명 JSON에 보존했다. 수정 파일은 이 검토 MD/JSON뿐이며 제품·원격·다른 아트 파일을 변경하지 않았다.
