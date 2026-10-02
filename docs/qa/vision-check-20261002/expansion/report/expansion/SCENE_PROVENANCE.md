# 확장 시험지 장면 계보와 독립성

실제 seed는 저장 envelope와 state에서 확인했다. 역사 replay의 `capture.json.seed=1`은 기본값이므로 seed2/seed4 장면의 실제 종자값을 의미하지 않는다. 원본 PNG는 origin alias에서 바꾸지 않았다. 카메라 zoom·pan은 각 replay의 observed_camera 또는 원본 capture 첫 프레임을 따른다. 요청 카메라와 관측 카메라는 동일 개념이 아니다.

| 장면 | 실제 seed | 원본 저장/생성 | QA 관련성 | 신선도 | 동결 정답 양성 단위 | 원본 계보 |
|---|---:|---|---|---|---|---|
| `exp-current-city` | 2 | fixtures/perf-gate/ch4-1380.save.json.gz (tick320000) | QA-002 / QA-005 / NAT1 반복 기준 | 이전 캡처 재사용·교정 | repeat_density 0 | `recall/current-fixed/current-city` |
| `exp-holdout-forest-s2` | 2 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 3 | `full-holdout/forest-summer-z1.0-s2` |
| `exp-main-chalk-wide` | 1 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 1, tile_seam 1 | `full-main/chalk-summer-z0.6` |
| `exp-main-coast` | 1 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 2, tile_seam 2 | `full-main/coast-summer-z1.0` |
| `exp-main-fen` | 1 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 1, tile_seam 1 | `full-main/fen-summer-z1.0` |
| `exp-main-forest` | 1 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 1, tile_seam 1 | `full-main/forest-summer-z1.0` |
| `exp-prenat1-city` | 2 | fixtures/perf-gate/ch4-1380.save.json.gz (tick320000) | QA-002 / QA-005 / NAT1 반복 기준 | 이전 캡처 재사용·교정 | repeat_density 2, scale_ratio 3 | `recall/prenat1/prenat1-city` |
| `exp-prenat1-city-confirm` | 2 | fixtures/perf-gate/ch4-1380.save.json.gz (tick320000) | QA-002 / QA-005 / NAT1 반복 기준 | 이전 캡처 재사용·교정 | roof_overlap 5 | `recall/prenat1/prenat1-city-confirm` |
| `exp-prenat1-roof-confirm` | 2 | fixtures/perf-gate/ch4-1380.save.json.gz (tick320000) | QA-002 / QA-005 / NAT1 반복 기준 | 이전 캡처 재사용·교정 | roof_overlap 1 | `recall/prenat1-roof/prenat1-roof-confirm` |
| `exp-prenat2-city-confirm` | 2 | fixtures/perf-gate/ch4-1380.save.json.gz (tick320000) | QA-002 / QA-005 / NAT1 반복 기준 | 이전 캡처 재사용·교정 | stationary_person 7 | `recall/prenat2-fixed/prenat2-city-confirm` |
| `exp-recall-chalk` | 1 | 일반 새 게임 생성(저장 import 없음) | QA-039 바위 / QA-040 숲과 같은 시각 결함군 | 이전 캡처 재사용·이번 확장 라벨 | straight_boundary 1, tile_seam 1 | `recall/current/current-chalk` |
| `exp-seed1-ch5` | 1 | v31/chapter-five-town.save.json (tick329000) | v31 fixture | 새 캡처·새 blind 라벨 | 정답 양성 없음 / 대조 뷰 | `replay.json` |
| `exp-seed1-ch5-detail` | 1 | v31/chapter-five-town.save.json (tick329000) | v31 fixture | 새 캡처·새 blind 라벨 | repeat_density 3 | `replay.json` |
| `exp-seed4-middle` | 4 | round01/repro/saves/middle1340.json.gz (tick162948) | QA round01 중기 저장 | 새 캡처·새 blind 라벨 | scale_ratio 2 | `replay.json` |

## 독립 단위의 해석

**검출기마다 양성 5개 이상은 다섯 독립 원인·다섯 독립 도시·다섯 독립 미공개 시험을 뜻하지 않는다.** 바위/숲의 여러 영역은 같은 렌더링 경로를 공유할 수 있고, 여러 고정 인물은 같은 장식 스프라이트 경로를 공유한다. 반복 실타래 다섯 군집은 두 도시의 별개 주택열이며 동일 아트/배치 원인이다. 크기 다섯 물건 중 빗물통 두 개는 같은 아트를 공유한다.

- 같은 물건의 시간·줌 변형은 객체 양성으로 재계수하지 않았다. `exp-seed1-ch5`는 detail과 같은 저장/도시이며 탐색용이고 detail 정답만 계수한다.
- `exp-prenat1-city`, `exp-current-city`, `exp-prenat2-city-confirm`, roof 확대는 모두 동일 seed2 저장에서 출발한다. 다른 커밋이 독립 도시를 만들어 주지 않는다.
- 20프레임은 움직임 판정의 한 시퀀스이며 20개의 독립 양성 표본이 아니다.
- 지면의 동일 영역에 straight_boundary와 tile_seam 라벨이 함께 존재할 수 있다. 검출기별 다른 결함 속성이지 독립 장면이 두 배가 된 것은 아니다.
- 재사용 capture에 새 라벨을 붙였다는 사실은 source 이미지가 blind holdout임을 보장하지 않는다. 이전 도구 개발/육안 검토 노출이 있어 재사용은 교정 자료로 취급한다.
- 새 seed1·seed4는 이번 객체 라벨 작성 시 원본부터 본 blind 자료다. 그 라벨을 보고 튜닝한 뒤 측정하는 결과는 해당 자료에 대한 교정 결과이며 외부 holdout 일반화 성능이 아니다.
- 정상 재고 ROI 다섯 개는 한 current 도시의 다섯 공간 구역이다. 장면 수는 하나이며 일반 재고의 과다반복 오탐을 평가하는 제한된 대조군이다.
- 양성 수가 작아 표본 불확실성이 크다. 대표 물건 아트·독립 도시·다른 계절/줌이 모두 충분하다는 주장으로 확장하지 않는다. 바퀴 이상은 양성 없음: 정상 바퀴 대조만 있으므로 바퀴 이상 재현율은 미측정이다.

## 확인한 저장 계보

| 저장 | envelope/state seed | 시작 tick | SHA256 |
|---|---:|---:|---|
| perf-gate/ch4-1380.save.json.gz | 2 / 2 | 320000 | `5aa3ef83bd5b0166ca1a3b5a4b11c1d29df6fdf503cb5fbe5a6cb6a60cede25a` |
| v31/chapter-five-town.save.json | 1 / 1 | 329000 | `2e592d22b05ad44517bf63576e1c68cdef21085805b8d44a005b13b8efbfc1ff` |
| round01/middle1340.json.gz | 4 / 4 | 162948 | `55855d9b12d8f18dacaaf4b4965fdb8e4367b8a1ae4cd31ce39136f3b03a1098` |

새 seed1 렌더링 소스는 preNAT1 `ce941ebeb3e567f498f2709e5989d08f39f6d370`, 새 seed4는 current `d6ae15498a45c2202a10f3ce8f20a543dd305c3f`로 replay에 기록되어 있다. replay 메타데이터 자체의 서버 소스 확인 한계 문구는 유지한다. 소스 SHA를 런타임이 자동 입증했다는 뜻은 아니다. 게임 src 수정·커밋·푸시는 하지 않았다.
