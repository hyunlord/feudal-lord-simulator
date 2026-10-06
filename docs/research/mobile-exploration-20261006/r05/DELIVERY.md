# 납품·출처 안내

| 회차 | ZIP | 내용 |
|---|---|---|
|01|/tmp/astra-mobile-r01-20261006.zip|7게임 조사와 출처·공개자료 경계|
|02|/tmp/astra-mobile-r02-20261006.zip|8축·모바일·전쟁·상품·원칙 설계|
|03|/tmp/astra-mobile-r03-20261006.zip|실제 PC 틱 측정·서버 비용 가정·배포|
|04|/tmp/astra-mobile-r04-20261006.zip|실행 가능한 시제품·31,680경기·보충 실험·캡처|
|05|/tmp/astra-mobile-r05-20261006.zip|최종 판단·인력/기간·완료 감사|

R01~04 파일별 크기·SHA256·CRC·깨끗한 추출·전체 내부SHA 및 파일집합 검증 결과는 evidence/*.json에 있다. R05 자체 검증 결과는 순환 자기 해시를 피하기 위해 작업 폴더 records/R05_DELIVERY.json에 보존한다. 각 ZIP 안에는 SHA256SUMS가 있다.

출처를 최종판에서 새로 만들어 붙이지 않았다. 시장의 개별 공식/리뷰/공개 매출 출처는 R01 GENRE_A/B.md, 플랫폼·가격의 공식 출처와 조회 조건은 R03 PLATFORM_RESEARCH.md/SERVER_COST_UPDATE.md, 자체 실험 출처는 R04 SOURCES.md 및 분석·원자료 파일을 따른다. 추정과 실측의 구분은 각 본문에 남겼다.

시제품 실행: R04를 풀고 `cd r04/prototype` → `node server.mjs` → http://127.0.0.1:4179 . 실제 Node25.8.2·Chrome 검증, 설치 불필요. 기존 포트가 사용 중이면 `PORT=4187 node server.mjs`로 실행한다.

최종 R04 ZIP의 깨끗한 추출본을 별도4187포트에서 실행했다. Chrome375/390/768/1280 너비 모두 정책→12일 성장→약탈→이유→저장→색감→새로고침 복구→같은 시작144일 비교를 통과했다. 43개 검사도 추출본에서 다시 통과했다. evidence/extracted-browser.json은 각 단계 화면 너비·저장 전체값 동등성·전투 재현·콘솔 기록을 포함한다. 실제 휴대폰 검수나 인간 첫 플레이의 대체물이 아니다.
