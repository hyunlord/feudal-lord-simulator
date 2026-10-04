# 화재 UI 실제 실행 독립 검수

**PARTIAL_FIRE_UI_PHASES_WITH_BURNT_SECOND_SAVE_FAILURE**. 네 단계의 사건칩·조언·대상집 상세는 실제로 열렸다. active/rebuild/completed의 단계·선택·두 번 새 저장 검증은 통과했고, burnt는 두 번째 새 저장이 입증되지 않아 실패를 유지한다. 공식 전체 종료는2/161.0초다. 자연 첫플레이 완료 판정이 아니다.

## 검토한 증거

실행 manifest289파일 SHA 검증, JPEG120개(모두 고유) 및 짝 DOM120개 파싱. 화면120개를12장 확인판으로 전부 검토하고, 네 단계의0014 조언·0021 대상 상세 및 burnt0024/0027/0028 등 핵심11장을1280×800 원본으로 다시 봤다. 썸네일만으로 본 작은 글씨를 읽었다고 주장하지 않는다. 입력4개의 원본SHA, helper12핀·source1095핀, before/after OK목록과 실제 준비 manifest경로 일치를 확인했다.

각 단계 최초 실제 저장의 stateSha256은 원본 fixture의 원시 state JSON SHA와 일치한다. 실제 fixture 설치는 정상codec/IDB manual write로 명시돼 있다. 이후 helper는 mouse입력, 실제 저장버튼, IDB read, QA camera/viewport/selection getter만 사용한다. 숨은 state/reducer/카메라 변경은 없다. 새 profile4개로 각각 로드한 독립 UI 검수이며 단계 사이를 자연시간으로 진행한 것은 아니다.

## 단계별 판정

| 단계 | 입력/실제 tick | exit | 판정과 실제 상태 |
|---|---:|---:|---|
|active-fire|9400/9400|0|PASS_BOUNDED_PHASE_UI. first_fire@9 대상000011 활성불,집8명/등급1. 두 새 저장·상태SHA 동일.|
|burnt-house|9460/9460|2|PARTIAL_SECOND_SAVE_UNCONFIRMED. burntTick9460/원인first_fire@9·공사없음·집8명/등급0. 칩·조언·대상집은 확인,stableTick 계약은 실패.|
|automatic-rebuild-site|9516/9516|0|PASS_BOUNDED_PHASE_UI_WITH_GUIDANCE_MISMATCH. rebuildOf000011 공사000020,주민0. 두 새 저장·상태SHA 동일.|
|rebuild-completed|9576/9576|0|PASS_BOUNDED_PHASE_UI_WITH_STALE_GUIDANCE. 소실표식·재건공사없음,주민0. 두 새 저장·상태SHA 동일.|

모두 실제 Continue 클릭 뒤 pause DOM=true였다. actions에는 pause-immediate 클릭이 **없으므로** 네 번 실제 일시정지 버튼을 눌렀다고 보고하지 않는다. 제목 이후116개 DOM의 pausePressed=true, 최초/최종 저장tick도 모두 입력과 같았다. burnt는 마지막 읽기가 오래된 저장이므로 이것만으로 전체 관측 구간 tick 정지를 입증하지 않는다.

## 플레이어에게 보인 정보와 다음 행동

### 불이 타는 동안

[active0014](../fire-ui-executed-r07b/active-fire/0014-event-full-advice.jpg)에서 불꽃·검은 연기와 사건카드 “불이 났습니다”, “타는 집 1채”, “우물 물로 끄는 집 1채”가 보인다. 실제 조언 클릭 뒤 “우물을 집 가까이에, 초가 사이에 빈 칸을 두면 불이 멈춥니다”가 보인다. 위치로/조언/닫기 버튼은 있지만 위치로·우물 설치·소화 행동은 이번에 시도하지 않았다. 대상 상세는 식량 부족·L2 장인가옥 필요를 우선 설명한다.

### 불탄 집에서 다음 행동을 잃는 지점

