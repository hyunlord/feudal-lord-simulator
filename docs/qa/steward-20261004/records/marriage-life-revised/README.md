# 혼인 후속 사건 문맥 초안

지정8유형을 20문장·6문맥 필드로 작성했다. 원본·정본650·엔진은 수정하지 않았다. 설치 전용 파일이 아닌 사용자 요청의 별도 문장·선택 형식 초안이다. 엔진 통합은 실제 사용의 한계이지 초안 완료의 추가 조건이 아니다. 독립 검수는 아직이다.

| 사건 | 사건 시점 조건 | 후보 전문 |
|---|---|---|
| marriage.brother_in_law_born | widowed_lord | 계약 당시 영주 본인이 맺은 혼인의 상대 가문에 아들이 태어나 상속 기대가 줄었다. |
| marriage.brother_in_law_born | son | 계약 당시 영주의 아들이 맺은 혼인의 상대 가문에 아들이 태어나 상속 기대가 줄었다. |
| marriage.brother_in_law_born | brother, nephew, cousin | 계약 당시 영주의 형제·조카·사촌 중 한 사람이 맺은 혼인의 상대 가문에 아들이 태어나 상속 기대가 줄었다. |
| marriage.father_ill | widowed_lord | 계약 당시 영주 본인과 혼인한 신부의 아버지가 병들었다. |
| marriage.father_ill | son | 계약 당시 영주의 아들과 혼인한 신부의 아버지가 병들었다. |
| marriage.father_ill | brother, nephew, cousin | 계약 당시 영주의 형제·조카·사촌 중 한 사람과 혼인한 신부의 아버지가 병들었다. |
| marriage.deferred_void | widowed_lord | 계약 당시 영주 본인의 혼인에 딸린 상속 후 채무인수 약정이 풀렸다. |
| marriage.deferred_void | son | 계약 당시 영주의 아들이 맺은 혼인에 딸린 상속 후 채무인수 약정이 풀렸다. |
| marriage.deferred_void | brother, nephew, cousin | 계약 당시 영주의 형제·조카·사촌 중 한 사람이 맺은 혼인에 딸린 상속 후 채무인수 약정이 풀렸다. |
| marriage.will_change | open | 상속을 침해하지 않겠다는 약속이 남아 있는 가운데 이웃 영주가 유언을 고치려 했다. |
| marriage.will_change | absent | 이웃 영주가 유언을 고치려 했다. 그때 아직 열려 있는 상속 불침해 약속은 없었다. |
| marriage.will_dropped | paid_favour | 돈을 건넨 뒤 이웃 영주가 유언을 고치지 않기로 했다. |
| marriage.will_dropped | support_promised | 정치적 지지를 약속한 뒤 이웃 영주가 유언을 고치지 않기로 했다. |
| marriage.father_died | living_son | 이웃 영주가 죽자 살아 있던 아들에게 영지가 넘어갔다. |
| marriage.father_died | rival | 이웃 영주가 죽자 새 유언에 적힌 경쟁자에게 영지가 넘어갔다. |
| marriage.father_died | lord_house | 이웃 영주가 죽자 혼인에서 비롯한 상속 청구가 인정되어 우리 가문이 영지를 물려받았다. |
| marriage.lost | positive | 영지가 이웃 영주의 아들에게 가면서 상속 뒤 빚을 떠맡기로 한 약정도 풀렸다. |
| marriage.lost | absent | 영지는 이웃 영주의 아들에게 갔다. 이 혼인에는 상속 뒤 떠맡을 빚이 정해져 있지 않았다. |
| marriage.contested | explicit_let_stand | 새 유언을 그대로 두겠다고 답한 뒤, 이웃 영주가 죽자 그의 조카가 영지를 차지했다. |
| marriage.contested | unanswered_deadline | 유언 변경에 답하지 않아 기한을 넘겼고, 이웃 영주가 죽자 그의 조카가 영지를 차지했다. |

## 의미와 근거

- 출생·질병·채무인수 해제는 계약 당시 신랑과 우리 영주의 관계를 재사용한다. subject=TOWN 또는 상대 아버지와 혼동하지 않는다.
- 유언 변경 시도는 상속 불침해 약속이 당시 open인지, 철회는 실제 돈 지급인지 새 정치적 지지 약속인지를 구별한다. 새 약속을 이행했다고 적지 않는다. open 약속이 없는 것은 약속이 한 번도 없었다는 뜻이 아니다.
- 아버지 사망은 실제 inheritance의 생존 아들→경쟁자→우리 가문 분기를 캡처한다. 현재 상태로 과거를 다시 계산하지 않는다.
- 상속 무산에서 deferredDebt의 유무를 구별한다. 이웃 영주의 원래 빚을 소멸시킨다는 뜻이 아니다.
- 분쟁은 새 유언을 그대로 두라는 명령과 기한 내 무응답을 구별한다. bot의 명령도 명령 경로일 뿐 사람의 의도를 뜻하지 않는다. 이후 소송 제기·승소를 주장하지 않는다.

FIELD_CONTRACTS.json에 소스 capture 지점·현재 저장 여부·복원 가능성과 필드별 가드를 담았다. SOURCE_EVIDENCE.json은 파일 SHA와 원문 구간이다. 직접 source에서 반증되는 동기는 NOT_AUTHORED.json에 기록했다. 새 원인·재혼·의학적 진단·미래 승소를 만들지 않았다.

## 기본 사실줄과 한계

출생 기본 사실줄은 '다시 장가들어'라고 하나 실제 producer는 아들의 출생과 fatherId만 만든다. 재혼을 입증하지 못하므로 해당3개 후보 모두 ADOPTION_LIMITS의 사용 차단 대상이다. 제안 사실줄은 '이웃 영주에게 아들이 태어났다 — 상속 기대가 줄었다'. 원본 문구는 바꾸지 않았다.

질병은 게임의 father_ill 사건이며 실제 질환·예후 상태가 저장된다는 뜻이 아니다. 사망 producer는 oldLord 미조회도 !alive로 취급하므로 이 초안은 실제 인물·사망 확인이 없으면 baseline fallback을 요구한다. fallback 자체가 기존 사실줄 문제를 해결하지는 않는다.

## 검증 계약

별도 PROPOSAL/CONTEXT schema는 정확한 필드 도메인·template 결합·필수 조건·양수 범위가 아닌 0부터의 safe integer tick·HEAD 일치를 검증한다. 기록 ID/tick의 실제 provenance·숫자에서 enum 캡처·저장복원은 미구현이다. fixtures는 신뢰된 어댑터 출력 뒤의 순수 선택 모형이며 원본 엔진/formatter/UI는 실행하지 않았다.

ruby validate.rb로 schema·missing/unknown/malformed/다른 template fallback·이름 계약·소스 SHA/스팬·정본650 보존·ID 충돌·재혼 사실줄 차단을 검사한다. 수정된 schema 음성검사를 처음부터 포함한다. READ_TIME_NAMES.md의 읽을 때 이름 계약을 따른다. 전체 E 완료를 선언하지 않는다.

graft1회, 추정46,391 tokens 절약. 판단은 실제 source 원문 재독으로 확인했다.

## 독립 검수 뒤 선택기 수정

PATCH_LOG.md 참조. 참조 선택기가 CONTEXT schema를 먼저 검증하도록 연결했다. 추가필드 회귀52건을 더하며 기존166 fixture/114 schema 음성검사는 그대로다. 문장과 사실줄 차단3건도 그대로 유지했다. 수정본 독립 재검수는 아직이다.
