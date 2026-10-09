# EB-TLINK — 개별 답변의 인과 흔적 시제품 인계

## 현재 상태와 고정점

**최신 제품864f1ea는 실제 기존 계절 보고에 한정된 관계 기여 증거와 잠정v56을 추가했다. 집중121시험·타입검사·범위 lint·독립 검토는 통과했다. 최신 제품의 브라우저 기능 검증은 통과했고,125년 측정·native 전후 해시·변경 영향 시험·기하는 pending이다.390px 화면의 우측 잘림은 별도 미해결로 보존했다. 0b04 공식 점수204/816=25%는 미달이며 최신 제품 결과로 사용하지 않는다. 전체 관문 통과나 본선 병합 승인이 아니다.**

| 구분 | 고정점 / 범위 |
| --- | --- |
| 최신 구현 | `864f1ea06851f0508109f34ab355e4843bb16ff4` |
| 이전125년 수집·재생 소스 | `0b04cd0becc4d73059fbfcf372395c8672d1a381` — 최신 관계 구현 전 |
| 구현 전 기준 | `64a16b5a6c1d91024415039db89bb88412528e15` |
| 격리 가지 | `codex/engine-b-tlink` — 본선 미병합 |
| 전체 변경 파일 | [docs/verification/eb-tlink/changed-files.json](../verification/eb-tlink/changed-files.json) |

0b04는 직접 감독 청원의 빠진 원인과 집사 교체의 원인 탈취를 고친 이전 측정 소스다. 최신864f1ea는 관계 기여 연결을 추가한 별도 제품이므로 이전 결과를 승계하지 않는다. 위 변경 파일 JSON은 기준64a→864f1ea의 전체 변경 목록이다. 구 fae9 측정과0b04 native 대기 작업은 실행 전에 취소했으며 통과 근거에서 제외한다.

목표는 성공한 각 답변의 소속·실제 선택 대상·공존 원인·관측 상태·표시 문구 ID를 보존하는 것이다. 승인 관문은 성숙한 무거운 답의 **정확한 자기 ID 미래 연결≥80%**, 남은 답의 실제 증거에 따른 설명, 규칙 해시 불변, 지정10사건 회귀다. 관련 원칙은 P-C3·P-D5·P-T1·A4·A5다.

게임 규칙·봇 정책·정본 조건·점수 분모·미래창은 바꾸지 않는다. 원래 TRACE-LINK 자리인 GROW-BLOCK 두 단계와 작은 묶음 뒤에 엔진이 검토·통합하며, MOD-SLOT 채택 뒤135→묶음7→묶음9 순서는 유지한다. 원격 작업은 공식 실행기의 한 세션 실험1개 규칙을 따르고 같은 실행을 중복 시작하지 않는다.

## 구현 계약

- `trace.answers`는 성공한 답의 자기 이력 ID, 기존 묶음 ID, 자기 선택 대상, 실제 기억 근거를 보존한다. 무효·반복 명령이나 구 묶음 별명으로 답 멤버십을 만들지 않는다. 기존 묶음은 기록 생성 순서 보존용이며 자동으로 개별 답의 원인이 되지 않는다.
- 직접 감독이 청원을 영주에게 올렸을 때 기존 `stewardship.brought`에만 `petition_routed`를 붙인다. 방식이 실제로 바뀐 답의 `oversight_mode:<estateId>`를 쓰므로 집사 교체/감사 처벌이 원인을 가져가지 않는다. 기록과 청원의 양방향 유일 대응을 확인하고 동명 영지의 모호한 연결·같은 tick·구 broad-only 근거는 추정하지 않는다.
- 실제 결과의 `because`에는 해당 효과에 기여한 답만 남긴다. 현재 설정 소유권·교체·취소·후속 재주문을 구분하고, 원인 수가 다섯 이상이어도 실제 기여를 조용히 잘라내지 않는다. faction 기억의 기존 ID·관계와 기록 할당 순서는 유지한다. 연결률을 올리기 위한 새 결과 기록은 만들지 않는다.
- 기존 `ledger.season`은 보존된 실제 후속 현금 거래와 거래 당시 소유권을 확인한 뒤 `traceLedgerEvidence`를 보관한다. 같은 tick의 명령 비용은 후속 수입 근거가 아니다. `readDecisionLedgerEvidence(record, answerId)`는 답별·대상별 근거를 읽고 잘못된 JSON·거래·범위·because·중복을 거부한다. 기록에 agency 모드가 없으므로 양끝 포함 범위 검사는 거래 당시 소유권이나 정확한 결산 cadence의 재실행 증명이 아니다.
- `decisionTraceEstateRelations.ts`는 실제 영지 청원 답의 tenants/merchants 변화와 기대값을 optional 증거로 저장한다. 0 변화·포화·반대 방향 변화·알 수 없는 writer·감독/집사 변경·끊긴 값·모호한 기록은 미래 기여로 추정하지 않는다. 첫 다음 실제 철의 요약과 기존 `stewardship.season`이 유일하게 대응할 때만 `estate_mood`와 현재 관계/보존 기여량을 덧붙이고 증거를 consumed로 바꾼다. 새 기록·지연 확인용 영수증을 만들지 않는다. 이는 제한된 기여 보존 증명이며 모든 장기 관계·경제 효과의 반사실 검증은 아니다.
- 실제 카드 클릭 명령의 원본 ID·`displayEntryId`를 답변 이력에 저장한다. 구 저장이나 봇에 없는 표시 정보는 모른다고 유지한다. 종료 화면은 root와 own answers를 함께 읽어 같은 묶음의 별개 무거운 답도 표시한다.
- 작은 own answer는 기존 TRACE-KEEP와 같이10년 뒤 정리하고 무거운 답은 보존한다. 무거운 root가 남아 있어도 작은 답의 만료는 별도로 검사한다.

