관문: 통과 — ① `population/marketAccess.ts`의 UI import 0(ESLint 억제 1건·한글 목록 8건 삭제) · ② 사람 경로(명령 재생: 1장 생존·필지 채움 → 헛간 보리·첫 에일)가 가드레일마다 함께 돎(DGX 확인) · 규칙·결정론 불변(전체 회귀 3,345/3,345, C25·해시 고정값 그대로) · 클론 CLONE

# CODE-1a 보고서 — 시뮬레이션의 UI 문구 의존 제거, 사람 경로 상시 관문

지시서: CODE-1(첨부 `CLAUDE_CODE_WORK_ORDER_CODE1_layering-i18n-app.md`)의 CODE-1a 절, 사용자 지시 2026-09-28(1.5시간). 초상 풀 3차 반입은 FIX-6에서 끝나 뺐다. 결정 CODE1A-D1·D2.

## ① 계층
- `marketAccessDiagnosis`는 사유 코드와 거리·범위만 돌려준다(`label` 없음). `ui/serviceDiagnosisCopy.ko` import를 지웠다.
- 화면의 시장 진단 문구는 원래 UI가 제 진단(`serviceDiagnosis`)으로 만든다. 엔진의 문구는 쓰이지 않았다. UI는 타입에 `label`을 더해 쓴다(`houseDiagnosisModel.ts` 한 줄). 화면의 글은 바뀌지 않는다.
- ESLint `--prune-suppressions`로 `no-restricted-imports` 억제 1건을 지웠다(남은 억제 0). 한글 문자열 목록도 `--write-baseline`으로 marketAccess 8건을 줄였다(463 → 455).

## ② 사람 경로 상시 관문
- **`tests/humanPathChapterOne.test.ts`**(새)
  - 명령만 쓴다: 튜토리얼 카드(속도 1), 거리 도로·우물 둘·필지 12 칠하기.
  - 1302년 끝까지 둔다. 60명 이상, 유지비 정지 0, 1년 넘은 공사 0, 방앗간 인력, 새 필지 8개 이상 입주를 본다.
  - 거리 명령은 FIX-4 관문 ②와 같은 도우미(`tests/helpers/humanStreet.ts`)를 쓴다.
- **`tests/humanPathAle.test.ts`**(C4): 헛간을 보리로, 가마 놓기, 첫 에일이 한 해 안에 팔린다.
- **`scripts/remote/tasks.sh guardrail`**
  - seed 실행 옆에서 `tests/humanPath*.test.ts`를 돌린다. 결과는 `guardrail/human-path.json`·`.log`다. 실패하면 가드레일 실행이 실패한다.
  - DGX 연결 확인: seed 1을 3,000틱으로 짧게 돌렸다(짧은 실행이라 seed 판정은 관문 아님). 사람 경로는 2/2, 10초였다.
- `docs/REMOTE_RUNS.md`에 한 줄을 적었다.

## 필수 조건
- 전체 회귀 `00da814` 3,345/3,345(C25·해시 고정값 재기록 없음).
- 깨끗한 클론 CLONE.
- 병합 전 검사: 고정값 재기록 0, 한글 새 문자열 0, ESLint 새 위반 0.
- 가드레일은 돌리지 않았다(규칙 무변화).

## 소요 시간
- 15:34 시작 → END 마감(KST, 명령 시각).
