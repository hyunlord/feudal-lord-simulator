# 인물 명세 (PERSON-0) — 가구에 사람이 산다: 이름·나이·역할·생애·초상

지시서: PERSON-0 인물 v0. 근거: [기록·연대기 설계](CHRONICLE_DESIGN.md) 1절(인물 생애 → 원장), 조사 11(인물 4단 구조·초상 풀·노화 사슬). 앞 단계: [노동 명세](labour.md) LB-1·LB-2(가구 구성원), [기록 원장 명세](history-ledger.md) HL-2 ⑤. 결정: PS1~PS8.

조항 번호(PS-*)는 `tests/persons.test.ts`(N1~N10)와 이어진다. 화면(초상 표시·전기 — UI-5·CHRON-1)은 렌더 세션 몫이고, 이 명세는 렌더가 읽을 API까지다.

## PS-1 인물과 가구 (`Person`, `src/engine/persons.types.ts`, 저장 v16)

- `Person{id, givenName, surname?, epithet?, sex, birthYear, householdId, role, classBand, occupation, build, hair, alive, deathYear?, deathCause?, leftYear?, portraitIdentity, tags[]}`.
  - `role`: 가구 안 자리(가구주 `head` · 배우자 `spouse` · 자녀 `child` · 친척 `kin` · 청지기 `steward`).
  - 직책은 `tags`에 둔다: `reeve` · `manager:<건물>` · `petitioner:<청원>`.
- `GameState.persons = {people(마을에 사는 이), past(죽은 이·떠난 이), nextOrdinal, reeveYear}`.
- **불변식**: 집마다 사는 인물 수 = 그 집 `residents`. 마을 인구 = 집에 사는 인물 수(청지기는 영주 가솔 `manor`이라 인구에 들지 않는다).
- 가구의 어른(14세 이상)·아이 = 인물 나이에서(`house.members`). **마을 노동 = 어른 수**(LB-1의 "인구 × 0.5"를 대체). 봇·화면의 추정은 예전 식 그대로다.

## PS-2 이름 (`src/content/personNames.ts`)

- 세례명: 1300–1450 잉글랜드 남부, 남 30 · 여 30, 빈도 가중(John 200 · William 140 · Thomas 90 · Richard 80 · Robert 70 … / Alice 150 · Agnes 120 · Joan 100 · Matilda 80 · Margery 60 …). 한 가구 안에 산 사람과 같은 이름은 다섯 번까지 다시 뽑는다.
- 성: 가구가 생길 때 가구주가 정하고 가구원이 따른다(1300년엔 성이 유동적 → 가구 단위로 정착).
  - 지명성·부칭·직업성에서 셋 중 하나를 고른다: atte Well · Bywater… / Johnson · Williamson… / Miller · Carter….
  - 청지기는 de 지명성이다(de Stratton…).
- 동명이인 별칭: 마을에 사는 사람 가운데 이름·성이 같은 이가 있으면 별칭을 붙인다.
  - 둘이면 the elder / the younger(출생연도 순), 더 있으면 le Rous · le Brun … 다음 the third …
  - 사는 사람 사이에서 이름(별칭 포함)은 겹치지 않는다(N2).

## PS-3 생애

- 나이대: 아이 < 14 · 청년 14~29 · 장년 30~54 · 노년 55+.
- **늘기**: 예전 성장 규칙(먹고 물 있는 집이 정원 아래면 한 명)은 그대로이고, 그 한 명을 이렇게 나타낸다.
  - 빈 집의 첫째는 가구주(가구 형성), 둘째는 배우자(혼인)다.
  - 그다음은 16~44세 여성이 있고 아이 ≤ 어른이면 출생, 아니면 친척(14~30세)이 온다.
- **줄기**: 예전 감소 규칙(굶는 집이 한 명 잃음)도 그대로다. 약한 이(5세 미만·55세 이상)가 먼저 굶어 죽고, 없으면 친척 → 자녀 → 배우자 → 가구주 순으로 한 명이 떠난다.
- **사망(새 규칙)**: 계절이 시작할 때 연령별 연 사망률 ÷ 4다.
  - 연 사망률: <5세 40‰ · 5~13세 10‰ · 14~29세 8‰ · 30~54세 12‰ · 55~64세 40‰ · 65~74세 90‰ · 75+ 200‰.
  - 가중: 빵값 × 1.4 이상 흉년 × 1.5, × 2 이상 기근 × 3, 역병 × 4(역병 사건이 생기면).
  - 가중으로 늘어난 몫의 죽음은 원인 `famine`이다. 불타는 집에 있던 이는 60‰로 죽는다(`fire`).
  - 죽은 만큼 집의 `residents`가 준다. 그 집은 성장 규칙으로 다시 찬다(출생·친척).
