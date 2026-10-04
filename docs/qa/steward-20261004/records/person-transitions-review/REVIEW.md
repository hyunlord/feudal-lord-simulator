# 입주·배우자 등록·이탈 문맥 독립 검수

**6/6 원고 조건부 승인. E의 기존 세 유형 원고 공백을 메운다.** 서로 같은 시대 문장에 다른 ID만 붙인 경우와 달리, 이번 문장은 인원·가구 위치·동일 가구 인물의 잔류 여부를 실제로 구별한다. 엔진 설치 또는 런타임 검증 판정은 아니다.

## 재현 증거

원본17파일의 SHA를 먼저 보존하고 `replay/records/person-transitions-context/` 사본에서 `ruby check.rb`를 실행했다. 원본 build/check를 실행하지 않았다. 검사 결과는 작성자 보고와 같았다: 캡처/선택92(양성7), 문맥 schema 음성72, 유효 schema지만 결합이 다른18, 원고 schema 음성5, unknown6. 소스5파일12인용 범위는 파일SHA·원문과 일치했다. 정본650과 신규ID 충돌도 없다.

추가 독립 사례9개를 실행했다: 과거 목록의 살아 있는 동일 가구 인물을 잔류로 세지 않음, 다른 가구 인물 제외, 기존 다른 spouse 거부, 영주관 actor 형식 오류, 안전 정수 범위를 넘는 거주자 수, after head 우선, 무관 actor 추가, 기존 past prefix 보존, subject 결합 오류. 전부 기대대로 선택 또는 fallback했다. 원본17파일은 검사 후에도 바이트가 같았다.

## 소스·문장 판단

- **입주2:** history.ts:333–378은 같은 house의 이전 주민수가0이하→이후양수일 때 기록한다. 새 화재/새 abandoned는 먼저 continue하며 이전 abandoned는 입주에서 제외된다. 후보는 비음수 안전정수로 더 좁혀 이전0을 요구한다. 한 사람/여러 사람은 house.residents 값의 구별이며 subject 개인의 가족관계를 추측하지 않는다. 원래 headOf는 before heads를 after heads로 덮어쓰므로 캡처의 같은 규칙이 맞다. head가 없을 때 household subject를 받아야 하는 양성도 포함한다. “비어 있던 집”은 새 건물 준공을 주장하지 않는다.
- **배우자2:** history.ts:386–404의 신규 spouse 등록과 persons.ts:350–367/608–622의 주택/영주관 생성 경로를 확인했다. 같은 head가 전후 존재하고 이전 spouse가 없으며 이후 spouse가 하나인 좁은 집합만 쓴다. 특정 배우자 이름·직위·초혼/재혼·별도 가구 창설을 주장하지 않는다. 영주관/주택은 단순 연도 수식과 다른 당시 생활 장소의 구별이다.
- **도시 이탈2:** history.ts:417–424는 새 past suffix의 alive 인물이며 before.people에 있었고 after.people에서 사라진 인물을 기록한다. 후보는 이전 past prefix 불변과 householdId 보존까지 요구한다. 잔류는 **after.people 안**의 동일 householdId만 센다. past의 이주 인물이 alive와 옛 householdId를 유지하더라도 세지 않는 독립 반례를 통과했다. 문장은 같은 가구의 “도시 기록” 유무만 말하므로 친족 모두의 죽음·부양 상실·집 철거·이탈 원인을 추가하지 않는다.

## subject·schema·unknown·FIX-12

record를 `{id,tick,template,subject,actors}`로 투영하고, 가구 사건의 subject가 head 개인일 수 있음을 분리한다. 가구ID를 subject.id에서 무조건 읽지 않는다. 영주관 개인 사건은 household actor가 없고 일반 주택 사건은 해당 가구 actor가 하나인 실제 형식에 맞춘다.

known envelope는 template별 정확한 필드/enum, 안전 정수 tick, sourceHead, emission_snapshot provenance, 추가 필드 금지를 검사한 후 recordId/tick/template/subject/householdId를 다시 대조한다. unknown은 빈 fields이고 selector에서 선택하지 않는다. requiredSlots는 모두 빈 배열이며 새 이름 슬롯을 만들지 않는다. ID 저장과 FIX-12 읽기 시점 이름 치환을 유지한다.

Ruby schema validator는 사용한 keyword만 처리하며 지원하지 않는 keyword를 거부하는 subset이다. 전체 JSON Schema 표준 적합성 검증 또는 JavaScript 실행은 아니다. Integer 타입이 아닌 1.0을 보수적으로 거부할 수 있지만 새 잘못된 문장을 선택하는 방향은 아니다.

## 남는 통합 경계 — 원고 부족과 구별

정규화 모형은 목록이 전체인지, 실제 같은 게임의 바로 그 사건 스냅샷인지 외부에서 인증하지 못한다. 캡처를 호출하는 어댑터가 이를 보장해야 한다. 같은 소스HEAD·recordId·tick이 다른 저장에서도 재사용될 수 있으므로 envelope를 다른 게임/저장에 전역 캐시해 재사용하면 안 된다. 같은 decoded save의 원본 record와 묶거나 별도 저장/캠페인 식별키를 두어야 한다. 이 모형의 sourceHead 검사는 동일 게임 인증이 아니다.

`before.tick < after.tick` 등 보수적인 제약 밖의 기록은 baseline으로 남을 수 있다. 정상 런타임에서 몇 퍼센트를 포착하는지는 측정하지 않았다. 주택 없는 초기 명부·후계 변경·모호한 spouse 조합을 unknown으로 두는 것은 가짜 인과보다 안전한 제안이다. 앞선 fixed-context의 실제 동거 주장과 달리 이번 이탈 문장은 목록 잔류를 말하므로, past 제외를 실제 동거/돌봄 판정으로 확장하지 않는다.

세 기본 사실행과 합쳐 읽었다. 입주는 '가구가 새 집에 들었다', 혼인은 '혼인해 가구를 이루었다', 이탈은 '마을을 떠났다'를 유지한다. 혼인 기본행을 별도 가구가 분리 창설되었다는 뜻으로 확대하지 않는 조건에서 충돌 보류는 없다. 최종 UI·저장복원·캡처 어댑터 설치는 미실행이다.

원고 승인은 위 계약을 유지하는 조건부 승인이다. 정본/인덱스 병합은 이 검수에서 하지 않았다.
