# Charter & Kin / 인장과 가문 — vector identity v1

사용자 확정 명칭. 원본 래스터를 자동 추적하지 않고 봉랍과 참나무 잎을 새 Bézier 도형으로 제작한다. 화풍은 손그림 원화와 함께 놓을 수 있는 절제된 인쇄 표장. 프런트엔드 스킬의 design 라우터와 minimalist 조판 참고를 적용하되 웹 UI 구성/React 규칙은 비적용.

## 명칭·서체
- English: Charter & Kin, EB Garamond SemiBold, wght=600. 원제 대소문자 보존.
- 한국어: 인장과 가문, Noto Serif KR SemiBold, wght=600.
- 모두 SIL Open Font License 1.1. 폰트 실파일은 경량 패키지에서 제외하고 정확 다운로드 경로/해시/라이선스를 제공. outlines는 폰트 설치 없이 사용 가능.

## 색
- 밝은 바탕 글자: oak #493522. 어두운 바탕 글자: parchment #F7E8CD.
- 봉랍: #934631, 음영 #693726, 내면 #AB5B3D. 인장 테두리/잎: #D9B875.
- 비교 배경: light #F3EBDD / dark #242A26.

## 형태
- 불규칙한 둥근 봉랍 외형, 간결한 2중 압인, 참나무 잎 한 장.
- 가로형 1200×280; 세로형 720×640.
- 32px에서는 잎맥의 보조선을 생략한 optical-small 아이콘. 64/256은 표준 인장.
- 도형·문자·규칙선은 SVG의 의미 있는 ID 그룹으로 분리. image/filter/foreignObject/bitmap 없음.

## 납품 규칙
- 언어 2 × 형태 2 × 대비 2 × live-text/outlined 2 = 로고 SVG16개.
- transparent SVG + preview PNG/JPEG. on-light/on-dark는 글자 대비 변형이며 로고 자체 배경은 투명.
- 인장 아이콘 SVG/PNG 각 6개: 32/64/256 × on-light/on-dark.
- 변경 가능 SVG는 text요소, 윤곽 SVG는 glyph path. 원본 그림의 픽셀 일치가 아닌 벡터 재조판.

## 검수
- 외부 이미지 참조 없음, 윤곽판 text요소0, live-text 문자열과 지정 family/weight 확인.
- 알파 경계/크기, 실제32/64/256 판독, 밝고 어두운 바탕 비교.
- 두 SVG판의 글자와 배치 일치 확인; 서체 미설치 시 live-text는 대체서체가 되므로 설치 필요.
