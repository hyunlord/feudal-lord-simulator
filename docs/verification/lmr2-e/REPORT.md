# LM-R2-E 보고서 — 렌더 LM-R2가 쓸 엔진 몫과 v4.1-senders

관문: 통과 — 요청서(docs/requests/engine-lmr2-seen-and-reads.md)의 넷을 모두 넣었고, 읽기는 명령과 같은 함수로 거절한다(시험이 박음). 이야기 "봤음"은 저장 v51, 이웃 가문 여덟에 정확한 문장, v4.1-senders로 보류 셋이 켜짐.

- **지시**: 사용자 지시(2026-10-06). RECOVER-1 다음, ①이 렌더 LM-R2 마무리를 막아 먼저. 이웃 가문 문장도 같은 작업으로. Astra v4.1-senders(발신자 단일화 3건)도 함께.
- **결정**: LME9B-10, LMR2E-1~3. **저장**: v51(v50은 MANOR-1).

## 실행 위치
- **Mac**: 시나리오 시험(`storySeen` 3/3, `neighbourArms` 3/3, `suitActions` 2/2, `negotiation` 14/14, `stewardship` 10/10, `registryCanon` 4/4, `registryV4` 8/8), typecheck, 저장 고정본·지문 생성.
- **DGX**: 바뀐 것에 걸린 시험(`npm run test:changed`, RR16) 3,939/3,939 — DGX `fc7b197`(`engine-LMR2E-changed-fc7b197`, 가벼운 칸, 본선 3841159b를 합친 머리).

## 무엇을 깔았나
- **① 이야기 "봤음"**: `GameState.seen.marks`, 명령 `mark_story_seen`(seen·opened·dismissed), 읽기 `storySeen`.
  - 같은 표시는 같은 상태 객체를 돌려준다. 두 해·256개를 남긴다.
  - 결정이 아니고, 규칙은 읽지 않는다(300틱 동안 표시 유무와 상관없이 같은 상태).
  - 저장 v51(판만 올림), 고정 저장 13개와 지문.
- **① 이웃 가문 문장**: 이웃 영주 성 여덟(`NEIGHBOUR_SURNAMES`)마다 정확한 문장을 데이터로 두었다(`neighbourArms.ts`, 한국어 읽기 `neighbourArmsCopy.ko.ts`). seed로 만들지 않는다.
  - 규약을 시험이 본다: 담비 없음, 왕실 조합 없음, 색과 금속의 대비. 새 영주 모드 게임의 이웃 영지 가문(늙은 영주 가문 포함)이 모두 문장을 가진다.
- **② 읽기**: `suitActions`, `keepPromiseRefusal`, `answerCounterRefusal`, `willChangeRefusal`, `estatePetitionEffect`, `auditAnswerEffect`.
  - 명령(`keepPromise`·`answerCounter`·`answerWillChange`·`answerAudit`)이 같은 거절 함수를 부른다. 감사의 후임 고르기는 한 함수로 나눴다.
  - 영주가 원고가 아닌 소송은 읽기가 null이다(보여 주기만).
- **③ 단어표**: `historyCopy.ko.ts`의 표 여섯을 내보냈다.
- **④ 확인 셋**: 요청서 답에 적었다(모두 맞음, 역제안은 한 계절 기다림).
- **v4.1-senders**(LME9B-10): 원고만 고치는 갈래 판을 id로 합쳤다(새 id 금지).
  - 008 → 교회, 024·035 → 도시 공동체.
  - 세 보류가 관계 −2의 대가로 켜진다. 대가 없는 보류는 003·046 둘만 남는다. 합친 건수는 215 그대로다.

## 필수 조건
- 바뀐 것에 걸린 시험: 3,939/3,939 — DGX `fc7b197`(`engine-LMR2E-changed-fc7b197`, 가벼운 칸, 본선 3841159b를 합친 머리)
- typecheck — Mac. ui-geometry: 화면 파일을 바꾸지 않았다(렌더 요청서만).

## 다음 후보
- EXT-1 → EXT-2(달력·화폐·시작·끝 연도·시대 구분을 팩 설정으로, 박힌 연도 목록) → EXT-3 → EXT-3b, LM-E9c와 번갈아.
- 긴 판 표(1300→1600, 50년마다 틱 시간·저장 크기·힙, 쌓이는 것).
- 이웃 세계 16가문(LM-E10)이 오면 문장 표를 그 가문들로.
