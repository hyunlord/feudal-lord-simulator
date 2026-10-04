# Steward R08 — 진행 중

HEAD 5fb1aebfe735592c1424c947e88388d4ffe21742, 시작10:08 KST. 회차 심각도 집계는 미확정이다. R07 신규0은 기존 결함 해결을 뜻하지 않는다. 새 실행이 완료되기 전에 가설을 원인으로 올리지 않는다.

## A·B 현재 증거

기존 자연1350/t200000 창고·제재소 화면과 현재 코드를 대조했다. 지도 상세는 DiagnosticCard이며 다른 Inspector 컴포넌트가 만드는 행동 문자열을 직접 사용하지 않는다. 받는 품목도 설정 버튼이 아니라 고정 규칙 목록이다. 첫플레이2 해결 승격은 없다. [근거](records/storage-surface-boundary/REPORT.md).

1375/t300000 식량 경계의 기존 재구성 기록에서 네 경로조회 중 하나는19간선에 잔여범위16으로 소스 조건상 제외된다. 다른 세 건은 잔여거리만으로 설명되지 않는다. 원 함수를 기록입력으로 재실행하는 제한 진단을 준비 중이며, 공식 tick 내부 선택을 직접 추적했다고 주장하지 않는다. [설계와 한계](records/food-selection-design/REPORT.md).

## C 현재 대조 완료

장부5885행·계획858행·원본858개85,287,352바이트를 재대조했고 불일치0이다. confirmed 미설치2221행은 계획858+제외1363으로 나뉜다. 승인44장 변경 없다. 영주관의2×2 엔진발판/3×3 원화사양 연결 확인을 설치 선행조건으로 유지한다. [C 감사](records/assets-current/REPORT.md), [현재 계획](install-plan-updated/R08_CURRENT.md).

## D·E 승계와 자립성

content/chronicle/patches132파일28,180,456바이트를 R07에서 동일 SHA로 승계했다. [승계목록](records/CUMULATIVE_D_E_INHERITANCE.json). 작성범위·현재 엔진 이벤트 타입·필수 근거 상대링크 의존을 별도 감사 중이다. 같은 본문이라도 근거 파일이 누락되면 자립적인 ZIP이라고 판정하지 않는다.

## 아직 남은 것

진단 helper 검토·필요한 공식 DGX 실행·독립 검수, 근거 의존파일 인계, 상위10·시스템지도·장기표/그래프 정리와 최종 SHA ZIP은 미완료다. 엔진·렌더·승인 그림은 수정하지 않았다.

## 추가 실행·인계
공식 DGX food-choice 실행1.7초/exit0,604검사통과,정확4개기록입력·직접함수4+4·advanceTick0. 별도 재구성입력 재실행이며 공식 내부선택 직접관측은 아니다. 원격scope inactive/dead와 실제최종helperSHA를 확인했다. 독립검수 진행중: records/food-choice-executed/.
사건·연대기 근거605파일10,378,670바이트를 필요한 로컬 링크/manifest 의존에 따라 승계하고 source/destSHA를 대조했다. 오래된 잘못된 상대경로1개는 원본을보존하고 records/INHERITED_EVIDENCE_COPY.json에 의도경로를 명시했다. 전체패키지무결성완료 주장은 아직하지 않는다.

## 식량 재실행 독립 검수 채택
records/food-choice-review/REPORT.md의4산출물SHA를 부모가 확인했다.604검사는604상황이 아니라4기록의92경로콜백을두함수에서대조한검사와공통조건이다. 선택은 house-46-42-0/000018이며 대상집000023은없다. 같은다음칸을공유하는집이1/24/5/22개라 이동칸에서목적집을역추정하지않는다. 장기미배급원인은HOLD유지.

## 10:34 재개 후 증거 채택

- 창고 후속 관측의 독립 감사와 SHA 목록을 부모가 확인했다. 200000–203840의 3840틱에서 생산 진행 변화70회는35틱 주기2회다. 최초 재고 변화200394와 생산 재개200840을 구분한다. 끝에는 다시 통나무1/목재19/진행0이므로 지속 회복을 주장하지 않는다. 직접 배달 callback은 수집하지 않았다. 첫플레이2는 미해결이다. 근거: `records/storage-flow-review/REPORT.md`, `records/STORAGE_FLOW_PARENT_ADOPTION.json`.
- 과거150년 판5개 핵심127파일(54,990,034바이트)을 복사 전후 SHA 대조 후 `inherited/R07/`에 승계했다. 중간25개 체크포인트는 제외했다. 새 R08 실행으로 세지 않는다. seed2 chalk은 동적 방침 판이며 fixed growth 대조군이 아니다. 근거: `records/long-run-inheritance/REPORT.md`, `records/LONG_RUN_PARENT_ADOPTION.json`.
- 새 지형 습지의 seed3/fixed growth 150년 실행은 준비 계약 검토 중이다. 아직 실행·완주 범위에 더하지 않는다.

## 10:39 습지 판 실행 중

공식 DGX run `astra-steward-seed3-fen-growth-r08-5fb1aeb`, nice19, detach/keep. 시작 저장의 seed3·core:fen_drainage·campaign·tick0·growth/dues1000/subsidies[]를 확인했다. 실행 입력25핀 원격 일치; 로컬 사전 목록26개 중 과거 unit-test.log는 동기화 대상이 아닌 결과 로그라 별도 제외 기록을 남겼다. 10:39 관측은 tick77000/1319년이며 목표1450년은 아직 미완료다. `records/fen-run-lifecycle/`에 실제 scope/PID·시작 저장·진행 기록을 보존했다. 같은 실행을 이어서 관측하며 새 중복 실행을 띄우지 않는다.
