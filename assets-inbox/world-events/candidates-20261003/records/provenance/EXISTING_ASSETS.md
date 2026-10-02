# 기존 월드 사건 그림 조사

조사일: 2026-10-03. 읽기 전용 `/Users/rexxa/fls-astra-worldevents`의 `public/assets`, `assets-inbox` PNG·제작 CSV·렌더 매니페스트를 대조했다. 관련 세계 그림 **99개**의 실제 PNG 헤더·크기·SHA256은 `existing-assets.json`에 기록했다. 대표 19개를 `references/EXISTING-WORLD-ART.jpg`로 만들어 육안 검수했다. 아래 ‘없음’은 이 검색 범위에서 발견하지 못했다는 뜻이다. 카드를 도시 그림으로 세지 않았다.

`public/assets`는 배포 자산 위치이며 해당 사건의 현재 실행 연결을 자동 보증하지 않는다. `assets-inbox`는 설치되지 않은 후보다. 엔진 연결은 별도 사건 목록의 소스 근거와 결합한다.

## 재사용 / 부족분

| 연출 | 확인된 재사용 그림 | 상태·형식 | 부족한 부분 / 새 제작 범위 |
|---|---|---|---|
| 혼인 행렬 | 일반 여성·남성 워커, `public/assets/runtime-actors-v1/cart_hand-v4.png` | 기존 4방향 인물/수레; 혼인 전용 아님 | 신부·동행 가족·악사, 혼례 짐수레의 독립 무리. wave40 혼인 삽화는 월드 그림이 아님 |
| 장례 | `public/assets/wave9/walker/wk_funeral_bearers-v1.png`, `wave9/prop/bier_shroud_ne-v1.png`, `bier_shroud_nw-v1.png`, `public/assets/walkers-v2/wk_priest_m_01-v1.png`, `wave9/decal/fresh_graves_a-v1.png` 및 b | 운구자296×148, 74×74×4방향×2걸음. 운구대64×32; 성직자 시트 | 새 운구자·운구대 중복 제작 불필요. 조종은 기존 교회의 소리·애니메이션 연동 설계 대상. 겨울 장례복 전용은 없음 |
| 세례 | 성직자·여성 일반 워커 | 기존 일반인 | 아기를 안은 부모·대부모와 축복 무리. 인물상태 아이콘은 대체 불가 |
| 장날 | `public/assets/buildings/historical-facilities-v1/market_active-v2.png`, `market_quiet-v2.png`; `public/assets/zones/animals/cattle_pair-v1.png`, `sheep_flock-v1.png` 및 b/c/d; 일반 장보기 워커 | 좌판3개 전체그림·가축 세계 PNG | 기존 좌판/가축 재사용. 시장 손님 무리 필요 시 독립 군중만. 계절 옷 구분은 일반 겨울 망토 규칙 적용 |
| 정기시 fair | 일반 시장 좌판·가축; `public/assets/wave14/ui-icons/icon_right_fair-v1.png`는 UI만 | 세계용 정기시 천막·곡예사 없음 | 큰 정기시 천막, 곡예·구경 무리 |
| 기근 구휼·빈 시장 | `public/assets/wave9/signifier/hungry_queue-v1.png`, `public/assets/wave7/signifier/empty_stall-v1.png`, `wave9/pile/empty_granary_floor-v1.png`, `public/assets/wave27/yards/yard_hungry_a.png` 및 b | 줄128×64, 빈 좌판 세계 PNG | 줄·빈 좌판 재생성 불필요. 배급자가 솥/빵을 나누는 독립 구휼 거점이 부족. 겨울 줄 전용 없음 |
| 흑사병 | `public/assets/wave9/event/plague_shut_l1-v1.png`~l3; 위 장례·새 무덤 | 기존 집 창판자 오버레이, 원본 집과 같은 캔버스 | 덮인 시신 수레, 독립 거리 화로. 문표식은 기존 명시적 폐기 이력 있음(아래). 새 벽부착 조각 만들지 않음 |
| 화재 | `public/assets/wave9/event/fire_roof_l0-v1.png`~l4, `burnt_l0-v1.png`~l4; `wave9/fx/black_smoke_column_sheet-v1.png`; `public/assets/wave7/work/work_waterbucket_ne-v1.png` 및 se/sw/nw | 지붕불은 **단일 정지 그림**. 연기96×192×4프레임. 탄 집은 전체집 그림 | 물동이 줄 무리, 땅에 선 소규모 불길의 실제 프레임 필요. 기존 지붕불·탄 집·연기는 재사용 |
| 홍수 | `public/assets/wave9/field/ridge_flooded-v1.png`, `wave9/decal/puddle_a-v1.png` 및 b | 잠긴 경작지512×64 반복 strip·물웅덩이 | 모래주머니·방재 작업 무리 |
| 징집·원정 출발 | `assets-inbox/wave17/candidates-20260926/assets/wk/wk_levy_archer-v1.png`, `wk_levy_billman-v1.png`; 같은 폴더 `prop/held_longbow_{ne,se,sw,nw}-v1.png`, `held_bill_*`; `bld/muster_field-v1.png`, `herd/wool_sack_convoy-v1.png` | **inbox 후보**. 두 인물시트296×148, 8셀. 옷만 바꾼 맨손 워커이므로 무기를 별도 기존 소품과 함께 배치해야 궁수로 읽힘 | 징집 옷·장궁·훈련장 중복 제작 불필요. 원정 짐마차는 울자루 행렬과 의미가 다르므로 전용 적재 무리 필요 가능 |
| 1381 반란 | 일반 주민 및 위 wave17 `prop/held_torch_*` | 주민·횃불만 기존. `assets-inbox/wave21/.../ch4_event_rebellion_1381.png`는 카드 삽화 | 몽둥이·횃불을 든 독립 군중 필요. 군사 외양/잔혹 묘사 금지 |
| 순례 | `assets-inbox/wave12/rework-20260926/assets/active/pilgrim_shrine-active-v1.png` | 후보: 무릎꿇은 한 사람+초. `public/assets/wave23/person_state/pilgrim_48.png`/96은 인물상태 UI | 행렬 전용 지팡이·여행망토·순례 배낭 무리 부족 |
| 국왕 사신 | `public/assets/wave9/walker/wk_royal_messenger-v1.png`, `wave9/prop/scroll_royal_ne-v1.png` 및 nw; wave17 inbox `wk_royal_purveyor-v1.png` | 왕실 사신296×148 8셀; 두루마리 별도. 징발관은 다른 역할 | 사신 본인·두루마리 재제작 불필요. 호위/영접 무리와 출입구 배치로 구분 |
| 판결 집행 | `public/assets/wave9/event/crowd_manor_gate-v1.png`, `wave9/walker/wk_petitioner_m-v1.png`/f, 일반 서기·성직자 | 군중192×128, pivot96,64. 청원자8셀 | 기존 군중을 법정앞 배치 가능. 판결을 읽는 집행관·문서 탁자는 별도 독립 무리 필요. 처형 장면으로 해석하지 않음 |

