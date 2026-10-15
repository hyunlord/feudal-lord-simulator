# EB-WEIGHT: 보존된 실제 입력의 출처와 다음 관측 창

판정: **124의 실제 미답 제안 입력 1개를 찾았다. 나머지 아래 저장은 실제 상태의 검색 출발점이며, 해당 사건 제안을 확보했다는 뜻은 아니다.** 이 문서 자체는 화면 관문 통과 증거가 아니다.

2026-10-15 로컬 보존 파일의 압축 해제·JSON 읽기·SHA256 대조와 생성 소스 읽기만 했다. DGX, 게임, 브라우저 실행과 상태 변경은 하지 않았다. 현재 제품 `0eddc146c7d57b4cae091bff62295a1fc16e1f97`에서의 무손실 codec 입장, 지원 선택, 실제 답변·결과·LS1 칩·카드는 별도 실행으로 확인한다. 예전 저장의 필드를 채우거나 제안을 복원하지 않는다.

## 공통 보존본

- 저장소 가지: `codex/engine-b-tlink`.
- 보존 경로: `docs/verification/eb-answer-effects/fixtures.tar.xz`.
- 이번에 읽은 로컬 파일: `/Users/rexxa/fls-astra-engineB-tlink/docs/verification/eb-answer-effects/fixtures.tar.xz`.
- **archive SHA256:** `03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4`.
- 같은 디렉터리 `fixture-provenance.json`은 2026-10-10에 받은 원격 파일 경로·바이트·SHA를 보존한다. 원래 생성 실행의 HEAD 전체를 이 문서가 새로 확정한 것은 아니다. 아래 생성 소스 해시는 이번에 읽은 코드의 식별자이며 원래 실행 해시를 대신하지 않는다.
- tar member의 JSON은 **raw GameState**다. save envelope로 오인하지 않는다. 현재 codec으로 입장할 때 전체 상태값의 동일성을 확인하고, 거부되면 그 이유를 보존한다.

| 대상 | archive member / 원격 원본 | seed · tick | raw 파일 SHA256 | 입력의 의미 |
| --- | --- | --- | --- | --- |
| 124 | `lord/registry-offer.json` / `/home/hyunlord/fls-lord-states/registry-offer.json` | 1 · 13000 | `0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508` | 실제 124 제안이 미답으로 존재 |
| 013·025·052 | `lmr2/audit-pending.json` / `/home/hyunlord/fls-lmr2-states/audit-pending.json` | 1 · 54320 | `2cfdff1a7f0ba416f41df4508291b533fddd8b739b81568ddcb94abcbb9fd804` | 실제 미답 감사; 해당 registry 제안은 아직 없음 |
| 019 | `lmr2/attention-overloaded.json` / `/home/hyunlord/fls-lmr2-states/attention-overloaded.json` | 1 · 54321 | `d4e0b795dc9b6c0f051d1dc41c4f5e32dee089810fe7e91e440a55d669aca05c` | 실제 직접 감독·과부하·후보; 019 제안은 없음 |
| 033·143·150 | `lmr2/contested.json` / `/home/hyunlord/fls-lmr2-states/contested.json` | 5 · 52029 | `dc66551fdfaecb234178346b8bf5b6d5a8e99ad0625d0b45a2efa18234686aa5` | 실제 영주 소송 filed·증거 미제출; 해당 제안은 없음 |

## 124: 이미 있는 실제 제안

발생 ID는 `registry:ck_evt_124:marriage.offer|kin:1:1|est-000002:13`. `offeredTick=13000`, `deadline=14000`, `status=offered`, `source=v4`, 원래 draw951/chance1000이다. 고정된 당사자는 신랑 `kin:1:1`, 신부 `est-000002`, 상대 영지 `estate-neighbour-3`다.

