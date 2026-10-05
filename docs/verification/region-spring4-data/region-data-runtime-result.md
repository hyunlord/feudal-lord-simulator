# REGION DATA20 실제 실행 결과

- 실행 `astra-region-data-v1-bd84351` 1회; 실제 HEAD `bd84351abb1e36d6b03f7fa03d4ec4f9484ed23d`; exit 0 / 결과 89파일 회수.
- 공식 status 사전 확인: geometry heavy 1개, 대기 0. 본 실행 FIFO slot 2/2, port 4302, wait 0.0초; 준비 7.9초, 실행 226.5초, 전송 22.0초.
- 20뷰 / A-A 20 / 오류 0 / physical identity 20 일치. 봄 positive 8: 새 4URL request→decode→paint 및 실제 픽셀 변경. negative 12: full identity 및 RGBA 동일, 새 4URL의 first-open paint 0.
- 전체 request/decode/paint URL-view 쌍 30. negative 요청 0을 요구하지 않았음.
- actual remote pre/post: HEAD·tracked clean·입력 27,053 SHA·export 27,054 모두 PASS. 회수 후 local 전체 동결 입력 SHA 불변 및 tracked clean 재검증 PASS.
- 입력맵 SHA `b0054c259f40f4801f97293d5b8717f6704ec434ebc8b185f3ea0805390dc8a7`.

[원본 20쌍 및 JPEG 인덱스](/Users/rexxa/fls-astra-renderB/.omo/evidence/region-data-runtime-native-index.md) · [정량 상세](/Users/rexxa/fls-astra-renderB/.omo/evidence/region-data-runtime-result.json)

독립 native 시각검토는 별도 진행한다. 본 보고서는 눈으로 품질을 판정한 결과가 아니다. 준비된 tick-only calendar 상태이며 자연 플레이, drainage 역할, 다른 DPR/가을 전체 범위의 증거가 아니다. 원격 외부 도구/캐시 SHA는 pre/post 영수증에 남겼으며 생성된 캐시 변화와 동결 제품 입력 불변을 구분한다.

이 작업의 main 변경은 본 result.md/result.json/native-index.md 세 파일뿐이다. 본선 제품·공식 proof·장부·커밋·push를 변경하지 않았다.
