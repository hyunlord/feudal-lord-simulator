# 1315년 이후 목책 공간 탐색 지연 — 읽기전용 소스 감사

기준: `codex/phase15-organic-ground`, HEAD `5ad4b8340b2ca14bfe99fb3e17b950e2cb064e0b`. 조사 시각 2026-10-03T05:04:34Z 이후. 범위는 부모가 제공한 DGX inspector/profile 파일과 현재 소스의 좁은 경로 검토다. src 수정·원격 실행·원인 분리 A/B는 하지 않았다. 기존 D 콘텐츠 기반정리 완료 상태는 그대로다.

**판정: 장기 실행의 지연과 목책 기하 탐색의 CPU 집중은 관측됐다. 관측된 건축 후보 경로의 검색 budget은 내부 목책 후보 탐색을 제한하지 않는다. 무한루프 판정은 기각한다.** 방침 전환은 해당 탐색을 활성화할 수 있지만, 지연의 독립 원인으로 확정할 수 없다.

## 실측과 한계

| 근거 | 직접 확인한 사실 | 여기서 확정하지 않는 것 |
|---|---|---|
| `debug-stack-01.json` 04:58:03.367Z | well 후보 `(60,3,1,1)`, margin 3, waterReach false; LandEnvelopes→Geometry→wallSpace→findBuildSite→townProposals 경로 | 이 파일에는 tick 문맥이 없어 02와 같은 tick이었다고 단정하지 않음 |
| `debug-stack-02.json` 04:59:15.080Z | 후보 `(5,1,1,1)`, margin 2; 내부 tick60450/main60449, pop528, hamlet,64×64; runAutoplaySearch limit1920 | 서로 다른 후보는 진행 정황이나 캐시 hit/miss 수·총 후보 수는 미측정 |
| `debug-stack-03.json` 05:01:12.519Z | 내부 tick60840/main60839, 같은 인구·era·격자 | 02 이후 390tick 전진했으므로 동일 위치의 영구 무한루프라는 설명과 맞지 않음 |
| `debug-profile-summary.json` | 10.454566초,646 samples, Palisade LandEnvelope+Geometry 623(96.4396%) | sampling 비율은 함수 CPU 집중 증거. 정책별 독립 비용 차이·전체150년 평균 TPS·전용CPU 성능은 아님 |
| `repro-1315.fls.json` | 저장 tick60000의 `state.agency.policy`는 **revenue**, church subsidy60 | 전환 전 저장본. 후속 commands-live 로그와 함께 읽어야 함 |

추가 확인: `commands-live.jsonl`에는 tick60061 set_estate_policy(stability), tick72073 set_estate_policy(revenue), tick78235 confirm_palisade_proclamation이 모두 stateReferenceChanged=true로 기록됐다. 따라서 정책 전환과 이후 진행은 실측이다. 이 로그는 동일 상태의 독립 A/B가 아니다.

부모가 보고한 NI19 및 공유 CPU 경쟁은 환경 조건이다. 소스 비용과 환경 지연은 동시에 존재할 수 있다. 이번 조사에서 nice/CPU 경쟁을 바꾼 비교 실행은 없다.

## 검색 budget: 보호되는 곳과 우회되는 곳

