# 현재 상태

갱신: 2026-09-24(B1). 제품 본선: `codex/phase15-organic-ground`.

## 현재 단계

- **B1 공통 데이터 계약**(Claude Code, 이 작업): `src/contracts/`에 설계서 11절의 `SourceRef`(10종)·`EffectSpec`(5종)·`AppliedEffect`·`PredictionLine` 타입과 파생·비저장 효과 파이프(`EffectRegistry`, 아직 읽는 규칙 없음)를 두고, 원인 등록표·예측 줄·시장 판매 수입·`firstBlocker`를 어댑터로 연결했다. 게임 규칙·저장 형식·표시 변화 없음. 콘텐츠 설계 v1.1·로드맵 v3·에셋 계획 v1·조사 원문을 이관했다. [B1 보고서](verification/b1-contracts/REPORT.md).
- **D1a 곡선 렌더**(Claude Code 렌더 세션, `claude/d1a-curved-render`): 진행 중. `src/render/**`·`src/world/boundary/**`·`public/assets/**`는 그 세션이 소유한다.
- 남은 어댑터 한 곳: `src/render/placementPredictionRuntime.ts:29-30`이 아직 옛 `tone` 줄을 만든다. `toPredictionLine`이 표시 전에 변환한다. D1a 병합 뒤 `severity`로 옮기고 `LegacyPredictionLine`을 지운다.

## 마지막 종료 작업

**R1-fix 관문 통과·종료**: 코드 고정 `0725764`에서 R-T17/17, 기준선 `7db9df85` 조건 가드레일5/5, 원본 선택 탐침 재현0/7, 느린 결정69/69를 확인했다. 서비스 우선권·실제 공사 인력·가동 중지·석벽 병렬·취소 화물 귀환·판매 비축·목재/식량 회복·검색 예산을 구현했고 저장v3/v4로 이행했다.

모든 seed가 L4 24/24·서비스 공백0·미완료 공사0·연속 안정24,000틱·시설 상한·경고10% 미만, 실제25분 이내다. 소스 고정본 전체2,570/2,570(Phase9 포함)·typecheck·build 통과. 마지막 보고 커밋의 새 클론 검증은 이 커밋 작성 시점에 대기 중이다. 검증 영수증은 `/tmp/fls-r1fix-20260924/final-verification/receipt.json`과 최종 증빙 ZIP에 남긴다. [최종 보고서](../output/rule-repairs/REPORT.md). 관문 밖 추가 구현은 하지 않는다.

**B11 렌더 계측**(Claude Code, 렌더·스크립트·테스트만): 증빙 모드 전용 단계별 시간·canvas 호출 수(`src/render/renderStageProbe.ts`, 단계 합 = frameWork 99.9~100%, 증빙 모드 밖 미실행 테스트), 벤치 `scripts/renderStageBenchmark.mjs`. P-F1(초반 도시 프레임 150~200ms)은 headed·headless 모두 GPU에서 재현됐고, 원인은 도로 칸 패턴 `fillRect`였다. 다각형 `fill`로 바꿔 수정했다(그림 동일, 인구 176 rAF 150→16.7ms). 기준선 14칸과 D1a 제안은 [B11 보고서](verification/b11-render-metrics/REPORT.md). 다음 후보: 새 게임 온보딩 오버레이 14ms/프레임.

**S0**: B8 merge `7968bcf`, 이식성 `dba23cb`, 공통 좌표 타입 `afb3321`, 검증 도구 `e97d6a8`·`3c52fa4`, 상태 기록 `b8e9fb4`·48필지 `ca70fbc`. 새 임시 클론 전체 2442/2442(Phase 9 포함), typecheck·build, 저장 결정론2/2·실제 이어하기, 문서 지도22/22를 확인했다. 종료 증빙 커밋에서도 새 클론 전체 검증을 실행하며 최종 receipt는 `/tmp/fls-s0-final-verification.json`. [S0 보고서](../output/trunk-baseline/REPORT.md).

24필지 seed1/2/4/5는24필지·seed3은13필지, 모두 관측 종료 시 L4=0. 별도48상한은48필지 도달·목책2/44,42구간 reserve_held. 각각25분 한 번의 **상태 기록이며 가드레일 판정이 아니다**. 기존 기준선 보존.

이전 종료 이력: **A⁵-1 · `5f38625`**: 비축·창고 포화 교착 수정은 사용자가 수용했다. E1~E4 4/4, 가드레일은 2/5이며 seed 1 실패·seed 2/3 미판정이다. 이 상태를 5/5 통과로 해석하지 않는다. 전체 회귀 2,304/2,304·typecheck·build는 해당 종료 커밋에서 통과했다.

## 다음 작업

**B2 시나리오·시대**가 다음 엔진 작업이다(로드맵 v3). K4(석벽 선택 프로젝트)와 시대 5기가 B2 범위이며, 현재 번영 승리의 석벽 완공 조건은 B2 지시서가 바꾸기 전까지 유지한다. [로드맵](design/ROADMAP.md)의 선행 조건을 따르며 문서 이관만으로 착수하지 않는다.

## 알려진 문제

- **시설 밀도(관찰, 미수정)**: R1-fix 가드레일(`0725764`)의 24필지 도시는 seed 1~5에서 건물/필지 3.79~4.12, 방앗간/밀밭 16/25~20/25(0.64~0.80)이다. 기준선 `7db9df85`는 3.17~3.33, 8/24~9/21(0.33~0.43)이었다. 밀밭≤·밀 0 방앗간 0%로 가드레일 안이지만 도시가 다시 시설 밀도로 기울 수 있다. 원인 후보는 R-8 밀 처리 복구와 식량 여유 `BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR = 1.05`(`src/content/balanceConfig.ts:12`)이며, B2/C1에서 판단한다. [seed별 표](verification/b1-contracts/mill-density.md).

## 결정 대기

- 설계서 12·13.0절의 권고안 일괄 확정, Steam Deck 출시 목표 수준.
- 자동 성장 기본 상한 8→24, 한 판 시간·틱 속도, 새 L3/L4 후보 설치.
- D24 자재 재관측은 보류 유지.

[결정 목록](decisions/README.md)의 상태를 참조한다. 설계서 14절의 기준선 교체 문구보다 최신 S0 지시서의 상태 기록·기존 기준선 보존이 우선한다. [문서 지도](README.md)에 원문 간 시점 차이를 기록했다.
