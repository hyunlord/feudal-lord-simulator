# 전쟁·역병 사건 시점 문맥 초안

판정: **7종 검토,6종14개 원고 작성,1종 미작성. 전부 미설치 제안이며 실제 발생 증거 아님.** 엔진/정본을 수정하지 않았다. 동의어로 고정 사건을 늘리지 않고 당시 방벽,곡물창고 재고,소문/도착의 시간차,재유행 당시 사제 자리라는 서로 다른 상황을 구분한다. 사망수·예방효과·피해·안전·새 역사적 원인은 추정하지 않는다.

| 사건 | 분기 | 출처/정확한 포착 시점 |
|---|---|---|
| war.messenger | 둘레 방벽 없음/미완성/완성 | history.ts:615 war 생성 전이,after.palisade.segments의 실제 completed |
| war.beacon | 둘레 방벽 없음/미완성/완성 | history.ts:616,beaconLit false→true에서 같은after 방벽상태 |
| war.licence | 곡물창고 밀 없음/있음 | history.ts:628 licence 첫 설정 전이의after inventory. 구매량·수입 아님 |
| plague.rumour | 도시도착 이전/동시기록 | history.ts:649 rumourTick 첫 전이와after.first.arrivalTick |
| plague.arrived | 앞선 소문기록 있음/없음 | history.ts:650 first 생성때before.rumourTick. 준비했는지/무지했는지 아님 |
| plague.second | 사제자리 채워짐/공석 | history.ts:671 second 생성때first.endTick 확인후after.curacy.filledTick |
| plague.priest_died | 미작성 | 현행생산기는curacy 생성만검사하며개별사제사망을확인하지 않음 |

원고 전문/조건/포착 계약은 PROPOSAL.json에 있다. 각 enum은 이벤트 발생 전후를 관측하는 제안 어댑터가 포착해야 하며,현재 기록에는 없어서 날짜나 현재 인물/방벽을 읽어 소급 채우면 안 된다. `plague.second`는 첫 유행 종결이 확인되지 않으면모두fallback이다. 공석은 사제직의 상태일 뿐 특정 살아 있는 사제의 유무·교회 건물 존재를 뜻하지 않는다. 방벽완성은 raidLosses의 안전보장이나 모두석벽/수비병보유가 아니다.

## 사실행과 미작성

작성한14개는 기존사실행을항상유지한다. war전령/봉화/면허 및 plague소문/도착/두번째유행이라는고정사실과 충돌하는 문구를추가하지않았다. 기존 plague.priest_died 사실행은 '사제가 역병으로 죽었다 — 교회가 비었다'이지만 plague.ts:519–524는 first생성과함께curacy.vacantSince와청원만설정한다. 추적사제사망이나교회건물존재를 이마커만으로 입증하지 못한다. 따라서 건물수/사망규모로분기를늘리지않고 NOT_AUTHORED.json에보류사유를기록했다. 이는일반사제사망이없다는주장이아니며 엔진수정요청이나수정완료가아니다.

## FIX-12와 채택 제한

이 후보는 인물 이름을 저장하거나 이름 슬롯을 새로 만들지 않는다. 기존사실행이인물ID를포함하면 historyNames.ts의읽는시점치환을유지한다. 역사적관계나상태는그사건에붙인불변snapshot만사용한다. sourceHead·recordId·recordTick·template 결합이 맞지않거나provenance를확인하지못하면기존사실행만보여준다. referenceVerified=true라는사용자입력하나가 실제참조무결성을증명하지않는다. schema는형식검사이고capture어댑터는구현되지않았다.

## 오프라인 검사

`ruby validate.rb`:14개양성,112개잘못된문맥schema,28개다른기록ID/tick,14개unknown fallback,6개proposal schema반례. source5파일12구간SHA도검사한다. 부정입력과positive fixture는손으로정한계약의가상입력으로,실제engine생산/format/UI테스트가아니다.

CONTEXT.schema는필수필드·비음수tick·도메인·템플릿과필드결합·캡처출처를강제한다. PROPOSAL.schema는이14개원고와정의된조건계약을동결하는엄격스키마이며 임의의추가원고를받는일반등록기규격이아니다. Ruby는사용한keyword만명시적으로실행하며미지원keyword를거부한다. 전체JSON Schema표준인증주장없음. 후보를고치면독립검수후schema도함께갱신해야한다.

실측발생·과거저장복원·엔진선택기·UI·독립검수는미수행이다. 출처관행을새로주장하는원고가아니므로근거는지정HEAD의기존게임사실과계약에한정한다.
