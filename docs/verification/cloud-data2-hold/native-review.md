# CLOUD DATA v2 독립 native 시각 검토

**DATA VISUAL FAIL — 승인된 .12에서 그림자 판독 미통과. v2 원래 exit1/오류8은 그대로 보존한다.**

실제 DATA `66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b` / CORE `cd24d50c5ff3f7df35fbf1849d11da67cfd137b9`, run `astra-cloud2-data-v2-66b8e1e`. actual v2는 transform double/Float32 oracle 오류로 실패했다. 이 시각 검토나 사후 픽셀 검산은 원래 실행을 PASS로 바꾸지 않는다.

원본 1280×800/DPR1의 after10과 같은 이름 before10을 **각각 모두** image tool original 모드로 열었다. 확대 crop·대비/알파 보정·합성 없이 살폈다. 원본 source2도 변환 없이 열었으며 도구의 투명 배경 표시는 런타임 배경이 아니다. 정확한 20경로/각 SHA, repeat PNG경로·SHA, 원본2/public 일치 및 전체 수치는 [동명 JSON](native-review.json)에 있다.

## 뷰별 판정

| 실제 PNG 이름 | 판정 | 관찰 |
|---|---|---|
| `summer-normal-z1-t0.png` | FAIL_UNREADABLE | 상단 중앙 바위·빽빽한 숲, 좌하단 잔디, 우하단 지붕에서 새 구름의 독립된 윤곽/중심을 안정적으로 찾지 못함. 풍경은 보이지만 구름 그림자 판독은 실패. |
| `summer-normal-z1-t5000.png` | FAIL_UNREADABLE | 상단 중앙 바위·빽빽한 숲, 좌하단 잔디, 우하단 지붕에서 새 구름의 독립된 윤곽/중심을 안정적으로 찾지 못함. 풍경은 보이지만 구름 그림자 판독은 실패. |
| `summer-normal-z06-t0.png` | FAIL_UNREADABLE | 전체 지도와 수면·좌하단 열린 잔디가 드러나지만 숲/지형 명암과 분리되는 새 그림자 실루엣을 읽지 못함. 축소뷰에서 두 deck을 구별할 수 없음. |
| `summer-normal-z06-t5000.png` | FAIL_UNREADABLE | 전체 지도와 수면·좌하단 열린 잔디가 드러나지만 숲/지형 명암과 분리되는 새 그림자 실루엣을 읽지 못함. 축소뷰에서 두 deck을 구별할 수 없음. |
| `winter-normal-z1-t0.png` | FAIL_UNREADABLE | 좌측 밝은 겨울 공터와 우측 숲/눈 덮인 지붕을 비교해도 새 그림자 가장자리/중심이 확실하지 않음. 원래 지면 타일 명암과 구별할 수 없음. |
| `winter-normal-z1-t5000.png` | FAIL_UNREADABLE | 좌측 밝은 겨울 공터와 우측 숲/눈 덮인 지붕을 비교해도 새 그림자 가장자리/중심이 확실하지 않음. 원래 지면 타일 명암과 구별할 수 없음. |
| `winter-normal-z06-t0.png` | FAIL_UNREADABLE | 넓은 밝은 겨울 벌판과 아래 수면이 보이나 구름 형태가 확실히 읽히지 않음. 희미한 넓은 명암을 새 구름이라고 특정할 수 없음. |
| `winter-normal-z06-t5000.png` | FAIL_UNREADABLE | 넓은 밝은 겨울 벌판과 아래 수면이 보이나 구름 형태가 확실히 읽히지 않음. 희미한 넓은 명암을 새 구름이라고 특정할 수 없음. |
| `spring-wet-negative-z1-t0.png` | 참_NEGATIVE_PRESERVED | 비 줄기와 지면 파문, 바위·숲·건물은 전후 동일하게 보임. 새 구름 그림자나 추가 화면 손상은 관찰하지 못함. |
| `summer-off-negative-z1-t0.png` | 참_NEGATIVE_PRESERVED | weatherFx-off의 여름 바위·숲·집·잔디가 전후 동일하게 보임. 새 구름 그림자나 추가 화면 손상은 관찰하지 못함. |