[생성 소스 eventArtStates.ts](../../../scripts/eventArtStates.ts)의 `play`(33행)는 정상 `newGameState`에서 시작하고, 매 tick 미답 카드를 먼저 관찰한 다음 정상 `lordBotCommands`/`gameReducer`와 `advanceTick`을 적용한다. 최초 제안을 잡는 부분은 37–45행, raw 상태를 저장하는 부분은 54–58행이다. 이 경로는 제안·당사자를 삽입하지 않는다. 과거 `2485af4` seed1–3에서 미관측이었다는 결과를 삭제하지 않고 **다른 보존 경로에서 새 입력을 찾은 것**으로 구별한다.

[answer124.mjs](answer124.mjs)는 선택 a의 정본 `propose_marriage`(현금80d+동의)를 현재 실제 enabled 상태에서만 누른다. 선택이 닫혔으면 실패를 남기며 임의 다른 선택·현금 보충으로 통과시키지 않는다. 협상 생성과 accepted/rejected/countered를 혼인 성사와 구별한다.

## 감사: 013·025·052의 다음 제한 관측

`audit-1`은 `pending`, 감사 tick54320·기한55320·드러난 횡령356·오류0이며 현직 `est-000006`에 속한다. 현직은 greedy, 충성45, 능력47, 연결 bishop이다. 실제 대체 후보 `est-000004`(merchant, 능력31·충성88), `est-000005`(peasant, 능력89·충성74)가 있다. 현재 위임·방문 감사이며 아직 세 사건의 registry offer는 없다.

[lmr2States.ts](../../../scripts/lmr2States.ts)의 `marriageStates`(53행)는 정상 혼인 경로에서 상속까지 진행한다. `stewardshipStates`(68행)는 실제 greedy 후보를 정상 `set_estate_oversight`로 임명하고 `set_audit_mode(visit)`를 적용한 후, 첫 Michaelmas 미답 감사에서 저장한다(71–82행). 이는 **정상 명령으로 선택한 플레이어 방침 경로**이며 기본 봇 표본과 동일한 경로가 아니다. 인물이나 감사값을 꾸민 경로로 취급하지도, 기본 봇 경로로 합산하지도 않는다.

[acquireAudit.mjs](acquireAudit.mjs)는 원본 SHA와 감사 정체성을 검증하고, 플레이어가 답을 보류한 채 정상 `advanceTick`만 최대55000까지 680tick 진행하도록 되어 있다. 봇으로 감사를 먼저 답하지 않는다. 새 제안을 저장하되 확률·빈도·경쟁으로 제안이 없으면 `bounded_search_no_target`을 남긴다. 한 대상이 나와 멈췄다는 사실을 세 대상 확보로 세지 않는다. 현재 실행 결과는 이 문서에 포함하지 않는다.

## 019와 소송 사건: 후보 입력만 확보

- **019**: 같은 정상 감사 경로에서 `set_estate_oversight(direct)` 후 한 tick을 진행해 과부하를 관찰한 저장이다(`lmr2States.ts` 83–86행). 당시 부하2/용량1, 실제 peasant/merchant 대체 후보 둘, 감독 since54320이다. 다음 철55000까지의 정상 관측이 검색 방향이지만, 정본 전체 조건·선택지·경쟁 통과와 실제 제안은 아직 확인하지 않았다.
- **033·143·150**: `marriagePath`의 `willAnswer=let_it_be` 경로에서 실제 혼인 청구 `claim-2`로 `suit-1`을 제소했다. seed5@52029, `stage=filed`, `stageSince=52028`, 영주 원고·상대 `person:est-000004`, `claim-2.evidence=[]`다. `lmr2States.ts` 61–62행이 이 상태를 답하기 전에 보존한다. 다음 철까지 증거를 제출하지 않는 정상 관측이 검색 출발점이다. 해당 저장의 현재 선택별 자금 조건, 소송 단계 지속, 확률·경쟁은 미검증이며 소송을 뒤로 돌리지 않는다.

## 사용하지 않는 입력과 음성 검색 결과

