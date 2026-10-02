# NE01 사건 등록기 형식 제안 v2

**미구현 설계 초안이다.** `registry.schema.json`은 JSON Schema Draft 2020-12이며 `registry.example.json`의 세 레코드는 이 스키마의 예제다. `events.json` 60개가 이미 엔진에 등록되었다는 뜻이 아니다. 구현 기준 HEAD는 `83b06802661d6eef33ebf7dc5b7c31a18aa9fae8`. 숫자로 제안한 빈도는 역사 통계가 아닌 게임 편집 추정이다.

## 1. 등록기는 기존 사건을 복제하지 않는다

| `contentClass` | 뜻 | 등록 동작 |
|---|---|---|
| `existing_event_copy_revision` | 기존 장 사건 문구 개선 | 해당 실제 청원 인스턴스의 표시 문구만 대체한다. 새 청원 생성·빈도 추첨·재과세 금지. 기존 장의 등장 시점과 선택지 제약을 따른다. |
| `existing_petition_variant` | 기존 청원 종류의 새 사정·당사자 변주 | 이미 발생한 실제 청원 하나에 결합한다. 새 변주에 적합하지 않으면 원래 청원 표시를 보존한다. |
| `new_event_draft` | 독립적인 새 장면 | 실제 존재하는 명령 대상에 결합하는 제안 어댑터가 필요하다. 대상이 없으면 건너뛴다. 임의 권리 조각·청원·인물·자원을 만들지 않는다. |

예제 `ck_evt_014`는 `wool_payment`의 문구 개선, `ck_evt_001`은 지도 밖 `common_dispute`의 변주, `ck_evt_004`는 기존 사업 장려금 명령을 사용하는 새 장면이다. 예제는 전체 60개를 변환한 파일이 아니다. `contentRef`의 배열 위치뿐 아니라 `id`도 일치하는지 확인한다. 문구 수정 버전은 `contentRevision`으로 관리하되 저장된 발생 기록과 재등장 횟수는 새 버전으로 초기화하지 않는다.

`binding.definitionKey`는 종류/정의 식별자다. 클릭에는 이것을 보내지 않고, 연결 시 확정한 **실제 instance ID**를 보낸다. `binding.creation=never`는 등록기가 기존 청원 생성기를 대신하지 않는다는 계약이다. `effectOwner=existing_engine_handler`이므로 `effects`의 금고·관계 예상치를 다시 실행하지 않는다. 권리 허가 뒤 공통 세력 후처리나 연대기를 별도 보상으로 중복 반영하지 않는다.

## 2. 필드 계약

| 필드 | 처리 규칙 |
|---|---|
| `conditions` | `all`/`any`/`not` 재귀식. 단말은 허용된 읽기 필드 + 대상 + 비교 연산. 임의 JavaScript, eval, 경로 실행 금지. |
| `frequency.mode` | `seasonal_candidate`만 새 콘텐츠 예산을 사용한다. `existing_arrival_only`는 기존 사건에 표시 문구만 붙인다. |
| `chancePermille`, `weight` | 먼저 0–1000 확률 필터를 한 번 적용하고, 남은 후보에서 정수 가중 추첨. 둘은 서로 다른 역할이다. |
| `minGapSeasons`, `maxPerYear` | 같은 초안의 노출 간 최소 간격·해당 달력연도 상한. 값 0인 상한은 금지이며 무제한이 아니다. |
| `recurrence.mode` | `once_per_campaign`은 전체 1회, `once_per_bound_instance`는 실제 대상별 1회, `new_context_only`는 새로운 실질 사정이 있어야 재등장. |
| `cooldownSeasons`, `maxOccurrences` | 직전 노출부터 계절 수; 전체 저장 게임에서 해당 초안 노출의 총상한. 응답하지 않고 닫아도 노출 횟수는 소모한다. |
| `contextKeyFields` | 영지·당사자·청지기·감사 기간 등 사정의 지문. `bound.instanceId`만 바뀐 것은 실질 사정 변화로 세지 않는다. |
| `dedup.exclusiveGroups` | 같은 분쟁/감사/수선 변주 묶음. 다른 초안 ID라도 같은 사정을 따로 노출하지 않는다. |
| `semanticKeyFields` | `bound.instanceId`를 쓰면 실제 청원 한 건 단위. 영지·당사자·종류를 쓰면 내용상 같은 사정 단위. 키 목록 순서대로 정규 JSON 직렬화한다. |
| `groupCooldownSeasons` | 같은 그룹과 semantic key의 직전 노출부터 적용하는 대기 기간. 초안별 쿨다운과 둘 다 충족해야 한다. |
| `suppressWhileBoundOpen` | 같은 연결 대상이 `offered` 또는 `deferred`이면 다른 카드로 재포장하지 않는다. 원래 열린 카드는 계속 볼 수 있다. |
| `winnerPriority` | 하나의 실제 대상에 여러 문구가 맞을 때 우선순위 내림차순, 동률이면 ID 오름차순으로 하나만 선택한다. 기존 사건 자체의 중요도를 재정의하지 않는다. |
| `executionPolicy` | 단일 명령은 기존 핸들러 재검증, 복합 명령은 atomic 어댑터 구현 전 자동 실행 금지. 본문 초안의 모든 선행조건 검사는 필수. |
| `minimumEnabledConsequentialChoices` | 실제로 실행 가능한 결과 있는 선택 2개 이상. 무료 닫기·단순 미루기를 여기에 세지 않는다. |
| `deadlinePolicy`, `deferPolicy` | 기존 만료 규칙 유지, 미루어도 기한·과세·추첨·선례를 초기화하지 않음. |
| `precedentPolicy` | 현 엔진이 청지기에게 맡긴 것은 등록기가 다시 영주에게 올리지 않는다. 등록기는 새로운 자동 판결을 내리지 않는다. |

