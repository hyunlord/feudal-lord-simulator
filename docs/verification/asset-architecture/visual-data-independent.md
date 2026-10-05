# Data-v3 actual runtime visual review — independent lane 2

판정: **PASS_WITH_NOTES — 관찰한 8개 실제 게임 화면에서 신규 BLOCK 회귀 없음.**

검토자는 `output/art-architecture/core-v3`의 before 8장과 `output/art-architecture/data-v3`의 after 8장을 각각 원본 PNG로 열어 직접 비교했다. 다른 시각 검토자의 판정은 참조하지 않았다. 메타데이터 해석에는 `.omo/drafts/fixture-runtime-review.md`를 사용했다. 이 문서는 코드/테스트 재검증이나 자연 플레이 검증이 아니다.

## 직접 연 이미지 및 결과

각 행의 파일을 **core-v3와 data-v3 두 디렉터리에서 각각** 열었다. 총 16장, 8쌍이다. 1280×800 prepared house gallery이며 각 장면은 20개 집의 occupied/abandoned 조합을 보여 준다.

| PNG basename | 직접 비교 결과 |
| --- | --- |
| `prepared-houses-1350-summer-gallery-z1.png` | 새 초가지붕/붉은 기와와 목골조가 기존 울타리 안에 정착한다. 건물 바닥의 부유, 이웃 대지 침범, 잘린 외곽 또는 불투명 이미지 사각형을 보지 못했다. 높은 단계의 boarded 무늬는 복잡하지만 건물 윤곽은 유지된다. |
| `prepared-houses-1350-summer-gallery-z06.png` | 축소에서도 낮은 집과 높은 집의 실루엣, 지붕 색이 구분된다. 목재/판자 세부는 줄어들지만 잘못된 오버레이 이동은 보이지 않는다. 기존 경고 집계 배지가 일부 지붕을 가린다. |
| `prepared-houses-1350-winter-gallery-z1.png` | 눈이 새 지붕 면에 붙으며 건물과 분리되어 떠 있는 큰 눈 덩어리나 이중 지붕을 보지 못했다. 높은 집의 판자·눈 조합에서도 본체가 사라지거나 눈이 벽 전체를 덮는 오류가 없다. 울타리/마당의 기존 눈은 유지된다. |
| `prepared-houses-1350-winter-gallery-z06.png` | 축소된 눈 덮인 지붕과 건물 높이 구분이 유지된다. 눈/판자 조합이 일부 어둡고 조밀하게 보이나 위치 불일치나 새 화면 가장자리 잘림은 관찰되지 않는다. |
| `prepared-houses-1400-summer-gallery-z1.png` | 더 선명한 붉은 기와와 크림색 벽이 기존 따뜻한 목재 울타리·잔디와 함께 읽힌다. 대지 크기는 유지되며 높은 집도 울타리 안에 발을 둔다. 판자는 해당 집 표면에 놓이며 옆 집으로 번지지 않는다. |
| `prepared-houses-1400-summer-gallery-z06.png` | 붉은 지붕 때문에 높은 단계 집의 구분이 명료하다. 축소된 판자 선은 어두운 질감으로 합쳐지지만 건물 자체는 읽힌다. baseline에도 있는 경고/물방울/금색 고리가 남아 있다. |
| `prepared-houses-1400-winter-gallery-z1.png` | 붉은 기와 사이의 흰 눈과 차가운 음영이 지붕 방향을 따른다. 큰 눈 외곽의 pivot 이탈, 건물 바닥의 계절 간 이동 또는 판자가 지붕 눈 전체를 잘못 덮는 현상을 보지 못했다. |
| `prepared-houses-1400-winter-gallery-z06.png` | 작은 크기에서도 흰 지붕과 본체가 하나의 집으로 보인다. 눈 표면의 세밀한 색 차이는 축소되지만 새로운 실루엣 파손/잘림은 없다. |

## Finding 분류

| 대상 | 참 / 오탐 / 불확실 | 분류 및 영향 |
| --- | --- | --- |
| 신규 body footprint/pivot/큰 clipping 회귀 | 오탐 — 관찰 증거 없음 | 여름/겨울, 두 시대, 두 확대율 모두 기존 fenced plot에 정착한다. 이것은 화면상 판정이며 좌표의 수치적 동일성을 주장하지 않는다. |
| 경고 삼각형·물방울·집계 숫자가 지붕을 가림 | 참 | **PREEXISTING/PREPARED**, 새 데이터 BLOCK 아님. before에도 존재하며 .6에서 더 두드러진다. z1의 금색 고리도 before/after에서 같은 장면 위치에 보인다. |
| 축소 화면 왼쪽 위 영주관의 단순 도형 표현 | 참 | **PREEXISTING**, 이번 house 교체 회귀 아님. 두 버전의 .6 화면에 이미 있다. |
| 높은 단계 abandoned 집의 조밀한 판자 선 | 참 | **NONBLOCKING READABILITY NOTE**. z1에서 폐가 질감으로 읽히고 .6에서는 세부 선이 합쳐진다. 실루엣/층수는 보이며 위치 오류의 증거는 없다. |
| 새 본체가 baseline보다 선명하고 지붕 색이 강함 | 참 | **INTENDED STYLE CHANGE / NONBLOCKING**. 목골조·초가·기와의 같은 재료 언어와 기존 울타리/배경의 등각 방향이 유지된다. 미세한 화풍 동일성까지 보증하지 않는다. |
| snow1350 L2/L3/L4 source alpha1–2 잔여 specks | 불확실 — 이 화면에서 독립 식별 불가 | **KNOWN SOURCE RESIDUAL**, parent가 전달한 원본 검사 사실이며 본 검토에서 alpha를 재측정하지 않았다. 실제 장면에서 눈에 띄는 부유 얼룩으로 구분되지는 않았다. 제거되었다거나 픽셀 단위로 없다고 주장하지 않는다. |

## 판정 범위 및 제한

- 직접 본 before/after 화면에서는 본체·계절 눈·boarded 조합이 한 건물로 읽히고, 새 아트의 발 위치·대지 점유·시각적 계층에 차단할 회귀를 찾지 못했다.
- prepared gallery는 조합 확인에 유효하지만 자연 성장, 밀집 도시의 실제 인접 가림, 이동/계절 전환, 다른 DPR/확대율, UI/엔진 행동의 증거는 아니다.
- 경고 아이콘이 가린 픽셀은 이 이미지로 확인할 수 없다. 해당 가림은 baseline에도 있어 신규 회귀로 올리지 않았다.
- 32개 source의 이전 개별 검토를 반복하거나 파일별 모든 픽셀에 대한 무결성을 증명한 결과가 아니다. 이번 검토의 독립 증거는 실제 런타임 이미지 16장을 개별로 연 시각 비교이다.
- 제품/스크립트/테스트/스냅샷을 수정하지 않았고, 브라우저·원격·빌드·테스트 실행은 하지 않았다. 변경 파일은 이 문서 하나이다.
