# 기록 당시 나이·시대 문맥 읽기 계약 (제안, 미설치)

기준 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. canonical 문장/엔진 코드를 변경하지 않았다. Mac에서는 저장 JSON 읽기·정수 산술만 실행했다. 실제 엔진 adapter 실행·저장 decode·UI 표시는 이 작업에서 검증하지 않았다.

## 결론

**개인 사건 allowlist + `subject.type === person` + 유일하게 조회되는 Person + 유효한 출생연도**일 때 `historyDate(record, state).year - person.birthYear`로 기록 당시 연령을 도출할 수 있다. 현재 직책·역할·가구·조건·관계는 복원되지 않으므로 과거 문장에 투사하면 안 된다. 이는 새 저장 필드를 요구하지 않는 읽기 전용 adapter 제안이다. canonical 조건 언어에 이미 구현됐다는 뜻이 아니다.

`historyDate`는 record.tick와 해당 scenario.startYear를 calendar에 넣는다(`src/engine/history.ts:892`, `scenarioState.ts:67`). `ageOf`는 연도 차이고 `ageBandOf`는 child <14, youth 14–29, adult 30–54, elder >=55다(`persons.ts:44`, `persons.ts:79`). 이는 엔진 연령 구간이며 중세의 법적 성년·노년 기준이라는 주장을 하지 않는다. 생일 날짜가 없어 연도 단위 게임 나이일 뿐이다.

`personBiography.age`는 deathYear → leftYear → 현재 연도 순으로 헤더 나이를 계산하므로 **개별 기록 나이로 재사용 금지**(`personsApi.ts:14`). `portraitAt`도 사망·이주 연도로 clamp하는 그림 선택용 함수이므로 문장 시점 계산과 동일하다고 간주하지 않는다(`chronicleScreenModel.ts:269`).

## emitter별 적용 범위

| 범위 | template | 처리 |
|---|---|---|
| 개인 사건 | person.born, married, arrived, steward, came_of_age, occupation, reeve, bailiff, fell_ill, injured, expecting, pilgrimage, recovered, healed, returned, died, left_town | 각각 `person.` 접두. history.ts:388–421의 personRecord가 개인 ID를 직접 subject로 기록. 아래 fail-closed 적용 뒤 나이 문맥 가능 |
| 가구 사건 | person.burnt, rebuilt, left, resettled, leaving, move_in, emptied, level_up, level_down, stayed, hungry, fed, water, water_lost, grew, shrank | 각각 `person.` 접두. **개인 나이 금지**. history.ts:335–382는 가구 변화에 가장 최근에 찾은 가구주를 subject로 넣을 수 있음. subject person만 보고 개인 사건으로 분류하면 오귀속 |
| 기타 개인 subject | petition leader change, legacy.heir_seated 등 | 이번 개인 allowlist 밖. subject의 의미와 사실 시점 emitter를 별도 검토하기 전 나이 변형 선택 안 함 |
| person ID를 params에 보유한 사건 | deceasedId, lordId, stewardId 등 | subject 나이와 별개인 명명 대상. 키별 별도 emitter 계약 필요. 특히 estate death는 params.age가 이미 있으므로 검증된 그 사실 우선 |
| 모든 알려진 기록 | 기록 연도에 따른 편집 시대 창 | scenario·tick 유효하면 가능. 현재 state.era나 historicalEras를 과거 날짜 대신 사용 금지. 연도만으로 사건 체험/흑사병 피해/번영 등을 단정 금지 |

개인 template라도 born/came_of_age처럼 엔진상 한 연령대로 사실상 고정된 항목은 연령 변형 수를 인위적으로 늘리지 않는다. occupation은 저장 params.occupation만 당시 직업 근거로 사용한다. 회복·순례 귀환 문장에 현재 alive/condition을 붙이지 않는다. died는 이미 저장 params.age와 계산 나이가 일치할 때만 age adapter로 확장하고 불일치 시 변형을 포기한다.

## ID, 보존, 조회 경계

