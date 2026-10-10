# EB-TLINK — 개별 답변의 인과 흔적 시제품 인계

## 현재 상태와 고정점

**최신 제품 소스는 23d1226이다. 사용자 수정 기준에 따른 현재 시제품 목표는 설명 미완 (c)≤10%이며, 엔진의 inert 수정 뒤 최종 목표는 실질 효과가 확인된 (a)≥80%다. 새 기준 점수는 아직 없다. 기존 미래 연결 도구의334/816=40.9313725%, pass=false는 원본 그대로 보존하는 참고 결과이며 현재 시제품 실패 판정을 대신하지 않는다.**

새 분류는 답의 실제 도메인 효과를 기준으로 한다. 청원·감사의 처리 상태 변경이나 확인 기록만으로 (a)를 인정하지 않는다.

| 범주 | 필요한 증거 |
| --- | --- |
| (a)/(가) 결과 보임 | 즉시 또는 후속의 실제 수치·권리·토지·인물·지속 명령 등 효과와 해당 답의 연결을 확인. 처리 완료 기록만으로 인정하지 않음 |
| (b)/(나) 무효과·inert | 처리 종결을 제외한 실제 효과가 모두0임을 입증한 답. `processing_only`는 실질 효과가 아니며, 전체 GameState 불변이라는 뜻도 아님 |
| (c)/(다) 설명 미완 | 효과나 조건을 충분히 판정하지 못한 나머지 답. 추정으로 다른 범주에 옮기지 않음 |
| (d)/(라) 관측 부족·명시 조건 미충족 | 관측창 미완료 또는 실행 가능한 조건이 실제로 충족되지 않았다는 보존 증거. 두 사유를 구분하고, 결과 기록 부재만으로 배정하지 않음 |

성숙 분모816은 유지한다. 조건부 답과 inert를 임의로 분모에서 빼지 않으며, 관측창 미완료20답은 분모 밖에서 별도 보존한다. 최종 (a)≥80%는 엔진의 inert 수정 후 평가할 목표이지 현재 달성한 결과가 아니다.

새 감사 matcher 이후 기존 잔여 주석은 즉시 처리 관측397·설명 미완85·관측 부족20이다. **이는 legacy residual annotation이며 새 네 범주의 점수가 아니다.** 추가 감사94건은 정확한 감사 처리 상태의 근거이지 실제 충성도 변화까지 입증한 결과가 아니므로 자동으로 (a)에 더하지 않는다.

실제 답 직전/직후 관측 실험 `engineB-tlink-immediate-3ecee4b`은 공식 실행기에 제출되어 실험 슬롯을 기다리고 있다(실행 중·완료로 세지 않음). 제품 소스23d와 실행 소스3ecee4b를 분리하고 깨끗한 격리 checkout을 사용한다. 실행 영수증 없이 RUNNING이나 완료를 주장하지 않으며, 새 점수는 관측 증거와 분류 검증 뒤 확정한다. core 특허 거절의 성숙 inert127건은 [엔진 인계](engine-B-inert.md) 대상이다. registry-v4 inert 감사는 계속 조사 중이다.

감사 때 카운터를 정리하면서 관계 증거까지 버리던 결함을 `d36d1de4c`에서 고쳤고, 23d1226에 고정했다. 원래 seed3의 명령 492개와 관측 지점 556개를 재생하여 답 `h-002840`이 기존 계절 기록 `h-002880`에 연결되는 것을 확인했다. 관계/문구 36시험·타입검사·독립 검토도 통과했다. 저장 v56 shape와 게임 규칙은 바꾸지 않았다.

최신 검증 상태는 다음과 같다.

- **완료:** 23d의 125년 수집·재생 세 판과 공식 집계, 감사 교정 경로 재생, 관계 브라우저 기능 검증(36.5초·exit0, 저장/기록 번호 불변·오류0), changed 검사(401파일 실행·218파일 재사용, 3464시험 중 3451통과·실패0·skip13), geometry(27행·540조건·실패0·미개방0).
- **별도 native 완료:** 기준64a/제품23d의 세 seed 원시 전체 최종 상태 해시가 모두 일치했다. exit0·1529.5초이며, 24필지·최대500000tick의 조기 종료 실행 범위다.
- **남은 한계:** 390px 화면의 우측 잘림. 이전 9ad의 native 세 seed 원시 전체 최종 해시 일치는 그 제품과 실행 범위에만 적용한다.

감사 교정은 실제 Michaelmas의 감사 배열 순서·ID·카운터·감독 관계·집사·전역 방문 시각이 모두 맞을 때만 pending을 유지한다. 같은 값의 임의 객체 교체는 허용하지 않는다. 현재 writer의 상태 전이로 연속성을 확인하며, 감사 이력 자체를 원인 영수증으로 쓰지 않는다. 실제 다음 철의 유일한 기존 `stewardship.season`만 답에 연결한다. 62320 감사 → 63000 결과의 검증 범위와 원본은 아래에 보존했다.

