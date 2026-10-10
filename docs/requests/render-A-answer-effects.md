# EB-ANSWER-EFFECTS → 렌더 A: 결정 영수증의 공통 읽기

관문: 읽기·저장·실제 답 재생 시험 통과(Mac). 화면 소비자 연결·화면 검수는 아직 하지 않았다. 격리 `codex/engine-b-tlink` 시제품이며 엔진이 TRACE-LINK를 검토할 때 함께 넘긴다.

```ts
import { answerEffects } from '../../engine/decisionTraceAnswers';
import type { AnswerEffect } from '../../engine/answerEffects.types';

answerEffects(state, answerId): readonly AnswerEffect[] | undefined
```

`answerId`는 `trace.answers[].id`, 즉 그 답의 기존 history decision ID다. 묶음의 `threadId`나 사건 ID를 대신 넣지 않는다. 읽기는 **답 당시 저장된 효과만** 돌려주며 현재 상태, 예상 명령 또는 다른 선택지에서 추론하지 않는다. 카드가 뒤집힐 때 성공한 dispatch가 새로 남긴 답 ID를 보존하고 같은 ID로 영수증·흔적·연대기를 읽는다.

| 필드 | 뜻 |
|---|---|
| `target` | `relation`, `treasury`, `right`, `land`, `person`, `command`, `oversight`, `condition`, `audit_recovery`, `marriage`, `term` |
| `path: readonly string[]` | 실제 도메인 경로. 배열은 `id`, `personId`, `estateId`, 없으면 당시 index. 예: `['stewardship','oversight','estate-neighbour-1','merchants']` |
| `before`, `after` | 답 직전·직후의 숫자/문자열/불리언/null 스칼라 |
| `beforePresent`, `afterPresent` | 값이 실제 존재했는지. 부재는 null과 false, 실제 null은 null과 true |
| `delta` | 양쪽 모두 숫자이면 `after - before`, 그 밖에는 null. 문자열·불리언·추가/삭제는 이전→이후로 표시하고 가짜 수치 차이를 만들지 않는다 |

`undefined`는 답 ID가 없거나 과거 저장이라 효과를 기록하지 않았다는 뜻이다. "변화 없음"으로 표시하지 않는다. `[]`만 실제로 기록한 변화가 없는 답이다. 이 차이는 저장·재읽기 뒤에도 유지된다. 사라진 항목도 before 값과 afterPresent=false로 남는다. 가문 관계의 생략된 값은 엔진과 같은 0, 목재 주문 생략은 0으로 읽는다.

## 요청한 세 항목

- **감사 회수액**: `target='audit_recovery'`, `path=['auditRecovery', auditId, ledgerEntryId]`, `before=0`, `after=delta=실제 새 audit_recovery 현금 분개액`. fixture에서 178이다. 이는 `treasuryCoin` 변화의 **구성 항목**이므로 금고 변화에 다시 더하지 않는다. 예상 회수액이나 처리 상태로 만들지 않는다.
- **유언에 따른 혼인 단계**: `target='marriage'`, `path=['diplomacy','marriage','stage']`. 실제 fixture의 `will_change → father_ill`, `delta=null`이 보존된다.
- **역제안이 바꾼 조항**: `target='term'`, `path=['diplomacy','negotiations', negotiationId,'effectiveTerms', index, field]`. 코어는 원래 `terms`를 덮어쓰지 않고 승낙된 `counter.terms`를 실행하므로, 그 승낙에서 적용된 원안→역안 차이를 별도로 기록한다. fixture의 상속 뒤 채무 추가액은 1305. 거절에는 적용 조항 변화 항목을 만들지 않는다. 다른 생긴 약속·혼인·금고 변화는 각 실제 경로로 함께 나온다.

배열 항목을 묶어 자연어 한 줄로 보여도 수치의 출처는 이 목록으로 유지한다. `target`은 표시 분류이고 `path`가 대상/필드의 정확한 식별자다. 금액 단위는 해당 게임 필드의 단위(동전: penny), 관계는 점수, 세율은 permille다. 사람이 읽는 현지화·단위 변환은 렌더가 맡는다.

## 포함/제외와 이행

실제 관계·금고·권리·땅·사람·혼인·약속·감독·규칙·주문·공사·목책/예약·조건을 저장한다. history/trace/장부의 처리 기록, RNG·시계, ID 카운터, 기억/연혁, 청원·감사 자체의 처리 상태, 캐시는 효과로 만들지 않는다. 다만 실제 명령의 취소·완료 상태와 계약·사람·권리 상태는 도메인 효과다. 기록만 추가되었다고 결과 보임 점수를 올리는 scorer 변경은 없다.

저장 `trace.answers[].effects?`와 provisional v57을 추가했다. v56→v57은 envelope만 옮기며 과거 답의 effects를 만들지 않는다. EB-INERT도 provisional57이므로 엔진이 합칠 때 번호·migration·fixture·fingerprint를 함께 정한다. 기존 답에 current-state diff를 덧붙이지 않는다.

## 증거

[재현과 실행 증거](../verification/eb-answer-effects/README.md): 렌더 A `299cffec123d869f629bd8c6e9537bd5be9d46e4`의 74답 선택 경로를 그대로 재생했고, 역제안2답을 추가했다.76답 모두 독립 상태 차이의 이전·이후·차이를 대조했다. 같은76답을 기준db750c164와 짝지어 trace 밖 전체 상태가 완전히 같음을 확인했다. 이는 fixture reducer 시험이며 새 자연125년 판 또는 화면 수용 시험이 아니다.
