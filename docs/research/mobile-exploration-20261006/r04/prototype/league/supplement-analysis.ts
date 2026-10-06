import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { AXES, RESOURCES } from '../model/index.js';
import { CHALLENGERS } from './strategies.js';
import { supplementSchedule, type SupplementKind } from './supplement-data.js';
import { duelScore, summarizeDuels, type DuelScore } from './metrics.js';
import { growthFoodPlot } from './supplement-plot.js';
import { array, average, boolean, deltas, diplomacyMetrics, gameRows, growthRows, number, object, text, type GrowthPoint } from './supplement-analysis-data.js';
const KINDS=['growth','challenge','diplomacy','geometry'] as const;
function hash(value:string|Uint8Array):string{return createHash('sha256').update(value).digest('hex');}
function flags(args:readonly string[]){const values=new Map<string,string>();for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!key||!value||!['--in','--out','--kind'].includes(key)||values.has(key))throw new RangeError('Unique --in --out --kind values required');values.set(key,value);}const requested=values.get('--kind')??'all';if(requested!=='all'&&!KINDS.some(k=>k===requested))throw new RangeError('Unsupported kind');return {input:resolve(values.get('--in')??'records/supplement-final'),output:resolve(values.get('--out')??'records/supplement-analysis'),requested};}
async function sourceRoot():Promise<string>{
 let root=dirname(fileURLToPath(import.meta.url));
 while(true){try{await access(join(root,'model','economy.ts'));await access(join(root,'tsconfig.json'));return root;}
  catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
  const parent=dirname(root);if(parent===root)throw new RangeError('Prototype source root missing');root=parent;
 }
}
async function verifyCurrentSources(raw:unknown):Promise<void>{
 const root=await sourceRoot();
 const expected=(await readdir(join(root,'model'))).filter(name=>name.endsWith('.ts')&&name!=='session.ts'&&name!=='build-identity.ts').map(name=>`model/${name}`);
 expected.push(...['game','strategies','schedule','compact','supplement','supplement-data','supplement-geometry'].map(name=>`league/${name}.ts`));expected.sort();
 const files=array(raw).map(entry=>{const item=object(entry),path=text(item['path']),sha256=text(item['sha256']);
  if(!/^(model|league)\/[A-Za-z0-9.-]+\.ts$/.test(path)||!/^[a-f0-9]{64}$/.test(sha256))throw new RangeError('Unsafe source path or malformed SHA256');return {path,sha256};});
 const paths=files.map(file=>file.path);
 if(new Set(paths).size!==paths.length||JSON.stringify(paths)!==JSON.stringify(expected))throw new RangeError('Provenance source closure differs from expected files');
 for(const file of files)if(hash(await readFile(join(root,file.path)))!==file.sha256)throw new RangeError(`Current source SHA256 differs: ${file.path}`);
}
async function verified(input:string,kind:SupplementKind){
 const schedule=supplementSchedule(kind),p=object(JSON.parse(await readFile(join(input,`${kind}-provenance.json`),'utf8')));
 const sourceHash=text(p['sourceHash']),scheduleHash=hash(JSON.stringify(schedule));if(p['format']!==1||hash(JSON.stringify(p['sourceFiles']))!==sourceHash)throw new RangeError('Provenance source list hash differs');if(p['scheduleHash']!==scheduleHash||p['total']!==schedule.length||p['kind']!==kind)throw new RangeError('Schedule/provenance differs');
 await verifyCurrentSources(p['sourceFiles']);
 const stored:unknown=JSON.parse(await readFile(join(input,`${kind}-schedule.json`),'utf8'));if(JSON.stringify(stored)!==JSON.stringify(schedule))throw new RangeError('Stored schedule differs');
 const expected=schedule.map((_,i)=>`${kind}-${String(i).padStart(5,'0')}.json.gz`),actual=(await readdir(input)).filter(n=>n.startsWith(`${kind}-`)&&n.endsWith('.json.gz')).sort();
 if(JSON.stringify(actual)!==JSON.stringify([...expected].sort()))throw new RangeError(`Exact ${kind} file coverage missing/extra: expected${expected.length}, actual${actual.length}`);
 const results:unknown[]=[],hashes:{file:string;sha256:string}[]=[];
 for(const [i,task]of schedule.entries()){
  const file=expected[i];if(!file)throw new RangeError('Missing path');const bytes=await readFile(join(input,file));const envelope=object(JSON.parse(gunzipSync(bytes).toString('utf8')));
  if(envelope['index']!==i||envelope['id']!==task.id||envelope['sourceHash']!==sourceHash||envelope['scheduleHash']!==scheduleHash||envelope['taskHash']!==hash(JSON.stringify(task))||envelope['resultHash']!==hash(JSON.stringify(envelope['result'])))throw new RangeError(`Invalid envelope ${file}`);
  const result=object(envelope['result']);if(JSON.stringify(result['task'])!==JSON.stringify(task))throw new RangeError(`Result task differs ${file}`);results.push(result);hashes.push({file,sha256:hash(bytes)});
 }
 return {sourceHash,scheduleHash,count:results.length,results,hashes};
}
function analyzeGrowth(results:readonly unknown[]){
 const rows=results.flatMap(result=>{const parsed=growthRows(result);if(JSON.stringify(parsed.map(r=>r.tick))!=='[48,96,144]')throw new RangeError('Wrong growth checkpoint sequence');return parsed;});if(rows.length!==1875)throw new RangeError('Missing growth checkpoints');
 const key=(r:GrowthPoint)=>`${r.seed}:${r.terrain}:${r.tick}`;
 const controls=new Map(rows.filter(r=>r.strategy==='policy-off').map(r=>[key(r),r]));
 const controlDifferences=rows.filter(r=>r.strategy!=='policy-off').map(r=>{const control=controls.get(key(r));if(!control)throw new RangeError('Missing paired policy-off');return {seed:r.seed,terrain:r.terrain,tick:r.tick,strategy:r.strategy,...deltas(r,control)};});
 const groups=new Map<string,GrowthPoint[]>();for(const row of rows){const k=`${row.strategy}:${row.terrain}:${row.tick}`,group=groups.get(k)??[];group.push(row);groups.set(k,group);}
 const curves=[...groups.values()].map(group=>{const first=group[0];if(!first||group.length!==5)throw new RangeError('Growth seed coverage');return {strategy:first.strategy,terrain:first.terrain,tick:first.tick,seeds:group.map(r=>r.seed),population:average(group.map(r=>r.population)),employed:average(group.map(r=>r.employed)),stocks:Object.fromEntries(RESOURCES.map(r=>[r,average(group.map(p=>p.stocks[r]))])),facilities:Object.fromEntries(AXES.map(axis=>[axis,average(group.map(p=>p.facilityCounts[axis]))])),radius:average(group.map(r=>r.radius))};});
 const mixed=rows.filter(r=>r.strategy.startsWith('mix:')).map(r=>{
  const match=/^mix:(\w+)(75|50|25):(\w+)(25|50|75)$/.exec(r.strategy);if(!match)throw new RangeError('Mixture id');const a=match[1],weight=match[2],b=match[3];if(!a||!b||!weight)throw new RangeError('Mixture capture');
  const counterpart=rows.find(other=>key(other)===key(r)&&other.strategy===`mix:${a}${100-Number(weight)}:${b}${weight}`);if(!counterpart)throw new RangeError('Missing mixed counterpart');
  const base=weight==='50'?rows.find(other=>key(other)===key(r)&&other.strategy===`${a}+${b}`):undefined;
  return {seed:r.seed,terrain:r.terrain,tick:r.tick,strategy:r.strategy,oppositeWeight:deltas(r,counterpart),halfMatchesBase:base?JSON.stringify({stocks:r.stocks,counts:r.facilityCounts,radius:r.radius,population:r.population})===JSON.stringify({stocks:base.stocks,counts:base.facilityCounts,radius:base.radius,population:base.population}):null};
 });
 return {curves,perSeed:rows,controlDifferences,mixed,checks:{totalRows:rows.length,halfVectorNameInvariant:mixed.filter(r=>r.halfMatchesBase!==null).every(r=>r.halfMatchesBase),distinctControlCounts:controlDifferences.filter(r=>r.facilityCountL1>0).length}};
}
function analyzeChallenge(results:readonly unknown[]){
 const scores:DuelScore[]=[];const warRows:unknown[]=[];
 for(const raw of results){const result=object(raw),game=object(object(result['task'])['game']),cities=gameRows(result),a=cities[0],b=cities[1];if(!a||!b||cities.length!==2)throw new RangeError('Duel endpoints');const seed=number(game['seed']);scores.push({strategy:a.strategy,seed,score:duelScore(a,b)},{strategy:b.strategy,seed,score:duelScore(b,a)});warRows.push({id:object(result['task'])['id'],wars:result['wars'],metrics:result['metrics']});}
 const challengerIds=new Set(CHALLENGERS.map(s=>s.id));
 return {challengers:summarizeDuels(scores.filter(r=>challengerIds.has(r.strategy))),baseAgainstChallengers:summarizeDuels(scores.filter(r=>!challengerIds.has(r.strategy))),scores,wars:warRows,warning:'Separate opponent population; do not compare BASE rates directly to base-only league. Six seed clusters exploratory, no absence-of-dominance proof.'};
}
function analyzeDiplomacy(results:readonly unknown[]){
 const groups=new Map<string,{on?:unknown;off?:unknown}>();
 for(const raw of results){const r=object(raw),game=object(object(r['task'])['game']),key=text(game['block']),pair=groups.get(key)??{};if(boolean(game['diplomacyEnabled']))pair.on=r;else pair.off=r;groups.set(key,pair);}
 const pairs=[...groups.entries()].map(([block,pair])=>{
  if(pair.on===undefined||pair.off===undefined)throw new RangeError('Unpaired diplomacy toggle');const on=diplomacyMetrics(pair.on),off=diplomacyMetrics(pair.off),onCities=gameRows(pair.on),offCities=gameRows(pair.off);
  const outcomes=onCities.map(city=>{const other=offCities.find(c=>c.seat===city.seat&&c.strategy===city.strategy);if(!other)throw new RangeError('Paired seat mismatch');return {seat:city.seat,strategy:city.strategy,onValue:city.value,offValue:other.value,deltaValue:city.value-other.value,populationDelta:city.population-other.population};});
  return {block,on,off,outcomes,raidDifference:on.raids-off.raids,siegeDifference:on.sieges-off.sieges};
 });
 return {pairs,summary:{pairedGames:pairs.length,offered:pairs.reduce((n,p)=>n+p.on.offered,0),accepted:pairs.reduce((n,p)=>n+p.on.accepted,0),rejected:pairs.reduce((n,p)=>n+p.on.rejected,0),avoidedRaids:pairs.reduce((n,p)=>n+p.on.avoidedRaids,0),raidDifference:pairs.reduce((n,p)=>n+p.raidDifference,0),meanValueDelta:average(pairs.flatMap(p=>p.outcomes.map(o=>o.deltaValue))),knownEnvoyShippingFees:pairs.reduce((n,p)=>n+p.on.knownEnvoyShippingFees,0)},warning:'Nominal contract flows are not welfare; known fees omit breach penalties/transfers. Zero rejected means no recorded recipient rejections, not universally accepted candidate search.'};
}
function analyzeGeometry(results:readonly unknown[]){return results.map(raw=>{const r=object(raw),store=object(r['store']),guard=object(r['guard']);return {id:object(r['task'])['id'],store,guard,allRequiredChecks:[store['sameCountsStocksAndPeople'],store['pathDiffers'],store['farCostsMoreFood'],guard['sameCountsStocksAndPeople'],guard['sameDeployed'],guard['nearExposureHigher']].every(boolean)};});}
async function main():Promise<void>{
 const config=flags(process.argv.slice(2));await mkdir(config.output,{recursive:true});const kinds=KINDS.filter(kind=>config.requested==='all'||config.requested===kind),summary:string[]=['# R04 보충 실험 분석','검증: 정확한 파일 집합·스케줄·ID·소스/작업/결과 해시·gzip 읽기. 전체 시뮬레이션 재실행을 뜻하지 않는다.'];
 for(const kind of kinds){const data=await verified(config.input,kind);let analysis:unknown;
  switch(kind){case 'growth':analysis=analyzeGrowth(data.results);break;case 'challenge':analysis=analyzeChallenge(data.results);break;case 'diplomacy':analysis=analyzeDiplomacy(data.results);break;case 'geometry':analysis=analyzeGeometry(data.results);break;default:{const unreachable:never=kind;throw new RangeError(String(unreachable));}}
  await writeFile(join(config.output,`${kind}-analysis.json`),JSON.stringify({kind,sourceHash:data.sourceHash,scheduleHash:data.scheduleHash,count:data.count,analysis},null,2)+'\n');
  await writeFile(join(config.output,`${kind}-verified-files.json`),JSON.stringify(data.hashes,null,2)+'\n');summary.push(`\n## ${kind}\n\n${data.count}개 원자료 확인. 소스 해시: ${data.sourceHash}. 결과는 ${kind}-analysis.json.`);
  if(kind==='challenge'){const a=object(analysis),ch=object(a['challengers']);summary.push('\n| 도전자 | 경기 | 승점률 | 탐색95%구간 | 분류 |\n|---|---:|---:|---|---|');for(const raw of array(ch['strategies'])){const r=object(raw);summary.push(`| ${text(r['strategy'])} | ${number(r['games'])} | ${(100*number(r['scoreRate'])).toFixed(2)}% | ${array(r['interval95']).map(v=>(100*number(v)).toFixed(2)).join('–')}% | ${text(r['flag'])} |`);}summary.push('\n6개 seed 군집의 탐색 구간이다. 지배전략 부재 증명이 아니다. BASE-only 리그와 상대 모집단이 다르다.');}
  if(kind==='diplomacy'){const s=object(object(analysis)['summary']);summary.push(`\nON/OFF ${number(s['pairedGames'])}짝. 제안 ${number(s['offered'])}, 수락 ${number(s['accepted'])}, 거부 ${number(s['rejected'])}, 실제 피한 출정 ${number(s['avoidedRaids'])}. ON−OFF 총 약탈 ${number(s['raidDifference'])}, 평균 종료가치 차이 ${number(s['meanValueDelta']).toFixed(2)}. 명시 사절/운송 비용 ${number(s['knownEnvoyShippingFees'])}. 명목 순흐름은 후생/ROI가 아니다.`);}
  if(kind==='growth'){await writeFile(join(config.output,'growth-food.svg'),growthFoodPlot(data.results));const c=object(object(analysis)['checks']);summary.push(`\n1,875시점, 각 전략/지형/시점5seed. 정책0 대비 시설구성 차이가 있는 행 ${number(c['distinctControlCounts'])}. 50/50 이름 무관 일치: ${boolean(c['halfVectorNameInvariant'])}. 구성·경제·공간의 원자료와 함께 판단한다.`);}
  if(kind==='geometry')summary.push(`\n5개 통제 묶음 전체 인과 조건: ${array(analysis).every(raw=>boolean(object(raw)['allRequiredChecks']))}. 합성 평지 시험이며 자연 도시의 평균 효과가 아니다.`);
  console.log(JSON.stringify({kind,verified:data.count,output:config.output}));
 }
 await writeFile(join(config.output,'SUPPLEMENT_RESULTS.md'),summary.join('\n')+'\n');
}
await main();
