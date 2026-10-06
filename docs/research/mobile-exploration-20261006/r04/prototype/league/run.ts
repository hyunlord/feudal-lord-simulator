import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { RULE_VERSION } from '../model/index.js';
import { compactGame } from './compact.js';
import { prepareGrowth, runGame, type PreparedGrowth } from './game.js';
import { duelSchedule, multiSchedule, type ScheduledGame } from './schedule.js';
import { BASE_STRATEGIES } from './strategies.js';
type Options={readonly kind:'duel'|'multi'|'smoke';readonly batch:number;readonly batchSize:number;readonly output:string;readonly replayIndex:number|null};
type Source={readonly path:string;readonly sha256:string};
type Manifest={readonly format:1;readonly sourceHash:string;readonly scheduleHash:string;readonly kind:string;readonly batch:number;readonly batchSize:number;readonly start:number;readonly end:number;readonly count:number;readonly ids:readonly string[];readonly file:string;readonly sha256:string};
function parseOptions(args:readonly string[]):Options {
 const flags=new Map<string,string>();
 for(let index=0;index<args.length;index+=2){const key=args[index],value=args[index+1];if(!key||!value||!['--kind','--batch','--batch-size','--out','--replay-index'].includes(key)||flags.has(key))throw new RangeError('Expected unique named options with values');flags.set(key,value);}
 const kind=flags.get('--kind');if(kind!=='duel'&&kind!=='multi'&&kind!=='smoke')throw new RangeError('--kind duel|multi|smoke required');
 const integer=(name:string,fallback:number):number=>{const text=flags.get(name);const value=text===undefined?fallback:Number(text);if(!Number.isSafeInteger(value)||value<0)throw new RangeError(`${name} requires a nonnegative integer`);return value;};
 const batchSize=integer('--batch-size',100);if(batchSize<1||batchSize>1000)throw new RangeError('batch size must be 1..1000');
 return {kind,batch:integer('--batch',0),batchSize,output:resolve(flags.get('--out')??'records/league-run'),replayIndex:flags.has('--replay-index')?integer('--replay-index',0):null};
}
function hash(data:string|Uint8Array):string{return createHash('sha256').update(data).digest('hex');}
const SOURCE_SELECTION={model:'model/*.ts',excluded:['model/session.ts','model/build-identity.ts'],league:['game.ts','schedule.ts','strategies.ts','compact.ts','run.ts']} as const;
async function findPrototypeRoot(start:string):Promise<string>{
 let candidate=start;
 while(true){
  try{await access(join(candidate,'tsconfig.json'));await access(join(candidate,'model','economy.ts'));return candidate;}
  catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
  const parent=dirname(candidate);if(parent===candidate)throw new RangeError('Prototype source root missing: tsconfig.json and model/economy.ts required');candidate=parent;
 }
}
async function sources(root:string):Promise<Source[]>{
 const paths=(await readdir(join(root,'model'))).filter(name=>name.endsWith('.ts')&&name!=='session.ts'&&name!=='build-identity.ts').map(name=>`model/${name}`);
 paths.push(...SOURCE_SELECTION.league.map(name=>`league/${name}`));paths.sort();
 if(!paths.includes('model/economy.ts'))throw new RangeError('Simulation source set is incomplete');
 return Promise.all(paths.map(async path=>({path,sha256:hash(await readFile(join(root,path)))})));
}
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function parseManifest(value:unknown):Manifest {
 if(!record(value)||value['format']!==1||typeof value['sourceHash']!=='string'||typeof value['scheduleHash']!=='string'||typeof value['kind']!=='string'||typeof value['file']!=='string'||typeof value['sha256']!=='string'||!Array.isArray(value['ids'])||!value['ids'].every((id:unknown)=>typeof id==='string'))throw new RangeError('Malformed prior manifest');
 const number=(key:string):number=>{const n=value[key];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw new RangeError(`Invalid manifest ${key}`);return n;};
 return {format:1,sourceHash:value['sourceHash'],scheduleHash:value['scheduleHash'],kind:value['kind'],batch:number('batch'),batchSize:number('batchSize'),start:number('start'),end:number('end'),count:number('count'),ids:value['ids'],file:value['file'],sha256:value['sha256']};
}
async function immutableFile(path:string,contents:string):Promise<void>{
 try{await writeFile(path,contents,{flag:'wx'});}catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='EEXIST')throw error;if(await readFile(path,'utf8')!==contents)throw new RangeError(`Existing provenance differs: ${path}`);}
}
async function fileHash(path:string):Promise<string>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');}
async function main():Promise<void>{
 const options=parseOptions(process.argv.slice(2));const prototypeRoot=await findPrototypeRoot(dirname(fileURLToPath(import.meta.url)));
 const sourceFiles=await sources(prototypeRoot);const sourceHash=hash(JSON.stringify(sourceFiles));
 const schedule:ScheduledGame[]=options.kind==='duel'?duelSchedule():options.kind==='multi'?multiSchedule():[{id:'smoke:seed1',block:'smoke:seed1',rotation:0,strategies:BASE_STRATEGIES.slice(0,4),seed:1,terrain:'river',growthSteps:48,diplomacyEnabled:true}];
 const scheduleHash=hash(JSON.stringify(schedule));
 if(options.replayIndex!==null){const game=schedule[options.replayIndex];if(!game)throw new RangeError('Replay index outside schedule');console.log(JSON.stringify({sourceHash,scheduleHash,game:compactGame(runGame(game),game)}));return;}
 const batchStart=options.batch*options.batchSize,batchEnd=Math.min(schedule.length,batchStart+options.batchSize);
 if(batchStart>=schedule.length)throw new RangeError('Batch outside schedule');
 await mkdir(options.output,{recursive:true});
 await immutableFile(join(options.output,`${options.kind}-provenance.json`),JSON.stringify({format:1,kind:options.kind,ruleVersion:RULE_VERSION,sourceSelection:SOURCE_SELECTION,sourceHash,sourceFiles,scheduleHash,total:schedule.length},null,2)+'\n');
 await immutableFile(join(options.output,`${options.kind}-schedule.json`),JSON.stringify(schedule)+'\n');
 const prefix=`${options.kind}-b${options.batch}-n${options.batchSize}`;
 const lock=join(options.output,`${prefix}.lock`);
 await writeFile(lock,JSON.stringify({pid:process.pid,sourceHash}),{flag:'wx'});
 try{
 const prior:Manifest[]=[];
 for(const name of await readdir(options.output))if(name.startsWith(`${prefix}-`)&&name.endsWith('.meta.json')){
  const parsed:unknown=JSON.parse(await readFile(join(options.output,name),'utf8'));const item=parseManifest(parsed);
  if(item.sourceHash!==sourceHash||item.scheduleHash!==scheduleHash||item.kind!==options.kind||item.batch!==options.batch||item.batchSize!==options.batchSize||item.file!==`${prefix}-${item.start}-${item.end}.ndjson.gz`)throw new RangeError('Prior batch provenance mismatch');
  if(await fileHash(join(options.output,item.file))!==item.sha256)throw new RangeError('Prior batch data hash mismatch');prior.push(item);
 }
 prior.sort((a,b)=>a.start-b.start);let cursor=batchStart;
 for(const item of prior){if(item.start!==cursor||item.end>batchEnd||item.count!==item.end-item.start||JSON.stringify(item.ids)!==JSON.stringify(schedule.slice(item.start,item.end).map(g=>g.id)))throw new RangeError('Prior batch coverage mismatch');cursor=item.end;}
 if(cursor===batchEnd){console.log(JSON.stringify({kind:options.kind,batch:options.batch,status:'already-complete',start:batchStart,end:batchEnd,count:batchEnd-batchStart,sourceHash}));return;}
 const started=performance.now(),start=cursor,ids:string[]=[];const cache=new Map<string,PreparedGrowth>();
 const temporary=join(options.output,`${prefix}-${start}-${process.pid}.tmp.gz`);const gzip=createGzip({level:6});const output=createWriteStream(temporary,{flags:'wx'});const finished=pipeline(gzip,output);
 // Cooperative time limit checks between complete games. One synchronous game may overrun.
 for(;cursor<batchEnd;cursor++){
  if(performance.now()-started>=30000)break;
  const game=schedule[cursor];if(!game)throw new RangeError('Missing scheduled game');
  const growth=game.strategies.map(strategy=>{
   const key=JSON.stringify([game.seed,game.terrain,game.growthSteps,strategy]);const existing=cache.get(key);if(existing)return existing;
   const fresh=prepareGrowth({...game,strategies:[strategy]})[0];if(!fresh)throw new RangeError('Missing prepared city');cache.set(key,fresh);return fresh;
  });
  const line=JSON.stringify(compactGame(runGame(game,{growth}),game))+'\n';if(!gzip.write(line))await once(gzip,'drain');ids.push(game.id);
 }
 gzip.end();await finished;
 if(hash(JSON.stringify(await sources(prototypeRoot)))!==sourceHash)throw new RangeError('Source changed during batch; temporary output retained, not committed');
 if(ids.length===0)throw new RangeError('No complete game; temporary output retained');
 const file=`${prefix}-${start}-${cursor}.ndjson.gz`,destination=join(options.output,file);
 try{await stat(destination);throw new RangeError('Refusing to overwrite orphan output');}catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
 const sha256=await fileHash(temporary);await rename(temporary,destination);
 const manifest:Manifest={format:1,sourceHash,scheduleHash,kind:options.kind,batch:options.batch,batchSize:options.batchSize,start,end:cursor,count:ids.length,ids,file,sha256};
 const meta=join(options.output,`${prefix}-${start}-${cursor}.meta.json`);const metaTemp=`${meta}.${process.pid}.tmp`;
 await writeFile(metaTemp,JSON.stringify({...manifest,elapsedMs:performance.now()-started,node:process.version,platform:process.platform,architecture:process.arch,ruleVersion:RULE_VERSION,batchComplete:cursor===batchEnd,totalSchedule:schedule.length},null,2)+'\n',{flag:'wx'});await rename(metaTemp,meta);
 console.log(JSON.stringify({kind:options.kind,batch:options.batch,status:cursor===batchEnd?'batch-complete':'partial-resume-same-command',start,end:cursor,count:ids.length,totalSchedule:schedule.length,elapsedMs:performance.now()-started,sha256,file}));
 }finally{await unlink(lock);}
}
await main();