빈도 제안의 기본은 새 변주/장면 최대 연 2개·계절 1개다. 이는 기존 장 사건을 지연시키는 상한이 아니다. 위기 연도에는 구현 시 별도 콘텐츠 예산을 0–1로 줄일 수 있으며, 그 정책 필드는 다음 스키마 버전에 명시해야 한다. 현재 스키마에 없는 조건을 문자열로 암묵 실행하지 않는다.

## 3. 기존 상태 읽기와 새 저장 상태 분리

`conditions.field`는 **등록기용 읽기 모델 이름 제안**이며 그대로 존재하는 GameState 경로라는 뜻이 아니다. 다음 매핑 어댑터를 구현·검증해야 한다.

| 읽기 모델 | 원자료/주의 |
|---|---|
| `calendar.year`, `calendar.season` | 기존 scenario/calendar와 seasonIndexOf로 계산. 실제 시나리오 시작 연도 사용. 계절은 spring/summer/autumn/winter. |
| `population.occupiedHouseholds` | 기존 입주 가구 산정과 일치시킬 것. 청원 `requiresLots`와 인구를 혼동하지 않는다. |
| `treasury.coinD` | `treasuryCoin`. 노출 때뿐 아니라 실행 직전 잔고 다시 확인. |
| `estate.landKinds`, `estate.ownedByLord` | 연결 영지의 실제 유형·보유 기록. 초안의 서사상 땅 묘사를 게임 지형 판정으로 취급하지 않는다. |
| `faction.relation`, `rights.pieceIds` | 실제 세력 ID와 영지 권리 조각. `politics.rights`의 인가 기록과 권리 조각을 구별한다. |
| `bound.status`, `bound.kind` | EstatePetition 상태/종류 또는 PetitionRecord의 응답 유무/defId를 정규화. 장 청원에서 response 없음은 open, expired는 만료. |
| `bound.deadlineTick`, `bound.reachedLord` | 영지 청원의 deadline 및 reachesLord/tick. 장 청원은 실제 경로의 만료 판정을 사용; 임의 deadline 속성을 추가하지 않는다. |
| `bound.allowedResponses` | 현재 청원의 options, 정의의 responses, 명령 검증을 교차 확인. 후계자 후보가 죽으면 선택 가능성 재계산. |
| `steward.mode`, `steward.rules.recurring`, `audit.status`, `person.alive` | 현재 stewardship/인물 기록. 청지기 교체·사망·감사 종료로 대상이 소멸하면 무효화. |

`requireContentPreconditions=true`이므로 구조화 조건을 통과해도 `events.json`의 조건/선택별 선행조건을 검증하는 허용 목록 어댑터가 없으면 노출하지 않는다. 예제004의 잔고120d는 최소30d 장려금의 필요조건일 뿐이다. 기존 장려금 미설정, 실제 사업 후보, 총한도와 A≤L<2A 조건까지 검증해야 한다. 004의 binding은 실제 agency 설정 대상을 나타내며 청원으로 위장 생성하지 않는다.