### 원래 점수와 잔여 답 판독의 분리

미래 직접 연결은 답변 뒤12000틱 안의 실제 결과 `because`가 정확한 답변 ID를 가리키는 경우다. 즉시 완결을 미래 결과로 세거나 조건부 답을 성숙 분모에서 제외하지 않는다.

`engineBTlinkResiduals.mjs`는 archive 핀을 검증하고 기존 scorer 전체 결과를 재계산해 일치할 때만 부가 판정을 만든다. 원래 분모·직접 링크·pass는 그대로 둔다.

| 부가 판정 | 필요한 증거와 한계 |
| --- | --- |
| `insufficient-observation` | 원래3년 관측창 미완료. 이미 관측된 후속이 있어도 원래 검열 상태를 보존 |
| `immediate-only-observed` | 같은 답의 실제 집행 성공 기록, 또는 검증된 청원 처리/혼인 역제안 기록. 미래 분자에는 불포함 |
| `conditional-unmet-observed` | 실제 집행 기록의 해당 시도 실패처럼 실행 가능한 거짓 조건이 관측된 경우만. 한 시도 실패를3년 전체 조건 미충족으로 확대하지 않음 |
| `unexplained` | 나머지 성숙 답. 영수증 부재를 조건 미충족으로 바꾸지 않음 |

영지 수선 허가·지대 구제·특허 거절은 manifest 해시로 검증한 답 당시 context, 정확한 청원 ID 전이, 같은 답의 실제 처리 기록을 함께 확인한다. 이는 청원 처리의 증거이며 공사 완성이나 실제 관계·금액 변화의 증명은 아니다. 혼인 역제안은 실제 negotiation ID와 처리 기록을 확인한다. audit ID가 없는 감사 기록에는 새 즉시 판정기를 적용하지 않는다.

기존 미분류 phase 명령은 실제 BIG 결정 기록과 명시적으로 검토한 소스 핀으로 별도 집계한다. 이 보충 분모·상태·임계치 결과는 원래 관문을 덮어쓰지 않는다. 승인 기대표의15개 원본 소스 핀 중 시제품과 다른 것은 `decisionTrace.ts`와 `history.ts`다. 따라서 원본 scorer의 strict contract audit에는 source mismatch가 남는다. 통과를 위해 기대표 핀을 임의 갱신하지 않았으며 엔진이 변경 의미를 검토한 뒤 재고정해야 한다.

## 측정 표 — 이전 제품 공식 미달과 최신 제품 대기

기존 승인125년 자료의 **292/816=35.78%**는 과거 관측값이다. 새 기준판도 같은 수치를 재현했지만, 별도 실행의 원본과 소스 핀을 아래에 보존한다. 0b04 세 판의 공식 수집·재생 검증 뒤 원래 scorer로 집계한 값은204/816=25%다. seed1=52/238, seed2=70/275, seed3=82/303이며 미성숙20·성숙 미연결612·미분류2다. 세 판 모두 replayVerified이며 원래 scorer의 pass=false를 보존했다. 후속 잔여 분석은 즉시 결과만 관측433·설명 미완179·관측 부족20으로, 미완 답을 조건부로 바꾸지 않았다.

