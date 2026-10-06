import {spawn} from 'node:child_process';
import {appendFile} from 'node:fs/promises';
const output='records/league-run';
for (const [kind,batches] of [['duel',119],['multi',198]]) {
 for(let batch=0;batch<batches;batch++) {
  let complete=false;
  while(!complete) {
   const child=spawn(process.execPath,['prototype/dist/league/run.js','--kind',kind,'--batch',String(batch),'--batch-size','100','--out',output],{stdio:['ignore','pipe','inherit']});
   let stdout=''; for await(const chunk of child.stdout) stdout+=chunk;
   const code=await new Promise(resolve=>child.on('close',resolve));
   if(code!==0) throw new Error(`Failed ${kind} ${batch}: ${code}`);
   const result=JSON.parse(stdout.trim());
   await appendFile('records/R04_BATCH_LOG.ndjson',JSON.stringify(result)+'\n');
   console.log(JSON.stringify(result));
   complete=result.status==='batch-complete'||result.status==='already-complete';
   if(!complete&&result.status!=='partial-resume-same-command')throw new Error('Unknown batch state');
  }
 }
}