누락 필드는 `exists=false` 외의 비교에서 false다. 필드/대상/값 타입 조합이 잘못되면 콘텐츠 검증 실패로 처리한다. 예: 숫자에 `contains`, 계절에 숫자, 전체 세계에 `audit.status`는 허용하지 않는다. JSON Schema는 식의 모양을 검사하며 이 매핑·타입 검사는 구현기의 별도 의미 검증 사항이다.

**새 저장 상태 제안:** `runtimeState.records`. 기존 엔진에는 이 등록기 원장이 없다. `occurrenceId`, `boundInstanceId`, `contextKey`, `semanticKey`, `offeredSeason`, `terminalSeason`, `status`, `choiceId`, `idempotencyKey`를 저장한다. 연별 횟수·쿨다운·그룹 잠금은 이 원장과 버전 고정 정의에서 계산한다. 엔진의 금고·권리·관계 사본을 여기에 저장하지 않는다. 기존 세이브 최초 도입 때 엔진의 이미 처리된 대상 목록과 대조하여 완료된 인스턴스를 재등록하지 않아야 한다.

`new_context_only`는 실질 맥락 필드(영지·당사자·청지기·감사 기간) 중 적어도 하나가 이전 기록과 달라야 한다. 모든 실질 필드가 없거나 동일하면 건너뛴다. `instanceId`나 새 문구 revision만 달라졌다는 이유로 통과시키지 않는다. 예제001의 지도 밖 청원에는 party가 없는 경우가 있으므로 같은 영지에서는 일회 변주에 머물 수 있다. 다른 당사자를 작가가 임의 만들어 재등장시키지 않는다.

## 4. 결정적 선택·실행 순서

1. 해당 tick의 기존 엔진 등장·만료·청지기 판결을 먼저 처리한다. 원래 홈 청원 발생률과 장 사건 시점을 바꾸지 않는다.
2. 실제 대상들을 조회한다. 문구 개선은 도착한 실제 대상에 결합하며 추가 추첨하지 않는다. 새로운 변주 후보는 조건, 기한, 최소 선택 2개, 재등장, 중복·연별 예산을 검사한다.
3. 후보를 `(id, boundInstanceId)`의 **코드 포인트 순서**로 정렬한다. OS별 locale 정렬을 쓰지 않는다. 확률 seed 입력은 게임 seed, seedNamespace, 절대 seasonIndex, 초안 ID, 실제 대상 ID를 사용한다. DOM 재렌더·저장 불러오기·창 닫기는 난수 소모 원인이 아니다.
4. 각 후보의 hash % 1000이 chancePermille 미만일 때 남긴다. 중복 묶음을 winnerPriority/ID로 먼저 하나로 줄인다. 남은 후보의 정수 weight 누적합과 별도 이름공간 `selection` hash % 합으로 한 개 선택한다. 총합은 안전한 정수 범위여야 한다. 같은 입력이면 같은 노출을 얻는다.
5. 원장에 `offered`를 기록하고 본문·선택지를 표시한다. `occurrenceId`는 `(registryVersion, draftId, boundInstanceId)`로 만들고, 문구 revision을 재발행 키로 쓰지 않는다. 같은 대상을 다시 여는 것은 새 노출이 아니다.
6. 클릭 때 현재 상태에서 모든 전제 조건과 실제 선택 가능성을 다시 검사한다. 변했다면 카드 갱신/무효화하며 임의 보상은 주지 않는다. 확인되지 않은 권리 ID·배우자 후보 ID·감사 ID는 실패 처리한다.
7. 엔진 명령을 적용한 결과와 등록기 원장을 한 저장 트랜잭션으로 확정한다. 현재 엔진에 없는 다중 명령의 원자적 합성은 이 제안의 새 어댑터 책임이다. 결과 미리보기 값을 더하는 방식은 금지한다.

**현재 초안과 미래 등록기의 경계:** `events.json`의 `sequential_non_atomic` 복합 선택은 기존 개별 명령을 순서대로 실행하는 수동 절차 초안이다. 중간 실패 때 이미 성공한 단계는 유지하며 자동 롤백하지 않는다. 이 현재 동작을 원자적이라고 부르지 않는다. 미래 등록기에 한 번 클릭하는 선택으로 직접 넣으려면 아래 원자적 어댑터가 필요하다. 구현 전에는 `executionPolicy.compoundCommands=blocked_until_atomic_adapter`에 따라 해당 복합 선택을 실행 불가로 두고, 남은 유효 선택이 두 개 미만이면 카드 자체를 노출하지 않는다.

