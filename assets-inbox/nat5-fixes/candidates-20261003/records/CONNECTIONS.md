# NAT-5 추가 접속 조각

Wave42 원 규격은 records/CONNECTIONS-source.md. 새 조각은 모두128×128, 피벗(64,80), worldScale0.5. 여름·겨울 동일 기하. 좌우 반사 금지.

| suffix | 포트 | 기존/신규 |
|---|---|---|
| corner_top | NW NE | 신규 |
| corner_bottom | SW SE | 신규 |
| fork_sw | NW SW SE | 신규 |
| fork_se | NE SW SE | 신규 |
| cross | NW NE SW SE | 신규 |
| end_nw | NW | 신규 |
| end_ne | NE | 신규 |
| end_sw | SW | 신규 |
| end_se | SE | 신규 |
| corner_ne / corner_nw / fork_ne / fork_nw | 원 등록표 그대로 | 유지, ZIP에 중복하지 않음 |

파일 ID는 path_clear_{suffix}_{summer|winter}. NW=(32,64), NE=(96,64), SW=(32,96), SE=(96,96).
NW·SE는 path_clear_nw, NE·SW는 path_clear_ne 띠에 접속한다. 포트 중심을 겹치고 띠를8UVpx 더 진행시켜 알파 중첩한다. strip512×64, 중심v32. NE u→(.5,-.25),v→(.5,.25); NW u→(.5,.25),v→(-.5,.25). 이 값 전체에 worldScale0.5를 곱한다.

새 조각 바깥 포트에는 승인된 같은 계절 띠의 u256위상 일부를 합성했다. 안쪽32UVpx 범위에서 부드럽게 연결되고 바깥8UVpx는 감쇠한다. 이는 생성화의 접속 폭을 기존 띠에 맞추기 위한 그림 조립이며 새 벡터 도형을 그린 것이 아니다. strip 반복위상에 따라 세부 자갈 무늬는 달라질 수 있다. 8UV 중첩과 자연스러운 알파 가장자리를 유지한다.

엔진 현재의 반쪽 띠 대체 대신 포트집합에 맞는 신규connector를 선택한다. 끝조각은 하나의 포트만 연결하고 중심에서 자연스럽게 끝낸다. 기존 tail fade와 겹칠 경우 등록 후 육안 확인이 필요하다.