[burnt0014](../fire-ui-executed-r07b/burnt-house/0014-event-full-advice.jpg)의 조언은 **“불탄 집을 눌러 다시 짓기를 시작하세요”**다. 지도 정상 경로로 클릭한 QA 선택은 construction-site-000011로 확인됐다. 그러나 [burnt0021](../fire-ui-executed-r07b/burnt-house/0021-target-top.jpg)은 일반 오두막 “L1 소가옥 승급 대기 · 1:00 남음”, “첫 방해: 없음 · 승급 대기”, 식량 부족으로 떠날 준비를 보여준다. [burnt0024](../fire-ui-executed-r07b/burnt-house/0024-target-scroll-2.jpg)의 끝에서는 합필 비활성 안내와 “주택 철거”만 보인다.

전체 inspector DOM에도 재건/다시 짓기 문구나 버튼이 없다. 화면의 작은 영역만 보거나 재건 버튼이 화면 아래 있다고 추정한 결과가 아니다. 세 번 실제wheel로 상단·중간·하단을 관찰했다. 따라서 **이 실행에서 권한 있는 대상집을 눌러도 조언이 가리킨 다음 행동을 찾을 수 없었다**는 좁은 UI 안내 불일치를 보고한다. 다른 경로 전체의 재건 기능 부재·엔진 원인·신규 중간이상 결함 수는 확정하지 않는다. 재건/철거를 누르지 않았다.

### 자동 재건 중과 완료 후

[rebuild0014](../fire-ui-executed-r07b/automatic-rebuild-site/0014-event-full-advice.jpg)는 지도 공사와 “다시 짓는 공사장 1곳”을 보여주면서도 같은 재건 시작 조언을 유지한다. 대상 집 상세는 “비워진 집 — 식량이 모자라 떠났습니다”,승급 대기,주민0으로 표시되며 공사 진행 상세로 바뀌지 않는다. 이 클릭은 공사ID가 아니라 원래 집ID였다. 공사 자체를 따로 선택하지 않았으므로 공사 상세가 없다고 주장하지 않는다.

[completed0014](../fire-ui-executed-r07b/rebuild-completed/0014-event-full-advice.jpg)는 실제 소실표식 해제·공사없음인데도 “집을 잃은 가구가 다시 짓기를 기다립니다”, “불탄 집 1채”, “다시 짓는 공사장 0곳”, 재건 시작 조언을 유지한다. eventStory.ts:96은 record.losses.burntHouses를 읽으므로 불탄 집1은 누적 사건손실이다. 현재 소실표식 수가 아니며 숫자 오류로 세지 않는다. 다만 완료상태를 설명하지 못하고 이미 끝난 재건 시작을 지시하는 문구는 다음 행동을 혼동시킨다. 복구기간 카드의 존재 자체는 오류라고 세지 않는다.

## 가시성 및 경로

화재칩/조언은 네 단계 모두 attempt→clicked 기록과0011 카드 출현,0012 조언전→0013/0014 조언후 텍스트 차이로 개별 확인했다. exit0에 기대어 추정하지 않았다. 모든 단계에서 실제 장부→지도→미니맵→canvas 입력→QA선택000011로 이어졌다. 표적좌표는 카메라 zoom2/pan192,-2512 기반이며 클릭 후 실제 selection 확인이 있다.

Inspector 전체DOM은 클리핑된 내용까지 포함한다. 0021 상단에서 하단 철거·합필까지 보였다고 쓰면 안 된다. 실제 스크롤은 active높이1353/burnt1357/client396의0→430→860 이후 마지막화면하단, 재건/완료높이1061/client396의0→430→665로 끝까지 갔다. 식구 전체보기·합필·철거는 누르지 않았다. 사건카드가 옆에 유지되어 지도 일부를 가린 것은 실제 화면 배치이며 숨은닫기 호출로 제거한 것이 아니다.

## 두 번째 저장 실패 보존

네 단계 모두 각 persist 전 settings.open=false→실제 설정 클릭→open=true/save hit=BUTTON reachable→실제 지금저장 클릭→settings.open=false를 확인했다. 실제 설정창 열고 저장버튼 누르기까지의 성공과 저장 완료는 별개다.