| 실행 / 측정 | 실제 소스 | 결과 상태 |
| --- | --- | --- |
| `engineB-tlink-baseline125-cf3fa94` — seed1–3 각125년 수집+재생 | `cf3fa941659ecb78396eed3780f88024a2bde0dd`, 제품은64a와 동일 | **완료·기준 미달** — 292/816=35.7843%, 관측 부족20·미연결524, 수집/재생3판 일치·exit0 |
| `engineB-tlink-prototype125-0b04cd0` — 같은 seed·기간·도구 | `0b04cd0becc4d73059fbfcf372395c8672d1a381` | **완료·미달204/816=25%** — 세 판 수집/재생 일치·실행 exit0, 채점 pass=false. 최신 관계 제품 결과 아님 |
| `engineB-tlink-paired-guardrail-0b04cd0` — seed1–3, 최대500000틱·24필지 일반 성장 전후 | 기준64a / 측정 엔진0b04 | **실행 전 취소** — 대기 작업 종료, 해시/통과 증거 없음 |
| `engineB-tlink-changed-0b04cd0` — 이전 제품 변경 영향 시험 | 구현0b04 | **PASS** — 616파일·4755시험:4742통과·실패0·skip13, exit0 |
| `engineB-tlink-geometry-0b04cd0` — 이전 제품 화면 기하 | 구현0b04 | **PASS** — 27행·540조건, 실패0·미개방0, exit0 |

| `engineB-tlink-relation-browser-864f1ea` | `864f1ea06851f0508109f34ab355e4843bb16ff4` | 기능 PASS·exit0 — 자기 답→다음 철→원인 답, 두 화면 크기·저장 왕복·틱/ordinal 불변.390px 우측 잘림은 화면 인수 미달 |
| `engineB-tlink-relation125-864f1ea`, `engineB-tlink-native-latest-864f1ea`, `engineB-tlink-relation-changed-864f1ea`, `engineB-tlink-relation-geometry-864f1ea` | `864f1ea06851f0508109f34ab355e4843bb16ff4` | **pending** — 결과 수치/해시 일치 추정 안 함 |

결과 인계에는 각 실행의 실제 sourceRevision·입력/출력 해시, seed별 원래 직접/성숙 분모와 관측부족, 부가 잔여 범주, 보충 phase 분모를 함께 고정해야 한다. 기준판은 seed1=71/238, seed2=114/275, seed3=107/303이며 전체836답 중816답이 관측 충분하다. 원래 scorer는80% 미달과 미분류 선포2건을 그대로 남겨 exit1이다. 보충 분류는 두 실제 BIG 기록을 확인했지만 원래 점수를 덮어쓰지 않았다. [세 판 원본·재계산·해시·측정 커밋 bundle](../verification/eb-tlink-outcomes/README.md)을 보존했다. 0b04 공식 집계는 기존 정확한 own-ID 미래창·분모를 그대로 사용한다. 기준판과 세 판의 명령열·관측 지점별 규칙 투영·최종 투영이 일치했다. 원시 전체 상태 해시는 세 판 모두 다르며 이를 해시 불변으로 부르지 않는다. 이 비교는 매 tick 또는 별도 native 가드레일 검증을 대신하지 않는다. 같은 tick 종결이나 관계 포화0을 미래 성과/조건 미충족으로 바꾸지 않는다. 아직 없는 최신 제품 수치나 전후 해시를 채우지 않는다.

[규칙 비교 방법](../verification/eb-tlink/parity-method.md)은 `history`, `trace.decisions`, `trace.answers`만 투영에서 제외한다. `trace.acts`, faction 기억의 실제 record/decision ID·관계, ledger 금액·모든 참조와 나머지 필드는 해시에 포함한다. 각 명령·각 철·최종 상태·명령 스트림을 대조하며 모든 tick 상태의 동등성을 증명하지 않는다. 일반 성장 가드레일의 전체 상태 해시는 별도 전후 비교다.

## 저장과 GROW-BLOCK 병합 겹침

