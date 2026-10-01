# Wave 38 재작업 + Wave 40 영주 사건 후보

게임 미설치, 원본 보존. 내장 image_gen으로 개별 제작·편집했습니다.

- wave38-rework/assets: 요청된 PNG 5장만. 주버튼4는 짙은 oak, tab_hover는 selected보다 어둡게. 기존128×40/alpha/9slice 유지.
- wave40/assets: 의뢰서 순서01–14, 사건 JPG14장, 전부960×540.
- wave40/contact-sheet.jpg: 14장 전체 확인 그림1장. 제목은 확인 그림에만 있고 개별 사건 JPG에는 없습니다.
- wave38-rework/comparison.jpg와9slice-proof.png: 전후·보조/선택 비교 및 Chrome 실제 납품PNG 9slice 렌더. 확인용 글자는15px. 주버튼 글자색은 밝은 양피지(#f1e4c6) 권장.
- 각 폴더 assets.csv, QA_CHECKLIST.md, qa/, provenance/generations.json: 명세·검수·정확한 프롬프트·참조·생성원본 경로/해시·처리 기록.
- reference/는 생성참조 또는 비교용 기존 이미지로 신규 후보가 아닙니다. wave40/revision-reference는13번 수정 전 검수 이력이며 최종 납품본이 아닙니다. 실제 사용할 후보는 각 assets/뿐입니다.

경량화를 위해 큰 생성원본PNG는 ZIP에서 제외했습니다. 사용한 두 화풍참조는 원본 그대로 포함했습니다. 생성원본은 기록의 로컬 경로에 보존했습니다. 후보의 시각·파일 검수이며 게임 카드 연결/런타임 렌더링/이벤트 전환은 미검증입니다.
