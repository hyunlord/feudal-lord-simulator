관문: ①테스트 7/7 · ②UI 동일 SHA 5/5 상태 · ③깨끗한 클론 2577/2577 · ④문서 링크 121/121 — 통과

# B1 공통 데이터 계약 + 콘텐츠 문서 이관

작업 브랜치 `claude/b1-contracts`, 기준 본선 `0ab8bde`. 게임 규칙·밸런스·저장 형식·표시는 바뀌지 않았다. `src/render/**`, `src/world/boundary/**`, `public/assets/**`는 수정하지 않았다(D1a 세션 소유).

## 커밋

| 커밋 | 내용 |
|---|---|
| `3eef83a` | `src/contracts/` 타입·효과 파이프, 어댑터 4곳, 단위 테스트, 표시 캡처 스크립트 |
| `98172d4` | 콘텐츠 설계 v1.1·로드맵 v3(v2.3 보존)·에셋 계획 v1·조사 원문 이관, 결정 K1~K12, 설계서 17절, 방앗간 관찰 |
| `5e35525` | `nanoid` 3.3.17→3.3.19 (잠금 파일만) |
| 이 보고서 커밋 | 보고서·STATUS |

## 관문

**① 타입·파이프 단위 테스트** `tests/dataContracts.test.ts` 7/7.
- `SourceRef` 10종·검증: 10종 정확 일치, 빈 id·미지 종류·비문자열 detail 거부.
- 등록·조회: 대상별 결과는 등록 순서다. `startedAt` 포함, `expiresAt` 제외. 대상 식별에 종류가 포함되고, 중복 id와 비유한 틱은 거부한다.
- 만료: `expiresAt ≤ tick`만 제거·반환한다. 같은 id는 만료 뒤 재등록할 수 있다.
- 직렬화 안정성: `EffectSpec` 5종 모두 `jsonSafetyIssues` 0. 같은 등록 순서는 같은 JSON이고, `fromJSON(toJSON)`은 바이트 단위로 왕복한다.
- 어댑터: 원인 항목과 `firstBlocker`의 `sources`, 시장 판매의 `sourceRefs`, 예측 줄의 `severity`↔기존 표시 키.

**② 기존 UI-1·UI-2 표시 바이트 동일**
- 캡처 도구: `scripts/contractDisplayCapture.tsx`. 상태 5개(기본 새 게임, v4 픽스처 `new-game`·`population-176`·`palisade-construction`·`timber-shortage`)마다 다음을 렌더한 결과를 SHA-256으로 묶는다.
  - UI-1: `CauseLegend`·`BuildingInspector`·`DiagnosticCard` 정적 마크업, 원인 스냅샷, `firstBlocker`, 원인 지도 캔버스 호출 기록.
  - UI-2: 가로·세로 4칸 간격 × 전 건물 종류의 `PredictionPanel`, 도로 예측, 선택 공사장 경로, 렌더 런타임의 옛 줄, `EraConsole`(초안 포함).
- 결과: 기준 `0ab8bde`(깨끗한 detached 워크트리) = 이 브랜치 = `2a3e3da6d7c78125c262fe10c57a7fb70a881c3b1714769f93b9362bda22c924`. 5/5 상태, 캡처 파일 5개 모두 `cmp` 일치. 원본은 `display-digest-before-0ab8bde.json`, `display-digest-after.json`.
- 민감도 대조: `ok` 기호 한 글자를 바꾸면 `a039941d…`, `EraConsole`의 표시 키 매핑을 빼면 `b7043fff…`로 달라진다(되돌린 뒤 원 파일 SHA 일치 확인).

**③ 깨끗한 클론 전체 회귀** GitHub `claude/b1-contracts`를 새로 클론해 `npm ci` → typecheck → build → `npm test`(Phase 9 포함)를 실행했다. 결과는 2577/2577, 실패 0이다(코드 커밋 `5e35525`, 기존 2,570 + 신규 7). 같은 클론에서 표시 캡처도 `2a3e3da6…`로 일치했다. `npm audit` 취약점 0. 스키마 감시(`saveSchemaFingerprint`)는 통과했고 `SAVE_SCHEMA_VERSION`은 4 그대로다(상태 무변경).

**④ 문서** `docs/README.md`·결정 목록·STATUS·이관 목록·설계서의 상대 링크 121개가 모두 파일로 열린다. 결정 목록에는 K1~K12(K2·K4 확정, 나머지 권고, 2026-09-24)를 추가했다. D1~D7은 기존 행을 유지하고 출처를 보존된 `ROADMAP_v2.3.md`로 고쳤다. 로드맵 v3에는 D1~D7 기록이 없다.

## 어댑터별 변경 위치

| 대상 | 위치 | 방법 |
|---|---|---|
| 원인 등록표(UI-1) | `src/ui/causeRegistry.ts` `CauseDetail.sources`, 생성 7곳(`houseProgressModel.ts`·`storageOverflowModel.ts`) | 진단 대상 건물 `{type:"building", id}` 한 개 |
| `PredictionLine[]`(UI-2) | `src/ui/predictionTypes.ts`, `PredictionPanel.tsx`, `EraConsole.tsx`, `placementPrediction.ts`, `wallPrediction.ts`, `predictionRegistry.ts` | 줄 = 계약 `{severity,text,sources}` + 목록 키 `id`. 표시는 `PREDICTION_SEVERITY_TONE`(info→neutral, ok→positive, warn→warning, block→negative)으로 기존 CSS·기호 키 유지 |
| 수입 기록(A″ 4항) | `src/engine/coinLedger.ts` | `sourceRefs: SourceRef[]`, `buildingSource(marketId)`. 저장 모양 동일 |
| `firstBlocker` | `src/ui/houseProgressModel.ts:firstBlocker` | 반환 `CauseDetail`에 `sources` 포함 |
| 남은 옛 줄 1곳 | `src/render/placementPredictionRuntime.ts:29-30` (수정 금지 영역) | `LegacyPredictionLine`을 받아 `toPredictionLine`이 표시 전에 변환. D1a 병합 뒤 제거 |

## 방앗간 관찰 기록 (수정 아님)

[seed별 표](mill-density.md). R1-fix 가드레일(`0725764`)의 24필지 도시는 건물/필지 3.79~4.12, 방앗간/밀밭 0.64~0.80(16~20/25~26)이다. 기준선 `7db9df85`는 3.17~3.33, 0.33~0.43(8~9개)이었다. 밀 0 방앗간 0%로 가드레일 안이다. 원인 후보는 R-8 밀 처리 복구와 `FOOD_PRODUCTION_MARGIN_FACTOR = 1.05`이며 B2/C1로 넘긴다. 새 자동 성장은 돌리지 않았다(UI·문서 작업, AGENTS.md).

## 다음 후보

- D1a 병합 뒤 `placementPredictionRuntime.ts`의 옛 `tone` 줄을 `severity`로 바꾸고 `LegacyPredictionLine`·`toPredictionLine` 분기 제거.
- 예측 줄 `sources`는 모두 빈 배열이다. 계획 중인 가상 시설은 아직 실체 id가 없어서다. B2~B4가 처음으로 실제 출처(정책·사건·시나리오)를 채운다.
- 원인 항목의 출처는 지금 진단 대상 건물이다. 공급자(`providerId`)를 두 번째 출처로 둘지는 B3 장부 설계 때 정한다.
- 이관 문서의 `CONTENT_DESIGN_v1.md` 같은 원문 파일명 표기는 원문대로 두었다(저장소 이름과 다름).
