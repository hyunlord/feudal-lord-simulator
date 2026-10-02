# Steam 그래픽 규격

조사일: 2026-10-02. Valve Steamworks 공식 공개 문서를 직접 조회했다. 아래는 **업로드 원본 규격**이다. 로그인된 Steamworks 업로드·심사·실제 클라이언트 표시는 검증하지 않았다.

**이전 시안의 460×215 헤더와 616×353 메인 캡슐은 현재 업로드 크기가 아니다.** 현재는 각각 **920×430**, **1232×706**이다. 두 축 모두 2배다. 공식 개요에는 2024년 8월 변경 안내와 함께 구규격을 더 이상 받지 않는다고 명시되어 있다. 기존 작은 시안은 비교용으로 보존하고 원본 그림과 벡터 로고에서 새 크기로 출력해야 한다. [공식 개요](https://partner.steamgames.com/doc/store/assets)

## 스토어

| 항목 | 원본 크기(px) | 필수 | 용도·조판 기준 | 형식·투명도 | 공식 근거 |
|---|---:|---|---|---|---|
| 헤더 캡슐 | 920×430 | 필수 | 상점 상단·추천·Big Picture·일일 특가; 제목 가독성 | 공개 상세문서에 확장자·알파 규정 미명시 | [Header](https://partner.steamgames.com/doc/store/assets/standard) |
| 소형 캡슐 | 462×174 | 필수 | 검색·판매순위·신작 목록; 자동 축소 120×45·184×69에서도 제목 식별 | 공개 상세문서에 확장자·알파 규정 미명시 | [Small](https://partner.steamgames.com/doc/store/assets/standard) |
| 대형/메인 캡슐 | 1232×706 | 필수 | 상점 첫 화면 회전 배너 | 공개 상세문서에 확장자·알파 규정 미명시 | [Main](https://partner.steamgames.com/doc/store/assets/standard) |
| 수직 캡슐 | 748×896 | 필수 | 계절 할인·판매 페이지 | 공개 상세문서에 확장자·알파 규정 미명시 | [Vertical](https://partner.steamgames.com/doc/store/assets/standard) |
| 상점 페이지 배경 | 1438×810 | 선택 | 콘텐츠를 방해하지 않는 은은한 그림; 미제공 시 마지막 스크린샷으로 생성 | 공개 상세문서에 확장자·알파 규정 미명시 | [Background](https://partner.steamgames.com/doc/store/assets/standard) |
| 스크린샷 | 최소 1920×1080, 16:9 | 필수, 최소 5장 | 실제 게임 플레이; 로고 합성 시안·콘셉트아트로 대체 불가 | 공개 상세문서에 일반 확장자·알파 규정 미명시 | [Screenshots](https://partner.steamgames.com/doc/store/assets/standard) |

위 스토어 항목에는 숫자로 된 공통 안전영역이 공개 본문에 없다. 임의 여백을 Valve 요구사항으로 제시하지 않는다. 실제 제작에는 같은 페이지가 연결한 최신 템플릿을 사용한다. 캡슐 확장자에 대한 미명시는 업로드 불가라는 뜻이 아니라 이번 공식 근거에서 확인하지 못했다는 뜻이다.

## 라이브러리

| 항목 | 원본 크기(px) | 필수 | 용도·안전영역 | 형식·투명도 | 공식 근거 |
|---|---:|---|---|---|---|
| 라이브러리 캡슐 | 600×900 | 필수 | 보관함·컬렉션; 300×450 자동 생성 | 자동 생성본 PNG; 원본 확장자·알파 규정 미명시 | [Library capsule](https://partner.steamgames.com/doc/store/assets/libraryassets) |
| 라이브러리 헤더 | 920×430 | 필수 | 최근 게임 등; 미지정 시 스토어 헤더 사용 | 공개 상세문서에 확장자·알파 규정 미명시 | [Library header](https://partner.steamgames.com/doc/store/assets/libraryassets) |
| 라이브러리 히어로 | 3840×1240 | 필수 | 상세 상단; **문자 금지**. 본문상 템플릿 중앙 안전영역 860×380. 1920×620 자동 생성 | PNG; 투명도 요구 미명시 | [Library hero](https://partner.steamgames.com/doc/store/assets/libraryassets), [PNG 명시](https://partner.steamgames.com/doc/store/assets) |
| 라이브러리 로고 | **너비 1280 및/또는 높이 720** | 필수 | 제목+선택적 심벌; 업로드 후 위치 선택 | **투명 PNG** | [Library logo](https://partner.steamgames.com/doc/store/assets/libraryassets) |

라이브러리 로고는 무조건 1280×720 직사각형을 채우라는 뜻이 아니다. 로고 비율을 유지하면서 지정된 한 축 이상을 맞춘다. 히어로와 로고는 별도 레이어다. 안전영역 860×380은 공식 본문 표기 그대로이며, 2배 환산값을 공식 규격으로 단정하지 않았다. 그 외 라이브러리 항목의 수치 안전영역은 공개 본문에 미명시다. [라이브러리 상세](https://partner.steamgames.com/doc/store/assets/libraryassets)

## 작은 아이콘과 배포용 구분

| 항목 | 원본 크기(px) | 필수 | 형식·투명도·용도 | 공식 근거 |
|---|---:|---|---|---|
| 바탕화면 바로가기 아이콘 | 256×256 또는 512×512 | 필수 | ICO 또는 PNG; PNG로 ICO 생성 가능 | [Shortcut Icon](https://partner.steamgames.com/doc/store/assets/community) |
| 앱 아이콘 | 184×184 | 필수 | JPG; 라이브러리 목록·채팅·알림. 바로가기 아이콘에서 생성하면 알파가 검정으로 바뀜 | [App Icon](https://partner.steamgames.com/doc/store/assets/community) |
| macOS 바로가기 아이콘 | 공개 문서에 크기 미명시 | macOS 아이콘 표시 시 별도 필요 | ICNS; 없으면 Steam 기본 아이콘 사용 | [Mac Icon](https://partner.steamgames.com/doc/store/assets/community) |

요청한 32·64·256px 봉랍 아이콘 중 32·64px는 브랜드 소형 표시·가독성 검수용이다. Steam의 별도 필수 업로드 크기라고 표시하지 않는다. 256px PNG는 바로가기 아이콘 크기와 맞지만, 앱 아이콘 슬롯에는 별도로 184px JPG를 준비해야 한다.

## 콘텐츠 규칙과 확인 범위

기본 캡슐은 게임 그림·게임명·공식 부제 중심으로 구성한다. 리뷰점수, 수상마크, 할인 문구, 구매·위시리스트 유도 문구와 다른 상품 홍보는 넣지 않는다. 라이브러리 로고에는 게임명 외 문구를 넣지 않으며 인장 심벌을 함께 둘 수 있다. 히어로는 문자 없이 출력한다. [공식 그래픽 규칙](https://partner.steamgames.com/doc/store/assets/rules)

이 문서는 기본 게임의 요청된 상점·라이브러리·로고·배경과 관련 아이콘 목록이다. 번들·이벤트별 조건부 그래픽과 동영상 규격은 별도 범위다. 공식 문서 원문 스냅샷은 `research/steam/`에 보관했다. 배포 직전 같은 공식 URL과 실제 Steamworks 슬롯에서 재확인한다.