| 구분 | 고정점 / 범위 |
| --- | --- |
| 최신 구현 / 새 측정 소스 | `23d12264289538de5f6ef3ef3f36aa9257b10aba` |
| 이전 완료125년 측정 소스 | `9ad9253468592e7cba144946081d2fbced36adca` |
| 이전125년 수집·재생 소스 | `0b04cd0becc4d73059fbfcf372395c8672d1a381` — 최신 관계 구현 전 |
| 구현 전 기준 | `64a16b5a6c1d91024415039db89bb88412528e15` |
| 격리 가지 | `codex/engine-b-tlink` — 본선 미병합 |
| 기준64a→23d 변경 파일 목록 | [고정 제품 전체 변경](../verification/eb-tlink/changed-files-23d.json) |
| 이전64a→9ad 변경 파일 목록 | [docs/verification/eb-tlink/changed-files.json](../verification/eb-tlink/changed-files.json) |

0b04는 직접 감독 청원의 빠진 원인과 집사 교체의 원인 탈취를 고친 이전 측정 소스다. 864f1ea는 관계 기여를 추가했고, 9ad는 계절 부호 제한을 교정했다. 최신 23d는 감사 정리 중 증거 연속성을 교정했으므로 이전 제품의 결과를 그대로 승계하지 않는다. 변경 파일 목록은 기준64a→23d 고정 제품과 이전64a→9ad를 각각 보존한다. 23d 이후의 문서·증거 커밋은 고정 제품 목록에 포함하지 않는다. 구 fae9 측정과0b04 native 대기 작업은 실행 전에 취소했으며 통과 근거에서 제외한다.

목표는 성공한 각 답변의 소속·실제 선택 대상·공존 원인·관측 상태·표시 문구 ID를 보존하는 것이다. 기존 도구는 성숙한 무거운 답의 **정확한 자기 ID 미래 연결≥80%**를 측정한다. 이는 보존할 과거 기준이며 현재 시제품은 위 사용자 수정 기준으로 별도 평가한다. 인계에는 남은 답의 실제 증거에 따른 설명, 규칙 해시 불변, 지정10사건 회귀도 필요하다. 미래 기록만 세는 방식은 기존 도구의 집계 기준이며 사용자가 직접 지정한 시간 범위로 해석하지 않는다. 관련 원칙은 P-C3·P-D5·P-T1·A4·A5다.

이 시제품의 게임 규칙·봇 정책·정본 조건은 바꾸지 않는다. 기존 점수와 분모·미래창은 원본 보고서에서 그대로 보존하고, 새 사용자 기준은 별도 scorer로 계산한다. 원래 TRACE-LINK 자리인 GROW-BLOCK 두 단계와 작은 묶음 뒤에 엔진이 검토·통합하며, MOD-SLOT 채택 뒤135→묶음7→묶음9 순서는 유지한다. 원격 작업은 공식 실행기의 한 세션 실험1개 규칙을 따르고 같은 실행을 중복 시작하지 않는다.

## 구현 계약

- `trace.answers`는 성공한 답의 자기 이력 ID, 기존 묶음 ID, 자기 선택 대상, 실제 기억 근거를 보존한다. 무효·반복 명령이나 구 묶음 별명으로 답 멤버십을 만들지 않는다. 기존 묶음은 기록 생성 순서 보존용이며 자동으로 개별 답의 원인이 되지 않는다.
- 직접 감독이 청원을 영주에게 올렸을 때 기존 `stewardship.brought`에만 `petition_routed`를 붙인다. 방식이 실제로 바뀐 답의 `oversight_mode:<estateId>`를 쓰므로 집사 교체/감사 처벌이 원인을 가져가지 않는다. 기록과 청원의 양방향 유일 대응을 확인하고 동명 영지의 모호한 연결·같은 tick·구 broad-only 근거는 추정하지 않는다.
- 실제 결과의 `because`에는 해당 효과에 기여한 답만 남긴다. 현재 설정 소유권·교체·취소·후속 재주문을 구분하고, 원인 수가 다섯 이상이어도 실제 기여를 조용히 잘라내지 않는다. faction 기억의 기존 ID·관계와 기록 할당 순서는 유지한다. 연결률을 올리기 위한 새 결과 기록은 만들지 않는다.
- 기존 `ledger.season`은 보존된 실제 후속 현금 거래와 거래 당시 소유권을 확인한 뒤 `traceLedgerEvidence`를 보관한다. 같은 tick의 명령 비용은 후속 수입 근거가 아니다. `readDecisionLedgerEvidence(record, answerId)`는 답별·대상별 근거를 읽고 잘못된 JSON·거래·범위·because·중복을 거부한다. 기록에 agency 모드가 없으므로 양끝 포함 범위 검사는 거래 당시 소유권이나 정확한 결산 cadence의 재실행 증명이 아니다.
- `decisionTraceEstateRelations.ts`는 실제 영지 청원 답의 tenants/merchants 변화와 기대값을 optional 증거로 저장한다. 0 변화·포화·반대 방향의 후속 명령·알 수 없는 writer·감독/집사 변경·끊긴 값·모호한 기록은 미래 기여로 추정하지 않는다. 첫 다음 실제 철의 요약과 기존 `stewardship.season`이 유일하게 대응할 때만 `estate_mood`와 현재 관계/보존 기여량을 덧붙이고 증거를 consumed로 바꾼다. 새 기록·지연 확인용 영수증을 만들지 않는다. 이는 제한된 기여 보존 증명이며 모든 장기 관계·경제 효과의 반사실 검증은 아니다.
- 9ad의 계절 기여 판정은 실제 현재값과 `현재값−자기 답 actual 기여`가 모두 −100과100 사이인지를 확인한다. 실제 +4 수선 답 뒤 계절 요율−6으로 현재−2가 되어도 답이 없으면−6이므로 기여+4는 남는다. 계절 변동의 부호만으로 이를 버리지 않는다. 반대 방향 **명령**·알 수 없는 writer·clamp·끊긴 chain은 계속 거부한다. 이 증명은 계절 관계 증분이 독립적이고 마지막에 한 번 clamp되는 현재 규칙에 한정되며 규칙이 바뀌면 재검토해야 한다.
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

