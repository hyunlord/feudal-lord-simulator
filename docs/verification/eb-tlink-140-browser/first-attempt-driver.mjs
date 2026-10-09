import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { answer,delegated,linked } from '../tests/helpers/engineBTlinkFixtures.ts';
import { gameReducer } from '../src/state/gameStore.ts';
import { advanceStewardship } from '../src/engine/stewardship.ts';
import { advanceHistory } from '../src/engine/history.ts';
import { advanceTrace } from '../src/engine/decisionTrace.ts';
import { linkRuleAnswerReceipts } from '../src/engine/decisionTraceAnswerReceipts.ts';
import { PRESSURE_BALANCE } from '../src/content/balanceConfig.ts';
import { encodeSave,decodeSave } from '../src/save/saveCodec.ts';
import { loadChromium,openScene } from '../scripts/renderCommitProbe.mjs';
assert.equal(process.platform,'linux');
const out='.remote/tlink-140-browser';mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const artifact=(name,bytes)=>{writeFileSync(`${out}/${name}`,bytes);return {path:name,bytes:bytes.length,sha256:sha(bytes)};};
const result={pass:false,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),driver:artifact('driver.mjs',readFileSync(new URL(import.meta.url))),errors:[],limits:['Prepared actual reducer answer and one actual advanceStewardship seasonal transition; synthetic seasonal boundary, not natural 125-year evidence.']};
let browser,page;
try{
 let base=delegated();const priorIds=[];
 for(let i=0;i<4;i++){base=gameReducer({...base,tick:1000+i},{type:'set_audit_mode',estateId:'delegated-estate',mode:i%2===0?'visit':'accounts'});priorIds.push(base.trace.answers.at(-1).id);}
 const answered=answer({...base,tick:1004},'ck_evt_140','b');
 const before={...answered.after,tick:2*PRESSURE_BALANCE.seasonTicks};
 const actual=advanceStewardship(before),recorded=advanceHistory(before,actual);
 const annotated=linkRuleAnswerReceipts(before,recorded);assert.equal(annotated.history.nextOrdinal,recorded.history.nextOrdinal);assert.deepEqual(annotated.history.records.map(r=>r.id),recorded.history.records.map(r=>r.id));
 const state=advanceTrace(before,recorded);
 const routing=linked(state,answered.ownId,'petition_routed');assert.equal(routing.length,1);const receipt=routing[0];assert.equal(receipt.template,'stewardship.brought');assert.ok(receipt.tick>answered.after.tick);assert.equal(receipt.params.traceEstate,'delegated-estate');
 result.ownId=answered.ownId;result.resultId=receipt.id;result.answerTick=answered.after.tick;result.resultTick=receipt.tick;result.priorIds=priorIds;result.ownRecord=state.history.records.find(r=>r.id===answered.ownId);result.receipt=receipt;result.petition=actual.stewardship.petitions.find(p=>p.id===receipt.params.tracePetition);assert.equal(result.petition.escalated,'direct');
 result.ordinals={before:before.history.nextOrdinal,recorded:recorded.history.nextOrdinal,annotated:annotated.history.nextOrdinal,final:state.history.nextOrdinal};
 const save=encodeSave({state,createdAt:'2026-10-10T00:00:00Z',savedAt:'2026-10-10T00:00:00Z'});assert.deepEqual(decodeSave(save.bytes).envelope.state,state);result.save=artifact('prepared.save.json.gz',gzipSync(save.bytes,{level:9}));result.saveSHA256=sha(save.bytes);
 const chromium=await loadChromium();browser=await chromium.launch({channel:'chrome',headless:true});const seat=state.buildings.find(b=>b.kind==='manor_house')??state.buildings[0];
 const scene=await openScene(browser,{state,tile:[seat.tx,seat.ty],baseUrl:process.env.TLINK_URL,run:false,width:1280,height:800,query:'&story-delay=3000',loadTimeout:90000,initScript:`globalThis.__name=globalThis.__name||(target=>target);localStorage.setItem('feudal-lord-simulator:tutorial:v1',JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));`});page=scene.page;page.on('pageerror',e=>result.errors.push(String(e)));
 result.dismissed=[];
 for(let i=0;i<10;i++){let dismissed=false;for(const selector of ['.story-modal-later','.results-card-continue','.season-ledger-resume','.chronicle-close']){const button=page.locator(`${selector}:visible`);if(await button.count()){await button.first().click();result.dismissed.push(selector);dismissed=true;break;}}if(!dismissed)break;await page.waitForTimeout(150);}
 await page.keyboard.press('KeyC');await page.locator('.chronicle-screen').waitFor({timeout:10000});
 const target=page.locator(`.chronicle-card[data-record="${result.ownId}"] .chronicle-card-body`);const list=page.locator('.chronicle-list');
 for(let i=0;i<24&&await target.count()===0;i++){await list.hover();await page.mouse.wheel(0,i===0?-100000:1800);await page.waitForTimeout(150);}await target.click();
 const own=page.locator(`.chronicle-detail-body[data-detail="${result.ownId}"]`);await own.waitFor();result.ownText=await own.innerText();
 const follow=own.locator(`.chronicle-thread-link[data-record="${result.resultId}"]`);await follow.waitFor();result.followText=await follow.innerText();await follow.scrollIntoViewIfNeeded();result.answerScreenshot=artifact('answer-followed.png',await page.screenshot());await follow.click();
 const detail=page.locator(`.chronicle-detail-body[data-detail="${result.resultId}"]`);await detail.waitFor();result.resultText=await detail.innerText();
 const back=detail.locator(`[data-part="because"] .chronicle-thread-link[data-record="${result.ownId}"]`);await back.waitFor();result.becauseText=await back.innerText();await back.scrollIntoViewIfNeeded();result.resultScreenshot=artifact('petition-because.png',await page.screenshot());await back.click();await own.waitFor();result.returnedOwnId=result.ownId;
 const observed=await page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.state());assert.equal(observed.tick,state.tick);result.tickUnchanged=true;assert.equal(result.errors.length,0);result.pass=true;
}catch(error){result.errors.push(String(error.stack??error));if(page){result.failureText=await page.locator('body').innerText();result.failureScreenshot=artifact('failure.png',await page.screenshot());}}
finally{if(browser)await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({pass:result.pass,errors:result.errors,out}));if(!result.pass)process.exitCode=1;

