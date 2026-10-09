#!/usr/bin/env bash
# One-off command body for run.sh --light. Does not run simulation or change policy.
set -euo pipefail
: "${FLS_REMOTE_PORT:?run through scripts/remote/run.sh --light}"
: "${PLAYWRIGHT_MODULE:?existing playwright-core module required}"
. scripts/remote/devServers.sh
mkdir -p .remote/eb-steward-chronicle
fls_serve .remote/eb-steward-chronicle-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:$FLS_REMOTE_PORT/" > /dev/null; then break; fi
  sleep 1
done
curl -sf "http://127.0.0.1:$FLS_REMOTE_PORT/" > /dev/null
node --import tsx --input-type=module <<'JS'
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readCheckpoints } from './scripts/engineBVisibleCapture.mjs';
import { withResidentWalkers } from './src/render/presentation/residentWalkerState.ts';
import { yearOfTick } from './src/ui/chronicle/chronicleScreenModel.ts';
import { loadChromium, openScene } from './scripts/renderCommitProbe.mjs';
const directory='/home/hyunlord/fls-runs/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-1';
const manifestSha='e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d';
const input=readCheckpoints(directory,manifestSha);
const rawPath='docs/verification/eb-weight/kept-2485af4/seed-1.json.gz';
const rawBytes=readFileSync(rawPath);const reportBytes=gunzipSync(rawBytes);const raw=JSON.parse(reportBytes);
const sha=value=>createHash('sha256').update(value).digest('hex');
if(sha(reportBytes)!=='3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd')throw new Error('Raw audit SHA mismatch');
const jobs=[
 {id:'h-008107',entry:'ck_evt_058',tick:126000,checkpoint:'ck_evt_032-answer'},
 {id:'h-011244',entry:'ck_evt_034',tick:171000,checkpoint:'ck_evt_031-answer'},
 {id:'h-026951',entry:'ck_evt_144',tick:415000,checkpoint:'ck_evt_165-answer'},
 {id:'h-029251',entry:'ck_evt_163',tick:450000,checkpoint:'ck_evt_165-answer'},
];
for(const job of jobs){
 const decision=raw.decisions.find(d=>d.id===job.id);
 if(decision?.by!=='steward'||decision.tick!==job.tick||!decision.source.startsWith(`registry:${job.entry}:`))throw new Error(`Raw steward identity mismatch ${job.id}`);
 job.decision=decision;job.scene=input.cases.find(c=>c.name===job.checkpoint);
 const history=job.scene?.checkpoint.state.history?.records.find(r=>r.id===job.id);
 if(history?.kind!=='decision'||history.tick!==job.tick)throw new Error(`Actual history absent ${job.id}`);
 job.year=yearOfTick(job.scene.checkpoint.state,history.tick);
}
const out='.remote/eb-steward-chronicle';
const result={sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirtyPaths:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),
 checkpointSourceRevision:input.manifest.sourceRevision,checkpointDirectory:directory,manifestSha256:manifestSha,
 rawAudit:{path:rawPath,gzipSha256:sha(rawBytes),decodedSha256:sha(reportBytes),provenance:raw.provenance},viewport:{width:1280,height:800},run:false,
 scope:'Manually opened history of steward decisions on actual later saves; not season stewardReport or first-visible timing.',cases:[]};