## 기존 도구 측정 표 — 23d 미래 연결 기준 미달, 새 분류 판정은 별도

기존 승인125년 자료의 **292/816=35.78%**는 과거 관측값이다. 새 기준판도 같은 수치를 재현했지만, 별도 실행의 원본과 소스 핀을 아래에 보존한다. 0b04 세 판의 공식 수집·재생 검증 뒤 원래 scorer로 집계한 값은204/816=25%다. seed1=52/238, seed2=70/275, seed3=82/303이며 미성숙20·성숙 미연결612·미분류2다. 세 판 모두 replayVerified이며 원래 scorer의 pass=false를 보존했다. 공식 보관은b218 커밋에 고정했고 엔진 소스0b04는 바뀌지 않았다. 후속 잔여 분석은 즉시 결과만 관측433·설명 미완179·관측 부족20으로, 미완 답을 조건부로 바꾸지 않았다.

| 실행 / 측정 | 실제 소스 | 결과 상태 |
| --- | --- | --- |
| `engineB-tlink-baseline125-cf3fa94` — seed1–3 각125년 수집+재생 | `cf3fa941659ecb78396eed3780f88024a2bde0dd`, 제품은64a와 동일 | **완료·기준 미달** — 292/816=35.7843%, 관측 부족20·미연결524, 수집/재생3판 일치·exit0 |
| `engineB-tlink-prototype125-0b04cd0` — 같은 seed·기간·도구 | `0b04cd0becc4d73059fbfcf372395c8672d1a381` | **완료·미달204/816=25%** — 세 판 수집/재생 일치·실행 exit0, 채점 pass=false. 최신 관계 제품 결과 아님 |
| `engineB-tlink-paired-guardrail-0b04cd0` — seed1–3, 최대500000틱·24필지 일반 성장 전후 | 기준64a / 측정 엔진0b04 | **실행 전 취소** — 대기 작업 종료, 해시/통과 증거 없음 |
| `engineB-tlink-changed-0b04cd0` — 이전 제품 변경 영향 시험 | 구현0b04 | **PASS** — 616파일·4755시험:4742통과·실패0·skip13, exit0 |
| `engineB-tlink-geometry-0b04cd0` — 이전 제품 화면 기하 | 구현0b04 | **PASS** — 27행·540조건, 실패0·미개방0, exit0 |
| `engineB-tlink-relation-browser-864f1ea` | `864f1ea06851f0508109f34ab355e4843bb16ff4` | 기능 PASS·exit0 — 자기 답→다음 철→원인 답, 두 화면 크기·저장 왕복·틱/ordinal 불변.390px 우측 잘림은 화면 인수 미달 |
| 이전864 relation125·native / changed·geometry·f264 cards | 864 계열 | **폐기** —125/native는 실행 전 취소, changed/geometry/cards는 구형 partial 중지. 인수 근거 없음 |
| `engineB-tlink-audit125-23d1226` | `23d12264289538de5f6ef3ef3f36aa9257b10aba`, clean | **완료·미달334/816=40.9313725%, pass=false** — seed별118/238·96/275·120/303. 세 판500000tick 수집/재생 검증·producer exit0·4698.7초. 기준판과 명령열·관측 지점/최종 규칙 투영 일치, 원시 전체 최종 해시는 세 판 모두 다름 |
| `engineB-tlink-native-latest-23d1226` | 기준64a / 제품23d | **PASS·exit0·1529.5초** — 세 seed 원시 전체 최종 해시 일치. 24필지·최대500000tick, 실제 종료tick372667/281540/299186. 표준5seed·1200000tick 관문 아님 |
| `engineB-tlink-final125-9ad9253` | `9ad9253468592e7cba144946081d2fbced36adca`, clean | **완료·미달301/816=36.8873%, pass=false** — seed별98/238·93/275·110/303, replayVerified3판·producer exit0·command4974.3초. 기준판과 명령열·관측 지점/최종 규칙 투영 일치, 원시 전체 최종 해시3판 불일치. 별도 native 결과는 아래 별도 실행 범위로 구분 |
| `engineB-tlink-final-changed-9ad9253` | 9ad 고정 제품 | **PASS·exit0** —553파일·4425시험:4412통과·실패0·skip13,66파일 재사용, command1947.2초. tree `f36378c83325d6b411f5ae7f6445135e8af19379` |
| `engineB-tlink-final-geometry-9ad9253` | 9ad 고정 제품 | **PASS·exit0** —27행·540조건·실패0·미개방0, command3293.9초.056의 초기 미개방3조건은 공식 재시도로 통과, 경고96. 기존 감사와 행·축 동일;390px 별도 화면 한계는 남음 |
| `engineB-tlink-native-latest-9ad9253` | 기준64a / 제품9ad | **PASS·exit0·command1531.2초** —24필지·최대500000tick·seed1–3 원시 전체 최종 해시 모두 일치. 실제 종료tick372667/281540/299186, target-scale-stable 조기 종료. 표준1200000tick·5seed 관문 아님 |
| `engineB-tlink-relation-browser-9ad9253` | clean9ad | **기능 PASS·exit0·33.6초**, 원본 보관 확인.390px 우측 잘림은 미해결이며 화면 전체 인수로 확대하지 않음 |

