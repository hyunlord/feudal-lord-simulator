# 반복 검출 정리 계획

정답 동결 파일 존재를 2026-10-02에 확인한 뒤 동작 변경을 시작한다. 기존 objects 테스트 12개 통과.

1. 정상 재고 제외 회귀 검증을 먼저 추가한다. 에일 재고 통·짐상자·명시된 목재 재고를 제외하되 일반 통, 실타래, 주택은 유지한다.
2. objects의 반복 검출과 크기 검출을 별도 모듈로 옮긴다. 공개 detect_objects/rain_scale/stationary_metrics API를 유지한다. 기존 숫자 문턱과 판정은 변경하지 않는다.
3. inventory의 좁은 원본 자산 경로 분류만 반복 검출 앞에 적용한다. scene/좌표/정답 ID에 의존하지 않는다.
4. 제외 집계를 별도 함수로 공개한다. 이는 화면에서 검출 가능한 재고 수가 아닌 캡처된 draw 호출 수임을 명시한다.
5. 기존 및 새 테스트, Ruff, Basedpyright를 실행한다.

근거: src/render/stockPiles.ts:15-34,47-64는 재고량별 pile을 정의한다. wave3AleManifest.generated.ts의 ale_barrels_3, wave7ArtManifest.generated.ts의 crates_1..3, visibilityArtManifest.ts의 pile_wood_1..3가 특정 재고 자산이다. 실타래도 재고로 쓰이지만 stockPiles.ts:65-69에서 집의 직업 표식으로도 쓰이므로 이번 사용자 요구에 따라 반복 검사를 유지한다. 일반 barrel이라는 이름 또는 pile 디렉터리 전체를 제외하지 않는다. 작업장/마당의 목재를 포함한 합성 그림 전체는 목재라는 이유만으로 제외하지 않는다.

## 실행 결과

- 동작 변경 전 새 검사: 에일 재고/상자 정상 제외 2개 실패, 일반 통/실타래/주택/불명 재료 더미 유지 4개 통과. 기존 12개 통과.
- 분리: objects.py 217행(비공백 193), repetition.py 176행(158), scale.py 157행(144), inventory.py 31행(23). 기존 검출 문턱 유지. 공통 픽셀 근거 함수는 repetition에 모아 stationary/scale에서도 재사용한다.
- `inventory_category(asset)`는 명시한 자산 경로만 분류한다. 추가 목재 근거: constructionPlaque.ts:209(재고량별 목재), constructionKits.ts:102(건설 현장 timber_beam_stack). 원본 URL의 query는 의미와 무관하므로 제거한다.
- `inventory_skip_counts(draws)`는 ale_stock/crate_stock/wood_stock별 캡처 draw 호출 수를 반환한다. 중복 호출 및 가려진 호출을 포함하므로 **실제로 보이는 재고 개수로 해석하면 안 된다**.
- `detect_objects`, `rain_scale`, `stationary_metrics` 공개 API 유지. 정상 재고 제외는 반복 검출에만 적용하며 크기 검사를 자동 면제하지 않는다.
- Ruff 담당 파일 전체 통과. Basedpyright 담당 파일 0 errors / 0 warnings. 전체 pytest 121 passed (0.53초).
- 제한: 장작이 포함된 작업장/마당 합성 그림 전체를 면제하지 않는다. 그런 합성 그림의 내부 재고 부품만 따로 다루려면 부품 근거가 필요하다. 실타래는 사용자 명시 요구대로 유지하므로 정상 cloth inventory와 직업 표식이 같은 그림일 경우 사람 검토가 필요하다.
- 이 문서의 수치는 회귀 검증이며 실제 확장 시험지 정밀도/재현율은 부모 실행에서 별도 보고한다. 정답 후보/좌표를 구현에 사용하지 않았다.

## 확장 시험 뒤 추가 교정

동결 시험지의 새 seed1 사례에서 이전 4칸 반경이 여러 도로열을 큰 상자 하나로 묶었다. 후보 자체는 존재했지만 고정된 공간 대응 조건을 통과하지 못했으며 FN으로 기록했다. 화면 y축은 등각 지면 투영에서 x축의 절반 척도이므로 근접 거리를 `hypot(dx, 2*dy)`로 고쳤다. 문턱은 `repeat_radius_tiles=2.4`, 작은 소품 `repeat_min_count=4`로 교정한다. 네 개 집의 보통 배열을 소품 네 개와 같은 밀도로 취급하지 않도록 건물에는 별도 `repeat_building_min_count=6`을 유지한다. 기존 설정 파일은 변경하지 않고 `config/expansion.json`에 기록한다.

과거 draw AABB의 좌우반전 누락은 반복 픽셀 가시성에도 영향을 주므로 원본 또는 수평반전 RGBA의 실제 픽셀 대조를 통과해야 한다. 보이지 않는 사본은 계속 제외한다. 반전 원본/가림, 서로 다른 지면 행/네 집 대조의 회귀 테스트를 먼저 실패시킨 뒤 수정했다.

이는 같은 동결 시험지를 보고 한 교정이다. 독립 holdout 성능으로 부르지 않는다. 군집 단위와 사람의 동네 구획이 항상 일치한다고 보장하지 않으며, 부분 가림 때문에 네 사본 중 두 개만 충분히 보이면 FN을 유지한다. 모든 고정 정답은 그대로 보존했다.
