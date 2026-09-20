import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const runtime=await readFile(new URL('./proof-work-runtime.mjs',import.meta.url),'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
const moduleUrl='/__phase19ProofFrameWork.js';
export async function install(page,receipt){
  await page.route(`**${moduleUrl}`,route=>route.fulfill({status:200,contentType:'text/javascript',body:runtime}));
  receipt({file:moduleUrl,sha256:sha(runtime)});
  for(const file of ['render/useGameCanvasRuntime.ts','state/fixedTickLoop.ts','testing/phase10ProofRuntime.ts']) {
    await page.route(`**/src/${file}*`,async route=>{
      const response=await route.fetch();const source=await response.text();let result=source;
      if(source.includes('proofFrameWork'))throw new Error(`Already instrumented source: ${file}`);
      if(file==='render/useGameCanvasRuntime.ts'){
        const call=/drawCurrentCanvasFrame\(\{[\s\S]*?\}\);/g;
        const matches=[...source.matchAll(call)];if(matches.length!==1)throw new Error('Draw call anchor mismatch');
        result=`import {proofFrameWork} from '${moduleUrl}';\n`+source.replace(call,statement=>`const work=proofFrameWork.current;const startedAt=work===null?0:performance.now();\n${statement}\nif(work!==null)work.recordFrame(performance.now()-startedAt);`);
      }else if(file==='state/fixedTickLoop.ts'){
        const anchor='nextState = advanceTick(nextState);';
        if(source.split(anchor).length!==2)throw new Error('Tick anchor mismatch');
        result=`import {proofFrameWork} from '${moduleUrl}';\n`+source.replace(anchor,`const work=proofFrameWork.current;const startedAt=work===null?0:performance.now();\n${anchor}\nif(work!==null)work.recordTick(performance.now()-startedAt);`);
      }else{
        for(const anchor of ['const spriteDrawProbe = installWorldSpriteDrawProbe();','spriteDraws: spriteDrawProbe.snapshot()','spriteDrawProbe.dispose();'])if(!source.includes(anchor))throw new Error('Proof anchor mismatch');
        result=`import {installProofFrameWork} from '${moduleUrl}';\n`+source
          .replace('const spriteDrawProbe = installWorldSpriteDrawProbe();','const spriteDrawProbe = installWorldSpriteDrawProbe();const workProbe=installProofFrameWork();')
          .replace('spriteDraws: spriteDrawProbe.snapshot()','spriteDraws: spriteDrawProbe.snapshot(),work:workProbe.snapshot()')
          .replace('spriteDrawProbe.dispose();','spriteDrawProbe.dispose();workProbe.dispose();');
      }
      receipt({file,inputSha256:sha(source),outputSha256:sha(result)});
      await route.fulfill({response,body:result});
    });
  }
}
