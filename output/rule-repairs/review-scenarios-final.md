# 최종 시나리오 근거 감사 — 0725764

**초기 감사 시점: ① R-T 17/17 · ② 가드레일 대기 · ③ R1 선택 탐침 재현 0/7.**

**최종 추가 감사(2026-09-24 13:19 UTC): 0725764의 5개 seed 원시 집계와 실행 영수증을 독립 대조해 모두 통과를 확인했다. 최종 관문은 17/17 · 5/5 · 재현0/7이다. 아래 본문은 seed 완료 전 감사 이력이며 최신 수치·상한은 `guardrails-final.json`과 `REPORT.md`를 따른다.**

고정 클론 `/tmp/fls-r1fix-clean`의 HEAD `07257643958ffac19af2881d6a8d7163e5b086e3`와 추적 파일 변경 없음, 원 작업 지시서를 확인했다. 테스트/시뮬레이션 실행이나 제품 편집 없이 기존 기록을 감사했다. 정확한 테스트 이름·소스 줄·PASS 로그 줄은 `scenario-matrix.json`에 22개 주 시나리오 시험과 추가 R-T14 5개를 기록했다.

| 시나리오 | 현재 소스 | 검증 범위 |
|---|---|---|
| R-T1 | `tests/servicePriority.test.ts:17` | 기존 집 서비스 유지·새 집 capacity. water/market/church 3종. |
| R-T2 | `tests/servicePriority.test.ts:26` | 건설 서수 우선, 반경 진입 및 배열 순서 반전 결정론. |
| R-T3 | `tests/palisadeEraLabour.test.ts:256` | 자재 대기 예약0 및 농장4/방앗간2/제재2 유지. |
| R-T4 | `tests/palisadeEraLabour.test.ts:263` | 준비2부지 예약6=배정6, 유실0, 일반풀 잔여 유지. |
| R-T5 | `tests/buildingOperation.test.ts:12` | 준비공사3·핵심식량8·벌목/제재5, 추가농장2개가 핵심을 빼앗지 않음. |
| R-T6 | `tests/buildingOperation.test.ts:20` | 농장 중지 workers0/생산정지/재배정, encode/decode 후 상태 보존, 재개. |
| R-T7 | `tests/servicePause.test.ts:13` | 중지 well/market/church의 paused 원인, 활성 대체시설은 정상 공급. |
| R-T8 | `tests/stoneConstructionFlow.test.ts:19` | no_route 첫 구간 대기, 뒤3구간 병렬시공, 복구 후 모두 작업완료. |
| R-T9 | `tests/stoneConstructionFlow.test.ts:39` | 자연 목책 snapshot에서 구성한 석벽12구간에 단일 실제 도로 연결 후 모두 실경로 존재. |
| R-T10 | `tests/constructionCargoRecovery.test.ts:22` | 실제 배송 취소 후 화물8 하역,208재고·넘침8 표시, 공급원 재사용. |
| R-T11 | `tests/constructionCargoRecovery.test.ts:41` | 한도 이하 소비 상태에서 파생 넘침 표시 제거. |
| R-T12 | `tests/constructionMarketReserve.test.ts:27` | 석재100/성채수요150,30시장주기 판매0·재정증가0. |
| R-T13 | `tests/constructionMarketReserve.test.ts:33` | 석재155/수요150에서5만 판매; 배송완료·운송중 수요 중복차감 방지 보조시험. |
| R-T14 | `tests/autoplayTimberScenario.test.ts:8` | 기본 새 게임, 전체 조언+정상엔진120000틱, 목재시설증설 및 증설 이후 목책진척. |
| R-T15 | `tests/autoplayWheatTransportRecovery.test.ts:10,22` | 편집 없는 자연 seed1 fixture, 전체 decideNextAction(policy24),24k틱 내 모든집 빵양수 및 최종 빈집0·시설상한. |
| R-T16 | `tests/autoplaySearchBudget.test.ts:18` | seed3-28080 원본, 예산·복제/재호출 결정론; 별도 직렬 단일결정<1000ms. |
| R-T17 | `tests/stoneConstructionFlow.test.ts:57` | 준비된16구간 중 첫 no_route 유지·나머지15작업완료. 자연seed2원본 아님. |

전체 회귀 로그 `source-test-0725764.log`는 **2570/2570, 실패·취소·건너뜀 0**이다. 현재 저장 v1~v4 fixture의 이행/1000틱 실행과 v4 지문 검사도 통과했다. typecheck 로그에는 오류가 없고 build는 완료됐다. JS789.52kB 청크 권고 경고는 남는다. 텍스트 로그 자체에는 HEAD/종료 코드가 없으므로 부모의 고정 클론 실행 기록과 현재 HEAD 확인을 연결한 근거다.

성능 재생은 **69/69**, 최대 **3621.756541ms**, R-T16 단일 결정 **198.455500ms**, 전부 결정론 통과다. R-T16 단위시험 전체1311.806ms는 여러 결정을 포함하므로 1초 관문과 비교하지 않는다. JSON의 `sourceCommit=e97d6a8`은 runner50행이 복사한 입력 manifest 출처다. 평가 HEAD072는 부모 실행 receipt와 독립 확인한 clone reflog(12:53:18UTC checkout)로 귀속하며 raw runner가 자체 HEAD를 기록한 것처럼 표현하지 않는다.

원본7개 탐침의 현재 실행 receipt HEAD와 exit0을 확인하고 403cfa9 출력과 **직접 byte 비교하여7/7 동일**함을 확인했다. timber-expansion은 명시적120000틱,46.948초다. 서비스P1/인력B·C·D/추가농장/석벽P2/취소귀환/성채석재판매/목재정체의 선택 결함만 재현0이며, 탐침의 다른 사례 전체를 뜻하지 않는다.

근거 분류와 제한:

- R-T14만 기본 새 게임에서 시작한120000틱 전체 advisor/엔진 검사다. R-T15는 편집 없는 자연 seed1 상태에서 전체 advisor를120틱 간격으로 실행한24000틱 진단 재생이며5seed 관문을 대체하지 않는다.
- R-T8은 준비된 공사 lifecycle 검사로 첫 구간 복구는 상태를 직접 설정한다. R-T9는 자연 목책 상태를 석벽12구간/석재 재고로 변형하고 실제 도로 명령으로 연결한 뒤 경로 존재를 검증한다. 전체 자연 석벽 운송 완공 증거는 아니다. 이미 구현된 공통 벽 운반 조항은 이전 커밋709c25d/10b8363/d3f9626와 현재 관련 회귀로 분리 기록했다.
- **R-T17은 원본 seed2 정체 fixture가 아닌 준비된16구간**이다. 자재·인력을 사전 배정한15구간 작업 완료와 첫no_route 유지까지 증명한다. 지시서의 “fixture, 가능하면”에 대한 이 제한을 유지한다.
- R-T11은 재고를208→192로 설정한 넘침 표시 검사다. UI6장은 현재072에서 준비 상태를 주입한 제품 UI 검증이며 자연 플레이가 아니다. 이 감사는 QA 기록을 읽었고 이미지를 다시 열지 않았다.

새 시나리오 누락/차단 결함은 발견하지 못했다. **최종072의5개 seed**에 대해 기준선7db9df85의24/24L4·연속안정24000틱·시설상한·경고10%미만과 seed당1500초를 확인해야 한다. 이전 HEAD의 seed4 통과를 이월하지 않았다. 총6시간 제한의 실제 소요 및 준수/초과, 항목별 커밋·푸시는 리더 최종 보고 의무로 남긴다.
