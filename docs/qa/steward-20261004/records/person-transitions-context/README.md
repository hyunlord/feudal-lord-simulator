# E 누락 보완: 입주·배우자 등록·도시 이탈

**3유형 6문구의 문맥 초안. 독립 검수 대기.** 정본·엔진을 수정하거나 실행하지 않았다. 사건 시점 입력을 받는 Ruby 캡처·선택 검증 모형을 제안했고, 실제 엔진 어댑터는 설치하지 않았다. 어댑터 구현은 이 원고 납품의 추가 완료 조건이 아니다.

## 문구 전문

모든 ID의 접두사는 해당 template이며 아래 마지막 열의 suffix 앞에 `.r06transition.`이 붙는다. 기본 사실행을 유지하고, 필요한 검증된 문맥이 없으면 문맥 문장을 내보내지 않는다.

| 유형 | 사건 시점 조건 | 문구 | suffix |
|---|---|---|---|
| person.move_in | 입주 직후 가구 거주자 1명 | 비어 있던 집에 한 사람이 들었다. | one |
| person.move_in | 입주 직후 가구 거주자 2명 이상 | 비어 있던 집에 여러 사람이 들었다. | several |
| person.married | 새 spouse 인물이 기존 영주관 가구에 속함 | 영주관 가구의 배우자로 새로 기록되었다. | manor |
| person.married | 새 spouse 인물이 기존 도시 주택 가구에 속함 | 도시 주택의 가구에 배우자로 새로 기록되었다. | town_house |
| person.left_town | 이탈 직후 같은 가구 ID의 다른 인물이 현재 도시 인물 목록에 있음 | 도시를 떠날 때 같은 가구의 다른 인물이 도시 기록에 있었다. | present |
| person.left_town | 이탈 직후 같은 가구 ID의 인물이 현재 도시 인물 목록에 없음 | 도시를 떠난 뒤 같은 가구의 인물이 도시 기록에 남지 않았다. | absent |

입주는 개인 나이·성별 대신 가구 거주자 수로 분기한다. 혼인은 소스에 spouseId 같은 직접 부부 연결이 없으므로 특정 상대 이름·신분·사랑·재산·초혼/재혼을 발명하지 않고 등록된 가구 위치를 구별한다. 이탈은 원인 대신 같은 가구의 당시 인물 기록 유무를 구별한다. “남지 않았다”는 모든 친족의 사망이나 집 철거를 뜻하지 않는다.

선택한 방식은 현재 상태로 과거를 추정하는 방법, 이벤트 이름만 보고 생애 사유를 덧붙이는 방법보다 필요한 사실의 범위를 좁힌다. 어떤 문구도 돈·성격·동기·행선지를 주장하지 않는다.

## 현재 소스와 제안 필드의 구분

`history.ts:333-378`의 `person.move_in`은 같은 집의 이전 거주자 수가 0 이하이고 이후 양수이며 이전 abandoned 상태가 아닐 때 발생한다. 새 화재와 새 abandoned 분기는 그보다 먼저 continue한다. head가 있으면 record subject는 개인이고 household는 actor이므로, 개인 subject를 가구 거주자 수와 혼동하면 안 된다. 제안은 유효한 비음수 인원만 허용해 이전 값을 정확히 0으로 좁힌다.

`history.ts:386-404`의 `person.married`는 before.people에 없던 인물이 after.people에 role spouse로 추가된 경우다. 변경된 기존 인물의 role만 spouse가 된 것은 이 producer가 아니다. `persons.ts:350-367,608-622`는 일반 집과 영주관의 spouse 생성 경로를 보여 준다. 제안은 기존 동일 head 1명, 이전 spouse 없음, 이후 spouse 1명인 가구로 더 좁힌다. 따라서 초기 명부 전체 생성·후계 변경 등 애매한 조합은 unknown으로 남을 수 있다.

`history.ts:417-424`의 `person.left_town`은 before.people에 있던 ID가 after.people에서 사라지고, 새로 추가된 past 항목에서 alive인 경우다. 이는 죽음 분기와 다르다. `persons.ts:385-411` 및 `608-614`는 이탈 원인이 다양함을 보여 준다. 새 문구에는 어느 원인도 확정해서 쓰지 않는다.

세 유형의 현재 이벤트 params에는 새 분기값이 없다. `arrivalSize`, `spouseHousehold`, `householdPeopleAfter`는 **모두 새 문맥 필드 제안**이다. 현재 도시·현재 가문 상태로 과거 필드를 채우지 않는다. 완전한 당시 스냅샷과 생성된 record의 대응을 확인하지 못하면 unknown이다.

## 캡처 및 선택 형식