burnt actual-before.savedAt과 actual-after.savedAt은 모두 `2026-10-04T00:23:44.636Z`다. [0027](../fire-ui-executed-r07b/burnt-house/0027-save-now-before.jpg)에는 지금저장 버튼, [0028](../fire-ui-executed-r07b/burnt-house/0028-save-now-after.jpg)에는 흐리게 된 저장 버튼이 보인다. 후속settings 기록도 disabled=true였으나 readback timestamp가 갱신되지 않았다. 따라서 클릭 미실행·설정 닫힘이라고 단정하지도, 저장 완료라고 승격하지도 않는다. 원인·장기 지연·게임 저장 결함 여부는 부모의 별도 조사 범위다.

다른 세 단계 새savedAt은 각각9400의04.384→12.134초,9516의24.785→32.382초,9576의04.865→12.449초로 바뀌고 저장stateSHA는 같았다(정확한UTC 값은 CHECKS.json). helper.completed=true는 코드가 끝에 도달했다는 뜻이며 burnt 실패를 지우지 않는다.

## 남은 한계

최종 IDB bytes 자체는 UI 산출물에 없고 정상codec readback의 hash·부분state 기록을 검토했다. 시각검수는 브라우저에서 실제 과거상태를 재현한4fixture에 한정된다. 자연발생부터 회복까지 플레이했거나 가구가 돌아왔음을 입증하지 않는다. HUD133/132/116/115는 인구이고 식량days0/0/42/31은 별도지표다. 인구 변화의 원인은 이번검수로 특정하지 않는다.

각 단계 cleanup-ok와 termination 기록, listener snapshot의4301/14301부재를 확인했다. 부모 공식scope 정리 보고와 구분하며 검수자가 원격 process를 새로조회하지 않았다. 원본289파일·helper/source 미수정, 소유 review 폴더의 확인판/기록만 생성했다.

## 기존 발견과 신규 심각도 권고

R01 `records/IDENTITY_AUDIT.md:32`의 첫플레이8은 이미 “불탄 집을 눌러 재건 방법 못 찾음”과 “자동 추진 중인지, 필요한 재료·승인·기간” 표시를 요구했다. 따라서 이번 소실 집의 지시→행동 부재는 **기존 서명의 실제 UI 재현**이다. 자동 재건 중·완료 후 시작 조언이 남는 현상은 같은 상태 안내 공백의 **단계별 범위 확장**으로 분류한다. 단순히 B01이라는 넓은 ID 아래 묶은 것이 아니라 R01의 구체적인 재건 상태 요구와 직접 겹친다.

`src/ui/eventStory.ts:84–96`은 불이 꺼진 뒤 recoveryUntilTick까지 aftermath 카드를 만들고, 현재 집 상태에 관계없이 고정 line/advice를 사용한다. `eventStoryCopy.ko.ts:31–36`의 기다림/재건 시작 문구가 실제 화면과 일치한다. 완료9576의 카드 존재 자체는 복구기간 계약에 맞고, 누적 손실1도 원장과 맞지만 시작 지시는 현 단계에 맞지 않는다. 네 fixture 외의 복수 화재 귀속이나 전체 재건 설계 결함을 추가 추론하지 않는다.

active의 우물 배치·초가 간격 지시는 기존 B01 영주 모드 동사 연결 공백의 확대 관측이다. burnt 두 번째 저장은 완료 확인 실패로 남기고 게임 저장 결함으로 세지 않는다. **이번 화재 UI 자료가 추가한 독립 신규 중간 이상 서명 권고는0**이며, 이는 R07 전체 신규0 선언이나 열린 첫플레이8 해결 판정이 아니다. 최종 심각도·합산은 부모가 결정한다.

완료 화면 수치의 이전 부모 전사0은 같은 `rebuild-completed/0014-event-full-advice.jpg` 재열람으로1로 정정됐다. 본 검수의 관측은 해당 파일과 tick9576 actual-before 기준이다. 원본 소스·기존 보고서 SHA는 REVIEW.json에 고정했다.
