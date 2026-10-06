# 배포와 최소 서버

## 배포 선택

이번 시제품은 링크로 실행하는 **일반 웹**이다. 설치·푸시·서비스워커까지 구현하지 않은 상태를 PWA 완료라고 부르지 않는다. 첫 사람 테스트 이후 캐시 갱신·저장 복구·설치·재접속을 확인해 PWA로 확장할 수 있다.

스토어 배포와 네이티브 알림/결제가 실제 필요해지는 단계에서 Capacitor를 검토한다. 기존 웹 자산을 네이티브 컨테이너에 담을 수 있지만 엔진을 자동 최적화하거나 스토어 심사를 대체하지 않는다. [공식 Capacitor 설명](https://capacitorjs.com/docs), [iOS 배포](https://capacitorjs.com/docs/ios/deploying-to-app-store), [Android 배포](https://capacitorjs.com/docs/android/deploying-to-google-play).

별도 네이티브 클라이언트 재작성은 실기기 WebView 렌더/입력/메모리 한계가 확인된 경우의 후보로 남긴다. 비동기 게임이라는 사실만으로 초기부터 두 플랫폼 UI를 새로 만드는 비용을 정당화하지 않는다.

iOS/iPadOS16.4 이후 홈 화면 웹 앱의 Web Push는 사용자 동작으로 권한을 받아야 한다. 일반 웹 탭의 체험자를 전부 푸시 대상이라고 계산하면 안 된다. 앱이 닫힌 동안의 경제 진행은 서버가 담당하고 알림은 결과 전달 수단이다. [WebKit 공식 설명](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple 백그라운드 작업](https://developer.apple.com/documentation/BackgroundTasks/choosing-background-strategies-for-your-app).

## 가장 작은 상용 서버의 역할

1. 인증/API: 사용자·도시·시즌 권한, commandId·expectedRevision·서버 시각 검증. 클라이언트가 보낸 잔고·승리 결과를 입력으로 받지 않는다.
2. 권위 DB: 계정·도시 revision·확정 원장·계약·동맹 소속 이력·출정 예약. 명령 처리와 outbox를 한 트랜잭션으로 기록한다.
3. 큐/스케줄러: 도시 정산·전투·시즌 경계 작업. 재전송을 정상 상황으로 취급하며 같은 결과의 지급은 한 번만 성공하도록 제약한다.
4. Node 계산 worker: 현재 TS 엔진의 import/메모리를 먼저 통제하기 쉬운 경로. 순수 factory/플랫폼 의존을 분리하고 작은 도시 묶음으로 실행한다. CPU 프로파일 없이 많은 도시를 한 프로세스에 넣지 않는다.
5. snapshot/replay 저장: 버전·seed·명령·hash·마지막 확정 시점. 도시 전체 저장은 보관하고 클라이언트에는 필요한 읽기 모델/변경분만 전달한다.
6. 알림·관찰: 동의한 요약 푸시, 실패/중복/큐 적체/정산 지연 계측. 개인정보·계정 복구·결제 검증·신고 운영은 별도 출시 작업이다.

초기 realm은 동맹 몇 개가 경쟁하는 독립 판으로 둔다. realm 간 자원 이전/전투는 제외한다. 시즌 종료는 신규 출정 차단→진행 전투/계약 확정→결산 원장→다음 판으로 진행한다. 같은 시대의 규칙을 서버와 리플레이가 공유한다. 정책 변경·약탈·계약이 동시에 들어오는 경계에서 단일 도시 revision 잠금과 다중 도시 거래 순서를 명시해야 한다.

Cloudflare Queues는 중복 전달 가능성이 있는 구조다. 성공 응답 전에 지급을 반복하거나, 지급했는데 큐 삭제에 실패해 다시 지급하지 않도록 DB의 idempotency 제약이 필요하다. [공식 전달 보장](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

## 비용표를 그대로 배포 설계로 읽지 않기

PLATFORM_RESEARCH.md의 월약$6/$55 사례는 **가벼운 모델·작은 CPU·저장 부하를 가정한 핵심 데이터 경로 산식**이다. 원 PC 엔진 이식의 측정 비용이나 상용 운영 총액이 아니다. 이번 원본 측정은 오프라인 정산20ms 가정과 동일한 작업이 아니다.

Workers isolate 메모리는128MB다. 이번 Node RSS는 약322~368MB지만 Node 전체 RSS와 isolate heap은 같지 않아 즉시 이식 불가의 수학적 증거는 아니다. 반대로 현재 엔진이 제한에 맞는다는 증거도 없다. import/힙/번들/API 호환성을 확인하기 전에는 edge에 전체 엔진을 넣는 단가로 예산을 확정하지 않는다. [공식 제한](https://developers.cloudflare.com/workers/platform/limits/).

권고 구조는 API/정적 자산과 계산 worker를 분리하는 것이다. edge 가격 산식은 단순화 모델이 실제 제한을 통과할 때만 사용한다. 원 엔진의 계산은 별도 Node worker 용량/메모리·DB·운영 비용으로 견적해야 한다. 상세 부하 산식은 SERVER_COST_UPDATE.md에 있다.

## 출시 전 남는 시험

- 도시/계약/전투 동시 요청, 역순·중복·오래된 revision·시즌 경계에서 자원 보존과 지급1회.
- 구버전 진행 전투와 리플레이, 저장 이행, 실패 작업의 복구.
- 1k/10k 계정 규모의 peak 큐/DB 병목. DAU와 계속 살아 있는 도시 수를 분리.
- 실제 중급 Android에서20분 체류·재접속·네트워크 손실·입력 반응·메모리·배터리/온도 측정.

이들은 이번 탐사 결과가 아니라 후속 출시 관문이다. R04 로컬 시제품에서 시연한 항목과 서버 미구현 항목을 별도 표기한다.