`capture.rb`는 전체 GameState를 받는 설치 코드가 아니라 **정규화된 입력에 대한 오프라인 검증 모형**이다. 실제 어댑터는 아래 투영을 신뢰 가능한 사건 발생 경로 안에서 수행해야 한다. 주어진 JSON이 진짜 사건 스냅샷인지 이 모형이나 schema 자체는 증명하지 못한다.

- record: `id`, `tick`, `template`, `subject:{type,id}`, `actors:[{type,id}]`. 실제 record의 다른 필드는 투영에서 제외한다.
- before/after: `tick`, 전체 `houses`, 전체 `people`, 전체 `past`. house는 buildingId를 `id`로, 주민 수를 `residents`로, burntTick/abandonedTick의 존재를 boolean `burnt`/`abandoned`로 투영한다. person은 `id`, `householdId`, `role`, `alive`만 투영한다. 목록의 순서를 유지한다. 목록 일부를 빠뜨려 absent로 만드는 것은 계약 위반이다.
- `record.tick == after.tick`이며 `before.tick < after.tick`. ID는 공백 아닌 문자열. 숫자는 0..9007199254740991의 정수. 중복 ID·불완전 목록·subject/actor 모순은 fallback한다.
- household subject 입주는 그 household ID를 우선하고 다른 actor로 모순을 덮지 않는다. person subject 입주는 소스의 before head 후 after head 덮어쓰기 규칙과 일치해야 한다. 일반 개인 사건 actor는 해당 가구 하나이고 영주관은 actor가 없다.
- left_town은 before.past의 정규화된 prefix를 유지한 새 past 항목이어야 한다. 대상은 before.people에 있고 after.people에 없어야 한다. 같은 householdId가 유지되어야 한다. alive=false는 죽음이므로 이 문구를 선택하지 않는다.
- 출력 envelope는 `recordId`, `recordTick`, `template`, `subject`, `householdId`, `sourceHead`, `captureKind`, `fields`를 저장한다. selector는 schema를 먼저 적용하고 record와 ID·시점·subject·가구를 다시 대조한다. known 빈 fields, 틀린 template-field 결합, 추가 필드, 현재상태 추론 provenance를 거부한다.
- `CONTEXT.schema.json`의 unknown은 빈 fields만 허용한다. selector는 null·malformed·unknown 모두 nil로 돌려 조건 headline을 표시하지 않는다. baseline 사실행이 별도로 남는다.

슬롯 추가는 없다. 인물 이름을 저장하지 않으며 기존 인물 ID와 FIX-12 읽을 때 표시 이름 해석을 보존한다. 이 모형은 이름 formatter를 구현하거나 실행하지 않았다. 부부 관계나 그 당시 가구는 이름을 새로 읽는 행위와 별도로 사건 시점에 고정해야 한다.

## 기본 사실행

- move_in: “가구가 새 집에 들었다.” 새 집은 가구가 새로 들어간 집으로 읽는다. 신축 완료라고 쓰지 않는다.
- married: “혼인해 가구를 이루었다.” 새 배우자가 기존 가구에 등록되는 경로와 연결한다. 별도 가구가 분리 창설되었다고 쓰지 않는다.
- left_town: “마을을 떠났다.” 두 문맥은 이탈 동기·행선지 없이 도시 목록의 잔류 여부만 보탠다.

초안 자체 감사에서는 직접 충돌 보류를 찾지 못했다. 최종 판단은 독립 검수에서 한다. 기존 기본행의 함의를 바꾸어 더 넓은 주장을 해서는 안 된다.

## 검사와 재현

`ruby check.rb`는 후보 폴더에 결과를 기록한다. 검수자는 사본이나 자신의 출력 폴더로 결과를 보내야 한다. `build.rb`는 원고와 schema를 생성한 기록으로 보존하며 동결 원고에서 재실행하지 않는다.

작성자 검사: 캡처+선택 **92건(양성 7)**, 문맥 schema 음성 **72건**, schema를 통과하지만 record 결합이 다른 입력 **18건**, 원고 schema 음성 **5건**, unknown fallback **6건**. 모두 통과했다. 소스 **5파일·12범위**를 SHA 및 줄 내용으로 확인했다. `FIXTURES.json`과 실행 결과를 함께 보존했다. schema 검사는 사용한 keyword만 처리하는 Ruby subset이며 전체 JSON Schema 표준 구현의 적합성 인증이 아니다.

정본 650개 SHA는 `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`, 소스 HEAD는 `5fb1aebfe735592c1424c947e88388d4ffe21742`다. 신규 ID 6개는 정본과 중복되지 않는다. 어댑터·저장복원·게임 런타임·UI는 미구현/미실행이다.

Graft 조회: `graft ask 'person spouse household marriage people past left town' .` 1회. 앞선 `graft find`는 지원하지 않는 명령으로 실패했다. `graft stats`는 세션 기록 없음으로 답해 절약 토큰 수는 측정할 수 없다. 조회 뒤 실소스를 읽었다.
