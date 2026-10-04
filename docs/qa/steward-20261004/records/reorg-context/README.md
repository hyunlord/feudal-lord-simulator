# 재편 사건 문맥 원고 — 미설치 초안

요청 5종에 11문구를 작성했다. 엔진·정본을 수정하지 않았다. `PROPOSAL.json`은 wave2-revised의 fields/additions/fallback 형식을 따른다. 모든 후보는 발생 당시 문맥 캡처 어댑터가 구현되기 전에는 설치할 수 없다. 이주 문구 2개는 기존 사실행 검토도 별도로 필요하다.

## 근거와 기록시점

소스는 `5fb1aebfe735592c1424c947e88388d4ffe21742`이며 원문·전체 파일 SHA·정확한 행 범위는 SOURCE_EVIDENCE.json에 보존했다. Graft 탐색 뒤 실제 소스로 판정을 확인했다. baseline647.ko.json은 event-context-wave2-revised의 동결 사본이며 SHA `ac1bde4a2c92381f8adaed3b3e5c6a4cd6dbe5745098639754bb6389919aba88`이다. 현재 정본의 개수나 내용으로 재해석하지 않는다.

| 사건 | 의미 있는 축 | 문구 수 | 출처 |
|---|---|---:|---|
| wage_competition | 임금 경쟁 시작 기록과 같은 전이에 해당 경쟁 이주 증가가 있었는가 | 2 | reorganisation.ts:417–424; history.ts:689–720 |
| guild_founded | 설립 당시 대표가 실제 지정되었는가 | 2 | reorganisation.ts:214–220,238–240 |
| weavers_left | 청원을 거절했는가, 답 없이 기한이 끝났는가 | 2 | reorganisation.ts:469–476 |
| overlord_warning | 경고 당시 길드가 이미 섰는가 | 2 | reorganisation.ts:438–446 |
| autonomy_request | 앞선 징수원 축출 / 길드 수락 / 나머지 실제 경로 | 3 | reorganisation.ts:305–308,478–480 |

이는 자연 플레이 발생 빈도나 모든 분기의 도달 가능성 증명이 아니다. 예를 들어 임금 경쟁 첫 틱의 이주 분기와 대표 미지정 분기는 소스에서 가능한 상태를 구별한 초안이며 정상 저장에서의 실제 관측은 하지 않았다. 임금 경쟁 이주가 없었다는 표현은 그 전이의 해당 카운터에 한정한다. 길드와 경고의 동시 존재를 길드가 경고를 일으켰다는 인과로 쓰지 않는다. 자치 특허의 내부 마감 계산을 역사적 관행으로 설명하지 않는다.

## 적용 계약과 차단

FIELD_CONTRACTS.json의 before/after 조건은 제안이며 구현되지 않았다. 새 기록이 생성되는 그 전이에서만 enum을 저장하고, 레코드 ID·틱·템플릿·소스 계보를 결합해야 한다. 현재의 대표·도시 상태로 과거 문맥을 복원하지 않는다. 카운터가 잘못되었거나 참조가 누락되거나 불확실하면 unknown이다. 소스 SHA 표시는 진짜 캡처를 스스로 증명하지 않는다.

`reorg.weavers_left`의 기존 사실행은 이주자를 직조공으로, 목적지를 길드가 있는 도시로 단정한다. 실제 leave는 직조소와 가까운 거주 가구를 고를 뿐 구성원의 직업이나 목적지 도시를 검증하지 않는다. 이 후보 2개는 ADOPTION_LIMITS.json에서 BLOCK을 유지했다. headline의 retainFactLine=true는 사실행을 임의 삭제하지 않는다는 뜻이며 이 BLOCK을 해제하지 않는다. 현재 households는 해당 전이의 증가량이 아니라 누적 now.weaverLeavers다. 중립 사실행 교체는 별도 승인·검토 범위다.

