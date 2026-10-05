# Phase 2 증거 조립 상태

**최종 `be576dbe` 실제 merge·깨끗한 클론·보호 본선 게시 통과.** DGX 4,886/4,886·타입·build·source LFS14/public14 검사 뒤 `90d9b586 → be576dbe`를 게시했고 원격 ref 일치를 확인했다. [최종 관문](be576-final-gates.json)·[게시 영수증](publication.json). 아래 ed83 및 더 이전 기록은 각각의 실제 측정 시점을 보존한다. 후속 REGION/CLOUD/HEIGHT 가지의 검증을 대신하지 않는다.

| 항목 | 확인 범위 / 상태 |
|---|---|
| 새 runtime 14 | 봄 9 + FIELD 3 + HEATH 2; 각 공식 패키지의 실제 런타임 영수증 참조 |
| 기존 이전 단계 | season core / FIELD core / HEATH core는 새 그림 수와 별도 |
| public 퇴역 6 | spring9 교체로 퇴역, 원본 source 보존; 신규 14에서 차감하는 분모 아님 |
| W37 ledger 16 | 별도 정합 처리; 새 runtime 16 설치라는 뜻 아님 |
| source 14 / public 14 | 부모 감사: source LFS pointer 14, public 일반 Git PNG 14, payload 28 검증 |
| ref-free LFS 업로드 | exit 0 / objects 14 / Git ref push false; 게시 또는 최종 clone 다운로드 증거 아님 |
| 최신 실제 통합 참조 | db17321a: 여름·겨울 × 1/.6, identity 4 / RGBA 동일 4 / A-A 4 / 오류 0, B/C paint; FIELD 봄 증거 아님 |
| 기하 | fd68f124 실제 측정 PASS: 2,202/2,202, 실패 0, WARN 693; 독립 검토 PASS |
| fd68 → db173 연결 | 보호 입력 4,277 동일, native hash 동일; 중간 연결이며 미래 HEAD 증명 아님 |
| merge / clean clone | 최종 be576 PASS: 4,886/4,886·타입·build·LFS14/public14; ed83 결과 별도 보존 |
| 보호 push | be576 DGX protected push exit0; 원격 exact HEAD 확인; 작업 가지 삭제·전용 자격 캐시 종료 |

## 기존 일곱 증거 폴더

경로는 저장소 루트 기준이며 현재 절대 경로와 각 SHA index 해시는 `packages.json`에 있다. 감사 당시 tracked/prospective 구분과 아직 게시해야 할 파일 목록을 보존했다.

| 패키지 | 저장소 경로 |
|---|---|
| wave37-reconcile | `docs/verification/wave37-reconcile` |
| season-core | `docs/verification/season-core` |
| spring9-data | `docs/verification/spring9-data` |
| field-core | `docs/verification/field-core` |
| field-spring3-data | `docs/verification/field-spring3-data` |
| heath-core | `docs/verification/heath-core` |
| heath-data | `docs/verification/heath-data` |

## 분모와 한계

원래 425개 census 내부의 marked 153 / runtime 157은 그 집합의 집계다. HEATH 2는 원래 425 밖에 있으므로 이를 전체 설치 수와 같은 분모로 표시하지 않는다. W37의 역사적 집계 역시 해당 시점 기록이다.

HEATH core의 931d780e 실행은 runtime 4,308 및 별도 driver가 고정되었으나 proof 문서 두 개가 수출 중 달라진 `NON_RUNTIME_DOCUMENT_DRIFT`였다. 전체 clean export였다고 주장하지 않는다. HEATH negative 16의 첫 열림 부재는 증명되었지만 repeat 부재는 저장되지 않아 미증명이다. FIELD protected 4,259 수는 closure 감사에서 각 원본을 재검산한 결과가 아니다.

초기 패키지 조립 중에는 새로운 시각 검사나 테스트·원격 실행을 수행하지 않았다. 후속 실제 ed83 관문은 아래 별도 절에 기록한다. 과거 실제 runtime/독립 native 검토는 각 패키지에 귀속된다. UI handoff, HEIGHT, REGION, CLOUD 완료를 이 Phase 2 증거로 주장하지 않는다. 원본 PNG·대형 freeze·로그는 외부 경로에 남아 있으며 원본 영수증의 SHA로 연결한다.

## 남은 관문