결과 인계에는 각 실행의 실제 sourceRevision·입력/출력 해시, seed별 원래 직접/성숙 분모와 관측부족, 부가 잔여 범주, 보충 phase 분모를 함께 고정해야 한다. 기준판은 seed1=71/238, seed2=114/275, seed3=107/303이며 전체836답 중816답이 관측 충분하다. 원래 scorer는80% 미달과 미분류 선포2건을 그대로 남겨 exit1이다. 보충 분류는 두 실제 BIG 기록을 확인했지만 원래 점수를 덮어쓰지 않았다. [세 판 원본·재계산·해시·측정 커밋 bundle](../verification/eb-tlink-outcomes/README.md)을 보존했다. 0b04 공식 집계는 기존 정확한 own-ID 미래창·분모를 그대로 사용한다. 기준판과 세 판의 명령열·관측 지점별 규칙 투영·최종 투영이 일치했다. 원시 전체 상태 해시는 세 판 모두 다르며 이를 해시 불변으로 부르지 않는다. 이 비교는 매 tick 또는 별도 native 가드레일 검증을 대신하지 않는다. 같은 tick 종결이나 관계 포화0을 미래 성과/조건 미충족으로 바꾸지 않는다. 이전 9ad의 공식 수치와 전후 비교는 아래에 별도로 고정한다. 별도 일반 성장 native의 전체 해시 일치는125년 답변 측정의 원시 전체 해시 불일치를 덮어쓰지 않는다.

[규칙 비교 방법](../verification/eb-tlink/parity-method.md)은 `history`, `trace.decisions`, `trace.answers`만 투영에서 제외한다. `trace.acts`, faction 기억의 실제 record/decision ID·관계, ledger 금액·모든 참조와 나머지 필드는 해시에 포함한다. 각 명령·각 철·최종 상태·명령 스트림을 대조하며 모든 tick 상태의 동등성을 증명하지 않는다. 일반 성장 가드레일의 전체 상태 해시는 별도 전후 비교다.

이전 9ad의 [공식 summary·소스/런타임/도구 핀](../verification/eb-tlink-outcomes/final-9ad-summary.json), [원래 점수](../verification/eb-tlink-outcomes/final-9ad-score.json.gz), [잔여 판독](../verification/eb-tlink-outcomes/final-9ad-residuals.json.gz), [전후 투영 비교](../verification/eb-tlink-outcomes/final-9ad-parity.json.gz)를 보존했다.836답·성숙816·직접301·미연결515·관측 부족20·미분류2이며, 잔여535건은 즉시 결과만 관측336·설명 미완179·관측 부족20·조건 미충족 관측0이다. 보충 phase 분류는 미연결2건을 더해301/818이지만 원래 점수301/816을 바꾸지 않는다. 세 판 수집/재생과 기준판 대비 명령열·관측 지점/최종 규칙 투영은 일치했고 원시 전체 최종 해시는 모두 달랐다. source-compatible strict audit는 세 판 모두 불일치로 남아 strict 직접0/816이며, 원래 own-ID 점수를 실제 대상·조건·렌더링의 완전한 증명으로 확대하지 않는다. 이전 [수집 snapshot](../verification/eb-tlink-outcomes/collection-9ad9253/archive.json)의 잠정301/816은 당시 기록으로 보존하며 이번 공식 결과와 수치가 같다는 것만 확인한다.

