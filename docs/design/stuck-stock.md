# 묶인 물자 명세 (FIX-11)

건물이 가진 물자 가운데 나가지 못하는 것과 그 이유를 목록으로 돌려준다. 코드는 `src/engine/stuckStock.ts`다.
- 요청: 렌더 UI-AUDIT-1이 요청했다.
- 쓰는 곳: 영주 모드 자율 성장(LM-E1)이 이 목록을 이유 점수로 쓴다.

## API
`stuckStock(state) → { buildingId, resource, amount, days, reason, source }[]`
- `reason`: `"no_road"`(길 없음) · `"no_carrier"`(운반꾼 부족) · `"receiver_full"`(받을 곳 가득)
- `source`: `"stock"`(건물의 재고) · `"field"`(헛간이 가득 차 밭에서 버린 밀)

## 조항
- **SK-1 이유와 순서**
  - 건물이 길을 요구하는데 길이 없으면 `no_road`다.
  - 그 물자를 받는 건물 어디에도 자리가 없으면 `receiver_full`이다.
  - 받을 곳은 있는데 다음 둘 중 하나면 `no_carrier`다.
    - 일손이 모자란다.
    - 재고가 그 건물이 드는 양(생산의 보관 상한, 없으면 저장 용량)의 5분의 4 이상 쌓였다. 수레꾼은 건물마다 한 번에 하나다.
- **SK-2 밭의 밀**: BOT-4 수확 기록의 `lost`는 여문 채 헛간이 받지 못해 겨울에 버린 밀이다. 그해 값을 쓰고, 그해 겨울 전이면 지난해 값을 쓴다. 이 밀은 가장 가득 찬 헛간에 `receiver_full`·`source: "field"` 한 줄로 드러난다.
- **SK-3 며칠째**
  - 건물은 물자가 처음 묶인 틱(`stuckSinceTick`)을 가진다.
  - 100틱(약 아흐레)마다 갱신한다(`advanceStuckStock`). 새로 묶이면 적고, 풀리면 지운다. 그래서 며칠째는 그 간격 단위다.
- **SK-4 결정론**: 목록은 상태에서 계산하며 같은 상태면 같은 목록이다.
