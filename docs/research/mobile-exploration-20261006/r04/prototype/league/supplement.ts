import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { RULE_VERSION } from '../model/index.js';
import { runGeometry } from './supplement-geometry.js';
import { runGrowth, runSupplementGame, supplementSchedule, type SupplementKind, type SupplementTask } from './supplement-data.js';
type Options={readonly kind:SupplementKind;readonly output:string;readonly start:number;readonly count:number;readonly freezeHash:string|null;readonly plan:boolean};
function options(args:readonly string[]):Options{
 const flags=new Map<string,string>();
 for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!key||!value||!['--kind','--out','--start','--count','--freeze-hash','--plan'].includes(key)||flags.has(key))throw new RangeError('Unique named flags and values required');flags.set(key,value);}
 const kind=flags.get('--kind');if(kind!=='growth'&&kind!=='challenge'&&kind!=='diplomacy'&&kind!=='geometry')throw new RangeError('kind growth|challenge|diplomacy|geometry required');
 const integer=(key:string,fallback:number)=>{const raw=flags.get(key),value=raw===undefined?fallback:Number(raw);if(!Number.isSafeInteger(value)||value<0)throw new RangeError(`${key} must be nonnegative integer`);return value;};
 const count=integer('--count',25);if(count<1||count>100)throw new RangeError('count must be 1..100');
 const plan=flags.get('--plan')??'yes';if(plan!=='yes'&&plan!=='no')throw new RangeError('plan yes|no');
 return {kind,output:resolve(flags.get('--out')??'records/supplement'),start:integer('--start',0),count,freezeHash:flags.get('--freeze-hash')??null,plan:plan==='yes'};
}
function hash(bytes:string|Uint8Array):string{return createHash('sha256').update(bytes).digest('hex');}
async function sourceRoot(start:string):Promise<string>{
 let path=start;
 while(true){try{await access(join(path,'model','economy.ts'));await access(join(path,'tsconfig.json'));return path;}
  catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}
  const parent=dirname(path);if(parent===path)throw new RangeError('Prototype root not found');path=parent;
 }
}
async function sourceFiles(root:string){
 const files=(await readdir(join(root,'model'))).filter(f=>f.endsWith('.ts')&&f!=='session.ts'&&f!=='build-identity.ts').map(f=>`model/${f}`);
 files.push(...['game','strategies','schedule','compact','supplement','supplement-data','supplement-geometry'].map(f=>`league/${f}.ts`));files.sort();
 return Promise.all(files.map(async path=>({path,sha256:hash(await readFile(join(root,path)))})));
}
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')return false;throw error;}}
async function immutable(path:string,contents:string):Promise<void>{
 try{await writeFile(path,contents,{flag:'wx'});}catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='EEXIST')throw error;if(await readFile(path,'utf8')!==contents)throw new RangeError('Existing supplementary provenance differs');}
}
function run(task:SupplementTask):unknown{
 switch(task.kind){case 'growth':return runGrowth(task);case 'challenge':case 'diplomacy':return runSupplementGame(task);case 'geometry':return runGeometry(task);default:{const unhandled:never=task;throw new RangeError(`Unhandled ${String(unhandled)}`);}}
}
async function main():Promise<void>{
 const config=options(process.argv.slice(2)),root=await sourceRoot(dirname(fileURLToPath(import.meta.url)));
 const files=await sourceFiles(root),sourceHash=hash(JSON.stringify(files)),tasks=supplementSchedule(config.kind),scheduleHash=hash(JSON.stringify(tasks));
 if(config.plan){console.log(JSON.stringify({kind:config.kind,total:tasks.length,sourceHash,scheduleHash,ruleVersion:RULE_VERSION,range:[config.start,Math.min(config.start+config.count,tasks.length)],execution:false,requires:'--plan no --freeze-hash EXACT_HASH'}));return;}
 if(config.freezeHash!==sourceHash)throw new RangeError('Explicit current supplementary source hash required; inspect --plan yes after parent freeze');
 if(config.start>=tasks.length)throw new RangeError('Start outside schedule');
 await mkdir(config.output,{recursive:true});
 await immutable(join(config.output,`${config.kind}-provenance.json`),JSON.stringify({format:1,kind:config.kind,sourceHash,sourceFiles:files,scheduleHash,total:tasks.length,ruleVersion:RULE_VERSION},null,2)+'\n');
 await immutable(join(config.output,`${config.kind}-schedule.json`),JSON.stringify(tasks)+'\n');
 const lock=join(config.output,`${config.kind}-${config.start}-${config.count}.lock`);await writeFile(lock,JSON.stringify({pid:process.pid,sourceHash}),{flag:'wx'});
 const started=performance.now();let executed=0,verified=0,next=config.start;
 try{
  for(;next<Math.min(tasks.length,config.start+config.count);next++){
   if(performance.now()-started>30000)break;
   const task=tasks[next];if(!task)throw new RangeError('Missing task');
   const path=join(config.output,`${config.kind}-${String(next).padStart(5,'0')}.json.gz`),taskHash=hash(JSON.stringify(task));
   if(await exists(path)){
    const saved:unknown=JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
    if(!record(saved)||saved['sourceHash']!==sourceHash||saved['scheduleHash']!==scheduleHash||saved['taskHash']!==taskHash||saved['index']!==next||saved['id']!==task.id||typeof saved['resultHash']!=='string'||hash(JSON.stringify(saved['result']))!==saved['resultHash'])throw new RangeError(`Resume artifact fails provenance/hash check: ${path}`);
    verified++;continue;
   }
   const result=run(task);
   if(hash(JSON.stringify(await sourceFiles(root)))!==sourceHash)throw new RangeError('Source changed during task; result not committed');
   const envelope={format:1,index:next,id:task.id,sourceHash,scheduleHash,taskHash,resultHash:hash(JSON.stringify(result)),result};
   const temporary=`${path}.${process.pid}.tmp`;
   await writeFile(temporary,gzipSync(JSON.stringify(envelope)+'\n',{level:6}),{flag:'wx'});
   if(await exists(path))throw new RangeError('Concurrent output appeared; refusing overwrite');
   await rename(temporary,path);executed++;
  }
 }finally{await unlink(lock);}
 console.log(JSON.stringify({kind:config.kind,executed,verified,next,total:tasks.length,sourceHash,elapsedMs:performance.now()-started,resume:'same start/count checks prior committed records; cooperative limit between tasks, one task may overrun'}));
}
await main();
