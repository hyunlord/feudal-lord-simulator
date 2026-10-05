# Wave37 기존 미표시16 — 독립 실제 장면 시각 검토

**Blocker: 이번 준비 장면에서 명백한 배치 파손은 발견하지 못했다. 단,16개 모두의 세밀한 접지·glyph 판독을 PASS로 선언할 수는 없다(NOTE).** 작은 부착물은 집 전면과 지면 주변에 보이나, 비·밀집 건물·목재색 배경이 작은 외곽을 가린다. 아래 PASS는 해당 화면의 큰 배치 오류 없음이라는 한정 판정이다.

검토자는 `output/art-architecture/wave37-before-v2/`의 root native PNG21개와 `wave37-after-reference/`의 새 root PNG4개를 **각각 직접 열었다**. contact sheet나 이전 hash로 실제 after 열기를 대체하지 않았다. 모두1280×800 캡처다. 제품·장부 수정, 새 브라우저/원격 실행, commit 없음.

## 범위와 기계 증거를 구분

`wave37-fixtures/minimal-coverage.json`의 static 계획은16개 summer-z1 + baker_a reference4 중 겹치는 summer-z1 하나를 뺀3 + close2 = **21 before**다. after는 동일 baker_a reference4, 총25개 실제 PNG를 열었다. static 파일의 NOT_CAPTURED 표시는 생성 시점의 상태이며 새 runtime 결과와 혼동하지 않았다.

`.omo/evidence/wave37-before-v2-summary.json`은 PASS21/errors0,각 view의 request/decode/draw 누락0, 독립 반복 differingPixels0을 보고한다. 이는 URL별 사용 증거이며 표면의 모든 픽셀이 최종 가시적이라는 뜻은 아니다. 준비된 facts로 선택한 장면이며 자연 발전 과정은 관찰하지 않았다. 원본 PNG 자체의 개별 source 품질 검수도 이번 작업과 다르다.

## 16 target summer-z1 개별 판정

아래 이름에 `-summer-z1.png`를 붙인 실제 파일을 하나씩 열었다. NOTE는 관찰 한계이며 확인된 기능 고장과 동일하지 않다.

| target | 판정 | 관찰 |
|---|---|---|
| condition_newcomer_cart_a | NOTE | 집열 옆 길에 작은 바퀴/수레형 물체가 놓인 모습이 보인다. 집 크기의 비정상 확대나 화면 경계 절단은 없다. 비와 도로색 때문에 작은 바퀴 접점은 z1에서 불명확하다. |
| condition_ordinary_bench | NOTE | 낮고 작은 갈색 부착물이 집 전면 지면과 섞인다. 큰 부유 또는 집 위로 튀는 오배치는 보이지 않지만 벤치 다리/땅 접점을 개별 판독하기 어렵다. |
| condition_prosperous_pots | NOTE | 풍부해진 정원과 작은 화분 계열 장식이 집 주변에 공존한다. 지붕 위 상태 diamond/문서 표식은 별도 UI이며 화분 증거로 세지 않았다. 작은 화분의 정확한 실루엣 분리는 제한된다. |
| condition_strained_barrel | NOTE | 갈색 원통 계열 소품이 집 앞 낮은 영역에 섞여 있다. 큰 registration 오류는 없으나 울타리/지면과 비슷한 색이라 받침/접지를 확정하지 않는다. |
| trade_ale_a | NOTE | 집 주변의 작은 갈색 표식/소품이 주변 비례를 깨지 않는다. ale 의미와 세부 부착점은 이 전체 화면에서 독립 판독하지 못했다. |
| trade_baker_a | PASS / NOTE | 둥근 갈색 빵/바구니형 덩어리가 위쪽 집열과 오른쪽 앞집 전면에 비교적 잘 드러난다. 지붕 위 부유나 큰 지면 이탈은 없다. 작은 glyph의 의미 승인은 아니다. |
| trade_baker_b | PASS / NOTE | 갈색 상품 덩어리가 전면에 놓이고 건물 실루엣과 별도로 보인다. 눈에 띄는 확대/절단 오류 없음. A/B의 세부 의장 판독까지는 보증하지 않는다. |
| trade_carpenter_a | NOTE | 목재색의 낮은 부착물은 timber 집/울타리와 대비가 약하다. 큰 배치 파손은 없지만 개별 도구/다리의 접지는 확신하기 어렵다. |
| trade_dyer_a | NOTE | 작은 색채 포인트가 집 전면에 나타나며 큰 사각 배경이나 지붕 이탈은 없다. 작은 크기와 비 때문에 세부 외곽은 제한된다. |
| trade_dyer_b | NOTE | 전면의 붉은/작은 색점이 보이나 물체 의미/부착면을 완전히 분해할 수 없다. 눈에 띄는 대형 offset/절단 없음. |
| trade_inn_a | NOTE | 작은 전면 표식은 집열과 함께 남고 큰 비례 오류는 없다. 건물 사이와 비에 묻혀 정확한 간판 연결부는 확정하지 않는다. |
| trade_miller_b | NOTE | 밝은 갈색의 작은 물체가 전면에 보이고 길 밖으로 크게 떠 있지는 않다. 작은 항목의 세부 접촉은 미확정이다. |
| trade_tanner_a | NOTE | 작은 밝은/갈색 장식이 전면 주변에 보인다. 큰 오배치는 없지만 배경 대비와 크기 때문에 가죽 모양/받침점 확정은 불가하다. |
| trade_tanner_b | NOTE | 흰빛의 작은 장식이 위 집열 앞에 드러나며 큰 정렬 오류는 없다. 주변 건물에 가까운 부착물의 가림 전부를 승인하지 않는다. |
| trade_weaver_a | PASS / NOTE | 밝은 직물/틀형 세로 소품이 집 전면에 보인다. 지면에서 크게 뜨지 않고 비례도 건물보다 충분히 작다. 근접1.4에서 추가 확인하되 문자 판독은 하지 않았다. |
| trade_weaver_b | NOTE | 밝은 작은 소품이 집 전면에 남고 큰 비정상 확대나 화면 절단은 없다. 카메라가 A와 달라 A/B 직접 픽셀 비교는 하지 않았다. |

