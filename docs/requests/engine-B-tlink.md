# EB-TLINK — 개별 답변의 인과 흔적 시제품

목표: 성공한 각 답변의 소속·실제 선택 대상·공존 원인·결과 관측 상태·표시 문구 ID를 보존한다.
만들 것: 격리 `codex/engine-b-tlink`의 코어 trace/history 시제품, 필요한 저장 이행 후보, 지정10사건 회귀, 실제125년 seed1~3 측정·규칙 불변 증거.
만들지 않을 것: 본선 병합, 게임 규칙·봇 정책·정본 조건 변경, 점수 분모/미래창 완화, 추정 root 연결의 승격.
관문: 성숙한 무거운 답의 정확한 자기 ID 후속 연결≥80%; 남은 답은 실제 조건/관측 증거로 설명; 규칙 해시 불변; 지정10사건 시험.
필수 조건: 원본·실행·소스 해시, 저장 영향, 병합 겹침 목록, 엔진 독립 검토.
시간 상한: 원격 실행은 공식 실행기의 한 세션 실험1개 규칙을 따른다. 같은 실행을 중복 시작하지 않는다.
관련 원칙: P-C3 · P-D5 · P-T1 · A4 · A5.

## 상태와 기준

구현과 측정 중인 인계 기록. 기준 `64a16b5a6c1d91024415039db89bb88412528e15`, 격리 가지 `codex/engine-b-tlink`. 본선에는 올리지 않는다. 원래 TRACE-LINK 자리인 GROW-BLOCK 두 단계와 작은 묶음 뒤에 엔진이 검토·통합한다. MOD-SLOT 채택 뒤135→묶음7→묶음9 순서는 유지한다.

기존 승인 자료는292/816=35.78%다. 새 측정의 기준 소스가 다르면 동일 판 비교처럼 쓰지 않고 구분한다. 직접 링크는 답변 뒤12000틱 안의 실제 결과 because가 정확한 답변 ID를 가리켜야 한다. 즉시 완결을 미래 결과로 꾸미거나 조건부를 분모에서 제외하지 않는다.

## 사전 병합 겹침 목록

2026-10-10 02:47 KST 읽기 전용 확인: `claude/grow-block`의 `065e15640771703d7b25dcde22460bfc2dcb5ff7`은 기준 본선의 후손이다. 서로 다른 common repository이므로 이 목록은 현시점 실제 파일 차이이며 검토 때 다시 확인한다.

| 파일 | GROW-BLOCK에서 보존할 변경 | TLINK 예상 접점 |
| --- | --- | --- |
| `src/engine/history.ts` | 혼인·사망 spouseId, child/father, 공사 포기 기록 | 답변 이력·표시 ID 기록 |
| `src/content/historyCopy.ko.ts` | agency.site_abandoned·사유 문구 | 필요한 새 흔적 문구만 별도 검토 |
| `src/save/saveTypes.ts`, `src/save/migrations/index.ts` | GROW의 저장v55 연결 | 시제품 저장 이행은 최종 판 번호를 예약하지 않음 |
| `src/save/migrations/v54ToV55.ts`, `src/save/schemaFingerprint.v55.json`, `fixtures/saves/v55/*` | GROW의v55 사실 계약 | 시제품은 잠정v55로 검증한다. 같은 경로가 충돌하므로 엔진이 GROW 이행과 합치고 최종 번호를 다시 지정 |
| `src/engine/townAgency.types.ts`, `src/engine/townAgency.ts` | charterWallFailure·abandonedSites | 규칙 변경 금지·읽기만 |
| `src/ui/lord/decisions/lordMattersDue.ts`, `src/ui/hud/autoPauseModel.ts`, `src/ui/hud/autoPauseCopy.ko.ts`, `tests/lordAutoPause.test.ts` | 기한 표시·중복 자동 정지 제외 | 기존 동작 보존 |

현재 GROW 추가 변경에는 `decisionTrace.ts`, `decisionTrace.types.ts`, `history.types.ts`, registry 계열 파일이 없다. 의미상 독립을 보증하지는 않는다. 핵심 엔진 커밋은77c6420f1·253683af9·566ce1f22·697b35b57이다.

## 검토 전에 채울 증거

- 시제품 커밋과 실제 바뀐 파일 목록
- 개별 성공 답변 ID/소속/선택별 대상, 무효·반복 명령 제외
- 실제 결과별 원인 공존, 덮어쓴 설정·취소·후속 재주문 배제
- 전후125년 실행과 직접/조건부/관측부족/없음 수치
- 규칙 해시 비교의 정확한 제외 경로와 게임 상태 보존 범위
- 표시 당시 문구 ID·구 저장 기본 문구·이행 후보
- 지정10사건과 저장·결정론 시험, 엔진 검토 항목

## 구현 경계와 원격 분류

- 개별 답은 `trace.answers`에 자기 이력 ID와 기존 묶음 ID, 자기 대상, 실제 기억 근거를 보존한다. 기존 묶음은 기록 생성 순서 보존용이며 자동으로 답의 원인으로 승격하지 않는다.
- 기존 결과 기록의 `because`만 실제 답 기여로 바꾼다. 계절 결산은 보존된 실제 후속 현금 거래와 거래 당시 소유권을 확인한 뒤 `traceLedgerEvidence`를 함께 보관한다. 같은 tick의 명령 비용은 후속 수입 근거가 아니다.
- 표시 문구는 실제 카드 클릭 명령이 넘긴 `displayEntryId`와 원본 ID를 답변 이력에 저장한다. 구 저장·봇의 없는 정보는 모른다고 유지한다.
- 잠정 저장v55는 GROWv55와 충돌한다. 엔진이 최종 번호와 이행을 합친다. 구 묶음의 별명으로 옛 답 멤버십을 만들지 않는다.
- REMOTE 분류:125년 판·가드레일은 실험 줄, `test:changed`와 바뀐 화면의 기하 감사만 관문 줄이다. 2026-10-10 `engineB-tlink-baseline-guardrail-cf3fa94`를 잘못 관문으로 등록한 실행은 직접 종료했으며 통과 증거로 사용하지 않는다.
