# 역사 기록 — R01 승격 당시

아래 574선택·60건 기준 설명은 최초 승격 당시 기록이다. 현재 R06은 사건200·선택572·명령템플릿395이며 `README.md`와 `EVENTS.md`가 현재 안내다. R01 ZIP은 `/tmp/astra-steward-r01-20261003.zip`이다. 해당 ZIP 구성원 경로를 현재 폴더의 상대링크로 오인하지 않도록 표시를 고쳤다. 역사 자료의 현재 로컬 원본 존재·파일 SHA는 `../records/content-promotion-link-repair/RESULT.json`에 있다. 과거 후보 전체를 R06 정본으로 복사하거나 재실행하지 않았다.

# 누적 200건 산출물 승격 안내

이 폴더는 정적 원고의 현재 누적판이다. 게임 설치·등록기 구현·실행 검증을 뜻하지 않는다. 200건과 574개 선택지를 담고, 등록 항목 200개 모두 enabledInEngine=false다.

- 현재 원고: [events.json](events.json), 현재 조건·명령 sidecar: [registry.json](registry.json).
- 원본 동결 후보: `R01 ZIP:content-merged-candidate/`. 후보 원본은 수정하지 않았다.
- 이전 60건 전체: `R01 ZIP:content-baseline-60/`. helper, 스키마, 계약, 중간 검증 결과를 모두 바이트 그대로 보존했다.
- 승격 근거·파일별 전후 SHA: `R01 ZIP:records/CONTENT_PROMOTION.json`.

## 이전 도구와 지침을 사용할 때

이전 `R01 ZIP:content-baseline-60/INTEGRATION.md`, `R01 ZIP:content-baseline-60/AUTHORING_CONTRACT.md`, `R01 ZIP:content-baseline-60/AUTHORING_TEMPLATE.json`, `R01 ZIP:content-baseline-60/events-expansion.schema.json`는 60건 기반 작업의 역사와 계약을 보존한다. 일부 중간 설명·건수·AST 제한은 당시 상태이며 누적판의 최신 검증 결과로 간주하지 않는다. 현재 합성 결과는 이 폴더의 READ_MODEL, COMMAND_CONTRACT, ADAPTER_CONTRACTS, VALIDATION과 독립 검수 보고서를 함께 읽는다.

이전 .mjs·.sh helper와 records/merge-content.mjs는 이전 content/ 경로 또는 60건 입력을 기대한다. 자동 재실행하지 않았다. baseline으로 파일을 옮겼어도 내부 절대경로는 그대로다. 재사용하려면 별도 작업에서 입력·출력 경로와 60/200 건수 계약을 명시적으로 분리해야 한다. 이전 registry-normalized.json과 현재 registry.json을 서로 대체하거나 별칭으로 연결하지 않았다.

## 실행 경계

미지원 조건·효과 차단, 선택별 바인딩, default 처리, 정책 alias, 중복 억제와 복합 명령 원자성은 제안 계약이다. 엔진 구현 여부는 정적 병합 PASS로 입증되지 않는다. 어떤 기존 검증 helper도 승격 중 실행하지 않았고, JSON 구조·동결 파일 SHA·보존 동일성만 새로 검사했다.

## 후속 정적 수정 r01-fn-r03

FN R03의 142·158·167 바인딩 범위 수정만 반영했다. 원고·명령 인수·기존 60건은 그대로다. 현재 누적판은 최초 동결 candidate와 이 세 sidecar 항목에서 다르며 후보 원본은 역사로 보존한다. 최초 35입력 manifest는 당시 병합 근거이고 현행 revision은 PROVENANCE.revisions와 records/content-revisions/r01-fn-r03/에 연결했다.
