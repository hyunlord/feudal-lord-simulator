# 문서 지도

먼저 [현재 상태](STATUS.md) → 해당 작업 지시서 → [설계서](design/DESIGN_MASTER.md) 관련 절 → [결정 목록](decisions/README.md) 순서로 읽는다.
설계 문서를 저장소에 옮기는 것은 그 안의 후속 기능을 지금 구현하라는 승인이 아니다. 현재 지시서의 범위·관문·시간 상한이 우선한다.

## 현재 설계와 계획

| 문서 | 용도 |
|---|---|
| [DESIGN_MASTER](design/DESIGN_MASTER.md) | v2.3 전체 설계, 확정·권고·보류 구분 |
| [ROADMAP](design/ROADMAP.md) | v2.3 단계와 선행 조건 |
| [결정 목록](decisions/README.md) | 설계서 12·13.0·14절 및 로드맵 결정 기록 색인 |
| [유기적인 땅 통합안](design/organic-world/SYNTHESIS.md) | 곡선 설계의 채택 기준, 세 원문 간 차이 해소 |
| [Fable v1](design/organic-world/fable-v1.md) | 설계 원문, 통합안이 채택한 부분만 적용 |
| [설계 v3-A](design/organic-world/v3-a/DESIGN_organic-world_v3_response.md) | 도판·탐침을 포함한 원문 |
| [설계 v3-B](design/organic-world/v3-b.md) | 저장·편집 계약 설계 원문 |
| [이관 파일·해시 목록](design/IMPORT_MANIFEST.md) | 첨부 본문 6개와 figures/probes 전체 30파일 링크·원본 SHA-256 |

## 보존된 이력과 구현 문서

- [기존 DESIGN.md](../DESIGN.md): 제품의 시각·조작 이력. 삭제하거나 새 설계에 맞춰 과거 기록을 다시 쓰지 않았다.
- [기존 DECISIONS.md](DECISIONS.md): 구현 당시 결정 기록. 새 결정 색인과 별도로 보존한다.
- [ARCHITECTURE](ARCHITECTURE.md), [DEVELOPMENT_STATUS](DEVELOPMENT_STATUS.md), [PROJECT_PROGRESS](PROJECT_PROGRESS_2026-09-20.md): 과거 구조·진행 기록. 최신 상태는 STATUS를 따른다.
- [B8 병합 절차](proposals/merge-b8-into-trunk.md), [B8 원 브랜치 검증](verification/b8-save/README.md): 저장 시스템 병합과 이전 증빙. S0의 병합 후 검증과 구분한다.
- [에셋 생성 기록 대장](provenance/ASSET_PROVENANCE.md): 생성·선택·설치 추적.
- [목책 운반 명세](wall-carry-contract.md), [도로 배치 명세](road-placement-contract.md), [경로 캐시 명세](routing-cache-identity.md): 현재 영역별 구현 계약.

## 충돌·시점 차이 목록

본문은 원형 보존했고 다음 차이를 코드 변경으로 해결하지 않았다.

| 기록 | 차이 / 현재 읽는 기준 |
|---|---|
| 설계서 14절·로드맵 S0의 기준선 교체 | 최신 S0 지시서 3절은 seed를 현재 상태로 기록하고 `baseline-7db9df85.json`을 교체하지 않는다. 성장 회복은 R1-fix다. |
| 설계서 14절의 Catmull-Rom·꼭짓점 흔들림·렌더 단계 설명 | 같은 절의 채택 기준인 통합안이 이동평균5+Chaikin2, 흔들림 없음, D1a/D1b/C1 분할을 우선한다. |
| 기존 DESIGN의 슬레이트 L3 및 초기 고정 명령대 치수 | 설계서 2절의 재료 기준 및 DESIGN 뒤쪽 UI-3 갱신을 함께 읽는다. 과거 자산 설명은 신규 제작 승인 근거가 아니다. |
| 기존 DECISIONS의 즉시 승급·기존 시장 판매 | 승급 유지 시간은 이미 후속 작업에서 바뀌었고, 시장 세입 구조 전환은 새 설계의 C2 후속 목표다. 원문의 설명만으로 경제 규칙을 바꾸지 않는다. |
| 설계서·로드맵의 후속 구역/정치/자유 곡선 기능 | 설계 상태이며 현재 구현 완료가 아니다. 각 작업 지시서와 관문이 별도로 필요하다. |

## 첨부에 없는 v3-B 보조 자료

v3-B 본문은 아래 보조 메모·도판을 참조하지만 ZIP에 없고 현재 로컬 프로젝트·Downloads 검색에서도 찾지 못했다. 원문을 보존했으며 빈 문서나 대체 그림을 만들어 채우지 않았다. 문서 지도에서 이관 본문으로 가는 링크는 열리지만, **v3-B 본문 내부의 아래 8개 상대 참조는 미해결**이다.

- `evidence/roads-walls.md`
- `evidence/placement-zones.md`
- `evidence/render-assets.md`
- `evidence/save-contract.md`
- `diagrams/02-boundary-contract.svg`
- `diagrams/01-architecture.svg`
- `diagrams/03-stage1-fixture.svg`
- `evidence/contract-challenge.md`
