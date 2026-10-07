import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { decodeSave, encodeSave } from '../../src/save/saveCodec.ts';
import { RESOURCE_STOCK_PILE_ART } from '../../src/render/art/resourceStockPileArt.ts';
import { stockPileLayout } from '../../src/render/stockPileLayout.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { method: 'Existing summer/winter campaign saves migrated through current codec; no authored state changes; codec migration may remove legacy wheat_farm markers. Target logging/sawmill IDs, positions and inventory are asserted identical.', scenes: [] };
for (const [season, source] of [['summer','.omo/log-stockpiles/source-inputs/summer.save.json'],['winter','.omo/log-stockpiles/source-inputs/winter.save.json'],['winter-seed5','tests/fixtures/money/seed5-stable-2ba96a7.json.gz'],['spring-seed5','tests/fixtures/storage-recovery/seed5-504000.json.gz']]) {
 const sourceBytes = readFileSync(source), original = source.endsWith('.gz') ? gunzipSync(sourceBytes) : sourceBytes;
 const state = decodeSave(original).envelope.state, parsed = JSON.parse(original), raw = parsed.state ?? parsed;
 const facts = b => ({id:b.id,kind:b.kind,tx:b.tx,ty:b.ty,inventory:b.inventory});
 const target = b => ['logging_camp','sawmill'].includes(b.kind);
 assert.deepEqual(state.buildings.filter(target).map(facts), raw.buildings.filter(target).map(facts));
 assert.equal(state.tick,raw.tick);
 const bytes = encodeSave({ state, createdAt: '2026-10-06T00:00:00Z', savedAt: '2026-10-06T00:00:00Z' }).bytes;
 const file = `states/${season}.save.json`; writeFileSync(`.omo/log-stockpiles/${file}`, bytes);
 const homes = state.buildings.filter(b => ['logging_camp','sawmill'].includes(b.kind)).map(b => ({ id:b.id,kind:b.kind,tx:b.tx,ty:b.ty,inventory:b.inventory,selected:RESOURCE_STOCK_PILE_ART.select(state,b)?.id??null,anchor:stockPileLayout(b).door }));
 report.scenes.push({ season,source,sourceSHA256:hash(original),file,saveSHA256:hash(bytes),tick:state.tick,seed:state.seed,homes });
 console.log(JSON.stringify(report.scenes.at(-1)));
}
writeFileSync('.omo/log-stockpiles/provenance.json',JSON.stringify(report,null,2)+'\n');