- `src/engine/autoplaySearchBudget.ts:12–17,22–32`: 한도1920은 **명시적인 spendAutoplaySearch 호출 횟수**를 세는 협력적 작업 예산이다. 경과시간 제한이나 함수 선점이 아니다.
- `src/engine/autoplay.ts:131–147`: findBuildSite는 후보 사이에서 exhausted 여부를 확인하지만 스스로 예산을 소비하지 않는다. 일반 내부 타일 목록이면64×64에서 최대62×62 후보를 받을 수 있다. 이는 코드상 상한 예시이며 이번 실측 후보 수가 아니다.
- `src/engine/autoplay.ts:158–168`: 일반 합법성 확인 다음 **wallSpace를 먼저** 검사하고, 그 뒤 serviceSpace 등을 검사한다. 뒤 검사에 budget 소비가 있어도 현재 wallSpace 호출을 중간에 끊지 못한다.
- `src/engine/autoplayWallSpace.ts:48–55`: 후보를 footprint/core/anchor에 추가하여 **raw computePalisadeProposal**을 직접 부른다. 여기에는 spend 또는 내부 한도 전달이 없다.
- `src/world/palisadeGeometry.ts:602–645`: primary 시도 후 전체 anchor 집합의 margin2·3 envelope, 이어 footprint를 하나씩 anchor에서 뺀 집합마다 margin2·3 envelope를 시도한다. 생략된 footprint도 clearance/검증 대상에는 남는다. 후보가 실패할수록 의도적인 대체 경로 탐색이 커질 수 있다.
- `src/world/palisadeLandEnvelope.ts:6–83`: footprint 확장 셀, 행·열 채움, 경계 연결을 매 호출 계산하며 budget을 소비하지 않는다. 유한 배열·집합 순회이며 현재 증거에 무한루프가 없다.
- **혼동 금지**: `src/engine/palisadeFootprints.ts:170`의 computePalisadeProposalForState에는 candidateLimit이 있지만, 관측된 wallSpace 경로는 이 wrapper를 호출하지 않는다. 그 wrapper의 한도도 raw 탐색 내부 후보마다 걸리는 한도는 아니다.
- buildAction의 road fallback 후보24개 제한은 첫 findBuildSite 전체 탐색 제한이 아니다(`autoplay.ts:279–314`).

따라서 "limit1920이 있으니 wall 기하 작업도1920번 이내"라는 주장은 성립하지 않는다. 다만 실제 총 envelope 호출 수와 비용은 아직 계측하지 않았으므로 수치로 부풀리지 않는다.

## 캐시와 무효화

| 캐시 | 키·재사용 | 무효화/한계 |
|---|---|---|
| wallSpaceByState | GameState 객체 identity | 새 state이면 이 캐시에서는 miss. 아래 tiles 캐시 재사용은 가능 |
| wallSpaceByTiles | tiles 배열 identity + JSON layout | layout은 width,height,정렬 footprint 좌표·치수·id,building id/kind,building construction id/kind. tiles identity 또는 layout이 다르면 후보 Map까지 새로 생성 |
| wallSpace.candidates | tx,ty,width,height | 동일 geometry 안에서 완료된 true/false 재사용. **계산 중에는 값이 없고 끝난 뒤 저장** |
| coreProposalByState | GameState identity | core 기본 제안은 state별 계산. wallSpace tiles/layout 재사용 시 core 재계산을 피할 수 있음 |
| proposalCandidatesByTiles | tiles identity + layout + candidateLimit | 별도 wrapper용. 관측 raw 호출을 보호하지 않음 |

근거: `autoplayWallSpace.ts:14–55`, `palisadeFootprints.ts:133–155,170–192`. tick·인구·재고·일꾼·방침 자체는 wallSpace layout에 없다. **매 tick마다 반드시 캐시가 무효화된다고 말할 수 없다.** 불변 tiles 교체/실제 배치 변경은 재계산을 부를 수 있으나 이번 inspector에는 hit/miss·identity 추적이 없어 원인 확정 불가다. tiles의 변경 규약까지 감사하지 않았으므로 stale cache 버그도 주장하지 않는다.

## stability와의 연결

`townAgencyConfig.ts:77`에서 stability의 well 가중치는20이다. `townAgency.ts:367–374`의 opportunity는 subsidy 또는 policyWeight>=20인 종류를 검토한다. 같은 종류 제안이 아직 없고 건물+공사 수가 houses/4 기준 이하면 autoplayBuildAction을 호출한다. **따라서 stability는 추가 우물 기회 탐색을 열 수 있다.** 관측된 직접 townProposals→autoplayBuildAction 호출도 현재 소스의 이 위치와 맞는다.

그러나 다음은 분리한다.

