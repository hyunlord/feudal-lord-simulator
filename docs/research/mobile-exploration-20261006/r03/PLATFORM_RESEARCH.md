# 모바일 비동기 영지·습격: 플랫폼·서버 기술 검토

확인일: 2026-10-06. 공식 공급사 문서를 웹에서 확인했다. 저장소 코드, 실제 배포, 성능, 청구서는 조사하지 않았다. 아래 게임 규칙·부하·비용은 설계 제안과 명시적 가정이며 구현 완료 주장이나 견적서가 아니다.

## 플랫폼 선택

| 선택 | 적합한 단계 | 장점과 남는 검증 |
|---|---|---|
| 반응형 웹/PWA | 첫 플레이테스트 권장 | 링크로 체험하고 동일 웹 UI를 검증. iOS/iPadOS 16.4+ Web Push는 홈 화면 웹 앱에서 지원하며 사용자 동작으로 권한을 요청해야 한다. 일반 탭 이용자에게 같은 푸시 전환을 기대하면 안 된다. 설치 안내·재접속·캐시 갱신·저장소 복구를 실기기로 검증한다. |
| Capacitor | 스토어 유통·네이티브 기능을 실제로 요구하는 다음 단계 | 웹 자산을 유지하며 iOS/Android 네이티브 프로젝트와 플러그인을 제공. 양 스토어 배포는 각 플랫폼의 일반 네이티브 제출 절차를 따른다. 포장만으로 심사, 서명, 결제 연동, 접근성, WebView 성능 문제가 해결되지는 않는다. |
| 별도 네이티브 클라이언트 | 실기기 측정에서 웹 경로의 한계가 확인된 뒤 | 플랫폼 UI·그래픽 구현 선택 폭이 넓지만 클라이언트 개발/QA 경로가 늘어난다. 비동기 영지 운영만으로 초기 재작성의 근거가 되지는 않는다. 서버 판정은 세 방식 모두 동일하다. |

