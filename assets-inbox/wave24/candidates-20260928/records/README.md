# Wave 24 — Steam 상점·라이브러리 그림 후보

필수 원화 **10 PNG**, 같은 크기의 안전 영역 가이드 **10 PNG**, 확인 그림 **2 PNG**, 앱 아이콘 호환용 **1 JPG**, 생성 기록 **CSV 21행**이다. 선택 항목인 시대 변주 3장은 제외했다. 게임 설치·Steam 업로드는 하지 않았다.

## 먼저 볼 그림

1. [캡슐 실제 크기·120×45 축소 확인](proofs/01-capsules-size-check.png)
2. [라이브러리 UI 가림 모의](proofs/02-library-mock.png)

확인 그림 1을 100%로 열면 메인·헤더·소형·세로·라이브러리 캡슐이 납품 픽셀 크기로 놓여 있다. 120×45·184×69·231×87에는 그림 단독, 임시 영문 제목, 임시 한글 제목을 나란히 뒀다. 제목은 스크립트가 시스템 글꼴로 얹은 검수용이며 `assets/` 원화에는 없다.

## 원화

| 그림 | 크기 | 구도 |
|---|---:|---|
| [헤더](assets/steam_header_capsule.png) | 920×430 | 왼쪽 영주·도시, 오른쪽 40% 여백 |
| [작은 캡슐](assets/steam_small_capsule.png) | 462×174 | 단순화한 도시 실루엣, 오른쪽 60% 여백 |
| [메인](assets/steam_main_capsule.png) | 1232×706 | 넓은 도시, 상단 1/3 제목 공간 |
| [세로](assets/steam_vertical_capsule.png) | 748×896 | 영주 전신과 아래 도시 |
| [라이브러리 캡슐](assets/steam_library_capsule.png) | 600×900 | 문장 깃발을 든 영주 |
| [히어로](assets/steam_library_hero.png) | 3840×1240 | 글자·로고 없는 파노라마 |
| [엠블럼](assets/steam_library_logo_emblem.png) | 1280×720 | 방패·성벽 탑·밀 이삭, 투명 |
| [페이지 배경](assets/steam_page_background.png) | 1438×810 | 어두운 양피지와 낮은 대비 지도 |
| [앱 아이콘 PNG](assets/steam_app_icon.png) | 184×184 | 같은 엠블럼 축소 |
| [바로가기 아이콘](assets/steam_shortcut_icon.png) | 256×256 | 같은 엠블럼, 투명 |

앱 아이콘은 [JPG 파생본](exports/steam_app_icon.jpg)도 제공한다. Steam 공식 문서의 JPG 요구에 맞춰 어두운 중성 배경에 합성했다. PNG·가이드 각각 한 행과 JPG 한 행을 CSV에 기록했다. 확인 그림은 원화 행에 포함하지 않는다.

## 사용·검수 구분

- 캡슐들은 한 그림을 잘라내지 않고 비율마다 재구성했다. 두 아이콘만 동일 엠블럼에서 축소했다.
- `guides/`는 확인 전용이다. 파란 상자는 제목 여백, 황토 상자는 UI 가림 또는 이미지 본체 영역이다. 아이콘·엠블럼에는 제목을 얹으라는 의미가 아니다. 좌표와 구분은 `records/safe-zones.json`에 있다.
- 히어로는 **2152×731 생성 원본을 확대·상하 소폭 정리한 3840×1240**이다. 네이티브 4K로 생성됐다고 주장하지 않는다. 붓질의 부드러움과 수정 이력은 기록에 남겼다.
- 생성 초안의 굴뚝은 교정했다. 최종 검수와 작은 화면에서의 한계는 [검수표](QA.md)에 기록했다.
- 엠블럼의 알파 바깥은 실제 투명이다. 밝은/어두운 배경 합성에서 눈에 띄는 번짐은 없었다. 극저알파의 잔여 RGB는 검수 기록에 공개했다.
- 라이브러리 확인 그림은 오프라인 합성이다. 실제 Steam 클라이언트의 모든 창 크기·패럴랙스, 게임 런타임은 검증하지 않았다.

## 기록과 경량화

`generation-records.csv`에는 파일·크기·파생 관계·검수·SHA256이 있다. `records/wave24-*.json`에는 실제 프롬프트·참조·교정 시도가 있다. 도구가 알려주지 않은 모델 버전·seed는 기재하지 않았다. `records/steam-spec-check.md`에는 현재 공식 규격 확인 출처가 있다.

경량 ZIP에서는 큰 생성 원본과 반려 시도 PNG를 제외했다. 최종 PNG는 무손실로 유지했다. 원본은 `/Users/rexxa/feudal-lord-analysis/astra-raw/wave24-20260928/`에 따로 보존하며, `records/raw-manifest.json`으로 출처·크기·해시를 추적할 수 있다. ZIP의 `SHA256SUMS`와 `PACKAGE-CHECK.json`으로 납품 파일을 확인한다.

공식 규격 출처: [상점 그림](https://partner.steamgames.com/doc/store/assets/standard?l=english), [라이브러리](https://partner.steamgames.com/doc/store/assets/libraryassets?l=english), [아이콘·배경 개요](https://partner.steamgames.com/doc/store/assets?l=koreana&language=english).