## 판독과 수치의 분리

여름 줌1은 바위·숲·잔디/지붕, .6은 전체 지도·수면/넓은 풀밭을 확인했다. 겨울은 밝은 열린 지면이 넓어도 새 구름의 명확한 실루엣·중심·이동을 안정적으로 식별할 수 없었다. t0→5000 두 정지 화면의 희미한 명암 차이를 구름 이동이라고 특정하지 못한다. 비/눈/수면/나무의 원래 시간 변화도 있으므로 전체 phase pixel delta를 cloud motion으로 읽지 않는다.

따라서 양성8뷰의 가독성은 FAIL, 원본 비율·중심·이동의 육안 판정은 UNCERTAIN이다. 뚜렷한 새 사각 절단·심한 띠는 보이지 않았으나 거의 보이지 않는 그림자에 정밀 banding/clipping PASS를 줄 수 없다. 음성 wet/off2는 새로운 이상이 보이지 않으며 exact RGBA 보존도 확인했다. 이전 CORE old2 역시 미세했으므로 baseline 구름 가독성이 이미 통과했다고 소급하지 않는다.

Pillow/NumPy로 파일을 새로 저장하지 않고 전체 RGBA를 독립 복호화했다: DATA A/A10/10, CORE A/A10/10 일치; positive8 before→after 변경, negative2 exact 동일. 원래 raw75 SHA도 모두 일치했다. 이는 반복 안정성·변경 존재의 증거이고 시각 판독의 대체물이 아니다.

- `summer-normal-z1-t0`: A/B changed 143,797px / max channel 17; DATA A/A0px.
- `summer-normal-z1-t5000`: A/B changed 135,515px / max channel 15; DATA A/A0px.
- `summer-normal-z06-t0`: A/B changed 213,539px / max channel 16; DATA A/A0px.
- `summer-normal-z06-t5000`: A/B changed 236,321px / max channel 16; DATA A/A0px.
- `winter-normal-z1-t0`: A/B changed 152,751px / max channel 19; DATA A/A0px.
- `winter-normal-z1-t5000`: A/B changed 144,418px / max channel 20; DATA A/A0px.
- `winter-normal-z06-t0`: A/B changed 222,595px / max channel 19; DATA A/A0px.
- `winter-normal-z06-t5000`: A/B changed 244,005px / max channel 20; DATA A/A0px.
- `spring-wet-negative-z1-t0`: A/B changed 0px / max channel 0; DATA A/A0px.
- `summer-off-negative-z1-t0`: A/B changed 0px / max channel 0; DATA A/A0px.

원본 source2는512×256, peak alpha35, source/public SHA 동일. 기존 alpha.12에서는 단일 deck peak35/255×.12≈1.65%다. 계획 §1/§6/§7은 미세한 수치차만 있고 식별되지 않으면 DATA 미통과로 남기도록 명시한다. 이번 판정은 그 기준을 적용했다. trace상 정상2:1·중심/이동 수치는 별도 source/native-blit 증거이며 이번 육안 확인으로 대신 인증하지 않는다.

## 권고와 범위

**DATA2 시각 승인을 보류한다.** 알파 증폭·원본 편집·날씨 조건 변경으로 통과시키지 않는다. renderer/원본/.12/카메라가 같고 oracle만 고치는 v3는 이 가독성 문제를 해결하지 못하므로, 가독성을 해결하기 위한 동일 캡처 재실행은 필요하지 않다. 차후 제품·그림 계약 판단은 부모에게 넘긴다. v2 실패 원본과 모든 raw는 유지한다.

이 작업은 리뷰 MD/JSON만 작성했다. 제품·harness·raw·원본·장부·DGX·브라우저 실행·이미지 생성/재저장0.
