# Wave 24 후처리 (processed-20260928)

Astra가 납품한 Wave 24(`wave24/candidates-20260928`) 가운데 네 장을 후처리했다. 이 폴더의 그림이 원래 그림을 대신하고, 원래 행은 장부에서 `superseded`다. 세부 값과 해시는 [`processing.json`](processing.json)에 있다.

## 히어로 `steam_library_hero.png` (3840×1240)
- **입력**: Astra가 고른 생성 원본 `hero-native-v4.png`(2152×731). 저장소 밖 `~/feudal-lord-analysis/astra-raw/wave24-20260928/`에 있다.
- **처리**
  1. Real-ESRGAN `RealESRGAN_x2plus`(공식 v0.2.1 가중치)로 2배 확대했다(DGX GPU, 4초). 결과는 4304×1462.
  2. Lanczos로 3840×1240에 맞췄다(cover·가운데). 구도는 납품본과 같다: 위아래 32 px를 잘랐고, 납품본도 64 px를 잘랐다.
- **비교**: [`../proofs/hero-upscale-comparison-100pct.jpg`](../proofs/hero-upscale-comparison-100pct.jpg). 영주와 개, 교회와 장터, 다리와 배를 100%로 잘랐고, 왼쪽이 납품본(단순 확대), 오른쪽이 새 것이다.
  - **나아진 점**: 울타리 기둥·창·인물 윤곽 같은 가장자리가 또렷하다.
  - **나빠진 점**: 나무 잎·망토 무늬·물결의 붓 자국이 매끈하게 뭉개진다. 에어브러시처럼 보인다.
  - 네이티브 4K가 아니라는 점은 그대로다.
- **중간본**: 4304×1462는 저장소에 넣지 않고 `astra-raw/wave24-20260928/processed-20260928/`에 두었다.

## 엠블럼·아이콘 투명도 정리
- 대상: `steam_library_logo_emblem.png`(1280×720), `steam_app_icon.png`(184×184), `steam_shortcut_icon.png`(256×256).
- 처리: 알파 8 미만 픽셀을 RGBA (0,0,0,0)으로 바꿨다. 바뀐 픽셀은 각각 16,541 · 1,052 · 1,761이고, 모두 알파 1~7에 RGB가 남아 있던 픽셀이다.
- 알파 8 이상 픽셀은 바이트 단위로 같다(스크립트가 확인한다).
- PNG 부가 청크(C2PA 등)는 새로 저장하면서 빠졌다. 받은 바이트는 `candidates-20260928`에 그대로 있다.
- 앱 아이콘 JPG(`candidates-20260928/assets/exports/steam_app_icon.jpg`)는 어두운 배경에 합성한 파생본이라 알파가 없다. 바꾸지 않았다.