**합성 019 제외:** `variants/registry-078.json`(seed3@40000, raw SHA `07c037636132cd9f763946b859187d21c54b1227cfab67ee0aa2cd5bb6d5a977`)에 019 미답 occurrence가 있으나 binding에 `variant-steward`, `variant-able`, `variant-loyal`이 들어 있다. 실제 자연 입력으로 채택하지 않는다. 078도 이56사건 범위 밖이다.

**011의 역제안 창 부족:** 아래 원본은 실제 countered지만 다음 철의 registry 평가 때 남은 기한이 정본의80tick보다 짧다. 현재 counter 상태의 존재만으로011 입력이라고 부르지 않는다.

| 보존 상태 | 저장 tick | 역제안 기한 | 다음 철 | 남는 tick |
| --- | ---: | ---: | ---: | ---: |
| archive `lmr2/offer-countered.json`, seed1, SHA `5d93c8d75c29f945bdaf424cb4f670c71a56f1b3dd9c34b154a66e6479477298` | 3 | 1002 | 1000 | 2 |
| 원래 kept seed3 `ck_evt_042-answer-h-001136.save.json.gz` | 29017 | 30017 | 30000 | 17 |
| 원래 kept seed2 `ck_evt_201-answer-h-003145.save.json.gz` | 40015 | 41015 | 41000 | 15 |

이는 이 세 저장에서 **그대로 다음 철로 가는 경로**의 제한이다. 다른 정상 제안 시점에서011이 영구 불가능하다는 뜻이 아니다. 기한을 고치거나 봇의 과거 답변을 취소하지 않는다.

**검색 범위:** Engine B의 weight, weight-screen, tlink, inert, v56 로컬 worktree에서 `.remote-runs`와 `docs/verification`의 `*.save.json.gz`, `*state.json.gz`, `*states.json.gz`를 읽었다. 중복 압축 SHA를 제거한156개 상태에서 미관측30사건의 유효 미답 offer를 찾지 못했다. `/Users/rexxa/fls-evidence`의 `states/*.json.gz`404개 상태에서도 찾지 못했다. 별도 archive의 raw 상태41개에서는124 하나를 실제 입력으로 찾고 위 합성019는 제외했다. 이 수들은 검색 묶음별 수이며 서로 겹치지 않는 전체 판 수로 합산하지 않는다. 다른 파일 형식·미수신 원격 저장 전체를 망라한 부재 증명도 아니다.

따라서 이 조사로 새로 바뀌는 입력 확보는124뿐이다. 감사·과부하·소송 출발점은 후보이며, 다른 미관측 사건의 `NO_AUTHENTIC_OFFER_INPUT`은 실제 제안을 얻기 전까지 유지한다. 이미 예정된 여섯 acquisition 실행의 결과를 이 정적 조사에 섞지 않는다.

## 이번에 읽은 생성 소스의 SHA256

| 파일 | SHA256 |
| --- | --- |
| `scripts/eventArtStates.ts` | `d7e0c70e5c95e6907a64a88a513887cd19d082a021017761ba906de55e57d5a9` |
| `scripts/lmr2States.ts` | `3acc4de6d49e7ba5f8562dc4a2734c17d74d5f142c47677a8462f611cdf901dd` |
| `scripts/marriagePath.ts` | `43e27a4168b9a3200bc53e7511193b062909be45645bbfd62a0fb9efc7c1e94e` |

위 값은 원본 생성 실행의 HEAD를 역산한 것이 아니라 이번 생성 경로 검토 대상을 고정한 값이다.

후속 제한 관측 도구: `acquire-candidate.sh attention`은54321→55000의019, `acquire-candidate.sh contested`는52029→53000의033·143·150를 대상으로 각각 한 공식 실험만 실행한다. `acquireCandidate.mjs`는 원본 식별값과 무손실 codec 입장을 확인한 뒤 정상 tick만 진행한다. 현재는 구문 검사만 완료했으며 기존 실행 줄이 끝나기 전에 병렬 제출하지 않는다. 실제 제안이 생기지 않으면 한 철의 제한 검색 실패로 보존한다.