1. [코드] well은 living core 종류이며 hamlet에서는 후보가 목책 anchor/core에 추가된다. hamlet이 아닌 well은 wallSpace에서 즉시 true다(`palisadeFootprints.ts:18–20`, `autoplayWallSpace.ts:19–24,50–53`).
2. [실측] 멈춰 보인 시점은 hamlet이고 well을 탐색했다.
3. [실측] commands-live.jsonl tick60061의 stability 전환 명령과 stateReferenceChanged=true를 직접 확인했다. tick72073에는 revenue로 전환했다.
4. [실측] tick60000 저장본의 revenue는 전환 전 상태이고, 관측된 느린 tick60450·60840은 stability 전환 뒤다. 시간적 선후관계는 확인됐지만 원인 분리 실험은 아니다.
5. [미검증] stability가 장기간 hamlet 체류를 야기했는지, revenue라면 같은 지연이 없을지, 그 정책만 바꾸면150년이 완료될지는 독립 A/B가 없어 판단하지 않는다.

`townAgency.ts:451–466,486–522`의 charterWallTried/layout skip은 planner의 era 탐색 억제다. 각 건축 후보의 wallSpace 증명 또는 opportunity 자체를 막는 장치로 읽으면 안 된다.

## 가설 비교

| 가설 | 현재 판정 | 남은 확인 |
|---|---|---|
| H1: 유한하지만 비싼 목책 탐색이 작업 예산 밖에서 반복 | **가장 강한 설명**: 세 stack, profile 집중, 직접 호출 구조 일치 | 정확한 저장상태에서 envelope/omission/후보 수 및 함수 비용 계측 |
| H2: tiles/layout 변경으로 캐시가 반복 cold | 가능한 증폭 요인, **미확인** | 실제 입력키 변화·cache hit/miss 계수 |
| H3: 로그만 안 나오거나 무한루프 | 순수 로그 정지만으로는 CPU 집중을 설명하기 어려움. 무한루프는 tick 전진으로 배제 | 공유CPU 경쟁이 벽시계 지연에 기여한 정도는 별도 |
| H4: stability가 유일 원인 | 활성화 경로는 확인, **인과 확정 불가** | 전환은 확인됨. 동일 저장본의 통제 비교는 미실행 |

## 최소 수정 방향 — 제안만, 구현하지 않음

1. **먼저 좁은 계측**: 후보·envelope·omission 수, cache hit/miss, geometry key 변화, spend 사용량을 집계한다. deterministic work를 세며 시간 제한으로 결정을 바꾸지 않는다.
2. **기존 유효 경로를 증거로 재사용**: 같은 geometry 키의 기본 목책 경로를 보관하고, 새 후보에 대해서 기존 경로의 모든 현행 enclosure/clearance/유효성 조건을 재검증한다. 통과하면 true, 실패하면 기존 완전 탐색으로 간다. 단순 기본 경로 충돌을 불가능(false)로 취급하면 안 된다. 전 조건 동치가 확인될 때만 빠른 긍정 경로를 채택한다.
3. **중복 기하 계산 캐시**: 동일한 tiles/grid/anchor/margin 입력의 envelope를 재사용할 수 있는지 확인한다. 후보마다 달라지는 acceptPath의 clearance/core 판정을 캐시 결과와 혼동하지 않는다. footprint 종류에 따른 core 포함 여부도 키 또는 재검증에 반영한다.
4. **예산이 반드시 필요하면 삼상 결과**: found/infeasible/**incomplete**를 구별하고 같은 입력에 대해 결정적인 순서로 이어서 탐색한다. 예산 중단을 false로 저장하거나 나머지 생략 후보를 영구 버리지 않는다. 여러 tick에 걸친 재개는 타이밍·선택 결과가 달라질 수 있어 별도 설계와 회귀 검증이 필요하며 즉석 최소패치로 주장하지 않는다.

피해야 할 변경: omission 전체 제거, 앞24개 등 임의 상한으로 부지 불가 확정, hamlet 벽 공간 보존 해제, stability 가중치 삭제로 성능 문제를 숨기기. 이런 변경은 향후 목책/칙허 가능성을 지키려는 게임 규칙을 훼손할 수 있다.

엔진 소유자의 검증 범위: 정확한 저장본 재현 → 기존/개선 결과 동치와 seed 결정성 → 오목한 마을·강·기존 목책·warm/cold cache → 바뀐 기하 키와 같은 치수/다른 core 종류 → 장기 실행. 이번 읽기전용 조사에는 그 실행 결과가 없다.

Graft: 이번 좁은 조사 성공8회, reported saved tokens 합40,706; 이전 D 기반정리와 별도 집계. 금액 정보 없음.
