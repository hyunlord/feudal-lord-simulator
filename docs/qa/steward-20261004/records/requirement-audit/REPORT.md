# R08 원목표 요구사항 감사 — 회차 진행 중 스냅샷

판정은 **CONTINUE_PENDING_ROUND_CLOSE**다. 원목표에 비춰 D·E의 작성 범위는 채워졌고 A·C의 이번 회차 작업과 B 추적도 있다. 그러나 읽은 시점 습지 실행은 진행 중이며 R08 최종 신규 심각도 판정·회차 최종 보고·root SHA256SUMS·ZIP이 없어 회차 또는 목표 완료를 선언할 수 없다. 기존 미해결 결함의 수리는 감독관 목표의 추가 종료조건이 아니다.

원목표는 INPUT_PINS.json 첫 행의 pasted-text-1.txt다. 아래 경로는 R08 묶음 기준이다. CHECKS.json은 직접 JSON 재계수·파일 SHA 검사이며 사료/모든 선택지의 의미를 새로 전수 검수한 결과가 아니다. source·런타임 의미의 이전 독립검수는 해당 포함 보고에서 승계한다. 엔진·브라우저·SSH 실행, 저장소/타인 파일 수정은 하지 않았다.

|요구사항|현재 포함 근거|판정과 좁은 한계|
|---|---|---|
|매 회차 pull·지정 가지/작업폴더|records/ROUND_START.json, ROUND_PLAN.md|HEAD5fb 및 Already up to date 부모 기록 있음. 이 감사에서 git pull 재실행하지 않음. 모든 필독 문서를 이번 회차 다시 읽었다는 증거로 source 핀 목록을 확대 해석하지 않음.|
|무수정·공식 DGX·nice·직렬·detach/keep|각 executed 결과와 records/fen-run-lifecycle/START_METADATA.json·SYNC_BOUNDARY.json|포함 실행 기록 범위의 운영 근거. 모든 타 세션/전체 시간의 무수정·직렬성을 전역 입증한 것은 아님. 이번 감사는 경량 로컬 읽기만.|
|A 시스템 지도 최초 작성·매 회차 갱신|SYSTEM_MAP.md, records/SYSTEM_MAP_HISTORY_THROUGH_R08_EARLY.md|갱신본 있음. 결정→성장→물류→인물/권리/약속 등 고리와 관측 공백 구별. 지도 존재가 모든 고리의 실행 검증은 아님.|
|A 불변식·seed/tick/save 재현|records/food-choice-review, records/storage-flow-review; inherited/top10의 SAVE01/A02/A05/B04 근거|새 식량 함수 재실행과 공개 3840틱 물류 관측, 과거 돈/사망자/원자성 등 최소 재현 입력 있음. 물자 양수 합계·4선택 반환·codec 성공을 세계 보존/장기 사망 원인/전체 결정론으로 바꾸지 않음. 모든 불변식 전면 통과를 목표로 추가하지 않음.|
|A 여러 seed·땅·방침 125–150년|records/long-run-inheritance/REPORT.md, inherited/R07/long-run·graphs·analysis|150년 5판, 3seed·2땅, 고정growth/stability 및 동적chalk 정책의 승계 근거. 750연간 행·127핵심 파일. R08 새 실행 아님. 중간 저장25개 제외를 숨기지 않으며 seed2를 고정정책 대조군으로 삼지 않음.|
|A 경제·결정밀도·사망·영지·세력·직업 이상 탐지|inherited/R07/graphs 4 SVG와 분석/요약, SYSTEM_MAP.md|요약과 그래프 존재. 기록된 인물 사망≠전세계 사망률, 명령 빈도≠재미. 습지 새 판 결과·비교는 아직 미완료.|
|B 영주 정체성·이유·봇경로·큰 사건·문구 감시|records/status-midround/STATUS.md, SYSTEM_MAP.md, inherited/top10, E 문구 검수|이전 B01/B02/B03와 원고/사실행 문제를 추적. 현재 모든 기능의 정상 UI 접근을 새로 검증한 것으로 주장하지 않음.|
|B 첫플레이 막힘10 추적|FIRST_PLAY_STATUS_R08.md, records/firstplay-current/TRACKING.json|10행·담당·현상·남은 확인 있음. 대표 과거 근거59파일 모두 SHA 확인. 첫플레이10과 결함 상위10은 서로 다름. 0/10 전면해결은 해결 미확인 상태이며 모두 현행 재현이라는 뜻 아님.|
|C 현행 장부·설치계획 대조|ASSET_STRATEGY.md, records/assets-current/REPORT.md·검사물|5885장부·858계획·858원본 현재 검사 승계, 불일치0. 승인44 보존. 후보 바이트 존재≠설치 완료/시각 품질.|
|C 중단/필요/순서·바이블 충돌 제안|ASSET_STRATEGY.md, install-plan-updated/R08_CURRENT.md|기존 영주관 연결 우선, 2×2 엔진/3×3 원화 계약 등 제안 있음. 새 제작·승인44 재작업·자동 설치로 확대하지 않음. 문서 앞 R07 표제는 승계 부분이며 R08 추가와 분리해 읽어야 함.|
|C 설치된 행 제외·새 승인 추가한 현재 계획|install-plan-updated/INVENTORY.csv·REMOVED.csv·EXCLUSIONS.csv·ORDER.md, records/assets-current|858행 계획 유지가 현행 해시 검사에 근거함. 새 설치 변화가 없다고 CSV를 억지 변경할 필요 없음.|
|D 누적200·근거·비용·장면|content/events.json·EVENTS.md·SOURCE_CATALOG.json·CHANGES.md|직접200ID/572선택, 사건별 필수 필드·선택별 tradeoff/costAxes/원장/연대기 필드 누락0. 사료 타당성·대가의 재미는 기존 의미검수 승계이며 이번 구조 검사만으로 보장하지 않음.|
|D 넓은창·범위·엔진이름·등록기 형식|content/registry.json·ADAPTER_CONTRACTS.json·COMMAND_CONTRACT.json·ENGINE_SUPPORT.json|200 registry entry, proposal_only_not_runtime_registry. 395명령 템플릿과 61사건 HOLD/60전선택미지원/sidecar0의 기존 감사 보존. 동일ID 11개 현행 존재를 200설치로 세지 않음.|
|D LM-E9 Astra 확인 해결|content/ASTRA_ANSWERS_R05.json·ASTRA_RESOLUTIONS_R05.md, records/de-coverage-current/REVIEW.md|24답 직접 재계수. 20기존+4개정의 검수 승계. 답변/원고 해결과 엔진 구현은 별개.|
|E 모든 종류·한국어 변형·선택 데이터|chronicle/variants.ko.json·CONTEXT_DRAFTS.catalog.json·COVERAGE.csv, records/de-coverage-current|직접history182/ledger46, 정본650+별도212+나이20=882. 현재 유형키 누락0 판정 승계. 전 관계/시대/나이 조합 실행을 뜻하지 않음. 91단일정본 유형의 별도 보완과 HOLD30도 보존.|
|E 전기·당시 나이·FIX12 읽을때 이름|chronicle/BIOGRAPHY_CONTRACT.json·AGE_CONTEXT_PROPOSAL.md, records/historical-age-contract·age-context-copy-proposal|전기API의 params 등 부족 필드를 같은 저장 history ID로 연결하는 제안, 당시 나이6유형20행. 현재 나이 대입 금지·unknown fallback·저장 ID 유지 계약 있음. capture/formatter/UI 미설치는 작성 승인 자체의 장벽이 아님.|
|납품 REPORT 상위10·심각도·재현·담당·근거·지난 상태|records/status-midround/STATUS.md, records/top10-evidence-plan/REPORT.md, inherited/top10|현재 REPORT.md에 심각도·담당·범위·원자료 입구를 갖춘10행이 있으며64대응 근거 전부 SHA 확인. 부모 10:53 개정본을 읽고 반영했다. 최종 신규수와 종결판정은 아직 미정. A01은 HEAD5ad 과거 profile이며 현5fb 재측정 아님. 실패저장·원자성·사망자 검사에 UI사진을 추가 필수조건으로 만들지 않음.|
|납품 지도·전략·장기표/그래프·content/chronicle·선택패치|해당 root문서, inherited/R07, content, chronicle, patches|요구 산출물 종류 존재. 패치는 선택사항으로 없음 자체가 누락 아님. 장기표 승계와 R08 새습지 결과를 구분할 것.|
|경량 ZIP·내부 SHA256SUMS·보고|/tmp/astra-steward-r08-20261004.zip, root SHA256SUMS|검사 시 둘 다 없음. 하위 manifest는 root납품 manifest를 대신하지 않음. 최종 바이트 동결/ZIP 검증·경로 보고가 남음.|
|계속/최종 멈춤|ROUND_PLAN.md, records/status-midround/findings.json|R07 신규확정0 1회차, R08 최종null. 아직 2회 연속0 아님. D200/E유형작성 충족만으로 멈추지 않음. 최종 새중간이상0이면 다른 종료조건과 함께 부모가 판정; 0이 아니면 다음 회차. 알려진 결함 전체 수정·D/E 런타임 설치를 별도 필수조건으로 넣지 않음.|