시제품 저장은 **잠정v56**이다. v54→v55의 own-answer 도입에 이어 `src/save/migrations/v55ToV56.ts`는 버전만 올리고 구 답의 관계 증거를 역으로 만들지 않는다. optional `estateRelationEvidence`의 shape·값·상태를 검증하며 pending/consumed 준비 상태까지 `src/save/schemaFingerprint.v56.json`에 포함했다. [표준13개와 관계 준비 저장2개](../../fixtures/saves/v56/README.md), [표준13개 fixture manifest](../../fixtures/saves/v56/manifest.json)를 보존했다. 표준13개는 공식 `buildSaveFixtures.ts --from-version 55`로 이행하여 전체 decoded state·재인코딩을 확인했다. 관계2개는 실제 reducer/계절 경로를 거친 준비 fixture이며 자연125년 증거가 아니다. 기존v55 fixture는 보존했다.

GROW-BLOCK은 여전히v55다. 2026-10-10 읽기 전용 재확인 경로는 `/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill-grow`, HEAD는 `a77081448e1f0e77ee54d43d333047c9cc518196`으로 이전 확인과 같다. tracked 변경은 없고 미추적 `output/grow2s/`, `output/grow2w/`, `scripts/tmp/`가 있어 전체 clean이라고 하지 않는다. 서로 다른 common repository의 관측이며 병합 때 다시 검사해야 한다. 엔진은 GROWv55와 TLINKv55→v56 이행을 통합한 뒤 최종 번호·fingerprint·표준 fixture를 재생성해야 한다. TLINK가v56으로 올랐다고v55 경로 충돌이 사라진 것은 아니다.

| 파일 | 보존할 GROW 변경 / TLINK 접점 |
| --- | --- |
| `src/engine/history.ts` | 혼인·사망 spouseId, child/father, 공사 포기 기록 / 답변 이력·표시 ID |
| `src/content/historyCopy.ko.ts` | agency.site_abandoned·사유 문구 / 필요한 흔적 문구 별도 검토 |
| `src/save/saveTypes.ts`, `src/save/migrations/index.ts` | GROWv55 연결 / 시제품 이행 통합·최종 번호 재지정 |
| `src/save/migrations/v54ToV55.ts`, `src/save/schemaFingerprint.v55.json`, `fixtures/saves/v55/*` | 같은 경로·표준 fixture 충돌 / 통합 판에서 재생성 |
| `src/engine/townAgency.types.ts`, `src/engine/townAgency.ts` | charterWallFailure·abandonedSites / TLINK 규칙 변경 금지 |
| `src/ui/lord/decisions/lordMattersDue.ts`, `src/ui/hud/autoPauseModel.ts`, `src/ui/hud/autoPauseCopy.ko.ts`, `tests/lordAutoPause.test.ts` | 기한 표시·중복 자동 정지 제외 보존 |

최초 확인 때 GROW 추가 변경에 `decisionTrace.ts`, `decisionTrace.types.ts`, `history.types.ts`, registry 계열은 없었지만 의미상 독립이나 최신 무충돌을 보증하지 않는다. 당시 핵심 엔진 커밋은77c6420f1·253683af9·566ce1f22·697b35b57이었다.

## 엔진이 검토할 결함과 한계

1. **영지 mood의 제한된 교정 — 최신 실행 검증 대기.** 기존 `decisionTrace.ts`의 전역 길이 기반 요약 탐색이 같은 길이의 새 요약을 놓치는 경로와 별개로864f1ea는 객체 정체성으로 실제 새 요약을 찾고 기존 계절 기록에만 연결한다. 답 당시 실제 관계 변화와 첫 다음 철까지 끊기지 않은 기여만 허용한다. 같은 estate의 모든 답·clamp0·알 수 없는 변화는 연결하지 않는다. 집중 회귀 통과는 자연125년 적용률·전체 규칙 해시·실제 화면 인수를 대신하지 않는다.
2. **무효과 heavy 답의 경계 사례.** 준비 seed17에서 상인 관계를−100으로 설정한 뒤 실제 계절 함수가 만든 charter_request를 두 번 거절했다. tick2000 `h-000016`·tick6000 `h-000020`은 rights heavy지만 관계−100→−100, 규칙·경제 변화0이었다. 청원 처리 상태를 맞춘 대조군과 다음 한 철 stewardship 전이도 차이0·해당 답 미래 링크0이었다. 모든 heavy 답에 후속 효과가 있다는 가정의 반례지만 자연125년 빈도·모든 미래·80% 미달을 미리 증명하지 않으며 분모 축소 근거도 아니다. 측정 엔진0b04에서 다시 실행한 [도구·결과·출처](../verification/eb-tlink-boundary/README.md)를 보존했다. 제품 diff는 없었고 인계 문서2개만 수정 중이었다.
3. **history 제외 투영의 한계.** 일부 게임 코드가 history를 읽는다. 추가 회귀는083·140·061 답 뒤 표시 ID·즉시 연결을 제거한 상태와 원래 상태를 각각4tick 전진시켜 규칙 투영과 ordinal 일치를 확인했다. faction.relation의 because는 게임 입력이므로 제거하지 않았다. 이12tick은 모든 계절 경계나 전체125년 해시의 대체 증거가 아니다.
4. **기존 화면 문제.** 빈 ‘예측과 실제’ 열·일부 한글 단어 갈림·067 하단의 초기 부분 잘림은 기준판에서도 확인했다. 정상 스크롤로 선택지는 드러난다. 표시 ID·종료 화면 수정의 검증을 전체 UX·반응형·자연 장기 결과 가시성 승인으로 확대하지 않는다.