잠정 미연결 영지 청원336건의 관계 증거는 답 당시 변화0인213·부분 포화4·경계값 도달3·정상 변화 후 무효화116이다.213건 중 수선/감면 허가86건에는 즉시 현금 비용이 따로 있으므로 답 전체 무효로 세지 않는다.116건에서 다음 철 전 같은 대상·차원의 반대 답은0건이어서 부호 제한 완화의 회복 사례는 입증되지 않았다. 최초 무효화 시점은 저장되지 않아 seed3 `h-002840`(62011tick)을 원래 명령열로63000tick 이내까지 재생하는 `engineB-tlink-invalidation-probe-9ad9253`을 공식 실험 줄에 제출했다. 첫 probe는 자체 미추적 runtime script를 사전 검사에서 거부하여2.4초에 실패했고 시뮬레이션 결과는 없다. 제품9ad를 바꾸지 않고 정확한 자기 script 경로만 허용한 `engineB-tlink-invalidation-retry-9ad9253`은120.3초·exit0으로 완료했다. 원래 명령483개와 관측 지점546개의 접두부가 일치했다. `h-002840`은62320tick의 Michaelmas 감사에서 pending→invalidated가 됐다. 상인 관계−40·소작인 관계74·집사·감독 방식은 그대로였으나 kept45/errors93을0으로 정리하며 감독 객체를 새로 만든 것이 원인이다. [실행 원본·실패 영수증·helper·해시](../verification/eb-tlink-audit-invalidation/README.md)를 보존했다. 이 실행은 최초 무효화에서 끝났으므로 추가 연결이나 점수 개선을 증명하지 않는다. 감사 전이만 인정하는 좁은 교정은 새 소스23d1226에서 다음 실제 철의 기존 기록 연결까지 별도로 확인했다. [수집 진단 원본·해시](../verification/eb-tlink-outcomes/collection-9ad9253/archive.json)는 공식 재생 완료와 별도다.

별도 [native 실행·재현 안내](../verification/eb-tlink-native/README.md)와 [manifest·원본 해시](../verification/eb-tlink-native/manifest.json)는 기준64a/제품9ad의24필지 일반 성장 비교다. 세 seed 모두 원시 전체 최종 상태 SHA가 같고 실행 exit0이다. 실제 종료tick은372667·281540·299186으로 target-scale-stable 조기 종료를 보존했다. 최대500000tick 설정이며 표준5seed·1200000tick 관문이나 모든 tick 동등성을 뜻하지 않는다. compact 보관26파일449684bytes이며125년 답변 수집/재생과는 다른 실행 경로다.

## 저장과 GROW-BLOCK 병합 겹침

후속 재확인: fetch한 본선은 `588d28d115498db4c1c0948a74bfbfcf09a7531f`이며 GROW 첫 단계가 게시됐다. `065e15640771703d7b25dcde22460bfc2dcb5ff7`의 `docs/ROADMAP.html`에는 이 격리 가지의 엔진 검토가 명시돼 있다. MOD-SLOT 채택은 발견되지 않았다. 아래 krill-grow 관측 이력과 충돌 파일 목록은 보존하며 병합 시 다시 검사한다.

시제품 저장은 **잠정v56**이다. v54→v55의 own-answer 도입에 이어 `src/save/migrations/v55ToV56.ts`는 버전만 올리고 구 답의 관계 증거를 역으로 만들지 않는다. optional `estateRelationEvidence`의 shape·값·상태를 검증하며 pending/consumed 준비 상태까지 `src/save/schemaFingerprint.v56.json`에 포함했다. [표준13개와 관계 준비 저장2개](../../fixtures/saves/v56/README.md), [표준13개 fixture manifest](../../fixtures/saves/v56/manifest.json)를 보존했다. 표준13개는 공식 `buildSaveFixtures.ts --from-version 55`로 이행하여 전체 decoded state·재인코딩을 확인했다. 관계2개는 실제 reducer/계절 경로를 거친 준비 fixture이며 자연125년 증거가 아니다. 기존v55 fixture는 보존했다. 9ad의 관계 판정 교정과 최신 23d의 감사 연속성 교정에는 v56 schema·migration·fingerprint·fixture 변경이 없다.

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