writeFileSync(`${out}/source-manifest.json`,readFileSync(`${directory}/manifest.json`));
const visible=(page,selector)=>page.locator(`${selector}:visible`).count().then(count=>count>0);
const stateJson=page=>page.evaluate(()=>JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
const INIT=`globalThis.__name ??= target => target; localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));`;
const browser=await(await loadChromium()).launch({channel:'chrome',headless:true});
let adviceAttempted=false;
try{
 for(const job of jobs){
  const checkpoint=job.scene.checkpoint;const state=checkpoint.state;const expected=JSON.stringify(withResidentWalkers(state));
  const row={id:job.id,entry:job.entry,decision:job.decision,checkpoint:checkpoint.record,rawStateSha256:sha(JSON.stringify(state)),expectedPresentationSha256:sha(expected),actions:[],errors:[]};
  let context;
  try{
   const seat=state.buildings.find(b=>b.kind==='manor_house')??state.buildings[0];
   const opened=await openScene(browser,{state:checkpoint.text,tile:[seat.tx,seat.ty],baseUrl:`http://127.0.0.1:${process.env.FLS_REMOTE_PORT}/`,width:1280,height:800,run:false,query:'&story-delay=1500',initScript:INIT,loadTimeout:90000});
   context=opened.context;const page=opened.page;page.on('pageerror',error=>row.errors.push(String(error)));
   const verify=async()=>{const text=await stateJson(page);const value=JSON.parse(text);return{tick:value.tick,tickUnchanged:value.tick===state.tick,rawStateExact:text===JSON.stringify(state),presentationSha256:sha(text),presentationExact:text===expected,historyExact:JSON.stringify(value.history)===JSON.stringify(state.history),traceExact:JSON.stringify(value.trace)===JSON.stringify(state.trace)};};
   row.initial=await verify();
   if(!row.initial.tickUnchanged||!row.initial.historyExact||!row.initial.traceExact||!row.initial.presentationExact)throw new Error('Initial presentation invariant failed');
   for(let i=0;i<8;i+=1){let clicked=false;for(const selector of ['.season-ledger-resume','.story-modal-later','.results-card-continue']){if(await visible(page,selector)){await page.locator(`${selector}:visible`).first().click();row.actions.push(selector);await page.waitForTimeout(150);clicked=true;break;}}if(!clicked)break;}
   if(!adviceAttempted){
    adviceAttempted=true;const selector='[data-dock="steward"]';row.hudAdvice={selector,present:await visible(page,selector),scope:'HUD advice bubble, not a seasonal handling report'};
    if(row.hudAdvice.present){await page.locator(`${selector}:visible`).click();row.actions.push(selector);await page.waitForTimeout(150);row.hudAdvice.text=await page.locator('.steward-bubble:visible').allInnerTexts();row.hudAdvice.screenshot=`${job.id}-hud-advice.png`;await page.screenshot({path:`${out}/${row.hudAdvice.screenshot}`});}
   }
   await page.keyboard.press('KeyC');row.actions.push('KeyC manual chronicle');
   await page.locator('.chronicle-screen:visible').waitFor({timeout:10000});
   await page.getByRole('button',{name:/^중요도:/}).click();
   await page.getByRole('option',{name:'모든 기록',exact:true}).click();row.actions.push('중요도 → 모든 기록');
   await page.waitForTimeout(150);row.severityControl=await page.getByRole('button',{name:/^중요도:/}).getAttribute('aria-label');
   for(const label of [/^부터:/,/^까지:/]){
    await page.getByRole('button',{name:label}).click();
    await page.getByRole('option',{name:String(job.year),exact:true}).click();
    row.actions.push(`${label.source} → ${job.year}`);await page.waitForTimeout(100);
   }
   row.yearFilter={expected:job.year,from:await page.locator('.chronicle-screen').getAttribute('data-from-year'),to:await page.locator('.chronicle-screen').getAttribute('data-to-year')};
   if(row.yearFilter.from!==String(job.year)||row.yearFilter.to!==String(job.year))throw new Error('Actual chronicle year filter mismatch');
   const selector=`.chronicle-card[data-record="${job.id}"] .chronicle-card-body`;const list=page.locator('.chronicle-list:visible');
   await list.evaluate(el=>{el.scrollTop=0;});row.found=false;
   for(let scroll=0;scroll<500;scroll+=1){
    await page.waitForTimeout(40);
    if(await visible(page,selector)){await page.locator(selector).click();row.actions.push(selector);row.found=true;row.scrollSteps=scroll;break;}
    const moved=await list.evaluate(el=>{const before=el.scrollTop;el.scrollTop+=Math.max(100,el.clientHeight-100);return el.scrollTop!==before;});if(!moved)break;
   }
   await page.waitForTimeout(150);
   row.selected=await page.locator('.chronicle-card[data-selected="true"]').evaluateAll(nodes=>nodes.map(el=>({id:el.getAttribute('data-record'),text:el.innerText})));
   row.exactSelected=row.selected.some(item=>item.id===job.id);
   row.detailText=await page.locator('.chronicle-detail').innerText();
   row.threadText=await page.locator('.chronicle-thread').allInnerTexts();
   row.screenshot=`${job.id}-chronicle.png`;await page.screenshot({path:`${out}/${row.screenshot}`});
   row.final=await verify();
   if(!row.found||!row.exactSelected)row.errors.push('Exact steward history record not selected through actual UI');
   if(!row.final.tickUnchanged||!row.final.historyExact||!row.final.traceExact||!row.final.presentationExact)row.errors.push('Final presentation invariant failed');
  }catch(error){row.errors.push(String(error));}
  finally{if(context)await context.close();}
  result.cases.push(row);writeFileSync(`${out}/results.json`,JSON.stringify(result,null,2));
 }
}finally{await browser.close();}
if(result.cases.some(row=>row.errors.length>0))process.exitCode=1;
JS