- `Person.birthYear`, `id`는 타입상 readonly(`persons.types.ts:43`), town 생성은 p-/m- ordinal을 증가시키고 ID를 부여한다(`persons.ts:312`). 이것은 정상 생성 경로 근거이며 임의·손상 저장까지 ID 충돌이 없다는 보장은 아니다.
- `Town.remove`는 people에서 빼고 같은 id/birthYear를 past로 옮기며 직책 태그·condition을 지운다(`persons.ts:217`). 따라서 나이는 보존되지만 과거 직책/질병은 현재 Person으로 복원하면 안 된다.
- 이주자의 후일 사망은 past 원소를 같은 ID로 갱신하고 leftYear를 제거한다(`persons.ts:963`). 후계 귀환은 past에서 빼서 people로 옮기고 가구/역할을 변경한다(`persons.ts:692`). past에서 없어졌다고 사람 삭제라고 볼 수 없다.
- 검토한 Town 경로에서 과거 사람을 나이 계산 불가능하게 삭제하는 보존상한은 발견하지 않았다. 저장 마이그레이션 전체·임의 state 재구성 경로의 영구 보존을 증명한 것은 아니다. 사람 미조회는 정상 fallback 처리해야 한다.
- `personById`는 people→past→factions이며 **estates를 포함하지 않는다**(`persons.ts:1049`). `historyNames.personNamed`는 estates, factions, past, people을 합쳐 읽기 시 이름을 찾는다(`historyNames.ts:27`). 일반 이름 키를 위해 이 private 함수를 호출할 수 있다는 API 주장은 하지 않는다.
- 제안 adapter는 네 pool을 읽되 중복 ID 발견 시 보수적으로 unknown 처리한다. 이름 조회의 우선순위로 서로 다른 birthYear를 조용히 덮어쓰지 않는다. FIX-12 이름은 기존 읽기 시 이름 경로 유지; 이름 문자열을 sidecar/canonical에 고정하지 않는다.

## fail-closed adapter 계약

1. 허용 template와 개인 subject 여부를 먼저 확인. actors 첫 인물이나 현 가구주로 대체하지 않는다.
2. scenarioId가 알려지고 record.tick이 유한 비음수 정수이며 현재 snapshot.tick 이하인지 확인. 알 수 없는 시나리오를 임의로 1300 시작으로 간주하지 않는다.
3. 해당 ID가 네 pool에서 정확히 한 번 나오고 birthYear가 유한 정수인지 확인. 없거나 중복이면 unknown.
4. `eventYear = historyDate(record,state).year`; `ageAtRecord = eventYear - birthYear`. 음수/비정수면 unknown. deathYear 존재 시 eventYear가 그보다 뒤면 unknown(사후 기록을 생전 사건처럼 꾸미지 않음). 큰 나이에 임의 상한을 넣거나 0으로 clamp하지 않는다. 이상치는 별도 진단 대상으로 남긴다.
5. 나이 구간은 엔진 ageBandOf 정의 사용. params.age가 있는 사망 기록은 동일 값 확인. 불일치면 unknown; 저장된 사실을 새 추정치로 대체하지 않는다.
6. 성공 시 읽기 context에 `{eventYear, subjectAgeAtRecord, subjectAgeBandAtRecord}`를 제공하는 adapter를 **제안**한다. history record, params, Person, 저장 schema를 수정하지 않는다. unknown이면 나이 조건이 모두 불일치하며 기존 사실 문장을 그대로 쓴다.
7. 당시 혼인·고아·상속인·영주·가난함·직업·친족관계는 birthYear에서 알 수 없다. 기록 params/template가 입증하는 범위 외에는 추가하지 않는다.

## 실제 저장 JSON 사례

`EXAMPLES.json`은 N04 seed 2 chalk 1450년 저장 1개에서 기록 2개와 거부 가구 사례를 추출했다. 원본 절대 경로·SHA256 포함. 동일 저장의 retained allowlist 기록 4310개는 후보 수이며 전체 문장 정확도/전기간 보존률이 아니다.

- h-050888 person.fell_ill: 1448년, 당시 66세 elder. biography 헤더 방식은 67세여서 그대로 재사용하면 1년 어긋난다.
- h-051206 person.came_of_age: 1449년, 당시 14세 youth. 저장 시 헤더는 15세. 역사적 성년 나이 주장이 아니다.
- person.move_in: subject가 person이어도 가구 emitter여서 나이 선택 금지.

재현: `ruby derive_examples.rb`. JSON 산술 결과이며 엔진 실행을 대신하지 않는다. 새 context 필드가 selector에 연결되기 전에는 canonical에서 조건으로 사용하지 않는다.