1. **영지 mood의 제한된 교정.** 이전 9ad의 공식 점수는 36.8873%로 미달이다. 9ad native와 무효화 probe는 완료했고, 최신 23d는 교정한 단일 경로를 확인했다. 23d의 공식 125년 점수도 334/816으로 미달했다. 기존 `decisionTrace.ts`의 전역 길이 기반 요약 탐색이 같은 길이의 새 요약을 놓치는 경로와 별개로864f1ea는 객체 정체성으로 실제 새 요약을 찾고 기존 계절 기록에만 연결한다. 답 당시 실제 관계 변화와 첫 다음 철까지 끊기지 않은 기여만 허용한다. 같은 estate의 모든 답·clamp0·알 수 없는 변화는 연결하지 않는다. 864의 부호 제한은9ad에서 실제값과 자기 기여를 뺀 값의 strict interior 검사로 교정했다. 집중 회귀 통과는 자연125년 적용률·전체 규칙 해시·실제 화면 인수를 대신하지 않는다.
2. **무효과 heavy 답의 경계 사례.** 준비 seed17에서 상인 관계를−100으로 설정한 뒤 실제 계절 함수가 만든 charter_request를 두 번 거절했다. tick2000 `h-000016`·tick6000 `h-000020`은 rights heavy지만 관계−100→−100, 규칙·경제 변화0이었다. 청원 처리 상태를 맞춘 대조군과 다음 한 철 stewardship 전이도 차이0·해당 답 미래 링크0이었다. 모든 heavy 답에 후속 효과가 있다는 가정의 반례지만 자연125년 빈도·모든 미래·80% 미달을 미리 증명하지 않으며 분모 축소 근거도 아니다. 측정 엔진0b04에서 다시 실행한 [도구·결과·출처](../verification/eb-tlink-boundary/README.md)를 보존했다. 제품 diff는 없었고 인계 문서2개만 수정 중이었다.
3. **history 제외 투영의 한계.** 일부 게임 코드가 history를 읽는다. 추가 회귀는083·140·061 답 뒤 표시 ID·즉시 연결을 제거한 상태와 원래 상태를 각각4tick 전진시켜 규칙 투영과 ordinal 일치를 확인했다. faction.relation의 because는 게임 입력이므로 제거하지 않았다. 이12tick은 모든 계절 경계나 전체125년 해시의 대체 증거가 아니다.
4. **기존 화면 문제.** 빈 ‘예측과 실제’ 열·일부 한글 단어 갈림·067 하단의 초기 부분 잘림은 기준판에서도 확인했다. 정상 스크롤로 선택지는 드러난다. 표시 ID·종료 화면 수정의 검증을 전체 UX·반응형·자연 장기 결과 가시성 승인으로 확대하지 않는다.

## 완료된 검증 — 소스별 범위

- 이전9ad: 관계 회귀20시험·타입검사·범위 ESLint·독립 검토 통과. 864f1ea의 집중121시험은 이전 소스 검증이다. 아래0b04/7a4 원격 증거는 해당 이전 소스에만 적용한다. 9ad changed·geometry는 각각 exit0으로 완료했다. changed는553파일 실행·66파일 재사용, geometry는27행·540조건을 통과했다.

- 최신 23d: 감사 교정 경로 재생과 changed 검사를 완료했다. 관계 브라우저는 기능 검증을 통과했고, 390px 화면의 우측 잘림을 별도 기록했다. 23d geometry는 27행·540조건·실패0·미개방0으로 완료했다. 125년 세 판의 공식 점수는 334/816으로 미달했고, 별도23d native는 세 seed 원시 전체 최종 해시 일치로 완료했다. [실행 결과·원본 driver·4개 화면](../verification/eb-tlink-relation-browser/README.md).

- 기하 `engineB-tlink-geometry-0b04cd0`:27행·540조건, 실패0·미개방0·exit0. 056의 최초 진입 시간 초과6조건은 정규1차 재시도에서 전부 통과했다. 예외 추가나 제품/driver 수정은 없었다. [전체 측정표](../verification/uiaudit1/geometry/engineB-tlink-geometry-0b04cd0/geometry.md). 빈 공간 경고96건과 준비 상태의 한계는 남는다.

- 이전0b04 `test:changed`:616파일·4755시험 중4742통과·실패0·skip13, exit0. [원본 시험 기록과 해시](../verification/eb-tlink-gates/changed-result.json). 원격 소스와 다른 후속 문서는 기하 관문의 안전 변경이다. 354474 인계 트리에서 `check:merge`가597시험을 재사용하고 저장소를 읽는19시험을 다시 요구한 것을 확인했다. 이는 당시0b04 게시 검증 기록이다. 후속23d 검증은 이 문서의 소스별 결과를 따르며, 후속 문서 변경의 적용 범위는 최종 check:merge에서 재확인한다.

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
| 864 relation125/native·changed/geometry·f264 cards | 9ad 계절 기여 교정으로125/native는 시작 전 취소, changed/geometry/cards는 obsolete partial 중지. 완료/인수 증거로 사용하지 않음 |
| GROW 겹침 확인 | 2026-10-10 02:47 KST `065e15640771703d7b25dcde22460bfc2dcb5ff7`, 후속 `b230119c9e3fea4c68d43f5c011afdb9585612c3`, 후속 `08dac106bda2ce1dfc0fd7ed97115f23e8fc39a0`, 최신 `a77081448e1f0e77ee54d43d333047c9cc518196`. 병합 때 재확인 |

기준판 지연은 당시 짧은 CPU 표본에서 기존 palisade 후보 검증·자동 건설 탐색이 지배했고 수집기는 진행 중이었다. 이 표본을 관측기 비용·교착 판정이나 최종 실행 결과로 사용하지 않는다.

### 지정 사건 시험의 검증 범위

