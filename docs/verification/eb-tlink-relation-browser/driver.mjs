import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { encodeSave,decodeSave } from '../src/save/saveCodec.ts';
import { loadChromium,openScene } from '../scripts/renderCommitProbe.mjs';
assert.equal(process.platform,'linux');
const out='.remote/tlink-relation-browser';mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const artifact=(name,bytes)=>{writeFileSync(`${out}/${name}`,bytes);return {path:name,bytes:bytes.length,sha256:sha(bytes)};};
const result={pass:false,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),driver:artifact('driver.mjs',readFileSync(new URL(import.meta.url))),errors:[],limits:['Prepared consumed fixture from actual reducers and seasonal advance; no natural 125-year or income-causality claim.']};
let browser,page;
try{
 assert.equal(result.source,process.env.TLINK_EXPECTED_SOURCE,'source pin');
 assert.equal(result.dirty,'','clean committed source required');
 const fixture='fixtures/saves/v56/eb-tlink-estate-relation-consumed.save.json';
 const bytes=readFileSync(fixture);assert.equal(sha(bytes),process.env.TLINK_EXPECTED_FIXTURE_SHA,'fixture pin');
 const state=decodeSave(bytes).envelope.state;
 result.fixture={path:fixture,bytes:bytes.length,sha256:sha(bytes)};
 const candidates=(state.history?.records??[]).flatMap(record=>(record.because??[]).filter(cause=>record.template==='stewardship.season'&&cause.key==='estate_mood').map(cause=>({record,cause})));
 assert.equal(candidates.length,1,'fixture must contain one unambiguous consumed relationship link');
 const {record:receipt,cause}=candidates[0];
 const contribution=state.trace?.answers?.find(row=>row.id===cause.decisionId);assert.ok(contribution);
 const ownRecord=state.history.records.find(row=>row.id===contribution.id);assert.ok(ownRecord);
 const evidence=contribution.estateRelationEvidence?.filter(row=>row.status==='consumed'&&row.estateId===receipt.params.traceEstate);
 assert.ok(evidence?.length);assert.ok(receipt.tick>ownRecord.tick);assert.equal(cause.part,true);
 assert.equal(ownRecord.params.command,'answer_estate_petition');
 assert.ok(contribution.targets.includes('estate:'+receipt.params.traceEstate));
 result.ownId=ownRecord.id;result.resultId=receipt.id;result.answerTick=ownRecord.tick;result.resultTick=receipt.tick;
 result.ownRecord=ownRecord;result.receipt=receipt;result.evidence=evidence;result.historyNextOrdinal=state.history.nextOrdinal;
 const save=encodeSave({state,createdAt:'2026-10-10T00:00:00Z',savedAt:'2026-10-10T00:00:00Z'});assert.deepEqual(decodeSave(save.bytes).envelope.state,state);
 result.saveRoundtrip=true;result.save=artifact('prepared.save.json.gz',gzipSync(save.bytes,{level:9}));result.saveSHA256=sha(save.bytes);
 const chromium=await loadChromium();browser=await chromium.launch({channel:'chrome',headless:true});const seat=state.buildings.find(b=>b.kind==='manor_house')??state.buildings[0];
 const scene=await openScene(browser,{state,tile:[seat.tx,seat.ty],baseUrl:process.env.TLINK_URL,run:false,width:1280,height:800,query:'&story-delay=3000',loadTimeout:90000,initScript:`globalThis.__name=globalThis.__name||(target=>target);localStorage.setItem('feudal-lord-simulator:tutorial:v1',JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));`});page=scene.page;page.on('pageerror',e=>result.errors.push(String(e)));
 result.dismissed=[];
 for(let i=0;i<10;i++){let dismissed=false;for(const selector of ['.story-modal-later','.results-card-continue','.season-ledger-resume','.chronicle-close']){const button=page.locator(`${selector}:visible`);if(await button.count()){await button.first().click();result.dismissed.push(selector);dismissed=true;break;}}if(!dismissed)break;await page.waitForTimeout(150);}
 const fullChronicle=page.getByRole('button',{name:'전체 연대기 보기',exact:true});
 if(await fullChronicle.isVisible()){await fullChronicle.click();result.chronicleAdmission='chapter full chronicle button';}
 else {await page.keyboard.press('KeyC');result.chronicleAdmission='C shortcut';}
 if(!await page.locator('.chronicle-screen').isVisible()){
   await Promise.race([page.locator('.chronicle-screen').waitFor({timeout:10000}),fullChronicle.waitFor({timeout:10000})]);
   if(await fullChronicle.isVisible()){await fullChronicle.click();result.chronicleAdmission='chapter full chronicle button after story admission';}
 }
 await page.locator('.chronicle-screen').waitFor({timeout:10000});
 const target=page.locator(`.chronicle-card[data-record="${result.ownId}"] .chronicle-card-body`);const list=page.locator('.chronicle-list');
 for(let i=0;i<24&&await target.count()===0;i++){await list.hover();await page.mouse.wheel(0,i===0?-100000:1800);await page.waitForTimeout(150);}await target.click();
 const own=page.locator(`.chronicle-detail-body[data-detail="${result.ownId}"]`);await own.waitFor();result.ownText=await own.innerText();
 const follow=own.locator(`.chronicle-thread-link[data-record="${result.resultId}"]`);await follow.waitFor();result.followText=await follow.innerText();await follow.scrollIntoViewIfNeeded();result.answerScreenshot=artifact('answer-followed.png',await page.screenshot());await follow.click();
 const detail=page.locator(`.chronicle-detail-body[data-detail="${result.resultId}"]`);await detail.waitFor();result.resultText=await detail.innerText();
 assert.ok(result.resultText.includes('앞선 답으로 소작인들과 가까워진 영향이 이번 철에도 남았다'),'visible qualitative retained influence');
 assert.ok(!result.resultText.includes('traceTenantsContribution'),'no implementation metadata');
 const back=detail.locator(`[data-part="because"] .chronicle-thread-link[data-record="${result.ownId}"]`);await back.waitFor();result.becauseText=await back.innerText();await back.scrollIntoViewIfNeeded();result.resultScreenshot=artifact('petition-because.png',await page.screenshot());await back.click();await own.waitFor();result.returnedOwnId=result.ownId;
 await page.setViewportSize({width:390,height:844});
 await follow.waitFor();await follow.scrollIntoViewIfNeeded();result.narrowAnswerText=await own.innerText();
 result.narrowAnswerScreenshot=artifact('answer-followed-390.png',await page.screenshot());
 await follow.click();await detail.waitFor();await back.waitFor();await back.scrollIntoViewIfNeeded();
 result.narrowResultText=await detail.innerText();assert.ok(result.narrowResultText.includes('앞선 답으로 소작인들과 가까워진 영향이 이번 철에도 남았다'));
 result.narrowResultScreenshot=artifact('season-because-390.png',await page.screenshot());
 await back.click();await own.waitFor();result.narrowReturnedOwnId=result.ownId;

 const observed=await page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.state());assert.equal(observed.tick,state.tick);assert.equal(observed.history.nextOrdinal,state.history.nextOrdinal);result.tickUnchanged=true;result.historyOrdinalUnchanged=true;assert.equal(result.errors.length,0);result.pass=true;
}catch(error){result.errors.push(String(error.stack??error));if(page){result.failureText=await page.locator('body').innerText();result.failureScreenshot=artifact('failure.png',await page.screenshot());}}
finally{if(browser)await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({pass:result.pass,errors:result.errors,out}));if(!result.pass)process.exitCode=1;

