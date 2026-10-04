# 이정표·가구 맥락: 8종 검토, 5종10문구 별도 초안

정본과 엔진은 변경하지 않았다. 추가10개는 strict proposal schema 아래 별도원고이며 현재 canonical schema에 넣지 않는다. 게임설치는 요청된 초안의 합격 조건이 아니지만 통합 검증과 명확히 구분한다.

## 대응
- chapter_start2: 기록 chapter2/5. 첫 장을 지나 다음 장으로 넘어감과 마지막 장 시작을 구별한다. chapter1은 현 producer가 증가할 때만 쓰므로 제외,3/4는 baseline.
- chapter_end2: chapter1/5. 첫 장 마침과 다음 장이 없는 마지막 장 마침을 구별한다. 정치 엔진 endChapterFive는 chapter를 올리지 않는다. chapter2–4는 baseline.
- market_town2: **기록 생산 시** era market_town/stone_town을 캡처한다. milestone emitter는 era!=hamlet이므로 기존 reached가 없는 stone_town도 이 기록을 생산할 수 있다. 후자의 자연 발생은 미검증이며 저장 이정표가 늦게 생긴 경우라고 원인을 단정하지 않는다. baseline은 시장도시가 되었다고 하는데 headline은 ‘기록된 시점’으로 범위를 분명히 한다.
- first_l4 2: 이정표 샘플 순간 L4가1채/여럿. emitter는 some(level4)일 뿐1채 보증이 없으므로 첫 이정표에 여러채가 관찰되는 경우를 구별한다. 여러 집이 동시에 승급했다고 말하지 않는다.
- person.grew2: 원시 params.residents2/>2. **after.persons===undefined인 legacy household producer**다. 현대 개인 birth/arrival 이벤트와 합치지 않고, 출산·혼인·이주 원인을 붙이지 않는다. old.residents>0이고 늘어야 하므로 최소2. 이 표본의 모든 자연기록에서 발생했다고 주장하지 않는다.
- stone_town: raw params없고 era stone_town 조건뿐이다. 현재 부·주택수로 억지분기하면 과거를 바꾸거나 무관한 장식을 늘리므로 새문구0. 의미 있는 기록당시 이행상황이 먼저 필요하다.
- ledger.l4: history copy에는 있지만 현재 history producer에서 배출을 찾지 못했다. **금전 원장의 category가 아니라 history template**다. legacy보존으로 표시하고 정체불명 from/to를 생성한다고 가정하지 않아 새문구0.
- came_of_age: source는14세 경계 통과. 14를 나이구간 몇 개로 나눌 수 없다. 같은 나이를 여러 문장으로 재포장하지 않아 새문구0. 당시직무·가구역할 등이 새로 입증되면 별도제안 가능하다.

## selector 앞 gate / 새 캡처
원시 chapter는 유한safeinteger2..5(start)/1..5(end), residents는2..MAX_SAFE_INTEGER. 문자열숫자/bool/비유한/소수/범위밖/누락은 baseline. 1.0처럼 정수값인 JSON Number는 JSsafeinteger처럼 취급한다. 추가원고의 op eq/gt 전에 가드를 적용한다. 가드없는 JSON 복사 설치는 금지다.

새 capture envelope는 정확히 `version:1,recordId,capturedAtTick,source:'milestone_emitter_after',era,l4Count`만 갖는다. recordId/tick이 대상과 같고, producer가 해당 이정표를 실제 쓰는 바로 그 after state에서 era와 houses.filter(level4).length를 기록해야 한다. 문자열 source나 boolean을 사용자가 넣었다고 진위가 증명되는 것은 아니다. 실제producer 구현이 필요하며 현재 미구현이다. 과거저장을 현재 era/주택수로 보충하지 않는다. 모르는 값/다른record/tick/추가필드/누락은 baseline. 새capture4문구는 BLOCKED_NEW_CAPTURE_FIELD, raw6문구도 BLOCKED_TYPED_INPUT_GUARD다.

## FIX-12 / 사실줄
모든 headline은 고정인명없음·requiredSlots[]·retainFactLine=true. 현재나이/직책을 읽지 않고 원래 history.summary(record,state)의 이름경로를 유지한다. 새headline이 기존factline과 독립된 세계변화를 보장하지 않는다. 특히 first_l4 샘플과 실제 첫 승급시간은 다를 수 있다. 엔진 이름formatter나 UI를 실행한 검증은 아니다.

## 검증
`ruby check.rb`: strict additionalProperties:false proposal schema, 실제조건 기반 선택, 유효10/잘못된값90/누락capture16 =116fixture, 유효chapter3 baseline 추가assert, source4파일 모든구간SHA대조. 소스/정본은 쓰지 않는다. `build.rb`는 작성 재현용이다. fixture는 합성이며 자연발생을 뜻하지 않는다. 독립검수 전 AUTHOR_DRAFT_ONLY. 부모가 병합 여부를 정한다.
