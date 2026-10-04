# QA003 통합 재촬영 눈 검토 기록

DGX `astra-ARCH1-qa003-smoke-v2-ab67dcb`, 입력 `ab67dcb84b3f0cbc202718cfd618b20393b198b8`. 부모 주 검수자가 아래 원본 PNG4장을 각각 열었다. 이 문서는 그 전달된 검토와 실제 캡처/해시 대조를 기록하며 문서 조립자가 추가로 눈 검토했다고 주장하지 않는다.

- `output/art-architecture/qa003-smoke-v2/integrated-summer-occupied-z1.png`
- `output/art-architecture/qa003-smoke-v2/integrated-summer-occupied-z06.png`
- `output/art-architecture/qa003-smoke-v2/integrated-winter-empty-z1.png`
- `output/art-architecture/qa003-smoke-v2/integrated-winter-empty-z06.png`

네 화면 모두 기존4151d15f의 동일 identity·RGBA와 일치하고 JPEG SHA도 동일하다. 따라서 기존 [통합 눈 검토](integrated-visual-review.md)의 화면 관찰 및 주의사항을 그대로 적용한다. 새 시각 차이를 주장하지 않는다. 줌0.6의 작은 직업 표지 세부, 기존 경고/금색 고리 가림, 겨울 영주관 눈 없는 지붕은 기존 한계다. 준비 장면이므로 자연 플레이·모든 겹침·워커 깊이 순서·다른 QA003 장면의 전면 검증은 아니다.

[독립 실행 영수증](qa003-smoke.json)과 [캡처 목록](capture-index.json)은 신규 실행 경로/PNG SHA/RGBA를 보존한다. 실제 재촬영을 했고 동일 JPEG4개만 물리적으로 재사용했다.

## 독립 검수 원문

아래는 별도 검수자의 `.omo/drafts/qa003-integrated-visual-review.md`를 보존한 내용이다. 문서 조립자의 직접 검토로 대체 표기하지 않는다.

# QA003 병합 smoke — 독립 실제 캡처 시각 검토

**판정: 제한된 네 준비 장면에서 새 통합을 차단할 명백한 시각 결함을 찾지 못함(PASS with notes).** 네 root PNG를 각각 직접 열었다. 부모의 시각 판정을 읽거나 그것을 대체 근거로 삼지 않았다. 제품 수정·추가 캡처·원격 실행 없음.

대상: `output/art-architecture/qa003-smoke-v2/`, capture commit `ab67dcb84b3f0cbc202718cfd618b20393b198b8`, 네 장 모두1280×800/DPR1. `captures.json`은 준비 저장 상태와 카메라/줌을 식별하는 데 사용했다. 실제 자연 플레이를 관찰한 것은 아니다.

| 직접 연 PNG | 판정 | 화면에서 확인한 것 / 제한 |
|---|---|---|
| `integrated-summer-occupied-z1.png` | PASS / NOTE | 두 열의 작은 초가지붕부터 다층 기와지붕 집까지 yard와 길 옆 지면에 놓여 있다. 눈에 띄는 이중 몸체, 바닥에서 뜬 집, 사각 불투명 바탕, 집을 가로지르는 잘못된 전경 길은 보이지 않는다. 아래쪽 폐쇄 상태 집들의 판자 모양과 금색 상태 원이 함께 보이며, 앞쪽 manor는 별도 몸체로 유지된다. 좌측 굽은 길/사선 줄기와 내부 얕은 밭 흔적도 공존한다. 경고 삼각형·물방울·금색 원이 지붕과 출입구 일부를 가리므로 그 뒤의 모든 레이어를 확인한 것은 아니다. |
| `integrated-summer-occupied-z06.png` | PASS / NOTE | 같은 집열·yard·manor·길의 상대 위치가 유지되고 화면 중앙에서 잘리지 않는다. 작은 초가집과 다층집, yard 외곽, manor의 길쭉한 실루엣을 구별할 수 있다. 줌 축소로 경고가 숫자 군집으로 바뀌고 일부 집 실루엣을 가린다. 간판은 작은 부착물 수준이며 baker/weaver 그림의 정확한 의미나 글자 판독을 승인하지 않는다. |
| `integrated-winter-empty-z1.png` | PASS / NOTE | 집 지붕의 눈은 노출된 경사면/처마를 따라 붙어 있고, yard 울타리 눈도 그 위치와 대체로 맞는다. 분리되어 떠 있는 눈판, 명백한 지붕 이중 외곽 또는 다른 크기의 old-body crop이 겹친 모습은 보이지 않는다. 판자/금색 원 상태 표시가 눈집과 함께 나타나며 집 바닥·yard·길의 접점도 유지된다. 겨울 길과 좌측 밭 흔적은 지면 위에 남는다. 앞쪽 manor는 눈 없는 적갈색 지붕이다. 이는 관찰 가능한 계절 차이이며 이 캡처만으로 새 회귀로 분류할 근거는 없다. |
| `integrated-winter-empty-z06.png` | PASS / NOTE | 축소 후에도 겨울 지붕의 흰 부분, 두 집열/yard와 manor, 연결 길이 서로 크게 어긋나지 않는다. 눈이 본체에서 분리된 큰 밝은 덩어리나 청크 경계의 큰 절단 흔적은 보이지 않는다. 겨울 바탕은 넓은 평면 타일/그리드가 여름보다 잘 드러나고 눈 없는 manor도 눈에 띈다. 이것을 이번 병합이 도입한 문제라고 단정하지 않는다. 판자 개별 부재, 간판 glyph와 가려진 출입구 상태는 이 줌에서 판별 불가다. |

## 공존 / 회귀 판정 범위

- **집·레이어:** 화면에 실제 보이는 roof/body/yard 외곽의 큰 등록 오류는 발견하지 못했다. 이 네 장은 모든20body/6board/6snow/4reused 조합의 완전 갤러리가 아니며 전체 변형 커버리지를 주장하지 않는다. 보이는 바닥 접촉의 타당성과 engine footprint/collision의 수치 일치는 별개다.
- **기존 간판과 manor:** 기존 소형 부착물과 manor가 신형 집/yard/상태 레이어 옆에 남아 있고 큰 이중 합성 또는 공간 파손은 없다. 수령된 asset URL의 lineage가 간판 모든 픽셀의 가시성이나 의미 판독을 증명하지는 않는다. 경고 UI에 가려진 면은 미검증이다.
- **Wave42 지면:** 이 카메라에서 사선 길, 좌측 굽은 연결부, 밭/방치 흔적이 집열·manor와 함께 나타난다. 열린 공간 위주이므로 복잡한 나무/집 뒤 occlusion, 모든16연결 mask, 다른 지도 경계·카메라에서의 seam까지 검증하지 않았다.
- **기존/도입 구분:** `.omo/evidence/qa003-smoke-v2-summary.json`은 네 장 모두 errors0/missing0, 반복 differingPixels0, 이전 smoke와 sameIdentity/sameRgba/sameJpeg=true를 보고한다. 이는 읽은 기계 증거이며 이 검토에서 독립적으로 파일 해시를 재계산하지 않았다. 따라서 위 겨울 manor/그리드 및 경고 겹침 NOTE를 새 도입 결함으로 분류하지 않는다. 새 캡처 네 장의 실제 픽셀을 별도로 열어 검토했다는 점과 이전 결과의 동등성 보고를 구별한다.

**최종: 이 네 준비 장면에서 blocker 없음.** 자연 플레이, 모든 가림 관계, glyph legibility, 모든 source 변형, 애니메이션/부하 성능 및 확대1.4 등록 품질은 이 검토의 승인 범위 밖이다.
