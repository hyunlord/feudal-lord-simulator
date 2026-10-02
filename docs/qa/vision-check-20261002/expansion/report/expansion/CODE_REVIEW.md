# 코드 검토: 확대 재현 시험 도구

판정: **COMMENT — 현재 소스 폴더에서 실행하는 전달 범위에 Critical/High 차단 사항은 발견하지 못했다.** Medium 1건, Low 1건을 기록한다. 이 검토는 지표의 독립 재채점이나 제품 전체 안전 인증이 아니다.

`report/expansion/baseline-tool/vision_check`와 현재 도구를 비교하고 component_catalog/parts, inventory, repetition, scale, objects, rock, analyze, replay/save_seed, CLI 및 관련 테스트를 읽었다. code-review 스킬의 심각도·파일 근거 기준을 적용했으며 부모의 직접 수행·위임 금지 범위에 따라 추가 에이전트는 만들지 않았다. 게임 소스·정답·캡처는 수정하지 않았다. 종합 테스트와 ZIP 검증은 부모 세션이 담당한다.

## 발견

| 심각도 | 위치 | 문제·재현 근거 | 영향 및 권고 |
|---|---|---|---|
| 중간 | `tools/vision-check/vision_check/scale.py:89` | 독립 부품으로 이미 분리한 `#component=` barrel/sack에도 옛 전체 묶음 제외 정규식 `_2/_3/stack/pile/cart/payload/cargo`가 적용된다. 동일한 35px 부품과 20px 인물 3명으로 직접 호출하면 `barrel:/assets/workshop.png#component=cask:original`은 후보 1개, 경로만 `workshop_2.png`로 바꾸면 0개였다. | 향후 번호 변형·더미 속 개별 통을 카탈로그에 넣으면 조용히 누락한다. 현재 카탈로그의 yard_brewer_a/b 및 yard_rain_barrel에는 해당 이름이 없어 이번 지표를 뒤집는 문제는 아니다. 검증된 component를 이 전체 묶음 제외에서 빼고, 번호·pile 부모 경로에서도 동일 부품 판정이 유지되는 회귀 검사가 필요하다. |
| 낮음 | `tools/vision-check/vision_check/analyze.py:197`, `tools/vision-check/pyproject.toml:34` | 분석이 패키지 바깥 `config/component-parts.json`을 필수로 연다. wheel 설정은 `vision_check`만 포함한다. 소스 폴더의 `uv run`에서는 존재하지만 설치형 wheel 단독 배포에는 이 경로 계약이 없다. | 사용자가 요청한 소스 ZIP 실행 범위는 충족한다. wheel/pip 설치도 된다고 확장 주장하지 말고, 그 배포를 지원할 때 package resource로 포함하고 깨끗한 설치 smoke test를 추가한다. |

## 확인한 방어와 제한

- 카탈로그는 원본 SHA256·크기·원본 좌표를 사용한다. 분석 시 path traversal은 public root containment로 막고, SHA 불일치·부분 crop·가림은 후보를 만들지 않는다. mirrored crop, SHA 변경, 가린 부품, 잘린 atlas 회귀 검사가 있다. 화면 정답 좌표로 탐지하는 구조는 확인되지 않았다.
- repetition은 ale/crates/wood의 정확한 manifest 경로만 재고 예외로 둔다. yarn은 계속 탐지한다. 동일 draw의 0.7 초과 IoU 중복을 제거한다. 실제 source template가 있는 경우 pair similarity 문턱을 적용하지 않고 각 원본과의 RGB 가시성 확인으로 대체한다(`repetition.py:162`). 이는 명시적인 같은 원본 반복 검사지만 색 변주를 독립 다양성으로 세는 일반 미학 평가는 아니다.
- 반복 그룹은 순차적으로 구성하고 이미 쓴 draw를 다음 그룹에서 제외한다. 결과 그룹 수는 그리기 순서와 앵커에 민감할 수 있다. 개별 물체의 독립성을 정답 평가에서 별도로 관리해야 하며, 그룹 개수 자체가 미적 결함의 객관적 개수라고 주장하면 안 된다.
- rock의 완화된 문턱은 색·질감·마스크·반대 등각 경사·원형도 조건과 함께 사용한다. 실제 QA039 양성, 마스크 제외, 곡선 바위 음성, 검은 stamp 없는 절단, 흩어진 실제 바위 음성 테스트가 있다. 일반 경계 통합에는 90% 포함과 stone 픽셀 비율이 있어 같은 bounding rectangle의 빈 흙 모서리를 무조건 지우지 않는다.
- `detect_rock_seams`는 독립 dark-component 주기 증거를 요구하지만 rock-cut 검출에 종속되어 있다. 둥근 외곽 바위의 내부 seam까지 보장하지 않으며, 세 쌍은 물체를 공유할 수 있는 pair 수다. 독립 원본 장면 수 또는 독립 물체 셋으로 오해하면 안 된다.
- replay의 world seed는 이제 저장 경계에서 읽어 두 `_frames` 호출에 전달된다. seed 누락·잘못된 타입 회귀 12개와 실제 세 저장 메타데이터를 앞선 담당 작업에서 확인했다. 기존 raw의 잘못된 seed는 수정하지 않았고 `SEED_METADATA.md`에 보존 주의사항이 있다.
- 이번 리뷰에서 브라우저 재생이나 wheel 설치는 재수행하지 않았다. 구성요소 필터 문제는 직접 Python 호출로 재현했다. 전체 pytest/정적 분석·원본 SHA·ZIP 해시는 부모의 최종 실행 결과를 기준으로 한다.

## 작성 후 해결 확인

중간 심각도 부모 이름 필터는 `#component=`로 분리·검증한 부위에 적용하지 않도록 수정했다. 통째 수레 짐 더미는 계속 제외하고, 그 안에서 분리된 포대는 계측하는 회귀가 통과했다. 현재 카탈로그에서 새롭게 허용되는 기존 키는0개였고, 최종14장면을 다시 실행해 결과가 동일함을 확인한다(최종 provenance 참조).

낮은 심각도 wheel 배포는 이번 소스 폴더 계약 밖이다. 문서에 소스 트리 `uv sync --frozen` / `uv run` 방식을 명시하며 wheel 단독 배포를 지원한다고 주장하지 않는다. 카탈로그를 포함하는 wheel 리소스 배치는 별도 통합 때 필요하다.
