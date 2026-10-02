# 이웃 세계 엔진 계약 감사

검토 SHA: `618c5ec28b2c191e85e0b448da7e0739660ad88a` / branch `codex/phase15-organic-ground`. 저장소 읽기 전용. graft ask 1회는 clone에 인덱스 없어 empty. 이후 local cache build(2724 files)를 완료하고 persons.types.ts skeleton을 확인했다: 918 tokens saved, query 2회(그중 empty1). build 뒤 tracked git status 깨끗함. 아래는 데이터 형태 적합성과 런타임 호환성을 구분한다.

## 납품 데이터의 권장 경계

`hundred.json`은 저장 게임이 아니라 candidate authoring bundle이다. `engine.estates`는 EstatesState, `engine.persons`는 PersonState, `engine.factions`는 FactionState(허용된 기존 9 ID만), `engine.diplomacy`는 DiplomacyState로 쓴다. 가문/기관, 인물 한국어 이름·성격·능력, 재정, 가문 사이 관계, 지도는 `proposals` 또는 명확히 proposal인 최상위 섹션. 원래 interface에 새 키를 몰래 보태지 않는다. JSON 파일을 게임이 자동 읽는 로더는 없다.

## 원래 타입

- `src/engine/persons.types.ts:43` Person: 필수 `id,givenName,sex,birthYear,householdId,role,classBand,occupation,build,hair,alive,portraitIdentity,tags,lineageId,traits`. 선택 `surname,epithet,deathYear,deathCause,leftYear,motherId,fatherId,condition,nameFrom,godparentId`.
- sex=`female|male`; role=`head|spouse|child|kin|steward`; classBand=`labour|poor_servant|artisan|merchant|gentry|clerical`; build=`thin|average|heavy`; deathCause=`age|captivity|famine|fire|plague`. `occupation`, hair, tags는 string. office는 tags로 `reeve`, `manager:<buildingId>` 등. 새 서술용 태그를 자동 효과처럼 설명하지 말 것.
- 부모 ID는 bare Person.id. spouseId 필드는 없다. 기존 관행 `spouse-of:<id>` 태그. 사망자는 alive=false와 deathYear, town에선 past에 저장. estates.people는 살아 있는/죽은 지도 밖 사람 모두 포함.
- `Person.traits`는 성격이 아님: `src/content/personTraits.ts:23`의 외모 유전형 `hair,skin,eye,faceShape,nose,buildBias`. hair=`black|dark_brown|brown|chestnut|auburn|red|blond|flaxen`; skin integer0..7; eye=`blue|grey|green|hazel|brown|dark_brown`; faceShape=`long|round|square|pointed`; nose=`straight|hooked|snub|bulbous`; buildBias=build enum. 성격/도덕을 외모에 연결하지 않음.
- `PersonState`: people,past,nextOrdinal 필수. lineages?,reeveTerms?,lordOrdinal?,reeveYear?,bailiffYear?. `NamedLineage`: id,kind,set,since,slots 전부 필수. kind=`lord|overlord|neighbour|merchant|reeve|miller`; set=`L1`…`L8` 또는 null(타입은 string|null); slots는 portrait identity→person id. 기관 lineage kind는 없음.
- `src/engine/estates.types.ts:47` Estate: id,name,kind,manors,annualValue,burdens,pieces,titleHolder,possessor,titleStrength,possessionStrength,offMap 필수. lifeTenant?,remainder?,patron?,steward?,house?. kind=`manor|market_town|mill_estate|fishery`. house가 있으면 name,lordId,familyIds,rank 모두 필요. rank=`gentry|knight|baron` 뿐. 백작을 baron으로 속여 넣지 말고 house 생략하고 확장 가문 객체에 정확한 지위.
- RightPiece: id,kind,annualValue,titleHolder,possessor,possessedSince 필수. loss?,lifeTenant?,remainder?. kind=`land_rent|manor_court|mill|market|tolls|fishery|advowson|hunting`. loss=`suspended|seized|forced|held_against_judgment`.
- EstateBurdens: debt,rentCharges,repairs 모두 number. 주석은 annual pennies라 하지만 실제 `negotiation.ts:104` 및 marriage terms는 debt를 누적 채무 원금으로 평가/인수. 따라서 데이터에 debt=잔존 원금, rentCharges/repairs=연간 d라는 명시적 의미를 두고 NEW_FIELDS에 모호함 기록. 이중으로 매년 원금을 차감하면 안 됨.
- HolderId는 string이나 의미 계약 중요: `lord` 현 플레이어 가문, `house:<order>` 과거 플레이어 가문, 기존 faction ID, `person:<bare-id>` 생애권자, `estate:<Estate.id>` 그 이웃 영지의 가문. `estate:estate-h01`처럼 id 포함. 임의 `house:h01`이 타입상 string이라고 자동 해석되지 않는다. `Estate.house.lordId`/familyIds 및 steward personId는 bare ID.
- EstatesState: estates,claims,suits,nextClaim,nextSuit,people 필수.
- Claim: id,claimant,estateId,basis,strength,evidence,since,status 필수; pieceId?; basis=`inheritance|marriage|purchase_deed|grant|old_possession`; status=`open|suing|won|lost|lapsed`. Evidence는 kind=`charter|deed|court_roll|witnesses|possession_years`, weight,tick. strength/titleStrength/possessionStrength0..100.
- Suit: id,claimId,plaintiff,defendant,estateId,stage,stageSince,patronSupport,enforcements,costs 필수; pieceId?,patron?,verdict?,hold?,enforced?. stage=`filed|evidence|patronage|hearing|judged|enforcing|closed`; verdict=`plaintiff|defendant`.
- `src/content/factionConfig.ts:10` FactionId 9개만: overlord,crown,neighbour_1,neighbour_2,bishop,merchant_house_1,merchant_house_2,town,commons. FactionKind=`overlord|crown|neighbour|church|merchant_house|town|commons`. `FactionRecord` id,kind,name,leaderId,heraldrySeed,relation,memory,timeline 모두 필수; leaderId nullable, relation -100..100. FactionState factions,people,nextOrdinal 필수. heraldrySeed는 정확한 blazon이 아님.
- `src/engine/stewardship.types.ts:15` StewardRecord: personId,estateId,ability,loyalty,disposition,connection,since,kept,errors,status. ability/loyalty0..100. disposition=`merchant|peasant|greedy`; connection string|null; status=`candidate|serving|dismissed|dead`. 여기 능력은 회계 수행·은폐 능력이고 전체 인물의 다축 능력이 아니다.

