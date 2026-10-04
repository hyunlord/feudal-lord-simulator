# Spring9: 실제 커밋 전후 검증

기준 `208c6222` → 후보 데이터 `70c15321`의 실제 브라우저 캡처다. 여름·겨울 줌 1/0.6 및 봄 줌 1/0.6/1.4의 7쌍을 JPEG 10개로 제공한다. 동일 JPEG SHA만 저장을 공유하며 논리적 촬영 출처는 각각 보존한다. 원본 PNG·RGBA·카메라 및 저장 상태 식별자는 manifest.json과 runtime-receipt.json에 있다.

전체 10뷰: A/A 10/10, 오류 0, 비봄 7뷰 RGBA 차이 0. 봄 3뷰는 승인된 변화이며 expectedRequests만 의도적으로 바뀌었다. 나머지 촬영 식별자는 동일하다. 새9 URL의 요청·디코드·그리기 계보를 봄 각 뷰에서 확인했다. 개별9 그림이 모두 가리지 않고 식별된다는 뜻은 아니다.

독립 검수는 AFTER 10장과 봄 BEFORE 3장을 원본으로 열어 PASS with limits로 판정했다. independent-visual-review.md 참조. 근접 장면의 기존 화면 하단 잘림, 나무 겹침, 자연 플레이 미검증 한계를 유지한다.

70c 이전 detached 검증은 history.json 및 spring9-v2-visual-review.md에 별도 보존했다. 현재 JPEG를 과거 실행의 그림으로 재명명하지 않았다. transfer-receipt.json은 당시 전송의 정적 영수증이며 현재 런타임 판정은 runtime-receipt.json이다. retirement.json/md는 후보 커밋 시점의 기록이다.

원장 승격 뒤 참조 4뷰와 최종 게이트·게시는 아직 PENDING이다. 이 패키지는 설치 장부를 수정하거나 최종 게시 완료를 주장하지 않는다.
