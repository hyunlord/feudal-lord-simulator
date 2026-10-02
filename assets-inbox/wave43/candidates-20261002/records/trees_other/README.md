# Wave 43 봄 후보 — 소나무 2종·고사목
상태: candidate / 미설치. 소유 범위는 trees_other 폴더뿐이며 게임 코드와 설치 원본을 수정하지 않았다.

- tree_pine_tall_spring: 64×120, pivot (32,120), worldRenderScale 0.5333333333333333.
- tree_pine_short_spring: 56×88, pivot (28,88), worldRenderScale 0.7272727272727273.
- tree_dead_spring: 56×80, pivot (28,80), worldRenderScale 0.8.
- 피벗·스케일은 krill/src/render/worldAssetManifest.generated.ts에서 상속했다. manifest.json은 그룹 내부 상대 경로다.
- 여름은 krill/public/assets/foliage, 겨울은 krill/public/assets/wave15/foliage 원본을 references에 실제 복사했다.

## 제작과 예외
내장 image_gen.imagegen으로 실제 여름 참조를 각각 보고 3회 개별 편집했다. raw에는 도구 원본을 복사했고 기록 JSON에는 전체 prompt, 입력·출력 SHA256, 생성 원본 위치가 있다. 도구가 모델·seed를 노출하지 않아 null로 기록했다.
Sharp로 생성 알파 bbox를 여름 bbox에 정합하고 Lanczos3 축소 후 원본 RGB에 생성 재질을 선택 합성했다. 여름 알파를 그대로 재적용하고 완전 투명 RGB를 0으로 정리했다. 경계·좁은 가지는 원본 RGB 비중을 높여 가짜 구조를 방지했다. 정합 방식·비율은 records/process.cjs와 개별 JSON에 명시했다.

소나무는 상록수이므로 낙엽수의 새 수관으로 교체하지 않았다. 기존 수관 내부에만 절제된 연두 candle 느낌과 색 차이를 넣었다. 고사목은 살아난 나무가 아니다. 새 잎·눈·새 가지 없이 젖은 수피와 본체 안의 작은 이끼색만 적용했다. 작게 보일 때 계절 차이가 약한 것은 고사 상태·형상 보존을 우선한 의도적 예외다.

## 검수
겨울→봄→여름 1배·0.6배 비교판을 같은 셀 좌표·바닥 피벗에 놓고 실제 열어 확인했다. 4배 nearest 비교판도 확인했다. 원본 수관·갈라진 가지·뿌리 실루엣 유지, 새 문자·흰 테두리·검은 외곽선·부활한 잎 없음. 세 장 모두 여름 대비 알파 차이 0픽셀, 완전 투명 RGB 오염 0픽셀. references 여름 복사 SHA와 설치 원본 SHA 일치.
이는 오프라인 이미지 검수이며 게임 런타임 설치·렌더링 검증은 수행하지 않았다.


## 소나무 시도 2 — 봄 식별성 보강
루트 시각 검수에서 초기 소나무가 여름과 너무 비슷해 revise 판정을 받았다. 두 소나무만 내장 imagegen으로 다시 개별 편집(총 호출 5회)하여 기존 수관 안의 밝은 연두 candle 새순 덩어리를 강화했다. 첫 시도 raw 및 records/*-attempt1.json을 보존했다. 최종 소나무는 records/process-attempt2.cjs를 사용하며, 수피 RGB는 원본을 유지하고 needle 내부는 생성 RGB 94%, 윤곽 인접부는 그 80% 비율로 합성했다. 알파는 원본 그대로다. 고사목은 변경하지 않았다. 1배·0.6배·4배 비교판에서 봄 수관 끝의 밝은 새순을 다시 확인했다.