- [x] 실제 fd68 기하 종료·수집 영수증 추가
- [x] 독립 기하 검토 사본 추가
- [x] 게시 대상 문서 및 감사의 publication dependencies 포함 확인
- [ ] 확정 최종 HEAD에 대한 check:merge 실제 결과
- [ ] 확정 최종 HEAD의 clean clone, real-origin LFS 14 및 public 14 실제 검증
- [ ] 보호된 정상 push와 실제 게시 HEAD 검증

준비된 실행 계획·LFS 전송 영수증은 위 체크박스를 통과시키지 않는다. 이전 실패 기록을 보존하고 최종 실행 결과를 별도로 추가한다.

## 실제 기하 측정 범위

[기하 영수증](geometry-final-receipt.json)은 fd68f124 실행을 그대로 기록한다. 4,827초, remote/fetch exit 0, 2,202개 측정 조건의 실패·미열림·미등록 프레임·page error는 0이다. 빈 공간 WARN 693개는 실패와 구분해 보존한다. 설계상 도달 불가 4개 화면의 60개 조건은 미측정이며 저장 조건 총수는 2,262다.

보호 source 4,277개, native input 1,977개 및 private fixture 8루트/126파일의 시작·종료·수집 바이트가 보존되었다. 실제 수출 tracked 상태는 clean이었고 원격에서 바뀐 tracked 출력은 기하 결과 JSON 하나였다. db17321a와 runtime 입력이 일치한다는 연결은 최종 미래 HEAD 검증을 대신하지 않는다. 전체 자연 플레이나 모든 게임 상황의 검사도 아니다.

기존 watch·closure 감사 사본의 PENDING 문구는 당시 기록으로 보존한다. 현재 기하 상태는 새 영수증과 `gates.json`에 표시하며 과거 문서를 덮어쓰지 않는다.

[독립 기하 검토](phase2-final-geometry-review.md)는 source 4,277 실제 바이트·native 1,977 목록/해시·private 126 바이트를 재검산했다. prepared/export freeze의 차이는 createdAt만이며 source drift가 아니다. shots 0을 보존하며 이 결과를 새 native 이미지 검토로 해석하지 않는다.

## 실제 ed83 관문과 문서 후속 커밋

DGX `astra-phase2-final-merge-ed83fe4`는 exit0, 기하 실패/예외/override0, 변경37파일 린트·타입·build 예산94.40/150MB를 통과했다. 추이115커밋 지연 경고는 비차단이며 보존한다. dd46의 C25 봄 지문 사유 누락 실패는 [원래 영수증](dd46-merge-failure.json)으로 남기고, ed83에서 결정 RB-SPRING9-PIN1만 추가했다.

DGX `astra-phase2-final-clone-ed83fe4`는 실제 내부 HEAD ed83·tracked clean, real-origin source LFS14 및 public 일반PNG14 바이트, 시험4,886/4,886(실패·취소·skip·todo0), 타입·build를 통과했다. 외부 입력26,845와 tracked26,841/LFS6,384의 전후 동결도 일치했다. [클론 영수증](ed83-clean-clone-receipt.json)·[병합 검사 영수증](ed83-merge-receipt.json)은 실제 실행 HEAD를 고정한다.

이 문서 정리는 완료된 일곱 설치/이전 항목을 작업 장부에 반영하고 STATUS·ROADMAP을 함께 갱신한다. 체크는 해당 구현·실제 장면 검증 완료를 뜻하며 본선 게시 완료는 뜻하지 않는다. 이 문서까지 포함한 후속 HEAD는 다시 최종 검사와 깨끗한 클론을 거친 뒤 보호 push하며, 그 실행을 ed83 결과로 대체하지 않는다. 전체 설치1~3단계·REGION·CLOUD·HEIGHT는 계속 미완료다.

## be576 게시 뒤 공식 추이

공식 DGX `infra-TREND-be576dbe-be576db` exit0/fetch0. 큰 도시5배·새 게임3배의 자동 A/B 네 짝 비교에서 할당률·GC·canvas·GC 뒤 heap 모두 95% 폭 기준 소음 안이었다. 비교 조상은90d9이며 현재 REGION/CLOUD/HEIGHT 통합의 성능 판정이 아니다. [원본 영수증](be576-official-trend.json)·[요약](be576-official-trend.md).
