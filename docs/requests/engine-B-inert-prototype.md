# EB-INERT 엔진 인계

상태: 격리 가지의 구현·회귀 검사 완료, 공식 판/비영주 해시 관문 측정 중. 엔진 채택·본선 병합은 하지 않았다.

가지 `codex/engine-b-inert`, 규칙 소스 `72c77f6157ac91f21d9fde73cf262702d0f787a0`, 기준 `db750c16486a283e7f320ceaca70504589a00f93`.

## 규칙과 실제 효과

| 답 | 실제 대가 | 반복·기간 | 흔적 |
| --- | --- | --- | --- |
| 특허 거절 뒤 상인 −100 | 거래분 총수입의4분의1 감소, 실제 수입으로 제한 | 네 철 손실. 그 뒤에도 최초 거절에서 열두 철 또는 관계>−80까지 재청원 억제 | 최초 정확한 청원 ID의 답→기존 철 결산의 marketLoss |
| 감사 묵인 | 드러난 빼돌림+오류는 미회수로 유지, 이후 각 철 ceil(합/16)의 새 오류 | 실제 재직 네 철. 교체 때 후임에게 이관하지 않으며 전임 재임명 때 잔여 기간 재개 | 감사별 정확한 답→실제로 발생한 오류의 철 결산 |
| 손실0·충성도100 감사 | 기존 clean 보고, 추가 무거운 결정 없음 | 목록·미리보기·직접 답변 API 모두 무효과 상신 차단 | 기존 감사 보고 |

과거 손실을 다시 청구하지 않는다. 기존 중복 특허 청원은 다음 철 청지기 보고로 닫아, 답할 수 없던 청원을 영주 미응답으로 기록하지 않는다. 모든 새 경로는 영주 모드에 한정한다.

## 바뀐 파일

핵심: stewardship.ts/types + stewardshipConsequences.ts/config. 흔적: decisionTrace.ts, decisionTraceStewardshipLosses.ts, decisionTraceEstateRelations.ts, history.ts, historyCopy.ko.ts. 저장: 선택 필드 검증, 잠정 v57 중립 이행, 표준 fixture·실제 처리 준비 fixture·fingerprint. 측정: engineBInertRun/Capture/Measurement/ReviewedSources, 기존 producer의 수동 관측 훅과 고정 프로필 확장. 전체 경로는 [구현 증거](../verification/eb-inert/implementation.json)에 보존한다.

## 저장 영향

선택 필드 charterResistance, toleratedErrors, audit.unrecovered, summary.charterLoss/toleratedLosses. 구판을 올릴 때 압력이나 과거 원인을 역으로 만들지 않는다. 잠정57은 엔진이 최종 판 번호를 정하고 GROW 저장 이행과 통합해야 한다. 재생성 가능한 준비 fixture는 자연 플레이 증거가 아니다.

## 엔진 검토와 병합 접점

2026-10-10 GROW 가지 `/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill-grow`, HEAD50fbcbece14be62decde80f317e2d727b28cec8e, 저장55. tracked clean, 미추적 scripts/tmp/ 존재. 이전98667ca8 뒤 추가파일과 EB-INERT의 새 직접 교집합은 없다. 기존 TLINK부터의 history.ts/historyCopy.ko.ts, saveTypes.ts/migrations/index.ts, v55 fixture/fingerprint 충돌은 여전히 별도 병합 대상이다. GROW의 timberTrade 등 실제 규칙 변화 후에는 채점 소스 핀을 의미 검토 없이 교체하지 말고 통합판으로 다시 측정한다.

엔진은 네 철·거래분4분의1·열두 철·관계−80·오류합/16의 조정값, 청지기 재임명 수명, 원인 보존, gross income와 최종현금의 차이, 실제 판의 무효과0과 결정빈도 비증가를 검토한다. UI 숫자와 다음 행동은 render-A-inert 요청서로 전달했다. 텍스트 단위 시험은 화면 수용 판정을 뜻하지 않는다.

RR22 수동 안전 목록 확대 요청은 철회했다. REMOTE의 그림자 측정(a′) 판단을 기다리며 공유 관문 코드에는 변경하지 않았다. 본선 통합 때 엔진의 src 변경에 따른 기하 감사는 별도다.

## 현재 검증과 공식 실행

Mac 관련238시험 통과(지정10사건22시험 포함), 추가 읽기모델·저장21통과/7기존skip, 타입 검사·변경소스 ESLint 통과. 의도적인 실패→교정 회귀 로그와 해시는 구현 증거에 있다. 단위 시험 합계를 중복해 세지 않는다.

공식 DGX 판: `engineB-inert-125-72c77f6`, 원본 수집과 재생·명령별 전후 관측을 포함한다. 비영주 비교: `engineB-inert-native-72c77f6`, 기준db750 대 제품72c77f6, 동일 Node24.21.0/linux aarch64/lock, seed1~5·24필지·최대1200000tick의 원시 최종 상태 SHA를 비교한다. 조기 종료를 보존하며, baseline JSON을 쓰는 표준 remote:guardrail 실행과는 구분한다. 빌드: `engineB-inert-build-72c77f6`. DGX 빌드는 exit0(명령56.9초)이다. 125년 판·해시 비교는 대기 중으로 수치 통과나 본선 채택을 주장하지 않는다.

이전 공식 답변 기준: 가622/816(76.23%), 나194, 다0, 관측부족20, 미래 직접334/816(40.93%). 연간 무거운 답 median/max는 seed1 2/5, seed2 2/6, seed3 3/6. 새 판은 실제 분모와 답 집합으로 각각 비교한다.
