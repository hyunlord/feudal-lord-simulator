# UI 글꼴 출처 (UX-2)

| 글꼴 | 쓰는 곳 | 굵기 | 배포 경로 | 버전 | 라이선스 |
|---|---|---|---|---|---|
| Noto Sans KR | 본문 전체(`--ui-font-sans`) | 400, 700 | npm `@fontsource/noto-sans-kr` → Google Fonts Noto Sans KR | 5.3.0 (고정, `package.json`) | SIL Open Font License 1.1 — [`OFL-NotoSansKR.txt`](OFL-NotoSansKR.txt) |
| Noto Serif KR | 제목·목표 카드 제목·청지기 대사·날짜·환영 제목·지도 표지판(`--ui-font-serif`) | 600 | npm `@fontsource/noto-serif-kr` → Google Fonts Noto Serif KR | 5.3.0 (고정) | SIL Open Font License 1.1 — [`OFL-NotoSerifKR.txt`](OFL-NotoSerifKR.txt) |

- 저작권자: Google Inc.(Noto 프로젝트). 라이선스 전문은 패키지의 `LICENSE`를 그대로 복사했다. 게임 빌드에도 같은 파일을 `public/licenses/fonts/`로 싣는다.
- 글꼴 파일은 저장소에 넣지 않는다. `npm ci`가 받은 패키지의 woff2/woff를 Vite가 빌드에 넣는다(유니코드 구간별 분할 파일, 화면에 쓰인 글자의 구간만 내려받는다).
- 불러오는 곳: `src/main.tsx`(`@fontsource/noto-sans-kr/400.css`, `700.css`, `@fontsource/noto-serif-kr/600.css`). 이름을 바꾸거나 수정하지 않았다(OFL 조건 "예약된 글꼴 이름" 준수).
- 글꼴이 아직 오지 않았거나 없으면 `Apple SD Gothic Neo` → `Malgun Gothic` → 시스템 글꼴 순으로 대신한다.