- **승계**: 가구주가 없으면 배우자 → 가장 나이 많은 어른 → 12세 이상 맏이 순이다. 아무도 없으면(12세 미만만) 가구가 흩어지고(아이들은 친척에게 — 떠남), 집은 빈다.
- 14세가 되는 해 첫날 어른(노동 대상, 일 `labourer`)이 된다.

## PS-4 직책 인물

- **청지기**: 영주 가솔(`manor`), 늘 한 명(gentry, 35~50세)이다. 죽으면 다음 계절 새 청지기가 선다.
- **reeve**: 해 첫날 25~60세 labour 가구주 가운데 뽑는다(남자 먼저 — 장원의 관행). 해마다 다시 뽑는다.
- **시설 책임자**: 일꾼이 있는 방앗간·제재소·석공장·시장·헛간·벌목장·채석장·곡창·창고마다 한 명이다.
  - 가장 가까운 빈 가구주가 그 일을 맡는다(miller·sawyer·mason·chapman·husbandman·woodward·quarrier·granger·storekeeper). 계급은 artisan·merchant·labour다.
  - 시설이 없어지거나 일꾼이 빠지면 labourer로 돌아간다. 계절 시작마다 맞춘다.
- **청원자**: 청원마다 가구주 2~3명을 적는다(`PetitionRecord.petitionerIds`). merchant → artisan → labour 순, 같은 등급은 청원 해시 순이다.

## PS-5 초상 (`src/engine/portraits.ts`, 풀 `src/content/portraitPool.ts`)

- 풀: 첨부 CSV 3개(`docs/design/portraits/`)에서 생성한다(`scripts/portraitPoolImport.ts`). 232장, identity 100개이고, 노화 사슬은 child → young → mature → old다.
- 고르기(`choosePortraitIdentity`, 결정론)는 이 순서로 비교한다.
  - ① 성별 ② 나이대의 그림 ③ 계급(아이는 묻지 않음) ④ 직책·직업(steward·reeve·청원 상인·miller…) ⑤ 체형
  - 위 조건이 같으면 **마을에서 덜 쓰인 얼굴**이다(얼굴 단위, 모든 단계 합산). 그다음 사슬이 있는 얼굴, 그다음 해시다.
- `portraitFor(person, band)`: 저장된 identity의 그 나이대 그림을 돌려준다. `exact` = 성별·나이대·계급 일치다.
- 해 첫날 얼굴이 더는 맞지 않는 사람(새 나이대 그림이 없는 얼굴, 계급이 바뀐 책임자)은 더 맞는 얼굴이 있으면 바꾼다.

## PS-6 저장 v16

v15 → v16 이관은 집의 residents·members에서 인물을 결정론적으로 만든다. 이름·출생연도·역할·초상과 청지기가 생기고, 직책(책임자·reeve·청원자)은 불러온 뒤 첫 틱에 채운다.

## PS-7 API (`src/engine/personsApi.ts`)

`persons.of(state, householdId)` · `persons.byRole(state, role|"reeve"|"manager"|"petitioner")` · `persons.biography(state, id)`(사실 + 초상 + 원장 기록) · `persons.portrait(state, person)` · `persons.name(person)`. 렌더의 `householdMembers`(LB-2)는 인물이 있으면 인물(가구주 먼저)을 돌려준다.

## PS-8 원장 연결 (HL-2 ⑤)

- 가구 기록(승급·하락·굶음·다시 먹음·우물·화재·떠날 준비·이탈…)은 주어가 가구주이고, 가구는 행위자다.
- 인물 기록: 출생 `person.born` · 혼인 `person.married`(영구) · 친척 옴 `person.arrived` · 성인 `person.came_of_age` · 직업 `person.occupation` · reeve `person.reeve`(1) · 청지기 `person.steward`(1) · 사망 `person.died`(1, 원인·나이) · 떠남 `person.left_town`.
- 인물이 있으면 식구 늘/줄(`person.grew`·`shrank`)은 쓰지 않는다(출생·사망·떠남이 대신한다).

## PS-9 봇 무변경

봇 파일은 바꾸지 않는다. 봇이 노동을 추정하는 식(인구 × 0.5)은 그대로이고, 엔진 노동만 어른 수다. 사망이 새 규칙이라 가드레일 기준선을 새로 잡는다(승리 틱 ±15 % 안).
