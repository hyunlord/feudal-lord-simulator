import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { array, number, object, parseGame, text, type Game } from './analysis-input.js';
import { duelSchedule, multiSchedule, rotate, type ScheduledGame } from './schedule.js';
import { BASE_STRATEGIES } from './strategies.js';
export type Kind='duel'|'multi'|'smoke';
export type InputOptions={readonly input:string;readonly kind:Kind;readonly partial:boolean};
function hash(value:string|Uint8Array):string{return createHash('sha256').update(value).digest('hex');}
async function fileHash(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
async function json(path:string):Promise<unknown>{return JSON.parse(await readFile(path,'utf8'));}
function integer(value:unknown):number{const parsed=number(value);if(!Number.isSafeInteger(parsed)||parsed<0)throw new RangeError('Expected nonnegative integer');return parsed;}
function safeFile(value:unknown):string{const file=text(value);if(basename(file)!==file||file==='.'||file==='..')throw new RangeError('Unsafe input path');return file;}
async function sourceRoot():Promise<string>{let dir=dirname(fileURLToPath(import.meta.url));for(;;){try{await access(join(dir,'model','economy.ts'));await access(join(dir,'tsconfig.json'));return dir;}catch(error){if(!(error instanceof Error)||!('code'in error)||error.code!=='ENOENT')throw error;}const parent=dirname(dir);if(parent===dir)throw new RangeError('Prototype source root missing');dir=parent;}}
function scheduleFor(kind:Kind):ScheduledGame[]{switch(kind){case 'duel':return duelSchedule();case 'multi':return multiSchedule();case 'smoke':return [{id:'smoke:seed1',block:'smoke:seed1',rotation:0,strategies:BASE_STRATEGIES.slice(0,4),seed:1,terrain:'river',growthSteps:48,diplomacyEnabled:true}];}}
function matchGame(input:unknown,scheduled:ScheduledGame):Game{
 const row=object(input),{id,block,rotation,...spec}=scheduled;
 if(row['id']!==id||row['block']!==block||row['rotation']!==rotation||JSON.stringify(row['spec'])!==JSON.stringify(scheduled))throw new RangeError(`Game identity/spec mismatch ${id}`);
 const game=parseGame(input),seats=scheduled.strategies.map((_,i)=>`seat-${i}`);
 for(const [phase,observations] of [['growth',game.growth],['foreign',game.foreign],['recovery',game.recovery]] as const){
  if(observations.length!==seats.length||observations.some((city,i)=>city.seat!==seats[i]||city.strategy!==scheduled.strategies[i]?.id))throw new RangeError(`Phase seat mapping mismatch ${id}`);
  const ticks=phase==='growth'?spec.growthSteps:phase==='foreign'?spec.growthSteps+12:spec.growthSteps+36;
  for(const city of array(row[phase]))if(number(object(city)['tick'])!==ticks)throw new RangeError(`Phase tick mismatch ${id}`);
 }
 const orders=Array.from({length:12},(_,round)=>rotate(seats,round%seats.length));
 if(JSON.stringify(row['order'])!==JSON.stringify(orders))throw new RangeError(`Processing order mismatch ${id}`);
 for(const decision of game.decisions)if(!seats.includes(decision.seat)||!['peace','honor-pact','raid','siege','breach'].includes(decision.action))throw new RangeError(`Invalid decision ${id}`);
 for(const seat of seats)if(game.decisions.filter(d=>d.seat===seat&&d.action!=='breach').length!==12)throw new RangeError(`Decision opportunity count mismatch ${id}`);
 if(game.decisions.filter(d=>d.action==='raid'||d.action==='siege').length!==game.wars.length)throw new RangeError(`War/decision count mismatch ${id}`);
 return game;
}
export async function readDataset(options:InputOptions,consume:(game:Game)=>void|Promise<void>){
 const names=await readdir(options.input),provenance=object(await json(join(options.input,`${options.kind}-provenance.json`)));
 if(provenance['format']!==1||provenance['kind']!==options.kind)throw new RangeError('Provenance version/kind mismatch');
 const sourceHash=text(provenance['sourceHash']),sourceFiles=array(provenance['sourceFiles']),scheduleHash=text(provenance['scheduleHash']);
 if(!sourceFiles.length||hash(JSON.stringify(sourceFiles))!==sourceHash)throw new RangeError('Source provenance hash mismatch');
 const root=await sourceRoot();const paths=new Set<string>();
 for(const input of sourceFiles){const file=object(input),path=text(file['path']);if(!/^(model|league)\/[A-Za-z0-9_.-]+\.ts$/.test(path)||paths.has(path))throw new RangeError('Invalid/duplicate source file');paths.add(path);if(await fileHash(join(root,path))!==file['sha256'])throw new RangeError(`Current source differs: ${path}`);}
 for(const required of ['model/economy.ts','league/game.ts','league/schedule.ts','league/strategies.ts','league/compact.ts','league/run.ts'])if(!paths.has(required))throw new RangeError(`Missing source provenance: ${required}`);
 const schedule=scheduleFor(options.kind),saved=await json(join(options.input,`${options.kind}-schedule.json`));
 if(JSON.stringify(saved)!==JSON.stringify(schedule)||hash(JSON.stringify(schedule))!==scheduleHash||provenance['total']!==schedule.length)throw new RangeError('Schedule differs from current fixed contract');
 const manifests=await Promise.all(names.filter(name=>name.startsWith(`${options.kind}-b`)&&name.endsWith('.meta.json')).map(async name=>{
  const m=object(await json(join(options.input,name)));if(m['format']!==1||m['kind']!==options.kind||m['sourceHash']!==sourceHash||m['scheduleHash']!==scheduleHash)throw new RangeError(`Manifest provenance mismatch: ${name}`);
  const start=integer(m['start']),end=integer(m['end']),count=integer(m['count']),batch=integer(m['batch']),batchSize=integer(m['batchSize']),file=safeFile(m['file']);
  if(end<=start||end>schedule.length||count!==end-start||!batchSize||start<batch*batchSize||end>Math.min(schedule.length,(batch+1)*batchSize)||file!==`${options.kind}-b${batch}-n${batchSize}-${start}-${end}.ndjson.gz`||name!==file.replace('.ndjson.gz','.meta.json'))throw new RangeError(`Invalid manifest range/name ${name}`);
  if(JSON.stringify(array(m['ids']).map(text))!==JSON.stringify(schedule.slice(start,end).map(g=>g.id)))throw new RangeError(`Manifest ID mismatch ${name}`);
  return {start,end,count,file,sha256:text(m['sha256'])};
 }));
 manifests.sort((a,b)=>a.start-b.start);let cursor=0,count=0;const gaps:{start:number;end:number}[]=[];const files=new Set(manifests.map(m=>m.file));
 for(const name of names)if(name.startsWith(`${options.kind}-b`)&&name.endsWith('.ndjson.gz')&&!files.has(name))throw new RangeError(`Orphan data file: ${name}`);
 for(const m of manifests){if(m.start<cursor)throw new RangeError('Overlapping schedule ranges');if(m.start>cursor)gaps.push({start:cursor,end:m.start});cursor=m.end;}
 if(cursor<schedule.length)gaps.push({start:cursor,end:schedule.length});if(!options.partial&&gaps.length)throw new RangeError(`Incomplete schedule: ${JSON.stringify(gaps)}`);
 for(const manifest of manifests){const path=join(options.input,manifest.file);if(await fileHash(path)!==manifest.sha256)throw new RangeError(`Data SHA256 mismatch: ${manifest.file}`);
  const lines=createInterface({input:createReadStream(path).pipe(createGunzip()),crlfDelay:Infinity});let index=manifest.start;
  for await(const line of lines){const expected=schedule[index];if(!expected||index>=manifest.end)throw new RangeError(`Extra game in ${manifest.file}`);const parsed:unknown=JSON.parse(line);await consume(matchGame(parsed,expected));index++;count++;}
  if(index!==manifest.end)throw new RangeError(`Missing records in ${manifest.file}`);
 }
 return {kind:options.kind,count,expected:schedule.length,complete:gaps.length===0,gaps,sourceHash,scheduleHash,manifests:manifests.length,batches:manifests,sourceFilesVerified:sourceFiles.length,independentSeeds:options.kind==='multi'?2:options.kind==='duel'?6:1};
}
