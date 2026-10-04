# 013·034·052 발동 창·직접 감독 갈래

검토 HEAD: `6a887ea7407e756efe56b6585f4a12cc47547f79`. 저장소 수정 없이 원문 형식의 세 초안을 `expanded-delegation.json`에 작성했다.

| 초안 | 수정 | 의미·한계 |
|---|---|---|
|013|1321–1347 → 1300–1450; loyalty≤90 → loyalty<100; 제목·본문·선택 호칭을 회계 담당자로 포괄; 직접 감독의 실제 감사 허용|청지기 위임이 없어도 직접 감독 영지의 담당자를 실제 감사하고 처분한다. 실제 상승량은 min(10,100−loyalty). pending 감사·드러난 돈·후임·연줄이라는 처분 근거는 보존.|
|034|1372–1374 → 1300–1450; 과거 영주 판결·실제 반복 청원을 필수에서 해제; 위임 전 사전 규칙 설정 갈래|위임 영지가 없어도 보유 offmap 영지 oversight가 있으면 현재 규칙을 바꿀 수 있다. 직접 감독 중 즉시 자동 처리·업무 감소는 없다. 영지를 새로 만들거나 위임하지 않는다.|
|052|1415–1420 → 1300–1450; 위임 영지 한정을 direct/steward 양쪽으로 변경|013과 같은 실제 감사의 직접 감독 갈래. 같은 auditId를 두 카드로 재상신하는 것은 기존 audit_findings 중복 방지로 금지.|

1300–1450은 v2가 인용한 영지 회계·감사·장원 기록 관행의 합성 서사를 게임 전체 기간에 쓰기 위한 편집 창이다. 특정 해의 실재 사건으로 주장하지 않는다. 새로운 역사적 사건·가격 주장을 추가하지 않아 기존 출처를 유지했다.

## 실제 코드로 확인한 근거

- `src/engine/stewardship.ts:51`: heldOffMapEstates는 offMap이며 titleHolder와 possessor 모두 LORD인 영지.
- `src/engine/stewardship.ts:117`: 새로 보유한 지도 밖 영지는 mode=direct로 oversight를 만들고 가장 충성스러운 실제 후보에게 회계를 맡긴다.
- `src/engine/stewardship.types.ts:112`: stewardId는 위임 청지기 또는 직접 감독 시 회계 담당자를 뜻한다는 명시적 주석.
- `src/engine/stewardship.ts:293`: 직접 감독도 담당자가 감추는 돈이 있으며 DIRECT_KEEP_SHARE를 적용한다.
- `src/engine/stewardship.ts:321`: michaelmas는 모든 보유 offmap oversight를 감사한다. mode=steward 필터가 없다. 감사는 revealedKept+revealedErrors>0일 때 pending.
- `src/engine/stewardship.ts:443`: answerAudit는 실제 pending 감사와 기한을 검사한다. punish/replace는 후임이 없으면 전체 no-op. 처분 후 oversight를 spread하고 stewardId 등만 바꾸므로 기존 direct mode를 보존한다.
- `src/engine/stewardship.ts:385`: setExceptionRules는 stewardship 존재·기존 설정과의 차이만 검사한다. 위임 영지를 필수로 하지 않는다.
- `src/engine/stewardship.ts:265`: 실제 선례 자동 처리에는 위임·예외 분류·과거 같은 estateId/kind의 lord 판결이 필요하다. 사전 설정이 이 기록을 만들지는 않는다.
- `v2/records/ENGINE_EFFECTS.md`의 audit.answer 및 steward.exception_rules만 사용한다.

## 034의 서로 다른 선택과 no-op 방지

세 선택 모두 실제 `set_exception_rules` 명령의 기존 필드 네 개를 완전히 지정한다.

1. `{amountAtLeast:240,rights:true,marriage:true,recurring:false}`: 큰 금액·권리·혼인은 상신 후보, 실제 같은 종류 선례가 있으면 재사용.
2. `{amountAtLeast:0,rights:true,marriage:true,recurring:true}`: 금액이 0 이상인 청원을 매번 상신.
3. `{amountAtLeast:null,rights:true,marriage:true,recurring:true}`: 권리·혼인만 상신, 나머지는 성향 처리.

세 preset은 서로 다르므로 현재 규칙과 같은 선택을 숨겨도 최소 둘이 남는다. undefined recurring은 false로 비교한다. 240d는 가격·지출이 아닌 편집 문턱이며 과거 초기값의 권위를 주장하지 않는다. 직접 감독 사전 설정은 저장 상태를 실제 변경하지만 위임 전까지 청원 처리 방식은 바꾸지 않는다는 것을 본문·대가·제한에 반복 명시했다.

## 남은 경계

- home만 있고 지도 밖 보유 영지가 없으면 013·052 감사가 생기지 않는다. 이 상황에 가짜 감사·가짜 청지기·금전을 만들지 않았다.
- 034도 실제 보유 offmap oversight가 없으면 표시하지 않는다. home만 가진 시작 시점의 유용한 즉시 자동화 갈래는 기존 명령으로 만들 수 없다.
- pending 감사가 없거나 후임·연줄이 없는 013·052는 여전히 적합하지 않다. 창 확장은 생성 기회를 넓히며 이벤트 빈도를 보장하지 않는다.
- 실제 등록기 어댑터와 인게임 장기 발생량은 이 콘텐츠 산출물의 검증 범위 밖이다.

## 검증

세 레코드의 ID·선택 수·기존 effect catalogue key를 유지하거나 기존 허용 key로 교체했다. 원문 형태 유지, 정본 용어 사용, source 확인을 마쳤다. 루트가 합본 JSON Schema 검증을 수행한다.

Graft: ask 1회 37,281 tokens, skeleton 1회 8,053 tokens, 존재하지 않는 auditEstate callers 1회(절감 보고 없음). 합계 보고된 절감 45,334 tokens, 조회 3회. source span은 실제 파일로 재확인했다.
