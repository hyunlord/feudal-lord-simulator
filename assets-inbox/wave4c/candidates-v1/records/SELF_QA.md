# Wave4c 검수표

| 검사 | 결과 | 근거 |
|---|---|---|
| 납품 수량 | 18PNG / 확인3 / CSV18 | records/package-validation.json |
| 목표 크기·RGBA·투명 배경 | 18/18 통과 | module-validation / nonmodule-technical-qa |
| 허들 구조 마스크 | 5/5 차이0픽셀 | module-validation.json |
| 허들 닫힌 마당 접합 | 8접점 연결 | proof01, module-validation.json |
| 그루터기 X 이음 | A/B RGBA 양끝 차이0 | nonmodule-technical-qa.json |
| 그루터기 알파 | growing과 차이0 | nonmodule-technical-qa.json |
| 헛간 규격 | 3종160×136, 피벗80,120 | asset-contracts.json |
| 확대·축소 확인 | 줌1/.6, 허들1.35 추가 | proofs3장 직접 확인 |
| 동물 내용 | 왼쪽 진행2소+농부+쟁기, 건초수레, 양5, 젖소2 확인 | proof03 실제 알파 합성 |
| 원본·CSV SHA 및 프롬프트 | 대조 통과 | package-validation.json |
| 게임 미설치 | 후보 폴더만 작성 | README |

## 육안 한계

헛간의 작은 마당 도구와 working의 소품 차이는 줌0.6에서 약합니다. 과수I/J는 기존4b보다 잎 묘사가 조밀합니다. G/H는 서로 다른 구조이나 둘 다 낮고 넓은 계열입니다. 허들 기존N과 신규 코너의 붓질 밀도 차이가 확대 검사에 보입니다. 위 항목을 미술적 최종 승인으로 간주하지 않습니다.

참조 불일치(과수4종, 창고 점유2×2, fallow알파)는 README에 별도 기록했습니다. 동물의 숨은 RGB는 실제 투명 합성에서 보이지 않습니다. 게임의 모든 방향·겹침·통행·프레임 성능은 미검증입니다.