## 완료된 검증 — 소스별 범위

- 최신864f1ea: 집중121시험·타입검사·범위 ESLint·독립 검토 통과. 아래0b04/7a4 원격 증거는 해당 이전 소스에만 적용하며 최신 제품의 changed·geometry는 pending이다. 관계 브라우저는 기능 검증을 통과했고 좁은 화면의 우측 잘림을 별도 기록했다. [실행 결과·원본 driver·4개 화면](../verification/eb-tlink-relation-browser/README.md).

- 기하 `engineB-tlink-geometry-0b04cd0`:27행·540조건, 실패0·미개방0·exit0. 056의 최초 진입 시간 초과6조건은 정규1차 재시도에서 전부 통과했다. 예외 추가나 제품/driver 수정은 없었다. [전체 측정표](../verification/uiaudit1/geometry/engineB-tlink-geometry-0b04cd0/geometry.md). 빈 공간 경고96건과 준비 상태의 한계는 남는다.

- 이전0b04 `test:changed`:616파일·4755시험 중4742통과·실패0·skip13, exit0. [원본 시험 기록과 해시](../verification/eb-tlink-gates/changed-result.json). 원격 소스와 다른 후속 문서는 기하 관문의 안전 변경이다. 354474 인계 트리에서 `check:merge`가597시험을 재사용하고 저장소를 읽는19시험을 다시 요구한 것을 확인했다. 최종 기하 결과와 문서를 고정한 뒤 실행한 시험 기록이 게시 시점의 검증 근거다.

- 지정10사건은 실제 reducer와 실제 stewardship·금전 정산·목재 거래를 거친 기존13시험에 routing 경계8개를 더한21시험 통과다. 별도 history 불변3시험을 합친 당시0b04 집중 회귀는24/24, typecheck·scoped ESLint·독립 검토도 통과했다. 038 성공/실패, 209 취소/보류를 분리했다. 140:a는 현재 다섯째 감사 방식 답을 연결하고 교체된 네 답을 제외한다. 140:b는 다섯째 직접 감독 답과 현재 감사 방식인 넷째 답을 함께 연결하고 폐기된 세 답을 제외한다.
- TLINK·문구 변형 집중 시험98/98, 후속 종료 화면 관련9시험·typecheck가 통과했다. 잔여 답/typed ledger 판독기 독립 검토에서 구체적 차단 결함은 발견되지 않았다. 이는 위 최신 changed·geometry·장기 관문의 결과가 아니다.
- 표시 ID 실제 화면: `engineB-tlink-browser-admission-f527d68-93245c4`,1280×800. 041=`h-001370`,067=`h-001713`의 실제 클릭, 자기 답/변형 ID, codec 왕복, 연대기 제목 일치. 067은 칩→결정하기로 열었다. 제품은f527과 같고 당시 검증기만 수정 상태였다. [docs/verification/eb-tlink-browser/result.json](../verification/eb-tlink-browser/result.json).
- 기준판 실제 클릭 비교: `engineB-tlink-baseline-browser-scroll-cf3fa94`. 기준 연대기는041·067 변형 제목을 잃고 시제품은 보존했다. 067은34px 정상 스크롤 뒤 하단 버튼을 클릭했다. [docs/verification/eb-tlink-browser-baseline/result.json](../verification/eb-tlink-browser-baseline/result.json).
- **UIend 실제 브라우저 완료:** `engineB-tlink-slice-browser-retry-7a4c6ae`, 깨끗한7a4·1280×800. 같은 root에 묶인 실제 reducer 답 `h-000002`·`h-000004`가 둘 다 보이고, 정상 연대기 이동·두 번째 기록 클릭·저장 왕복 동일·tick20000 유지·오류0·exit0을 확인했다. 준비 종료 fixture이며 자연125년 판은 아니다. 같은 tick 처리는 화면 결과 묶음에 포함되지만 미래 직접 분자에는 불포함이다. [docs/verification/eb-tlink-slice-browser/result.json](../verification/eb-tlink-slice-browser/result.json), [이미지·실행 driver·준비 저장](../verification/eb-tlink-slice-browser/README.md).