지정10사건의 실제 reducer/domain 시험은083:a,061:b,077:a,130:a,038:enforce,140:a/b,092:b,211:a,046:cancel,209:c/d를 직접 답한다.10사건 기대표의27선택 중12선택이며 전 선택 검증으로 확대하지 않는다.140은 덮어쓴 앞선 설정을 배제하고 다섯 번째 답 및 현재 감사/감독 두 원인을 확인한다. 준비 occurrence를 사용하므로 자연 추첨이나125년 발생 증거는 아니다. 표시 변형은 별도 presentation 시험과 실제 브라우저 증거로 검증하며 지정10사건 각각의 변형 화면 시험은 아니다.

### 감사 교정23d1226의 실제 경로

`engineB-tlink-audit-repair-23d1226`은263.5초·exit0이다. [원본·helper·해시](../verification/eb-tlink-audit-repair/README.md)는 source1449개 핀과 이전9ad 핀을 모두 보존한다. 허용된 제품 변경은 `decisionTraceEstateRelations.ts` 하나뿐이며 원래492명령 접두부 SHA와556개 규칙 관측 지점이 일치했다. seed3의h-002840(62011)은62320 감사 뒤 pending,63000의 기존h-002880(`stewardship.season`)에서 consumed가 됐다. 결과의 `because.decisionId=h-002840`, `key=estate_mood`, 상인 관계 기여−8이다. 장부상 수입885의 원인이라고 판정하지 않았고 새 결과 기록을 만들지 않았다. 이 한 경로는 전체125년 점수나 모든 무효화116건의 회복을 증명하지 않는다.

`engineB-tlink-audit125-23d1226`은 원래 수집기/채점기·seed1–3·125년으로 수집·재생을 완료했다. 공식 점수는 334/816이며 규칙 투영 비교는 통과했다. `engineB-tlink-native-latest-23d1226`은 같은 24필지·최대500000tick·세 seed의 기준64a 전후 비교를 완료했다. 세 seed 원시 전체 최종 해시가 모두 같고 exit0·1529.5초다. `engineB-tlink-audit-changed-23d1226`은 완료했으며 세부 결과는 아래에 있다. `engineB-tlink-audit-geometry-23d1226`은 3488.1초·exit0, 이전과 같은 22 selector/27행·540조건·실패0·미개방0으로 완료했다. 전체 축을 유지했으며 경고96과 초기 캡처3개를 보존했다. 390px는 이 축 밖이므로 별도 화면 잘림은 미해결이다. [공식 기하 결과](../verification/uiaudit1/geometry/engineB-tlink-audit-geometry-23d1226/geometry.json).

### 관계 포화 답의 의미 경계 — 이전 기준의 기록

**아래는 사용자 기준 수정 전의 해석이다. 새 기준은 처리 종결만으로 (가)를 인정하지 않는다. 23d의 전체 처리 경로와 다른 효과를 추가 검토한 결과, 성숙127건을 실질 무효과로 확정했으며 [현재 엔진 요청서](engine-B-inert.md)를 우선한다.**

기존9ad 잔여 자료의 특허 거절127건은 상인 관계−100→−100(의도−8·실제0)이지만 답 전체가 무효인 것은 입증되지 않았다. 실제 `open→refused`, `decidedBy=lord` 전이가 있으며 열린 청원 목록에서 빠진다(`stewardship.ts:437–439,471–499`). 답하지 않은 청원은 기한 뒤 만료 처리와 계절 요약으로 이어진다(`stewardship.ts:292–300,351–353`). 영주 처리 수를 읽는 registry와 tutorial 소비자도 있다(`registry.ts:121–134`, `tutorialModel.ts:211–215`). 따라서 분류는 **관계 포화0인 즉시 청원 종료, 미래 자기 ID 연결 미관측**이다. 전체 무효·분모 제외·조건 미충족으로 바꾸지 않는다. 더 강한 판정에는 답 직전 동일 상태의 전체 전이 비교, 기한/다음 철까지의 미응답 반사실 비교와 실제 소비자 감사를 따로 해야 한다. 일어나지 않은 만료 기록을 가짜 미래 영수증으로 만들지 않는다.

새 회귀 `engineB-tlink-audit-changed-23d1226`은1769.1초·exit0,619개 선택 파일 중401개를 실행하고218개를 재사용했다.3464시험 중3451통과·0실패·13skip이다. [원본·재사용 근거·해시](../verification/eb-tlink-gates/changed-result-23d1226.json)를 보존했다. 이 실행의 제품 소스는23d1226이며 이후 문서 수정의 게시 검사는 별도로 확인한다. GROW HEAD a77081448e1f0e77ee54d43d333047c9cc518196과 기존 미추적 세 경로도 다시 확인했다.

### 같은 철의 확인 기록과 공식 점수 구분

