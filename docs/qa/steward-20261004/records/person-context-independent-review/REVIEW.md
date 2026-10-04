# 독립 검수: DRAFT 합격, 통합은 명시 조건부

13개 새 문구·12유형 대응표·기존 나이20개 재사용의 범위가 자료와 맞는다. source5파일 SHA와 모든 인용구간을 현 HEAD에 대조했고, 작성자 최종142사례를 읽기 전용 pure selector로 재실행했다. 후보·정본은 수정하지 않았다. 별도 기록시점 나이2사례도 통과했다. 엔진 미설치를 초안 합격의 결격으로 삼지 않는다.

- **청지기2개**: `persons.ts:477`은 현 청지기 부재에 새 인물을 만들고 `advancePersons:1009`는 사망/이탈 처리 뒤 이를 호출한다. `history.ts:395–405` 신규 steward와 416–421의 before→past 이탈을 같은 전이에 연결하는 조건은 논리적으로 맞는다. 다만 정상 청지기는 manor 소속이고 일반 사라진 집 이주 처리에서 제외되므로 **사망 뒤 임명은 코드상 가능한 경로, 이주 뒤 임명은 자연 도달 경로 미입증**이다. 두 후보의 BLOCKED_NEW_FIELD_REACHABILITY_UNVERIFIED 표시는 적절하다. 실제 producer는 전임자 ID가 새 대상 ID와 다르고 before에서 유일하며 after 신규past에 들어온 동일인임을 직접 증명해야 한다. 제안 selector의 Boolean 플래그 자체는 이 증명이 아니다. 문서도 이를 이미 구분한다.
- **빈집2개**: history.ts370은 비방치 거주자>0→<=0을 검사할 뿐 굶주림 원인을 검사하지 않는다. 현행 historyCopy347 기아 단정과 retainFactLine:true의 충돌은 실제다. 두 후보를 baseline 사실줄+신규필드 차단으로 분리한 것이 맞다. 중립 headline만 적용하면 충돌이 해결되지 않는다.
- **나이7개 및 기존20개**: adapter는 현재 tick 대신 record.tick의 연도에서 불변 birthYear를 뺀다. 별도검수에서 현재1400년/기록1301년/생년1275년을 넣어 26세(125세가 아님)를 확인했고 중복ID는 unknown이었다. 현재역할을 과거역할로 대체하지 않는다. 가구 empted는 개인 나이 allowlist에서 제외된다.
- **현실 범위**: arrived14–29/55–70은 친척 생성구간의 보수적 부분집합, reeve25–60/expecting16–44는 engine 생산조건과 맞는다. 30세 arrived가 baseline으로 빠지는 것은 오류가 아니라 명시된 범위다. bailiff artisan/merchant/head/25–60은 선임조건과 맞으며 기록시점 값이 필요하다. 이 숫자는 게임 규칙이며 역사적 법정 나이 주장으로 쓰지 않는다.
- **FIX-12**: 13개에 고정 인명이나 과거이름 문자열이 없다. 이름은 기존 ID→읽기시점 해석 경로를 유지하고 새 슬롯 ageAtRecord만 숫자로 제안한다. 원래 fact line 유지 자체가 이름해석 통합을 자동 보장하지 않으므로 실제 adapter/renderer 결합 시 별도 확인해야 한다.
- **범위/드리프트**: 기존 age20은 6개 template 그룹의 variants 합계20이고 새13과 template가 겹치지 않는다. 기존20 전체를 이번에 다시 검증했다고 세지 않는다. 최종 저자 baselineSHA와 현재정본SHA는 동일 `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`였다. 부모가 언급한 작성중647 대비 드리프트를 최신결과의 실패로 판정하지 않았다. 정본 변경은 하지 않았다.

통합 조건은 ① 새context/slot schema 연결, ② 기록시점6개필드의 실제producer provenance, ③ empty2 사실줄 충돌해소, ④ 청지기 특히이주 자연도달 확인이다. 현 초안은 이 조건과 미검증 상태를 명시하므로 DRAFT 합격이다. 전체 E 완료나 runtime 검증은 아니다.

검수기 최초실행에서 기존20의 template그룹6을 variant20으로 잘못 센 로컬검수 오류가 있었고 flatten-count로 바로잡았다. 원고 결함이 아니며 RESULT.json은 수정된 검수기의 재실행 결과다.