나머지 9개에서도 capture 구현 전 설치 승인을 뜻하지 않는다. selector fixture는 초안 문구 선택만 검사한다. actual capture, 저장 왕복, 엔진 발생, UI, 자연 플레이는 미검증이다.

## 이름 계약 (FIX-12)

이번 문구에는 이름 슬롯을 추가하지 않는다. 대표 지정 여부는 당시 정확한 headId 참조로만 판단하며 이름·신분·혈연을 추론하지 않는다. 추후 이름을 표시할 경우 기록에는 ID를 보존하고 historyParams(record,state)가 읽는 때 personDisplayName을 적용한다(historyNames.ts:15–22,43–54). 현재 이름/별칭으로 표시하는 것과 현재 인물 상태로 과거 사건을 추정하는 것은 별개다. 알려지지 않은 ID에는 기존 이전 저장 문자열/기본 명칭 계약을 그대로 따른다.

## 검증 범위

`ruby validate.rb`로 11 양성, 99 문맥 스키마 음성, 22 레코드 결합 불일치, 11 unknown fallback, 7 원고 스키마 음성을 검사했다. selector는 항상 CONTEXT.schema 검사 뒤 실행한다. fields=[]/fallback={}/빈 조건/틀린 템플릿/빠진 retainFactLine 등은 거부한다. known fields={}는 거부하며 unknown fields={}는 기본 문구로 돌아간다.

PROPOSAL.schema는 이 동결 원고를 위한 정확한 const/enum 계약이다. 새 원고를 자유롭게 허용하는 범용 확장 스키마가 아니다. CONTEXT.schema는 템플릿별 필드·도메인·필수값을 묶는다. Ruby 검사기는 사용된 키만 지원하고 모르는 키는 실패시킨다. JSON Schema 전체 표준 구현이나 의미적 출처 검증을 대신한다고 주장하지 않는다. 원고·스키마가 함께 생성된 한계는 소스 원문 검토와 반례 검사로 구분하며 독립 검수는 아직 받지 않았다.

검증 과정에서 테스트 selector가 when.field/op/value를 잘못 읽은 오류를 발견해 수정한 뒤 전체 검사를 다시 통과했다. 엔진 오류 보고가 아니다.

## 문구 전문

- `reorg.wage_competition.r06rg.none_recorded`: 이웃 장원의 임금 경쟁이 시작됐지만, 그 첫 시점의 임금 경쟁 이주 기록은 없었다.

- `reorg.wage_competition.r06rg.departure_recorded`: 이웃 장원의 임금 경쟁이 시작된 때에, 이 경쟁으로 떠난 가구도 기록되었다.

- `reorg.guild_founded.r06rg.assigned`: 대표를 정하며 직인 길드가 섰다.

- `reorg.guild_founded.r06rg.unassigned`: 대표가 아직 지정되지 않은 채 직인 길드가 섰다.

- `reorg.weavers_left.r06rg.refused`: 길드 설립 청원을 거절한 뒤, 이주한 가구가 기록되었다.

- `reorg.weavers_left.r06rg.expired`: 길드 설립 청원이 답 없이 기한을 넘긴 뒤, 이주한 가구가 기록되었다.

- `reorg.overlord_warning.r06rg.founded`: 직인 길드가 선 도시에 상위 영주의 경고가 전해졌다.

- `reorg.overlord_warning.r06rg.not_founded`: 직인 길드가 아직 서지 않은 때에 상위 영주의 경고가 전해졌다.

- `reorg.autonomy_request.r06rg.chased`: 인두세 징수원을 쫓아낸 일이 있은 뒤, 도시가 자치 특허를 요구했다.

- `reorg.autonomy_request.r06rg.guild_accepted`: 길드 설립을 받아들인 도시에 자치 특허 청원이 올라왔다.

- `reorg.autonomy_request.r06rg.guild_not_accepted`: 길드 설립을 받아들이지 않은 상태에서 도시가 자치 특허를 요구했다.