- **140 실제 미래 링크 화면 완료:** `engineB-tlink-140-browser-admission-ce4ea9a`, 제품0b04. 답 `h-000011`(tick1004) → 실제 다음 철 청원 기록 `h-000015`(tick2000) → 원인 답 복귀를 정상 클릭으로 확인했다. 주석 전후 ordinal28 유지·저장 왕복·tick 불변·오류0·exit0. 준비 계절 경계이며 자연125년 증거가 아니다. [원본 결과·이미지·driver·첫 진입 실패](../verification/eb-tlink-140-browser/README.md).

## 이전 실패·수정·취소 이력

| 기록 | 처리와 증거 한계 |
| --- | --- |
| 초기 제품f527, 저장 핀 기록93245c4, 브라우저 진입 보완4a2125e9 | 이후 작은 답 보존 수정으로 측정 엔진fae9, 종료 화면/fixture 보완으로 구현7a4에 도달 |
| 지정 사건 기준판 RED | [11실패·1통과 기록](../verification/eb-tlink/specified10-baseline-red.txt). 046취소만 통과. 이후140시험을 더 엄격하게 수정했으므로 최종 시험과 같은 바이트의 RED라고 하지 않음 |
| `engineB-tlink-baseline-guardrail-cf3fa94` | 실험을 관문으로 잘못 등록해 직접 종료. 통과 증거에서 제외 |
| `engineB-tlink-prototype125-f527d68`, `engineB-tlink-paired-guardrail-93245c4` | 구 소스 대기 작업만 취소하고 fae9 실행으로 교체. baseline125 실행은 유지. 옛 가드레일 업로드 dirty1은 브라우저 검증기였으며 제품 소스는 같았음 |
| `engineB-tlink-changed-f527d68` | 612파일·4704시험:4678통과·13실패·13건 건너뜀. 12실패는 표준v55 fixture 누락:13개 이행 후 관련8파일33시험 통과. 나머지 sliceEnds는 작은 답 미정리:fae9 보존 수정 후 기존6시험 통과. 추가 root-only 종료 조회도 수정했으나 7a4 전체 changed는616파일·4747시험 중4734통과·실패0·skip13(exit0)이며,0b04 관문은 별도로 등록 |
| 이전eba2 기하 | 종료 화면 수정으로 최신 근거가 아니어서 직접 취소. 7a4도 후속 코어 수정으로 교체 |
| 067 자동 개방 대기 실패 | 정상 칩 진입으로 검증기를 고쳤다. 제품 자동 개방 결함으로 단정하지 않음 |
| `engineB-tlink-slice-browser-7a4c6ae` | 셸 인용 문제로 driver 이전 exit126. 통과 근거에서 제외하고 retry 실행의 exit0만 사용 |
| fae9 prototype125·pairedguardrail / 7a4 geometry | 직접 감독 누락 교정 전 대기 작업을 직접 종료(exit255)하고0b04로 교체. 장기 측정 결과는 없으며 baseline125와 이미 실행 중이던7a4 changed는 유지했고 후자는 exit0으로 종료 |
| GROW 겹침 확인 | 2026-10-10 02:47 KST `065e15640771703d7b25dcde22460bfc2dcb5ff7`, 후속 `b230119c9e3fea4c68d43f5c011afdb9585612c3`, 후속 `08dac106bda2ce1dfc0fd7ed97115f23e8fc39a0`, 최신 `a77081448e1f0e77ee54d43d333047c9cc518196`. 병합 때 재확인 |

기준판 지연은 당시 짧은 CPU 표본에서 기존 palisade 후보 검증·자동 건설 탐색이 지배했고 수집기는 진행 중이었다. 이 표본을 관측기 비용·교착 판정이나 최종 실행 결과로 사용하지 않는다.
