// INSTALL-15 evidence states: the C25 zoned board (seed 2 final with painted arable, pasture, orchard and burgage
// plots by the wall and the lake) in each season, 600 ticks in (past the season effects); the autumn-to-winter turn
// 25 ticks before it (about a second at 1x); and 50 ticks into autumn and winter for the falling leaves and the first
// snow. Usage: npx tsx scripts/install15States.ts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { C25_SEASONS, c25SeasonState, c25ZonedState } from "./c25Board";

const out = process.argv[2] ?? ".remote/install15-states";
mkdirSync(out, { recursive: true });
const base = c25ZonedState();
const year = Math.floor(base.tick / 4_000) * 4_000;
const write = (name: string, tick: number) => writeFileSync(join(out, `${name}.json`), JSON.stringify({ ...base, tick }));
for (const [name, season] of C25_SEASONS) writeFileSync(join(out, `season-${name}.json`), JSON.stringify(c25SeasonState(season)));
write("turn-autumn-winter", year + 3_000 - 25);
write("turn-winter-spring", year + 4_000 - 25);
write("fx-leaves", year + 2_000 + 50);
write("fx-snow", year + 3_000 + 50);
console.log(JSON.stringify({ out, year, tick: base.tick }));
