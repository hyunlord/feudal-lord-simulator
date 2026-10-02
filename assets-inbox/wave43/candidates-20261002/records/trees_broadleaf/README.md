# Wave43 봄 활엽수 3장 — candidate

- `tree_oak_large_spring.png`:88×112, anchor(44,112), renderScale4/7.
- `tree_oak_small_spring.png`:64×80, anchor(32,80), renderScale0.8.
- `tree_birch_spring.png`:60×96, anchor(30,96), renderScale2/3.

기준은 `/Users/rexxa/Downloads/ASTRA_Wave43_spring.md` 및 채택 ART_BIBLE_v2. krill의 실제 여름 원본과 겨울 참조를 먼저 보고 references에 고정 복사했다. anchor와 배율은 krill/src/render/worldAssetManifest.generated.ts:293,310,361에서 확인하여 상속했다. manifest.json은 통합 비교판용 경로·크기·피벗·계절 참조를 담는다.

내장 imagegen 각1회, 총3회로 같은 나무의 봄 새잎 RGB를 실제 생성했다. 잎만 더 밝은 연두 새순으로 바꾸고 원본 나무의 위치·크기·줄기·가지·뿌리를 보존했다. raw/는 수정하지 않은 도구 결과, records/generation-*.json은 전체 프롬프트·생성경로·참조해시·후처리·최종해시다. API 모델/seed는 도구 미공개라 null이다.

정합 방식: 생성 RGB를 원본 canvas로 리샘플하고 alpha bbox로 위치 대응, 원본 잎 영역에 생성80%+원본20% 색을 사용했다. 원본 목재/비잎으로 분류된 픽셀 RGB는 그대로 보존했고 원본 alpha는 모든 픽셀에 정확히 재적용했다. alpha0 RGB는0. Birch는 처음 생성 결과가 여름색에 가까워 잎 영역에만 R−5/G+8의 작은 마무리 색 조정을 추가했다. 원시 생성만으로 완벽한 기하가 나왔다는 주장은 하지 않는다. 잎/목재 분류는 기록된 색 기준이며 객체 세그멘테이션의 완벽성을 주장하지 않지만 실제 확대 비교에서 줄기·가지의 움직임은 보이지 않는다.

검수 PASS (오프라인):3장 모두 alpha 차이0, 보호된 비잎 RGB 차이0, 투명 RGB 누출0. 참나무2종은 여름의 진한 올리브보다 밝은 연두 새잎, 자작나무도 더 맑은 연두로 구별된다. 봄/여름 수관 윤곽과 내부 투명 구멍 동일. proofs/seasons.jpg는 겨울→봄→여름을 같은 anchor 기준으로 표시하며3배 원본확대와 manifest 배율 적용 zoom1.0/0.6을 포함한다. proofs/light-dark.jpg는 최종 봄 PNG의 양배경 검수다. 두 파일 모두 최종bytes로 제작하고 실제 열어 확인했다.

겨울 그림 자체는 기존 승인 참조로, 일부 나뭇가지/줄기 형상이 여름과 다르다. 이번 변경은 봄↔여름 기하 일치이며 겨울도 완벽한 픽셀 일치라고 주장하지 않는다. 게임 미설치, renderer/manifest 코드 미수정, 실제 계절 교차페이드·런타임 합성 미검증. 별도 세션 생성이나 재귀 위임 없음.
