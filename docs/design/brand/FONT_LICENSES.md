# 서체와 라이선스

2026-10-02 공식 Google Fonts 배포 파일 및 라이선스 확인. 로고는 유료 서체를 사용하지 않았다.

| 사용 | 서체 / 굵기 | 권리 표기 | 라이선스 | 공식 원본 |
|---|---|---|---|---|
| Charter & Kin 영문 | **EB Garamond SemiBold**, variable `wght=600` | Copyright 2017 The EB Garamond Project Authors | **SIL Open Font License 1.1** | [서체 폴더](https://github.com/google/fonts/tree/main/ofl/ebgaramond), [TTF](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/OFL.txt) |
| 인장과 가문 한글 | **Noto Serif KR SemiBold**, variable `wght=600` | Copyright 2012 Google Inc. All Rights Reserved. | **SIL Open Font License 1.1** | [서체 폴더](https://github.com/google/fonts/tree/main/ofl/notoserifkr), [TTF](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/OFL.txt) |

OFL은 상업 디자인과 로고 제작·윤곽선 사용을 허용한다. 폰트로 만든 로고 자체를 OFL로 공개할 의무는 없다. 폰트 파일 자체를 재배포하거나 수정할 때는 OFL의 별도 조건을 따른다. 이 구분은 [OFL 공식 FAQ 1.1–1.1.2 및 1.13](https://openfontlicense.org/ofl-faq/)에 따른다. 폰트의 사용 허락과 **게임명·로고의 상표 사용 가능성은 별개**다.

## 편집 방법

- `*-text.svg`: 실제 `<text>` 요소가 있는 판. 위 무료 폰트를 설치한 뒤 Inkscape·Illustrator 등에서 편집한다. `font-family`, `font-weight="600"`, `font-variation-settings`를 SVG에 명시했다.
- `*-outlined.svg`: 글자를 실제 폰트 glyph에서 추출한 Bézier `<path>`로 바꾼 판. 폰트를 설치하지 않아도 형태를 유지한다. 인장과 글자는 ID가 있는 별도 그룹이다.
- 경량 ZIP에는 23MB 한글 전체 폰트를 넣지 않았다. 공식 다운로드 링크와 원문 라이선스 2개를 제공한다. SVG에 폰트나 비트맵을 몰래 포함하지 않았다.
- 문자판은 100단위 글자와 그룹 배율로 조판했다. 한글 가로판은 운영체제별 공백 폭 차이를 피하도록 두 단어의 시작 위치를 tspan으로 고정했다. 문구 변경 시 단어 위치와 그룹 배율을 함께 조정한다.
- 외부 서체 없이 누구에게나 같은 모양으로 전달하려면 outlined판을 사용한다. 문자열을 고치려면 text판을 사용한다.

## 사용 파일 식별

| 파일 | SHA-256 |
|---|---|
| EBGaramond[wght].ttf | `ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027` |
| NotoSerifKR[wght].ttf | `11f8d5de6f1b79195efba3828aaa2ec95c1178f5ae976fb23c8d53250a9938f3` |

사용한 가변축 값은 두 폰트 모두 600이며 CoreText에서 실제 적용값을 확인했다. 합성 굵기나 타 폰트 대체 없이 글자 경로를 추출했다. 생성 파일은 `provenance/glyph-outlines.json`, 추출 코드는 `outline.swift`에 보관했다. 폰트 파일은 이 세션의 `/tmp/charter-kin-work-20261002/fonts/`에도 보존되어 있다. 공식 main 배포 파일은 앞으로 변경될 수 있으므로 재현 시 위 해시와 비교한다.