## 실제 남은 것과 인계 교정

1. **습지 판 종료 및 결과 인계**: 읽은 records/fen-run-lifecycle/LIVE_PROGRESS_1049.txt는 tick280000/year1370, active/running이다. 성공 exit·1450최종저장·해시·요약·기존 판과의 한계 있는 비교가 아직 이 감사의 완료 근거가 아니다. 목표가 매 회차 모든 땅을 요구한다는 뜻은 아니며, 현재 이미 시작한 실행의 상태를 최종 보고에서 빠뜨리지 말라는 의미다.
2. **R08 최종 심각도와 최종 REPORT**: 현재 REPORT.md 상위10에 기존 상태·담당·재현 입구가 연결되었다. 이 필드는 더 이상 누락으로 보고하지 않는다. 최종 신규 수와 중복/범위확장/별개 서명 심의, 종결판정만 후속 확정해야 한다. 미해결과 신규를 혼동하지 말 것.
3. **최종 아카이브**: 최종 root SHA256SUMS와 ZIP, 포함 파일·SHA/아카이브 검증, 납품 경로가 남는다. 현 단계에서는 ZIP 내부 완결성을 선언할 수 없다.

확인 중 발견한 ASSET_STRATEGY의 옛 상대링크는 부모가 records/storage-background-art-audit-r07/REPORT.md를 원SHA로 복사해 해소했다(ASSET_REPORT_LINK_ADOPTION.json). 첫플레이59파일도 부모 복사 후 전부 재해시했고 FIRST_PLAY_STATUS_R08.md 파생 인계본이 있다. 상위10 64파일 대조와 합쳐 **이 세 인계 이슈는 더 이상 미복사로 보고하지 않는다.** 모든 과거 문서 내부의 절대경로·형제파일·스크린샷 전수가 휴대 가능한 환경으로 닫혔다는 뜻은 아니다.

필수 신규 D/E 원고 누락은 현재 발견하지 못했다. 문맥·사실행 HOLD, 미지원 명령, 시각 검증 미완료는 숨겨야 할 실패도, 무조건 새 원고로 채워야 할 공백도 아니다. 근거와 제한을 유지한 인계 대상이다. 회차 약3–4시간은 대략적 운영 지침이며 본 감사에서 임의의 초 단위 최소시간 종료관문을 만들지 않았다.

검사 스냅샷 이후 동시 작업으로 파일이 바뀔 수 있다. INPUT_PINS.json의 바이트가 이 판정의 기준이며 부모 최신 종결 증거를 자동 승인하지 않는다.
