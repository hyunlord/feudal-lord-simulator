# R06 registry.invalid 문장 후보 3개

정본 647개는 변경하지 않았다. 단일 기본형 registry.invalid에 조건형 3개를 제안한다. 후보를 메모리에서 합친 650개 문서와 JSON Schema를 검사했을 뿐 설치·엔진 실행·자연 발생·독립 검수는 하지 않았다.

| 저장 params.entry | 제안 문장 |
|---|---|
| ck_evt_013 | 감사 처분을 묻던 안건은 사정이 달라져 거두어졌다. |
| ck_evt_034 | 반복 청원을 선례대로 처리할지 묻던 안건은 사정이 달라져 거두어졌다. |
| ck_evt_038 | 판결에 따른 점유 집행을 묻던 안건은 사정이 달라져 거두어졌다. |

모두 저장된 `params.entry`의 문자열 완전 일치만 사용한다. 사건 종류만 구체화하고, 안건 자체가 거두어진 일과 실제 감사·소송·반복 청원의 해결을 구분한다. 감사 자체 취소, 청지기 사망/해임, 금고 부족, 권리 집행 완료, 선례 확정은 주장하지 않는다. 다른 entry는 기존 기본형으로 돌아간다. 052처럼 같은 감사 계열도 이번에 확대하지 않았다.

## 근거와 한계

- `src/engine/registry.ts:420–434`: 응답 시 대상 또는 등장 조건이 맞지 않으면 occurrence를 invalid로 바꾼다. 효과 적용 실패는 이와 별개로 원상태 반환이다. 그러므로 자금 부족을 일괄 invalid 원인으로 번역하면 안 된다.
- `src/engine/history.ts:1129–1144`: 이전 offered가 answered/lapsed 이외로 변하면 registry.invalid 기록이 만들어진다. 기록 params는 entry·choice뿐이며 원인 reason이나 인물 상태를 저장하지 않는다.
- `src/content/historyCopy.ko.ts:239`: 기존 사실 줄은 제목 + “사정이 바뀌어 없던 일이 되었다”다. 이를 유지한다. 후보가 구체적인 원인을 보태지 않는다.
- `src/content/registry/draftEvents.ts:31–36,57–67`와 `registryCopy.ko.ts:15–16,23–26`: 세 entry가 감사 처분·반복 청원 처리 원칙·점유 집행을 다루는 근거다. 발생 당시 제안의 주제만 사용한다.
- `docs/design/glossary.md:21,191`: 청지기 명칭 및 연대기 과거형을 따른다.
- FIX-12: 이름을 후보·fixture 본문에 굳혀 넣지 않는다. baseline.renderer와 history.summary(record,state) 호출 계약을 그대로 둔다. 이 기록에 이름이 없다고 다른 기록의 읽기 시점 이름 처리를 바꾸지 않는다.

## 검증

`ruby validate.rb`는 기준 SHA, 정본 수량 647, 전체 schema, 후보 ID 중복, 정확한 세 entry 조건, baseline 보존, 소스 SHA·행, 28개 선택 fixture를 검사한다. 12개는 알려진 entry(선택/근거 없는 reason/이름 필드가 붙어도 원인이나 이름을 사용하지 않음), 16개는 누락·알 수 없는 ID·대소문자/공백·잘못된 타입 fallback이다. 타입 검사·선택 모형은 Ruby 참조 검사이며 실제 엔진 선택기의 실행 증거가 아니다.

`build.rb`는 작성 재현용이다. 현재 정본으로 baseline SHA를 다시 잡으므로 검수 재현에는 build를 먼저 실행하지 말고 `validate.rb`만 실행한다. `schema_validator.rb`는 R05 후보 검사기의 schema 부분을 복사한 경량 검사다. 원본 경로는 `/tmp/astra-steward-r05-20261004/records/next-context-candidates/validate.rb`다.

추가 역사는 추정하지 않았으므로 외부 역사 출처를 새로 붙이지 않았다. 후보 의미는 현재 소스와 정본 용어에 한정된다. 부모 검수 후에만 병합 여부를 결정한다.
