import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { delegated, town } from '../tests/helpers/engineBTlinkFixtures.ts';
import { gameReducer } from '../src/state/gameStore.ts';
import { advanceTrace, isBigDecision } from '../src/engine/decisionTrace.ts';
import { estatesOf } from '../src/engine/estates.ts';
import { lordSliceEndTick } from '../src/engine/lordSlice.ts';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig.ts';
import { encodeSave, decodeSave } from '../src/save/saveCodec.ts';
import { loadChromium, openScene } from '../scripts/renderCommitProbe.mjs';
assert.equal(process.platform, 'linux');
const out='.remote/eb-tlink-slice-browser'; mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const artifact=(name,bytes)=>{writeFileSync(`${out}/${name}`,bytes);return {path:name,bytes:bytes.length,sha256:sha(bytes)};};
const result={pass:false,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),driverSHA256:sha(readFileSync(new URL(import.meta.url))),errors:[],limits:['Prepared regression state with actual reducer answers and synthetic end boundary; no natural 125-year claim.','Year answer rows are text, not links; normal end-page chronicle button then own record click tests navigation.']};
let browser,page;
try {
 const base=delegated(); assert.ok(base.stewardship);
 const original=base.stewardship.petitions[0]; assert.ok(original);
 const petitions=['first','second'].map(id=>({...original,id,tick:base.tick,deadline:base.tick+1000,status:'open',escalated:'rights'}));
 const first=gameReducer({...base,stewardship:{...base.stewardship,petitions}},{type:'answer_estate_petition',petitionId:'first',grant:false});
 const after=gameReducer({...first,tick:first.tick+1},{type:'answer_estate_petition',petitionId:'second',grant:false});
 const answers=after.trace.answers; assert.equal(answers.length,2); assert.ok(answers.every(isBigDecision)); assert.equal(answers[0].threadId,answers[1].threadId);
 const slice={...after,scenarioId:LORD_SLICE_SCENARIO_ID,estates:{...after.estates,estates:[...estatesOf(town()).estates,...after.estates.estates]}};
 const ended=advanceTrace(slice,{...slice,tick:lordSliceEndTick(slice)});
 const save=encodeSave({state:ended,createdAt:'2026-10-10T00:00:00Z',savedAt:'2026-10-10T00:00:00Z'});
 const state=decodeSave(save.bytes).envelope.state; assert.deepEqual(state,ended);
 result.save=artifact('prepared-ended.save.json.gz',gzipSync(save.bytes,{level:9}));result.saveSHA256=sha(save.bytes);result.answerIds=answers.map(a=>a.id);result.tick=state.tick;result.saveRoundtrip=true;
 const chromium=await loadChromium(); browser=await chromium.launch({channel:'chrome',headless:true});
 const seat=state.buildings.find(b=>b.kind==='manor_house')??state.buildings[0];
 const scene=await openScene(browser,{state,tile:[seat.tx,seat.ty],baseUrl:process.env.TLINK_URL,run:false,width:1280,height:800,query:'&story-delay=3000',loadTimeout:90000,initScript:`globalThis.__name = globalThis.__name || (target => target); localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] }));`});
 page=scene.page;page.on('pageerror',e=>result.errors.push(String(e)));
 const end=page.locator('.slice-end'); await end.waitFor({timeout:20000});
 result.initial=artifact('slice-initial.png',await page.screenshot());
 const list=page.locator('.slice-year-big [data-record]');assert.deepEqual(await list.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-record'))),result.answerIds);
 const scroll=page.locator('.slice-end .chronicle-page-body');
 const firstRow=list.first();
 for(let i=0;i<20;i++) { const box=await firstRow.boundingBox();if(box&&box.y>=0&&box.y+box.height<740)break; await end.hover();await page.mouse.wheel(0,500);await page.waitForTimeout(150); }
 result.rows=[];
 for(const id of result.answerIds){const row=page.locator(`.slice-year-big [data-record="${id}"]`);const box=await row.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=800,`visible own row ${id}`);result.rows.push({id,box,text:await row.innerText()});}
 result.rowsScreenshot=artifact('slice-own-answers.png',await page.screenshot());
 await page.locator('.slice-chronicle').click();await page.locator('.chronicle-screen').waitFor();
 const target=page.locator(`.chronicle-card[data-record="${result.answerIds[1]}"] .chronicle-card-body`);
 const chronicleList=page.locator('.chronicle-list');
 for(let i=0;i<24&&await target.count()===0;i++){await chronicleList.hover();await page.mouse.wheel(0,i===0?-100000:1800);await page.waitForTimeout(150);}
 await target.click();const detail=page.locator(`.chronicle-detail-body[data-detail="${result.answerIds[1]}"]`);await detail.waitFor();
 result.chronicle={id:result.answerIds[1],text:await detail.innerText(),screenshot:artifact('own-answer-chronicle.png',await page.screenshot())};
 const observed=await page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.state());assert.equal(observed.tick,state.tick);result.tickUnchanged=true;assert.equal(result.errors.length,0);result.pass=true;
} catch(error){result.errors.push(String(error.stack??error));if(page){result.failureText=await page.locator('body').innerText();result.failureScreenshot=artifact('failure.png',await page.screenshot());}}
finally{if(browser)await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({pass:result.pass,errors:result.errors,out}));if(!result.pass)process.exitCode=1;