미래 등록기의 다중 명령 선택은 복제 상태에 순서대로 실제 핸들러를 적용하고, 각 명령의 기대 후조건을 확인한 후 모두 성공했을 때 한 번에 commit해야 한다. 단순히 반환 상태 객체가 바뀌었는지만으로 성공을 판정하지 않는다. 중간 명령이 무효이면 전체를 버린다. 후처리·원장·연대기도 성공 경계에 포함한다. 이 트랜잭션 구현이 없으면 그런 선택을 실행 가능으로 표시할 수 없다.

`idempotencyKey = occurrenceId + choiceId`이며 occurrence 자체에도 단 하나의 종결 선택만 허용한다. 같은 클릭 재전송은 저장된 결과를 돌려주고 재실행하지 않는다. 다른 선택 재전송은 이미 종결된 발생 건으로 거부한다. 저장·불러오기 사이에 엔진만 반영되고 등록기 기록이 누락되지 않도록 원자적 저장이 필요하다. 원자적 저장을 지원하지 않는 엔진 통합에서는 새 등록기 실행을 활성화하지 않는다.

## 5. 미루기와 기한

`defer`는 기존 청원을 open으로 두고 등록기 상태만 `deferred`로 바꾸는 UI 행위다. 돈·관계 변화가 없지만 기존 시간은 계속 흐른다. 계절 한 칸을 강제로 진행하거나, 기한을 연장하거나, 확정된 미래 보상·중재 성공을 약속하는 효과가 아니다. 원래 카드에서의 답변도 등록기 기록과 동기화한다. 만료되면 **기존 핸들러**의 만료 결과를 한 번만 적용하고 등록기는 `expired`로 관찰 기록한다. `deferred`는 재추첨·새 카드 생성·선례 승인 이력을 만들지 않는다.

## 6. FIX-14와 NE10 범위

최신 코드에 SW-12 선례 처리가 있다. 다만 `stewardship.ts:270`은 **위임한 지도 밖 영지**에서 같은 영지·종류의 영주 승인/거절을 찾아 청지기가 따른다. `rules.recurring=true`이면 이 선례 적용을 막는다. 홈 생성기 `homePetitionSeason`은 별도 함수로 직접 상신하며 여기에는 그 선례 분기가 없다. 따라서 NE10을 전체 미구현이라 부르면 틀리고, 홈 자동 선례까지 구현되었다고 부르는 것도 현재 코드와 다르다. 등록기는 이 판정을 읽고 따를 뿐 자동 처리 범위를 넓히지 않는다.

## 7. 코드 근거와 검증 기준

- [기존 사건 시드·계절 일정](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/eventSchedule.ts#L1), [인스턴스 ID](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/eventSchedule.ts#L144).
- [PetitionDef와 응답 종류·기간](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/chapterConfig.ts#L45), [실제 PetitionRecord](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/politics.types.ts#L12).
- [양모 공납 정의](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/content/warConfig.ts#L108).
- [홈 청원 생성·기한](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L183), [위임 영지 선례](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L270), [답변 검증](https://github.com/hyunlord/feudal-lord-simulator/blob/83b06802661d6eef33ebf7dc5b7c31a18aa9fae8/src/engine/stewardship.ts#L399).

정적 검증: 스키마 자체 유효성, 예제 3개 유효성, ID 고유성, 정본 분류명, contentRef→id 일치, years 조건 교집합, 기존 문구 개선은 `existing_arrival_only`/chance1000/새 예산 제외인지 확인한다. `new_context_only`에는 실질 맥락 키가 있어야 하며, `once_per_campaign`의 maxOccurrences는 1이어야 한다. 스키마만으로 코드 효과·도달 가능성까지 검증했다는 주장은 하지 않는다.

구현 시 수용 시험: 같은 seed 저장/복원 동일 후보, 대상 없음 건너뜀, 이미 답변한 장 사건 재노출 없음, 2개 미만 유효 선택 비노출, 클릭 직전 잔고/인물 상태 변경, 이중 클릭 한 번 반영, 다른 카드의 같은 대상 중복 억제, 미루기 만료 유지, 선례 자동 처리 청원 재상신 금지, 다중 명령 두 번째 실패 때 금고/권리/원장 모두 원상태 유지. **이 수용 시험은 아직 엔진에서 실행하지 않았다.**
