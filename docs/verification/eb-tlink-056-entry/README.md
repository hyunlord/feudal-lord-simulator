# 056 기하 준비 장면의 개방 지연

공식 `engineB-tlink-sidecar-geometry-71bc336`에서056의 첫 개방이 반복해서 실패했다. 제품/채점 효과가 아니라 준비 장면 진입을 별도로 진단했다. [정확한 소스·보고서·캡처·실행 영수증](archive.json)을 보존한다.

같은 입력 저장 SHA `00c8eeab4b4c17443e3b3c53f0a6a2af639e7fc3bf1c23ea8de6a56fd181405c`, tick32000을 썼다. probe1~3의3초 개방에서는 실제 DOM에 등록기092 칩/창만 있고056은 없었다. 다른 창을 닫고6초 기다려도 같고, 게임 tick도32000 그대로다. 화면 문구만으로 첫 칩을056이라고 본 초기 추정은 DOM의 `data-story=registry_event`로 폐기했다.

probe4는 준비 URL의 `story-delay`만20000으로 하고21초 기다렸다. 실제056 제목 **장날 수레가 빠지는 길**과 `.lord-card[data-home-petition]`이 열렸고, 열린 청원 `estate-petition-19`·`road_bridge`·deadline33000은 그대로였다. 오류0이다. 초기 `Escape`와 먼저 열리는 카드의 경쟁은 `surfaces.registry.ts`의 HOUSE_DELAY/CHAPTER_DELAY 주석에도 기록된 기존 문제다. 타이밍 전후는 이 가설을 지지하며, 모든 부하/장면에서20초를 보장하는 증명은 아니다.

수정은 기하 입력 행 `modal.lord.home-petition.variant-056`의 URL 지연20초와 해당 창의90초 명시 대기뿐이다. 기존 HOUSE/CHAPTER 준비 방식과 같다. 측정 조건·viewport·frame/overflow 판정·기준선·예외·선택기·원격 줄은 그대로다. 시험 장면 메타데이터만 바뀌므로 게임 런타임/제품 화면 동작 코드·규칙·저장·채점 소스는23d/71bc와 동일하다. 실제 게임의 개방 시간을20초로 바꾸는 수정이 아니다.

이 네 탐침은 준비 장면의 진단이며 전체 기하 통과를 대신하지 않는다. 같은27행·540조건의 공식 후속 결과를 인계에 덧붙인다. 원래 실패/재시도 자료도 보존한다.

71bc336의 원래 감사는 수정판으로 교체하기 위해 자기 scope를 종료했고 inactive/dead를 확인했다. [중단 기록](superseded-71bc336/status.json)의 FAILED 로그에는 종료로 브라우저가 닫힌 뒤 생긴 후속 오류도 포함된다. 중단 산출물의444측정·96미개방을 완료한 판의 제품 결함 수나 통과 근거로 쓰지 않는다. 공식 실행 종료 영수증은 없고 attach는255였다. 원래 진입 실패와 진단 네 실행은 그대로 보존했다.
