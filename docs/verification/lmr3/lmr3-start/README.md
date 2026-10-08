# LM-R3 start: the welcome and the house choice

DGX run `render-LMR3-start-captures-e18d2b6` (`--light`, headless Chrome, `scripts/lmr3StartCaptures.sh`, commit e18d2b61), 2026-10-08.
The logo is lmr3-start's stub (`src/ui/brand/GameLogo.tsx`, the game's name as text) until lmr3-brand's outlined logo replaces it at merge.

| file | what |
|---|---|
| `welcome-1280x800.jpg`, `welcome-tablet-1180x820.jpg` | the welcome: logo, lands, 영주 모드로 시작 (primary), 샌드박스로 시작 with its 목표와 함께 switch |
| `house-1280x800.jpg`, `house-tablet-1180x820.jpg` | the house choice after 영주 모드로 시작 (de Haverel, its `haverel` arms first) |
| `house-1280x800-picked.jpg` | 드 레이븐홀트 picked, 다른 문장 보기 once, the 3rd candidate (`ravenholt-7`) chosen |
| `started-1280x800.jpg` | the lord's slice started with that house (proof query) |
| `captures.json` | boxes, smallest text and target, primaries, and the flows read back from the game |

Measured (captures.json): at 1280×800, 1180×820 and 1280×720 the parchment is inside the viewport and does not scroll on both
steps; the smallest text is 12 px, the smallest target 44 px high; one primary on each step. The goal switch turns the sandbox
button's scenario from `core:sandbox` to `core:campaign_market_town` and back; the started game's lordship house is order 1
`de Ravenholt` / `ravenholt-7`; the campaign started through `scripts/welcomeStart.mjs` keeps the default house. Page errors: 0.

After this run two CSS rules changed (not re-captured; the lead's geometry run covers them): the sandbox button no longer
stretches to its column (it is as wide as its text, like lord mode's), and the house step's 뒤로 / 이 가문으로 시작 get their
160 px minimum width (the rule was too weak to apply). The stub logo's text was also sized to fit its box.
