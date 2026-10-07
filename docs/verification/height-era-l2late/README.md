# RB-HEIGHT-ERA-L2LATE — 로컬 설치 준비

집중 시험 44개와 타입·공용 소비자 범위 린트가 통과했다. 실제 게임 캡처, 기하 감사, 본선 게시는 아직 수행하지 않았다. 기준 본선은 `a666482cfad68a49ab66b5472e5500e7863053df`이다.

## 설치 범위

원본 I0003 `era-pilot/candidates-20261003/assets/houses/house_l2_1420.png` 한 계열에 본체·눈·일반 판자·strained·neglected·vacant·plague-shut 7 PNG를 등록했다. 7개의 원본 종류 또는 기존 23문 교정의 추가 완료로 세지 않는다. 공용 소비자·엔진·저장·UI 코드는 바꾸지 않았다.

선택 조건은 기존 URL `assets/buildings/historical-houses/house_l2-v2.png`, 집, 표시 등급 2, 단독 필지, 기존 적격 판정, 1400년 이후의 교집합이다. 우선순위 110으로 이 경우에만 기존 Wave20 등록을 대체한다. 관리층 → 판자층 → 눈의 순서와 필요한 이미지 전체 준비 후 전환하는 기존 원자성을 재사용한다. 화재·전소는 기존 fallback 범위이며 새 그림을 추가하지 않았다.

7장 모두 137×244, 피벗 `(70.95813397129186, 211.08373205741626)`, 배율 `0.4980801861842801`, 발판 1×1이다. 위 여백 15와 피벗 보정으로 이전 후보에서 잘리던 낮은 alpha 픽셀을 보존했다. 공개 PNG와 inbox 승인 PNG는 받은 후보 바이트와 같다.

## 출처와 정적 한계

inbox `height-era-l2late/candidates-20261008/records/`에 제작 manifest·본문/레이어 인계·padding 좌표 검증을 보존했다. 원시 생성물과 정확한 prompt의 정본은 외부 `/tmp/astra-height-era-l2late-candidates-20261008/`에 있다. 원시→등록 재현은 제작에 쓰인 **ffmpeg swscale Lanczos**로 7장 RGBA가 일치했다(PIL 재현이 아님). 부모 검증에서 원본 SHA 목록 100개와 실제 파일집합도 정확히 일치했다. 해당 독립 검증 파일은 아래 외부 준비 폴더에 보존했다.

문은 native 약 45×21, 끝점 불확실성 ±2이며 폭 상한에서 0.01584 world 잔차가 남는다. 발판 최대 잔차 6.32 native, 더 밝고 규칙적인 기와, vacant의 새 지붕처럼 보일 수 있는 패치와 밝은 회벽 손상은 남은 시각적 한계다. 눈은 수동 ROI 기준 가중 68.2542%·이진 76.8701%, ROI ±2 native 불확실성이 있다. ROI 밖 얇은 경계 178px와 원시 그림의 낮은 alpha 가장자리 픽셀을 숨기지 않는다. 이 수치로 실제 게임 정합 통과를 주장하지 않는다.

## prepared 저장과 재현

하네스·10개 저장·실제 선택 receipt·원본/결과 SHA·변경 필드 JSON은 저장소 밖 `/tmp/astra-height-era-l2late-prep/`에 있다. `prepare.mjs`, `fixtures.json`, `states/`, `receipts.log`, `ledger-preservation.json`을 인계한다. 이 자료는 자연 진행 플레이가 아니다.

원본 `docs/qa/round02/repro/saves/chapter2-war1340.json.gz`의 SHA256은 `1233eeac2874be9731bc5a1741d6211ee6f83f2ddb62c853c64ac52f6adeb1d9`이다. 대상은 `(50,39)`의 `construction-site-000021`. 기본 변경은 seed 1→68, 시점을 1400년 이후로, 해당 집의 level/builtLevel 1→2로 바꾼 것이다. seed는 다른 장식도 바꾸므로 향후 전후 비교는 **동일한 prepared seed 68 저장**끼리 한다. 원본과 준비 저장을 설치 전후라고 부르지 않는다.

관리 양호·strained(표시 등급 2/생활 등급 1)·neglected·vacant·abandoned·역병+abandoned·겨울·겨울+abandoned·해빙·해빙+abandoned 총 10개를 현재 codec으로 왕복하고 실제 선택자로 확인했다. 각 상태에 필요한 추가 필드는 `fixtures.json`에 전후 값으로 모두 기록했다. 건물 위치나 보행자·인물을 새로 만들지 않았다. receipt는 이미지 준비를 모의한 로컬 선택 검증이며 실제 화면 소비 증거는 아니다.

다음 실행 담당은 최신 본선을 합친 뒤 같은 prepared 저장의 전후 화면(줌 1.0·0.6), 실제 층 소비, 등록 잔차를 확인하고 현재 저장소 관문을 수행한다. 이번 인계에서는 DGX 실행과 push를 하지 않았다.
