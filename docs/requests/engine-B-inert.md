# EB-INERT — 포화된 core 특허 거절의 실질 효과 인계

최신 사용자 기준은 **실제 효과가 모두 0인 선택을 inert로 분류하고, 처리 상태만 바뀐 것을 실질 효과로 세지 않는 것**이다. 이 기준으로 공식 23d 자료에서 core `charter_request` 거절 **성숙127건과 관측창 미완료6건**을 확인했다. 이는 registry-v4 사건이 아니며 임의의 `ck_evt_*` ID를 붙이지 않는다. core 청원 생성·선택 효과의 수정은 엔진 소유다. registry-v4의 별도 inert 감사는 아직 조사 중이다.

## 실제 실행과 대상

- 실행: `engineB-tlink-audit125-23d1226`, seed1–3 각각125년·500000tick, 원본 manifest의 valid/replayVerified 확인.
- 소스: `23d12264289538de5f6ef3ef3f36aa9257b10aba`.
- 명령: `answer_estate_petition`, `grant:false`. 사건은 core `charter_request`, 결과 상태는 `refused`다.
- 판정 입력: 답 당시 관계 증거와 처리 전후 청원 payload, 고정된 처리 함수. 전체 상태의 모든 필드에 대한 답 직전/직후 snapshot은 보존되지 않았다.

| seed | 성숙 inert | 관측창 미완료 | 대표 답 ID | 명령 ordinal | 답 tick | 청원 ID / amount |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| 1 | 17 | 2 | `h-014460` | 1774 | 219025 | `estate-petition-309` /56 |
| 2 | 61 | 0 | `h-005045` | 600 | 66067 | `estate-petition-62` /70 |
| 3 | 49 | 4 | `h-004304` | 530 | 91027 | `estate-petition-100` /95 |
| 합계 | **127** | **6** | | | | |

세 대표 사례의 영지는 `estate-neighbour-3`다. 실제 답 당시 상인 관계는 모두 **−100→−100**, 의도 변화−8·실제 변화0이다. 청원의 `rights:true`와 `escalated: rights`는 답 이전부터 있던 분류/상신 정보이며 새 권리 부여가 아니다. 실제 권리 변경 때문에 제외한 사례는0건으로, 이 이유로127건이 줄지 않는다. 사용자 제시 seed17 사례는 이 seed1–3 측정에 포함되지 않으며 독립 실측 사례로 소개하지 않는다.

## 0 효과의 증거와 처리 상태의 구분

고정 소스 [stewardship.ts:175](../../src/engine/stewardship.ts#L175)의 `petitionEffect`에서 특허 거절은 income0·tenants0·merchants−8·neglect false·kept0이다. [answerEstatePetition:471](../../src/engine/stewardship.ts#L471)의 off-map 거절 분기는 이 효과를 적용한다. income0이므로 현금 posting이 없고 neglect 실행도 없으며, 권리·토지·인물·지속 명령을 쓰는 경로가 없다. 따라서 상인 관계의 실제0은 보존된 답 당시 증거로, 나머지 실질 효과0은 이 고정 처리 분기의 소스 검토로 입증한다. 소스 핀8개에는 reducer·history·factions·trace·즉시 기록 연결도 포함해 2차 변경 경로를 함께 검토했다. 영수증이 없다는 사실만으로0을 추정하거나 모든 필드의 snapshot 차이를 측정했다고 말하지 않는다.

모든133건에서 청원 payload는 `status: open→refused`, `decidedBy: 없음→lord` 외에는 같았다. 대표 청원은 각각 생성tick219000/66000/91000, deadline220000/67000/92000이며 amount56/70/95와 기존 rights:true가 그대로다. 이 amount는 거절 비용으로 지출되지 않았다.

처리 상태·history/trace 기록·처리 수를 읽는 registry 입력은 변한다. 청원은 [열린 목록](../../src/engine/stewardship.ts#L437)에서 빠지고 이후 [미응답 만료](../../src/engine/stewardship.ts#L293)의 대상이 아니게 된다. 그러므로 **전체 GameState가 동일한 no-op이라는 뜻은 아니다.** 다만 사용자의 이번 기준에서는 이러한 처리 종결만으로 실질 효과가 생겼다고 재분류하지 않는다. 미응답 때 생겼을 미래 효과를 피했다는 반사실 주장은 별도 비교가 필요하며, 여기서 관측한 후속 영수증으로 만들지 않는다.

133건의 기존 도구 미래창 내 정확한 자기 ID 후속 영수증은0건이다. 관측창 미완료6건은 미래 부재의 완결 판정으로 확대하지 않는다. 이 인계는 기존 공식334/816 점수·분모를 수정하지 않는다. 이전 진단의 관계 변화0인 수선/감면 허가86건은 실제 현금 비용이 있으므로 이 inert 집합에 포함하지 않는다.

## 엔진에 요청하는 변경

포화 상태에서 허용된 실질 효과가 모두0인 특허 거절을 반복해서 무거운 영주 결정으로 제시하지 않도록 core 생성/선택 처리를 검토해 달라. 계속 영주 결정을 요구한다면 정본에 근거한 실제 거절 효과와 플레이어가 확인할 결과가 있어야 한다. 처리 완료 표시를 추가하거나 가짜 미래 기록을 만들어 의미 있는 선택으로 계산하는 변경은 사용자 의도에 맞지 않는다.

구체적인 규칙 변경은 엔진이 결정·구현한다. 이번 작업은 근거 인계이며 core 효과·저장·채점기를 수정하지 않았다. registry-v4는 우리 책임 범위로 계속 조사하되, 이 문서를 registry 전체 inert 감사 완료로 사용하지 않는다.

## 원본과 재현

[보관 디렉터리](../verification/eb-tlink-inert/)에 정확한 진단 script/JSON/MD와 압축 전후 해시를 보존했다. [공식125년 자료](../verification/eb-tlink-outcomes/final-23d-summary.json)와 각 seed manifest/raw/context/final-state 입력 핀은 진단 JSON에 연결돼 있다.

| 원본 | SHA256 |
| --- | --- |
| `.omo/evidence/tlink-inert-23d-charter.py` | `24421a53c5122847ec51ff7b0b87526329e50a18464e8cc4c5f3c8e980f131e3` |
| `.omo/evidence/tlink-inert-23d-charter.json` | `9692d538c0d8dbe6d98408287bf695affdefb314421438eca42f4c792575f1b6` |
| `.omo/evidence/tlink-inert-23d-charter.md` | `ef36284b042230eda71adcd9368279f7b312831a2dacc529687ab5ccefbe9f4c` |

소스·입력 핀이 맞는 별도 checkout에 원래 상대 경로를 복원한 뒤 `python3 .omo/evidence/tlink-inert-23d-charter.py`로 오프라인 재현한다. 기존 보존 출력을 덮어쓰지 않는 작업 위치를 사용한다. 전체133행의 답 ID·ordinal·tick·처리 전후 청원·관계 증거는 JSON에 있으며, 이 문서의 세 행은 대표 사례다. 이번 인계 작성에서 새 시뮬레이션은 실행하지 않았다.
