# 렌더 A → 엔진: 도시 인장 필드(테두리 + 가운데)

INSTALL-18(Wave 14 남은 UI 그림)에서 도시 인장 그림 여섯 장과 자치 특허장 틀을 설치하지 못했다. 도시가 어떤 인장을 갖는지 엔진도 코드도 정하지 않기 때문이다(도시 문장은 seed의 `heraldryArms`, `legacy.ts`의 `city_seal`은 5장 유산 LG-1의 한 단계일 뿐). 사용자 결정(2026-10-07): 화면이 규칙을 베끼지 말고(P-D4) 엔진에 인장 필드를 요청하고, 그 필드가 들어오면 특허 봉인 순간과 함께 설치한다.

## 요청
1. **도시 인장**: 도시가 자치 특허를 받는 순간(5장 `charter_sealing` / `city_seal` 단계) 한 번 정해 저장하고 바뀌지 않는 필드 — 예: `town.seal: { rim: "round" | "pointed_oval"; centre: "gate" | "ship" | "church" | "bridge" } | null`(특허 전 `null`). 저장 필드라 저장 판 올림이 필요하면 그대로.
2. **고르는 규칙은 도시의 실제 특징으로**(사용자): 다리 통행세를 쥔 도시 → `bridge`, 교회 도시 → `church` + `pointed_oval`(Astra의 증명 `assets-inbox/wave14/candidates-v1/records/proof-seals.cjs:3`이 이 둘을 짝짓는다), 항구 → `ship`, 그 밖 → `gate`. 테두리는 교회 도시만 뾰족한 타원, 나머지는 원(다른 짝이 맞으면 엔진이 정해 알려 줘). 무엇을 "교회 도시"·"항구"로 치는지는 엔진의 정의로.
3. **특허 순간의 읽기 모델**(있으면 그대로, 없으면): 넘겨준 권리 목록과 정액 상납(fee farm)의 금액·기한 — 지금 화면은 `lordshipModel`의 `rightsTransfer`를 장부 서랍 두 줄로만 보인다(`src/ui/hud/HudShell.tsx:234-237`). 들어오면 "자치 특허" 화면에서 특허장(`frame_charter` 512×640, 제 크기)에 이 내용과 인장을 함께 보인다.

## 들어오면 렌더가 하는 것
- `seal_town_round`·`seal_town_pointed_oval` 테두리 + `seal_town_center_gate|ship|church|bridge` 가운데(조합 규칙 `docs/ops/install-plan-20261003/SPECS/wave14-ui.md:11`, 가운데 지름은 증명대로 원 142/256·타원 112/256)를 그 도시의 필드대로.
- "자치 특허" 화면(특허 봉인 순간에 열리고, 권리 줄에서 다시 열 수 있음): 특허장 틀, 넘겨준 권리, 정액 상납, 인장.
- 설치 표시는 그때 실제 장면 캡처 뒤에(INSTALL_PROTOCOL).

출처: INSTALL-18 Wave 14 보고(렌더 A, 2026-10-07), 결정 IN18-D1. 받는 쪽: 엔진(5장 유산·도시 특허).