## 협상·초기화·실행 제약

- `src/engine/diplomacy.types.ts` Term: kind,giver 필수, amount?,years?,pieceId?. kind=`cash|pension|right_piece|political_support|debt_assumption|jointure|debt_after_inheritance|consent|inheritance_non_infringement|residence|land_use|wardship`; giver=`proposer|counterpart`. amount는 d, pension은 연 d, years는 해.
- DiplomacyState negotiations,promises,relations,nextNegotiation,nextPromise 필수, marriage?는 단 하나. relations는 상대 holder→플레이어 관계 -100..100이지 모든 가문쌍 행렬이 아님.
- Negotiation.purpose는 `marriage`만. acceptance에는 score,reasons,top,permille,tier 모두 있어야 한다. 아직 협상하지 않은 첫해는 negotiations/promises 빈 배열; 이야기용 과거 혼인에 허위 Acceptance를 만들지 않는다.
- `marriage.ts:29,104`: MARRIAGE_ESTATE_ID=`estate-neighbour-3`; 신랑은 플레이어 남자, 신부는 그 영주 딸. `marriageRefusal`은 진행중인 marriage 하나로 추가 계약 금지. 따라서 일반 자율 혼인망은 **새 실행기** 필요. 혼인 동의=즉각 소유권 아님; 기대권→문서→판결/점유 별도.
- `estates.ts:88`: estates 없으면 현재 하드코딩4영지(홈+이웃3) 재생성. 작성된 EstatesState를 명시 주입하는 importer 필요. 단지 JSON을 놔둔다고 바뀌지 않음.
- `estates.ts:226`: estates.people 나이 사망만 처리; 출생/일반 상속/재혼 자동 규칙 없음. 사망 난수는 id 숫자 부분을 사용하므로 각 인물에 전역 고유 숫자 suffix 권장(가문마다001 반복하면 상관 난수).
- `estates.ts:248`: 해마다 생애권 종료 및30년 점유 청구만 자동. person holder 해석은 Person.id 조회; 못 찾은 person은 살아있음으로 취급하므로 참조 무결성 필수.
- offMap은 지역지도 바깥이라는 새 뜻이 아님: 엔진의 플레이 도시 타일 지도 밖. 지역 JPEG에 찍힌 이웃도 offMap=true.
- home estate ID=`estate-home`; special pieces `home:market`,`home:tolls`,`home:mill` 보존해야 기존 권리 검사가 맞음. home annualValue와 ledger 현재 수입은 별개; 정적1300평가액을 live수입처럼 말하지 않음.
- tick epoch1300에서 연4000tick (`balanceConfig.ts:35`), season1000. 연대기 tick=(year-1300)*4000. 역년과 tick을 혼용 금지. £1=240d,1mark=160d (`estateConfig.ts:40`). 과거 사건은 proposal year로 기록; possessedSince 음수 tick은 새 로더 정책 없이는 쓰지 않는 편이 안전(개시 전 보유기간별도).

