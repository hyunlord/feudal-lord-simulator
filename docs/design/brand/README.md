# Charter & Kin / 인장과 가문

2026-10-02 · 정식 명칭을 적용한 벡터 마스터 v1.

가장 먼저 `previews/BRAND-BOARD.jpg`를 열면 영문·한글 가로/세로 조판과 밝고 어두운 배경, 실제 32·64·256px 아이콘을 비교할 수 있다.

## 포함 파일

| 요청 | 결과 |
|---|---|
| 편집 가능한 정식 벡터 | 로고 SVG16개: 언어2 × 가로/세로2 × 밝은/어두운용2 × 문자/윤곽2 |
| 투명 래스터 파생본 | 로고 PNG8개. 벡터에서 렌더링했으며 생성 래스터가 아님 |
| 작은 인장 | 아이콘 SVG6개 + 투명 PNG6개: 32·64·256px × 대비2 |
| 배경 비교 | JPEG9개: 개별 조판8개 + 전체 보드1개 |
| 무료 상업 서체 | FONT_LICENSES.md, OFL 원문2개, 정확 다운로드 링크·폰트 해시 |
| 상표 사전 조사 | TRADEMARKS.md, 4개 등록부 세부표·실조회 캡처·응답 |
| Steam 공식 규격 | STEAM_SIZES.md, 2026-10-02 공식문서 스냅샷 |
| 검증·출처 | QA.md, provenance/, SHA256SUMS |

## 사용할 파일

- `logos/charter-kin-en-horizontal-on-light-outlined.svg`: 밝은 바탕용 영문 가로 로고.
- `logos/charter-kin-ko-horizontal-on-dark-outlined.svg`: 어두운 바탕용 한글 가로 로고.
- `horizontal`을 `vertical`로 바꾸면 세로형.
- `outlined`판은 글자가 path라 폰트 없이 동일 형태. `text`판은 이름·서체명·굵기가 명시된 실제 text요소라 문자 편집 가능.
- SVG와 PNG 로고 자체에는 바탕을 넣지 않았다. `on-light`는 짙은 참나무색 문자, `on-dark`는 양피지색 문자다. JPEG 비교판만 배경색이 있다.
- 아이콘은 `icons/seal-{32,64,256}-on-{light,dark}.{svg,png}`. 32px은 보조 잎맥을 생략한 소형 전용 형태다.
- SVG의 `wax-seal`, `wax-edge`, `pressed-rim`, `oak-impression`, `wordmark` 그룹/ID를 통해 인장과 글자를 따로 수정할 수 있다.

## 제작과 검증

이전 봉랍·참나무잎 아이디어를 유지하고 도형을 새 Bézier 경로로 그렸다. 영문 EB Garamond 600, 한글 Noto Serif KR 600의 실제 glyph 윤곽을 CoreText로 추출했다. 이미지 자동 추적, 생성형 이미지, SVG 내부 bitmap은 사용하지 않았다. 파일 내부에 서체명과 OFL1.1 메타데이터를 남겼다.

원본 전체 폰트는 패키지 용량 때문에 제외했다. outlined판은 폰트가 필요 없고, text판 편집은 FONT_LICENSES.md의 공식 링크에서 무료 폰트를 받아 설치한다. 서체 대체가 일어나면 글자 모양이 바뀌므로 윤곽판을 배포 마스터로 권한다.

로고 구조 검사, 14개 투명 PNG의 크기·알파 검사, 독립 시각검수 두 건, Chrome에서 문자판/윤곽판 8쌍의 실제 렌더와 잘림 검수를 수행했다. 세부 결과는 QA.md. 상표 사전조사는 사용 허가 판정이 아니며, UK IPO와 도형 선행조사 등 미확인 범위는 별도 표시했다.

지정 저장소의 원본·게임 자산은 변경하지 않았다. 커밋·푸시·게임 설치·상표 출원·Steam 업로드 없음. 제작 코드는 재현 이력용이며 현재 세션의 macOS 및 작업 경로를 사용한다. SVG 자체를 편집하는 데 이 코드를 실행할 필요는 없다.

## 무결성

압축 해제한 이 폴더에서 `shasum -a 256 -c SHA256SUMS`로 모든 납품 파일을 검증한다. SHA256SUMS 자체는 자체 해시에 포함하지 않는다.