기존9ad 공식 점수의 `sameTickOwnLinks`를 읽기 전용으로 집계하면 관측 충분816답 중579답에 같은 tick의 자기 ID 비결정 기록이 있다. 미래 직접 연결301답과 겹치는 것은142답이며 합집합은738답이다. 미래 연결이 없는437답은 즉시 청원 종료336답과 미설명101답(감사94·감독3·감사 방식3·점유 집행1)이다. 같은 철 기록도 미래 기록도 없는 답은78개다. 이는 확인 기록의 존재를 센 참고 집계이며 기대 효과·화면 가시성·미래 지속을 입증하지 않는다. 기존 채점기의 같은 tick 제외 규칙과 공식301/816 미달 판정은 그대로다. 이 집계 때문에 분모나80% 관문을 바꾸지 않는다. 원본은 [고정 점수와 잔여 분류](../verification/eb-tlink-outcomes/README.md)의9ad 자료이며 점수 SHA는 `393150034d875b2ea1b7360a5eaf26840d43f296605918b07d388f83e97f44a0`이다.

23d의 [수집 단계 잠정 진단](../verification/eb-tlink-outcomes/collection-23d1226/README.md)은 334/816(약40.93%)이다. seed별118/238·96/275·120/303으로 이전9ad보다33답이 추가 연결됐고 잃은 연결은0이다. 세 판의 수집 명령열·관측 지점·최종 규칙 투영은 기준판과 같고 원시 전체 상태는 다르다. 전체 재생이 진행 중이던 시점의 자료로 보존한다. 이후 공식 집계도 334/816으로 같지만, 이 잠정 진단 자체를 공식 판정이나 80% 통과 증거로 바꾸지는 않는다. 이전9ad의 공식301/816 기록도 유지한다.


### 최신 23d 공식 결과와 게시 상태

[공식 summary](../verification/eb-tlink-outcomes/final-23d-summary.json), [원래 점수](../verification/eb-tlink-outcomes/final-23d-score.json.gz), [잔여 판독](../verification/eb-tlink-outcomes/final-23d-residuals.json.gz), [전후 비교](../verification/eb-tlink-outcomes/final-23d-parity.json.gz)를 보존했다. 무거운 답836개 중 성숙816개·미성숙20개이며 직접334개·성숙 미연결482개·기존 미분류2개다. 직접 답을 제외한502개는 즉시 결과만 관측303·설명 미완179·관측 부족20·조건 미충족 관측0이다. 보충 phase 분모는334/818이며 원래 점수334/816을 바꾸지 않는다. source pin 불일치가 남아 strict audit는0/816이다. 핀을 임의로 다시 맞추거나 미관측 조건을 만들어 통과시키지 않았다.

세 판 모두 기준판과 명령열·관측 지점별 규칙 투영·최종 투영이 일치했다. 원시 전체 최종 상태 해시는 세 판 모두 다르며, 모든 tick이나 별도 native의 동등성 증명으로 확대하지 않는다. 원본·재현 명령·압축 전후 해시는 [공식 보관 안내](../verification/eb-tlink-outcomes/README.md)에 있다.

이 공식 결과 보관에 앞선 원격 게시 커밋은 `d820a4b211241063b4898a0c76577facce5c6bfa`다. check:merge와 최종19파일136시험, 고정23d changed의3451통과·geometry540조건 통과를 확인한 게시 기록이다. 제품/측정 소스23d와 문서 게시 커밋을 구분한다. 별도23d native도 완료했지만 저장 v56·GROW 병합 제한과390px 잘림은 그대로 남는다.


### 최신23d native 완료 범위

[23d native 안내](../verification/eb-tlink-native-23d/README.md), [manifest](../verification/eb-tlink-native-23d/manifest.json), [원시 비교](../verification/eb-tlink-native-23d/comparison.json)를 확인했다. 기준 `64a16b5a6c1d91024415039db89bb88412528e15`와 제품 `23d12264289538de5f6ef3ef3f36aa9257b10aba`의 세 seed 전체 원시 최종 상태 SHA가 모두 같다. 실제 종료tick은372667·281540·299186이며 모두 target-scale-stable 조기 종료다. 24필지·최대500000tick 설정으로, 표준5seed·1200000tick 관문이나 모든 tick의 동등성 증명은 아니다. 보관은26파일449765bytes다. 이 일반 성장 실행과125년 답변 수집/재생은 다른 harness이므로, 후자의 원시 전체 해시 불일치 및334/816 FAIL을 덮어쓰지 않는다.


### RR22 — 새 분류 도구의 원격 검토 요청

사용자 수정 기준을 구현하는 `scripts/engineBTlinkOutcomeCategories.mjs`·의미 판독기 `scripts/engineBTlinkOutcomeEvidence.mjs`·입력 검증/실행기 `scripts/engineBTlinkOutcomeCategoriesRun.mjs`를 REMOTE 검토의 semantic gate에 어떻게 연결할지 검토해 달라. 기존 화면 selector와 기하 축은 변경하지 않는다. 이는 새 도구의 검증 매핑 요청이며, 현재 감사 문서 게시를 막는 조건으로 취급하지 않는다.

새 도구의 [입력·종료 코드·분류 경계·관측 소스 계약](../verification/eb-tlink-four-categories/README.md)을 보존한다. 실제 즉시 변화는 별도 관측기로 읽으며, 처리 기록이나 미검증 미래 기대를 무효과/성공으로 바꾸지 않는다.