## 여섯 성격과 용어

미술 정본 `assets-inbox/lord-components/candidates-20261002/records/assets.csv`: trait_prudent 신중, trait_frugal 검소, trait_ambitious 야심, trait_honorable 명예, trait_merchant_friendly 상인 친화, trait_peasant_friendly 농민 친화. 확장 personalityTraits는 이 ID들 사용. 개인의 욕망은 별도 문장; 모두 똑같은2특성 반복 피함.

glossary 우선: gentry=지주층(젠트리), overlord=상위 영주, magnate서술=대영주, steward=청지기, bailiff=집행관, reeve=마을 대표(리브), advowson=성직자 추천권, jointure=과부산, dower=과부 몫, title=권원, possession=점유. 사용자 요청의 향신은 지주층(젠트리)로 안내하고 문서 정본 사용. 채무 인수는 원채무 탕감 아님. 수도원/주교좌는 혈연 가문이 아니라 기관이며 지도자 생가3세대와 기관 계승을 분리.

## 새 필드/실행 범주 권장(최종 번호는 주작성자가 확정)

1 고을 루트/버전/로더, 2 가문과 기관·정확한 신분·blazon, 3 한국어 인물표기/성격/능력/욕망, 4 가문별 금고·채권·저당·연금 및 debt의 의미, 5 방향 있는 모든쌍 관계·원한·후원 이력, 6 일반 혼인·복수계약/친족금지/동의, 7 출생·후계·기관 선출·절가/여성/방계 처리, 8 연례 규칙 확률·cooldown·감사로그, 9 지도좌표·경로·거리/여행시간, 10 계약 가신·봉사/연금·직책 연결, 11 역사충격·년도별 노출, 12 역전 가능한 토지거래/저당 집행과 개별 권리 부담. 이들은 현재 타입의 일부 슬롯 재사용은 가능해도 완성된 런타임이 아님.

확인 범위: 원문 type+구현 읽기. 코드 수정, 게임 로드, 실행 시뮬레이션, 타입체크는 수행하지 않음. 최종 납품에는 반드시 별도 JSON 참조/enum/숫자 단위 검증이 필요하다.