## 추가 reference/close5와 실제 after4

| before 추가 PNG | 시각 판정 |
|---|---|
| trade_baker_a-summer-z06.png | NOTE: 마을/집/작은 소품의 상대 위치는 유지된다. 전체 마을이 작아져 개별 상품/간판 접점 및 의미 판독은 불가능에 가깝다. |
| trade_baker_a-winter-z1.png | PASS / NOTE: 빵/바구니형 전면 소품이 눈 지붕 아래에서 남으며 큰 눈 레이어 충돌이나 부유는 보이지 않는다. 겨울 눈/밝은 바탕에 묻힌 작은 접점은 한계다. |
| trade_baker_a-winter-z06.png | NOTE: 집열과 눈 지붕은 구별되나 소품은 작은 색 덩어리 수준이다. 저줌 glyph/세밀한 접지 PASS가 아니다. |
| condition_newcomer_cart_a-summer-z14.png | PASS / NOTE: 전면 길의 바퀴형 수레와 집의 상대 비례를 z1보다 분명히 볼 수 있다. 눈에 띄게 떠 있는 큰 물체는 없다. 주변 캐릭터/집 때문에 모든 수레의 완전한 가시성은 미검증. |
| trade_weaver_a-summer-z14.png | PASS / NOTE: 밝은 세로 틀/직물형 장식이 전면 벽 가까이에 있고 그 아래가 길 영역으로 이어진다. 불투명 canvas box나 대형 pivot 이탈은 없다. 일부 전면이 인접 집과 겹치므로 모든 occlusion 승인 아님. |

새 after-reference의 `trade_baker_a-{summer,winter}-{z1,z06}.png` 네 장도 각자 직접 열었다. 위 before reference와 같은 비/눈·집·소품 배치로 보이며 새 시각 차이를 찾지 못했다. 별도 읽기 전용 비교에서4/4 `identity` 객체 동일, root PNG 전체 바이트 동일, capture의 `rgbaSHA` 및 `repeatRgbaSHA` 값 동일을 확인했다. after `captures.json`은 pass=true/errors=[]다. 실제 after 열기 이후의 동등성 대조이며 before hash만 복사한 검토가 아니다.

## 제한과 후속 판정에 필요한 구분

- 비와 상태 원/표식, 나무·밀집 집이 가림 조건을 만든다. 여기에 보이는 큰 배치가 정상이라는 판단과 원본16개 모든 픽셀의 가시성은 별개다.
- 저줌0.6은 baker_a reference만 있다. 나머지15개의0.6 판독이나 겨울 등록은 시험하지 않았다. prosperous_pots 겨울 생략도 계획대로이며 겨울16 전체를 통과했다고 보고하면 안 된다.
- 숲의 규칙적인 반복/밴드와 강한 비는 모든 장면에서 눈에 띄지만, 이 작업의 sign16 도입 회귀라고 분류할 증거는 없다. 기존 표시 증명의 배경 제한으로 기록한다.
- 이번 결과는 기존 미표시16의 준비 사실 기반 runtime 사용 및 한정된 장면 공존 증거를 보강한다. 새로운 설치, ledger 확정, 자연 플레이, 모든 가림 관계, 개별 glyph 의미의 승인을 대신하지 않는다.

최종: **명백한 blocker 없음; 접지/가림/저줌 해독의 불확실성은 위 NOTE로 남김.**
