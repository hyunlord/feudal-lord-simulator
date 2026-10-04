# Spring9 actual70c runtime closure

**실제 후보 커밋 70c 런타임 PASS. 후속 원장 참조4 및 최종 게시 PENDING.**

17개 데이터 작업(카탈로그1·새 public9·옛 public6 제거·provenance1)은 `70c153211187f5e7dedef538147136b22afdd8fc`에 기록됐다. 기존20 이전 커밋 `208c6222`가 비교 기준이다. 코드·스크립트·테스트 2,342개 SHA 보존, 카탈로그95·활성계절68, 역사6 원본 보존은 이전 transfer-receipt.json의 정적 근거와 구분한다.

실제 DGX 실행 astra-spring9-committed-70c1532는 입력 4,143개 SHA와 퇴역 경로6 부재를 확인했다. 원본 captures.json 및 로컬/원격 freeze의 경로와 SHA를 runtime-receipt.json에 고정했다. 전체10뷰 식별자·PNG SHA·RGBA 비교·A/A 및 봄 각뷰 새9 요청/디코드/그리기 근거를 포함한다. 비봄7뷰 전체 식별자 및 RGBA가 같다. 봄3뷰는 expectedRequests만 다른 식별자로, 실제 픽셀 변화는 각각 18,642/100,186/17,766이다. URL 목록 차이로 픽셀 변화를 추정하지 않았다.

executor-visual.md는 실행 담당자의 실제13장 검수, independent-visual-review.md는 별도 검수자의 실제13장 검수다. parent-review.json은 부모의 독립 수치 재확인 및 표본 육안검수다. 모두 해당 커밋의 준비된 장면 범위 증거이며, 전체 자연 플레이·다른 DPR·가려진 모든 원본의 시인성 검증은 아니다.

촬영 시점 candidate9/빈 installed_by와 이후 승격 작업은 별개다. 이 보고서는 후속 원장 변경의 캡처나 최종 게시를 대신하지 않는다. 역사 detached 프리뷰·검수 및 v1→v2 퇴역 기록은 history.json과 역사 파일로 구별한다. 기존 detached JPEG를 삭제하고 실제 브라우저 JPEG로 교체했으며 원본 raw 영수증은 변경하지 않았다.

후속 정적 검사에서 C25 Node 봄 보드의 기존 기대 해시가 승인된 spring9 데이터와 맞지 않아 실패했다. 분리 통합 준비본에서 카탈로그만 208 기준으로 바꾼 대조는 통과했고, 변경 없는 70c에서도 같은 실패가 재현됐다. 원인은 기존6 봄 URL 교체 및 새 소나무·고사목3이 Node 절차적 대체 그림을 바꾼 것이며, 청크 래스터64와 다른 해시15는 보존됐다. 봄 기대 해시만 cf0b… → 24e805…로 갱신한 뒤 기존 C25 시험1/1이 통과했다. c25-snapshot-followup.json에 별도 기록했으며 실행 코드·검사 조건은 바꾸지 않았다. Node 해시를 브라우저 PNG 증거로 취급하지 않는다.

부모는 실제70c 검증 뒤 새9 provenance를 runtime, 장부를 RENDER-B-SPRING9로 승격했다. 해당 후속 작업은 promotion.json에 별도 기록되며, 촬영 당시 candidate 상태를 소급 변경하지 않는다. 이 문서 작업자는 장부·provenance를 수정하지 않았다.
