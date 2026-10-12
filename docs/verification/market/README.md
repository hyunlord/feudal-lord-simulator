# Market town — the lord's screens after the market charter's proclamation

States (DGX `~/fls-market-states`, `scripts/marketTownStates.ts`, run `render-MARKET-states5-061e8b2-061e8b2`, kept; the two
states of the first run `render-MARKET-states3-81dbc49-81dbc49` came out byte for byte the same): the lord's
slice as the lord bot plays it on seed 1, nothing injected. The town was proclaimed a market town at tick 69,266 (1317,
summer); the slice ended by its own rule at tick 72,000 (1318, a second estate) and the bot played on to 1321. Years covered
1300–1321. `states.json` here lists what each state holds.

| state | tick | date | era | population | holds |
|---|---|---|---|---|---|
| `market-proclaimed` | 70,266 | 1317 autumn | palisade (시장도시) | 528 | plan `past`; wall 2/25 segments; chapter 1's page due; the great famine's chip |
| `market-season-eve` | 70,960 | 1317 autumn | palisade | 528 | 40 ticks before the season's close (the season card's row runs it over) |
| `market-years` | 85,266 | 1321 summer | palisade | 528 | plan `past`; wall 7/25; slice ended; a house's suit against the lord (suit-5, evidence); the lord's moment and a decision trace chip |

Captures (`scripts/marketTownCaptures.sh`, run `render-MARKET-captures-c345cdb-c345cdb`, DGX headless Chrome, a state loaded —
not natural play): `market-proclaimed` and `market-years` at 1280×800 and the tablet (1180×820, touch) — the town as it comes up, the era console with
the plan's past line, the lord screen host. `results.json`: at most one primary, smallest text 12–13 px, buttons ≥ 44 px
(48 px on the tablet), no `title=`, each JPEG ≤ 600 KB (12 files, 1.6 MB) — all 12 pass.
