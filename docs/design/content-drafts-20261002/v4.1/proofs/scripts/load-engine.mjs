import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill-lme9b/package.json');
const { build } = require('esbuild');
const root = '/tmp/astra-content41-harness/snapshot';
const canon = '/Users/rexxa/fls-astra-content41/docs/design/content-drafts-20261002/v4';
export async function loadEngine({ entries, events, derived, label = 'probe' } = {}) {
  const registry = JSON.parse(readFileSync(`${canon}/registry-v4.json`, 'utf8'));
  const prose = events ?? JSON.parse(readFileSync(`${canon}/events-v4.json`, 'utf8'));
  const list = entries ?? registry.entries;
  const defs = derived ?? JSON.parse(readFileSync(`${canon}/READ_MODEL.json`, 'utf8')).derived;
  const live = list.filter(entry => entry.unsupportedFilters.length === 0);
  const blocked = list.filter(entry => entry.unsupportedFilters.length > 0).map(entry => ({id:entry.id,contentClass:entry.contentClass,blockedBy:entry.unsupportedFilters.map(filter=>filter.id)}));
  const copy = Object.fromEntries(prose.map(event=>[event.id,{title:event.title,body:event.body,sender:event.sender?.role??event.sender?.faction??'',senderFaction:event.sender?.faction??'',choices:Object.fromEntries(event.choices.map(choice=>[choice.id,choice]))}]));
  const entryModule = `export const V4_LIVE_ENTRIES=${JSON.stringify(live)}; export const V4_BLOCKED_ENTRIES=${JSON.stringify(blocked)};export const V4_POLICY=${JSON.stringify(registry.policy)};export const V4_DERIVED=${JSON.stringify(defs)};`;
  const outfile = `/tmp/astra-content41-harness/engine-${label}.mjs`;
  await build({stdin:{contents:`export * from './src/engine/registryV4.ts';export * from './src/engine/registryDsl.ts';export * from './src/engine/registry.ts';export * from './src/engine/townAgency.ts';export * from './src/engine/scenarioState.ts';export * from './src/ledger/ledger.ts';export {decodeSave} from './src/save/saveCodec.ts';export {recordDecision} from './src/engine/history.ts';`,resolveDir:root,loader:'js'},outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'external-content-only',setup(build){build.onLoad({filter:/v4Entries\.generated\.ts$/},()=>({contents:entryModule,loader:'js'}));build.onLoad({filter:/v4Copy\.generated\.ts$/},()=>({contents:`export const V4_COPY=${JSON.stringify(copy)};`,loader:'js'}));}}]});
  return import(`${outfile}?v=${Date.now()}`);
}
