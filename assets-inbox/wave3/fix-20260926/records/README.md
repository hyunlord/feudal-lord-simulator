# Wave3 교체 후보 10장

기존 통과 72장은 수정·재생성하지 않습니다. 이 압축파일에는 아래 **교체 PNG 10장**, 확인 그림 1장, 생성 기록 CSV 10행이 들어 있습니다. 게임 설치 없음, 상태 `candidate`.

| 수정군 | 파일 |
|---|---|
| 숙인 긴 수염 보리 | `field/ridge_barley_ripe_a-v1.png`, `field/ridge_barley_ripe_b-v1.png` |
| 보리 이삭이 보이는 자루 | `pile/barley_sacks_1-v1.png` ~ `barley_sacks_3-v1.png` |
| 보리 자루 적재물 | `loads/cart_load_barley_ne-v1.png`, `cart_load_barley_nw-v1.png` |
| 차분한 염색천 | `yard/tenter_frames_dyed-v1.png`, `loads/cart_load_cloth_dyed_ne-v1.png`, `cart_load_cloth_dyed_nw-v1.png` |

파일명·에셋 ID는 유지하며 생성 기록의 버전을 `v1-revision2`로 표시합니다. 기존 전체 납품 ZIP도 그대로 보존했습니다.

`checks/01-wheat-barley-dye-comparison.png`의 **100% 표시 크기**에서 줌0.6 줄을 확인하십시오. 해당 줄은 원본0.3배이며, 옆의 원본 크기 세부와 구분해 표기했습니다. 아래쪽에는 염색천 수정 전후를 같은 배율로 배치했습니다.

밀 띠 비교 기준은 기존 프로젝트 `field/ridge_growing_a-v1.png`입니다. 파일명은 growing이지만 기존 제작 기록에서 황토색 밀·익은 밀밭 그림을 참조한 띠이므로 이를 실제 비교본으로 사용했습니다. 자루·적재물은 Wave7 기존 납품 원본입니다.

`assets.csv`에 실제 프롬프트 전문·재시도·참조·후처리 기록을 담았습니다. `records/`에는 생성 원본 경로와 검증 근거를, `QA.md`에는 최종 자체 판정을 기록합니다. 게임 내 적용·성능 검증은 포함하지 않습니다.
