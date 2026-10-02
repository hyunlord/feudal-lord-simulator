# 새 필드와 엔진 연결 제안

검토 기준: `618c5ec28b2c191e85e0b448da7e0739660ad88a`. 이 묶음은 저작용 후보 데이터이며 저장 게임/구현 완료 기능이 아니다. 현재 타입과 맞는 `engine` 부분도 JSON을 읽는 로더 없이는 실행되지 않는다. **차이 범주 14개**로 센다. 각 범주 안 필드 개수나 미구현 함수 개수와는 다르다. 원래 Person의 외모 `traits` 및 Estate 객체에 제안 키를 끼워 넣지 않는다.

| ID | 필요한 데이터/동작 | 현재 모양과의 차이 | 연결 계약 |
|---|---|---|---|
| NF01 | 고을 root, 시작연도, 참조 SHA, loader | hundred 타입/loader 없음 | engine 레코드를 검증한 뒤 명시적 새 게임 생성기에 전달. 시드가 생성하는 기존4영지와 중복 병합하지 않음. 로드 전 모든 참조 확인, 실패 시 원자적으로 거부. |
| NF02 | 가문·기관, 유형, 신분, 문장 blazon | FactionId9개 고정; Estate.house.rank=gentry/knight/baron만 | 새 사회주체 등록기. 수도원·주교좌는 corporation; 백작/상인은 house.rank를 거짓값으로 변환하지 말고 선택 house를 생략. 문장은 seed와 별개 exact blazon. 기관 지도자 생가 혈통과 기관 재산계승 분리. |
| NF03 | 한국어 이름, 성격, 개인 욕망, 다축 능력 | Person.traits는 외모; Person에 성격/능력 없음 | personId 참조 profile. 성격은 기존 그림6종 ID, 능력0..100은 게임 추정. 인종·체형·외모와 도덕 능력의 인과 없음. 청지기 회계 능력만 StewardRecord.ability로 연결. |
| NF04 | 금고·채권·원금·저당·연금 양자 장부 | Estates.burdens에 합계뿐, debt 주석/사용의 stock-flow 차이 | 금액은 정수d. debt=잔존 원금으로 선언하고 연간 원금상환/연금/수선/지대 분리. 양자채권 ID 하나, 채권자 자산과 채무자 부채 일치. 원금을 매년 전액 부담으로 재차감 금지. |
| NF05 | 가문쌍 관계/원한/후원/증인/의무 | Faction.relation 및 diplomacy.relations는 플레이어 상대값 | directed relation edges+dated reasons. 혼인 친족관계는 대칭 참조, 후원/채무는 방향. 관계값과 실제 채권은 같은것 아님. NPC-NPC 갱신은 새 루틴. |
| NF06 | 혼인 탐색·복수 부부·친족/동의/거주 | marriage.ts는 estate-neighbour-3 고정, 단일marriage, player신랑 | marriageContracts[]와 spouse links, 배우자 생존/중복/연령/성직상태/금지친족 검사. 자율 계약은 동시 수락·지급/권리 이동을 원자적으로 적용. 단순 혼인으로 토지 즉시 합병 금지. |
| NF07 | 출생·후계 후보·여성/방계·절가·후견·기관선출 | estates.people는 나이 사망 위주, 자동 가족재생산/일반상속 없음 | 사망 시 살아 있는 권리별 후보를 계산. 딸/과부/방계/생애권/잔여상속권/관습 문서 존중; 남계단절≠모든혈족사망. 기관은 원장선출/주교이동, 재산은 법인에 유지. |
| NF08 | 연례 규칙 registry와 상태/쿨다운/확률/원인로그 | rules.json 실행기가 없음 | 해마다 안정된순서로 조건검사→난수→충돌해결→원자갱신→인과영수증. 확률은 조건부연간 범위 게임 추정; 같은 영지 이중 매각/같은 인물 이중 혼인 방지. 사건 초안 v2 registry는 제안임. |
| NF09 | 지역 지도좌표·노선·도하·소요일 | Estate에 좌표 없음, offMap은 도시타일지도밖 의미 |1600×1000 좌상단원점 pixel. 표식/거점과 도로노드 분리, 강은 지정도하점 사용, route km/day는 게임추정. 이웃은 지역지도 안이어도 offMap=true. |
| NF10 | 가신 계약·연금·복무·직책 | StewardRecord만 부분 지원, 전체 retinue 없음 | personId/houseId 계약으로 연결; 이름없는 추종자 수와 이름있는 가신 중복계상 금지. 상비군/가문 인구와 동일시하지 않음. 후원 전환은 남은 의무/평판 비용을 기록. |
| NF11 | 흑사병·기근·1381 등 노출과 개별 반응 | WORLD_EVENTS는 고정연대 항목, 모든가문 영향 모형 없음 | 역사 trigger와 허구 local outcome 분리. 사망자/생존자/상속/부채 재계산. 1381을 모든 지주 몰락 또는 일괄개혁으로 고정하지 않음. |
| NF12 | 매매·저당·소송·권리별 부담/양도 제한 | RightPiece에 권원/점유와 Claim/Suit 있으나 일반자율거래 없음 | 매매대금과 문서로 title 이동; possessor는 인도/판결집행 후 이동. 생애권/과부몫/기관양도허가/우선권 조사. 승소≠자동명도. |
| NF13 | 개시 전 보유·사건·혼인·사망 연도 | tick 기준은 게임개시, 과거기록 단일정책 없음 |1300=0,1년4000tick. 역사 priorYear 필드는 제안으로 분리. possessedSince=0은 시작시점부터만 증명됨; pre1300기간을 장기점유청구에 합산하려면 importer 명시규칙 필요. |
| NF14 | 초상 배정·사용 단계·미충족 얼굴·잠정대체 | Person.portraitIdentity만 있음; 연령별 파일 찾기는 pool의 책임 | 기존identity만 engine 레코드에 지정. 없는얼굴은 requested slot/profile에 기록; 필요한 경우 검증된 임시identity+replacementRequired=true를 별도 기록. 아이/여성/성직복/신분 불일치와 동시동일얼굴 재사용을 숨기지 않음. |

## 그대로 재사용하는 필드

Person, 외모 PersonTraits, NamedLineage, RightPiece, EstateBurdens, Estate, Claim, Evidence, Suit, EstatesState, StewardRecord는 원래 타입 이름·필수 키·enum을 따른다. Person에는 age를 넣지 않고 `1300-birthYear`로 표기한다. holder `person:<id>`는 인물 권리자이고 `lordId`/`fatherId`/`motherId`는 prefix 없는 실제 인물id. `estate:<id>`는 해당 영지 가문의 현재holder로 해석한다. `holderAlive`는 못찾은인물을 살아있다고 취급하므로 제안 importer가 dangling ID를 엄격히 막아야 한다.

표의14개는 데이터파일 자체가 오류라는 뜻이 아니라 명시적으로 격리한 신규필드/실행연결 범주다. 엔진의 기존 타입 검증 통과와 게임150년 실행 검증은 별개이며, 후자는 이번 저작 납품 범위에 없다.

기관 인물의 `lineageId:""`는 허용된 string 타입 안에서 비혈연 기관임을 나타내는 저작 선택이다. 현행 초기화의 표준 관행이라고 확인된 값은 아니다. NF02/NF07 로더에서 빈 값을 혈통 검색·혼인 친족 판정에 넣지 않도록 해야 한다. 기관의 직책 승계 명단은 biological parentIds로 바꾸지 않는다. `Estate.steward`는 HolderId로 `person:<id>`, `StewardRecord.personId`는 bare id다.