## 폐기 자산·시대 주의

`assets-inbox/wave9/rework-20260926/records/README.md`는 다음을 명시한다.

- `event/plague_door_mark-v1`: **폐기**, 대체 그림 없음.
- `prop/coffin_ne-v1`, `coffin_nw-v1`: **폐기**. 열린 나무 운구대와 흰 수의 `bier_shroud_ne/nw-v1`로 교체.
- 현재 `plague_shut_l1~l3`는 문이 아닌 창에 판자를 댄 것으로 문 영역 알파가0이다.
- `src/render/buildingOverlays.ts`에도 “No door marks (historical accuracy)”가 남아 있다. 최신 사용자의 문표식 요구를 숨기지 말고, 새 표지 선택과 역사적 예외를 최종 EVENTS 문서에서 명시해야 한다. 과거 폐기 그림을 슬쩍 복원하지 않는다.

## 워커·계절 계약

정규 신규 시트는296×148, 74×74셀, 가로 NE/SE/SW/NW, 세로 걸음0/1, 총8프레임이다. 셀 전체 높이를 사람 키로 쓰지 않고 프레임별 `figureHeight`, `foot`를 사용한다. `walker-contract.json`에 원본 템플릿들의 정확한 발좌표를 추출했다. 정지 무리는 이 규격을 흉내 낸 애니메이션 시트로 표기하지 않는다.

기존 망토는 남/녀/상인 템플릿에 맞춘 별도 레이어이며 성직자·새 무리에 임의로 씌울 수 없다. 이번 사건 그림 대부분에 summer/winter 전용짝이 없으므로, 기존 all-season 소품 재사용과 새 겨울 옷을 분리한다. 원본 그대로 복사한 파일을 새 겨울 제작 수에 넣지 않는다.

바이블 v2에는17.6world px 성인과0.8저줌 기준이 적혀 있지만, 현재 소스 `walkerComposer.ts:35`는16world px, `drawWalkers.ts:42`는floor0.65다. 현재 실제 표시 기준은 줌1.0에서16px, 줌0.6에서10.4px이다. 바이블의 소재·조명·H비율을 따르되 이 불일치를 실제 장면 합성 기록에서 공개하고 그림만 몰래 크게 그려 맞추지 않는다.

## 판독상 직접 확인

대표 contact에서 굶주린 줄은 대각선 한 줄로 명확하다. 기존 운구자·사신·징집 워커는 같은 발맞춤 틀을 따른다. 징집 그림은 장궁을 손에 합성하기 전에는 일반인과 가깝다. 기존 `market_active`는 좌판 세 개를 통째로 담으므로 전체지지물로 재사용하고 천막 조각으로 분해하지 않는다. 작은 판자·운구대는 contact 확대시 흐려 보이므로 실제 크기에서 장면 합성으로 판독해야 한다.

조사 도구: 파일명/제작기록, PNG실체·SHA256, graft 2회(절약 추정51,363토큰), 해당 위치 소스 재확인. 저장소 파일 수정·설치·커밋·푸시 없음.

## 납품 재사용 파일

`assets/reused/`에31개 원본PNG를 바이트동일 복사했다. `reused-manifest.json`의각SHA256을 복사후 전부재검증했다. 여름/겨울양쪽에서 쓰는원본을두장으로복제하지 않았으며 신규그림수에포함하지않는다. 운구자·사신·징집2종·사제의8프레임과원본발좌표를포함했다. 불길 fire_small/large는기존 단일프레임이라 새불길 애니메이션을대체하지못한다.