PWA 조건 근거: [Apple Web Push 문서](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [WebKit 설치·권한 설명](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Capacitor 범위와 배포 근거: [공식 소개](https://capacitorjs.com/docs), [iOS 배포](https://capacitorjs.com/docs/ios/deploying-to-app-store), [Android 배포](https://capacitorjs.com/docs/android/deploying-to-google-play).

네이티브에서도 iOS의 백그라운드 작업 실행 시점은 시스템이 정한다. 따라서 '앱을 닫아도 마을이 진행된다'는 서버 시각 기반 정산으로 구현하고 푸시는 알림으로만 사용한다. [Apple Background Tasks](https://developer.apple.com/documentation/BackgroundTasks/choosing-background-strategies-for-your-app).

## 서버 판정 설계 제안

웹 클라이언트 → 인증/API → 권위 상태 DB → 트랜잭션 outbox → 큐 → 결정론 판정 → 결과 원장/리플레이 객체 → 알림 구조를 권장한다. 원장은 정답이고 클라이언트 화면은 예측·재생이다. 중요 게임 상태를 서버가 판정하고 직접 클라이언트 쓰기를 막는 원칙은 [Unity 공식 서버 접근 제어 설명](https://docs.unity.com/en-us/cloud-code/server-access-control)과도 일치한다. Unity 제품 채택을 뜻하지 않는다.

1. **오프라인 정산**: 서버의 `lastSettledAt`부터 `now`까지 정산한다. 최대 누적 시간, 생산 상한, 저장 용량, 이벤트 경계는 규칙 버전으로 고정한다. 기기 시계·클라이언트가 보낸 자원 총량을 신뢰하지 않는다. 모든 초를 시뮬레이션하지 말고 작업 완료·세율 변경 등 경계 단위로 적분하되, 원래 틱 결과와 일치하는지 별도 검증한다. 오프라인 입력은 임시 계획이며 서버 승인 전 경제 상태가 아니다.
2. **습격 시점**: 출정 승인 시 공격 편성·비용·타깃 방어 스냅샷·버전·서버 발급 seed를 고정하고 `arrivalAt`을 기록한다. 본 제안에서는 도착 때 고정 스냅샷으로 판정하므로 출정 후 상대 편집은 해당 전투를 바꾸지 않는다. 도착 직전 방어를 반영하는 규칙은 별도 제품 선택이며 혼합하면 안 된다. 실제 약탈은 출정 시 확보한 한정 보상 예약분으로 정산하여 다중 공격의 중복 인출을 막는다. 예약·실패 반환·만료를 같은 원장에 기록한다.
3. **재전송·동시성**: `commandId`, `battleId`, `expectedRevision`, `seasonId`를 검증한다. 비용 차감·보상 예약·명령 승인·outbox 기록을 원자적으로 처리한다. 동일 전투 결과의 보상 지급은 단 한 번만 성공한다. 큐는 최소 1회 전달이고 순서를 보장하지 않으므로 재전송과 역순 도착을 정상 조건으로 설계한다. [전달 보장](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [큐 동작](https://developers.cloudflare.com/queues/reference/how-queues-works/).
4. **결정론 계약**: 고정 틱, 정수/고정소수점 연산, 명시적 정렬, 지정 PRNG·seed, 입력 명령 로그를 사용한다. `engineVersion + rulesetHash + contentHash + initialStateHash + commandsHash + resultHash`를 저장한다. 정산 중 Date/랜덤/외부 API를 읽지 않는다. 서버가 계산한 결과가 정답이며 클라이언트 결과 hash 일치만으로 보상을 승인하지 않는다. seed를 숨기는 것만으로 부정행위를 막을 수 없다.
5. **버전 보존**: 시즌 중 규칙 버전은 고정하고 새 버전은 새 시즌 또는 명시적 마이그레이션부터 사용한다. 진행 중 전투는 시작 버전으로 끝낸다. 리플레이 보존기간만큼 구버전 판정기를 보존한다. 새 빌드에서 구 리플레이가 우연히 재생되는 것을 호환성으로 간주하지 않는다.
6. **일일 제한**: 공격 횟수·약탈 총량·타깃 반복 횟수·보호막을 서버 시즌 시각과 원장으로 검사한다. 예시 수치는 테스트 설정으로만 제시하고 영구 밸런스로 확정하지 않는다. 자정 경계 동시 요청과 재시도에서 제한이 뚫리지 않아야 한다. 타임존 변경이나 기기 재설치로 초기화하지 않는다.
7. **동맹·시즌 토폴로지**: 초기는 소수 동맹이 함께 있는 독립 시즌 realm 단위로 DB를 나누고 realm 간 공격/자원 이동을 막는다. 동맹 가입 이력과 공격 당시 소속을 고정하여 탈퇴·재가입 보상 악용을 막는다. 시즌 종료는 신규 출정 차단 → 기존 전투 처리 → 확정 원장 → 순위 보상 → 새 시즌 순서다. 실시간 글로벌 전쟁망·월드 간 재화 이전은 초기 범위에서 제외한다.

Cloudflare D1으로 구현한다면 한 DB 안에서 SQL batch 트랜잭션과 조건부 변경을 사용할 수 있지만, 변경 행 수가 0인 조건 실패를 자동 SQL 오류와 혼동하면 안 된다. 원장 제약과 revision 검증으로 전체 경제 변경을 함께 성공/실패시키는 증명이 필요하다. 샤드 간 원자적 거래를 가정하지 않는다. [D1 batch 계약](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## 월 서버비 산식 예시

아래는 **Cloudflare Workers Paid + D1 + Queues + R2 Standard** 하나의 가벼운 비동기 모델이다. 공급사 비교·최저가 보증은 아니다. 공개 USD 단가, 30일, 전용 계정의 포함량을 온전히 쓴다고 가정한다. 지역은 글로벌 Workers와 Asia-Pacific D1 위치 힌트이며 서울 고정 리전/국내 데이터 상주를 보장하는 모델이 아니다. 이 서비스 가격표는 아래 항목에 지역별 차등 단가를 제시하지 않는다. [D1 위치 문서](https://developers.cloudflare.com/d1/configuration/data-location/).

| 단가 항목 | 확인한 포함량과 초과 단가 |
|---|---|
| Workers | 월 기본 $5. 요청 1,000만 포함, 초과 100만당 $0.30. CPU 3,000만 ms 포함, 초과 100만 ms당 $0.02. |
| D1 | 월 읽기 250억 행 포함, 초과 100만당 $0.001. 쓰기 5,000만 행 포함, 초과 100만당 $1. 저장 5GB 포함, 초과 GB-month당 $0.75. |
| Queues | 월 100만 operation 포함, 초과 100만당 $0.40. 메타데이터 포함 64KB 이내 메시지는 정상 완료에 보통 쓰기+읽기+삭제 3회. 재시도 추가. |
| R2 Standard | 저장 10GB-month, A 100만, B 1,000만 포함. 초과 저장 $0.015/GB-month, A $4.50/100만, B $0.36/100만. 과금 단위 올림 적용. |

단가 출처: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Queues](https://developers.cloudflare.com/queues/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/). 확인일 2026-10-06. Workers/R2 문서의 최근 갱신일은 각각 2026-10-02/2026-10-01이다.

부하 가정: DAU=D, 1인 하루 API 100회×CPU 10ms, 오프라인 정산 4회×20ms, 습격 5회×200ms. 큐 job은 정산+습격 9개/일이며 job당 별도 invocation 1개를 보수적으로 더한다. DB는 인덱스 비용을 포함하여 1인 하루 읽기 1,000행·쓰기 200행. 저장은 DAU 1k/10k에서 DB 2/20GB, R2 20/200GB-month. R2 A는 습격당 1회, B는 2회. CPU 수치는 미측정 가정이며 실제 엔진 벤치마크로 대체해야 한다. DB 저장량은 계정 전체 보존 데이터까지 포함한 가정이므로 DAU만으로 실제 저장량을 알 수 없다.

- 월 API 요청 `R=30×D×109`.
- 월 CPU ms `C=30×D×(100×10 + 4×20 + 5×200)=62,400D`.
- 월 queue operations `Q=30×D×9×3=810D`.
- Workers 비용 `5 + max(R−10,000,000,0)/1e6×0.30 + max(C−30,000,000,0)/1e6×0.02`.
- D1 비용 `max(read−25e9,0)/1e6×0.001 + max(write−50e6,0)/1e6 + max(GB−5,0)×0.75`.
- Queue 비용 `max(Q−1e6,0)/1e6×0.40`.
- R2 비용은 무료량을 뺀 초과 저장 GB-month·A/B 백만 요청 단위를 각각 올림한 뒤 단가를 곱한다.

| 월 사용량/비용 | DAU 1,000 | DAU 10,000 |
|---|---:|---:|
| Worker 요청 | 327만 | 3,270만 |
| CPU | 6,240만 ms = 17.33 CPU시간 | 6억2,400만 ms = 173.33 CPU시간 |
| Workers | $5.648 | $23.69 |
| 큐 operations | 81만 | 810만 |
| Queues | $0 | $2.84 |
| D1 읽기/쓰기 | 3,000만/600만 행 | 3억/6,000만 행 |
| D1 저장 포함 총비용 | $0 | $21.25 |
| R2 저장/A/B | 20GB / 15만 / 30만 | 200GB / 150만 / 300만 |
| R2 | $0.15 | $7.35 |
| **계산 합계** | **약 $5.80/월** | **약 $55.13/월** |

CPU 200ms/습격이 아니라 2,000ms라면 CPU 총량은 92.33/923.33 CPU시간이고 합계는 약 **$11.20/$109.13**으로 증가한다. CPU시간은 상시 서버 임대 시간이 아닌 실제 연산량 환산이다. 지속 연결 없는 비동기 모델이어서 상시 24시간 인스턴스를 전제하지 않는다.

예시 다운로드를 1인 하루 5MB라 두면 150GB/1.5TB 월 egress다. 위 Workers·D1·Queues·R2 가격표의 해당 egress 비용은 $0이나 요청량/연산량은 계속 과금된다. 외부 서비스, 다른 CDN, 로그 수집 대상의 egress는 이 산식에 포함하지 않는다. R2 목록 조회·추가 snapshot·관리 호출이 늘면 A/B operation도 다시 계산한다.

이는 핵심 데이터 경로만의 산식이다. QA/스테이징, 장애 여유, 유료 로그/모니터링, 인증·이메일/SMS, 추가 백업, 도메인, 스토어 개발자 계정/수수료, 세금·환율, 보안 운영과 인건비는 제외한다. 따라서 실제 출시 운영비를 월 $6 또는 $55로 확정해서는 안 된다.

특히 D1은 **DB 하나당 최대 10GB, 단일 스레드 쿼리 처리**이므로 20GB 사례는 예를 들어 독립 realm DB 4개×5GB를 전제한다. 시즌 마감 순간의 쓰기 폭주와 hotspot은 월 비용이 낮아도 실패할 수 있다. [D1 제한](https://developers.cloudflare.com/d1/platform/limits/). 먼저 1k/10k 부하를 재현해 p95 정산 지연, 중복 보상 0건, outbox 누락 0건, peak backlog, 행 스캔 수, CPU ms/raid를 측정한 뒤 예산과 저장 분할을 확정한다.
