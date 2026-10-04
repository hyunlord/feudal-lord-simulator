# R06 registry.invalid 독립 검수와 병합

판정: **PASS_INDEPENDENT_OFFLINE_MERGE_WITH_INHERITED_BLOCKS**. 정본 647개를 보존하고 3개를 더해 650개로 병합했다. 역사 단일 문장 유형은 92→91이며 전체 182종과 원장 46분류는 같다. 종류별 기본 커버리지를 문맥 다양성 요구의 완료로 확대하지 않는다.

## 문구와 코드 판단

- 감사 처분 안건: ck_evt_013의 pending_audit 결박과 punish/tolerate/replace 선택에 맞는다. 감사 자체의 취소나 해임·회수 결과는 단언하지 않는다.
- 반복 청원 원칙 안건: ck_evt_034의 set_exception_rules 선택에 맞는다. 개별 청원의 해결이나 홈 청원 처리 완료를 단언하지 않는다.
- 점유 집행 안건: ck_evt_038의 enforcing 단계·enforce/defer 선택에 맞는다. 실제 점유 이전 성공을 단언하지 않는다.
- registry.ts:424–429는 대상/조건 불일치를 invalid로 기록하지만 효과 실패는 원상태 반환한다. history.ts:1140–1142는 invalid의 원인을 저장하지 않는다. 따라서 세 문구 모두 ‘사정이 달라져 안건이 거두어졌다’까지만 말한다. 사망·금고 부족 등 원인은 보태지 않는다.
- params.entry의 문자열 완전 일치만 사용하고 baseline 사실 줄·읽기 시점 이름 조회(FIX-12) 계약을 유지한다. 이름 슬롯을 새로 저장하지 않는다.

## 실행한 검증

원 후보 validate.rb를 647 기준에서 실행해 28개 fixture(알려진 값12, fallback16)와 전체 schema를 확인했다. 이후 기준 chronicle 전체를 baseline647/에 보존했다. 동결 후보의 바이트 동일 사본을 replay/records/registry-invalid-candidates/에 두고 replay/chronicle의 원647 기준으로 다시 실행했다. 원 후보 파일과 이력은 변경하지 않는다.

별도 check_merge.rb는 실제 소스 7파일 SHA와 11개 구간, 세 조건의 정확한 범위, 650 ID 유일성, 추가 세 객체를 제거했을 때 전체647 JSON 동일성, 전체 schema, 정본을 사용하는 우선순위 선택28개, COVERAGE.csv228행, 기존 설치 차단6개 보존을 검사했다. 실제 코드 원문을 SOURCE_EVIDENCE의 각 구간과 대조했다. 병합 이후 검사도 통과했다. 부모 최종 수용은 별도다.

이전 R05D_INSTALL_BLOCKS.json은 바이트 그대로 유지한다. unresolved Rd/{recovered} 사실 줄 2개와 숫자 가드4개가 자동 해제된 것이 아니다. 이번3개는 새로운 원인·금액 슬롯을 쓰지 않는다.

## 범위와 재현

- R05 동결본, 엔진·렌더·게임 설치·커밋·푸시를 변경하지 않았다.
- 검증기는 경량 Ruby/JSON 참조 선택기다. 실제 엔진 선택, 저장 복원, 이름 조회 실행, 자연 발생, UI 표시는 이번 병합에서 미검증이다.
- 기준본 전체: baseline647/. 원본 후보 재실행: replay/records/registry-invalid-candidates/validate.rb. 현650 재검증: check_merge.rb. `--merge`는 원647 정본에서만 허용한다.
- 원본 후보 validate.rb는 현650 정본에 바로 실행하지 않는다. baseline SHA를 고정하므로 실패하는 것이 정상이다.
- graft 1회, 보고된 절감 추정 36,183 tokens. 달러 추정은 도구가 제공하지 않았다.
