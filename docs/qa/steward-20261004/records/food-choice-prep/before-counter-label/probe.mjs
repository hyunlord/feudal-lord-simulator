// Original selection functions over pinned recorded inputs; not a live route or official tick interception.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {bestHouseDemand,nextHouseDemandTile} from '../../src/agents/roamingDemand.ts';
import {houseBreadCapacity} from '../../src/content/houseFoodConfig.ts';
import {BALANCE} from '../../src/content/balanceConfig.ts';
const BASE='output/steward-food-choice-r08',OUT=BASE+'/result';
const HEAD='5fb1aebfe735592c1424c947e88388d4ffe21742';
const INPUT='f5bc425b4c6a763e1beda92fbdb4547ee76bb783ac1e5486ccf55b13436a0203';
const TARGET='construction-site-000023';
const EXPECTED=['distributor:construction-site-000036:299880','distributor:construction-site-000036:300000','distributor:construction-site-000067:299760','distributor:granary-42-37-0:300000'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const hash=x=>sha(JSON.stringify(x));
const write=(name,value)=>writeFileSync(`${OUT}/${name}.json`,JSON.stringify(value,null,2));
const checks=[],rows=[];const calls={bestHouseDemand:0,nextHouseDemandTile:0,advanceTick:0};
function check(name,pass,detail=null){checks.push({name,pass,detail});if(!pass)throw Error(name);}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
function replayPort(savedCalls,label){
 let cursor=0;const seen=[];
 const servicePath=(start,house)=>{
  const expected=savedCalls[cursor];
  check(`${label}:call-${cursor}-exists`,expected!==undefined);
  check(`${label}:call-${cursor}-exact-arguments`,hash([start,house])===hash(expected.arguments));
  check(`${label}:call-${cursor}-defined-result`,expected.undefinedResult===false);
  seen.push({ordinal:cursor,houseId:house.buildingId,argumentsSha256:hash([start,house]),resultSha256:hash(expected.result)});
  cursor++;
  return expected.result;
 };
 // A strict port exposes only the method read by these functions; unexpected reads fail closed.
 const port=new Proxy({servicePath},{get(target,key){if(key!=='servicePath')throw Error(`${label}:unexpected-port-method:${String(key)}`);return target.servicePath;}});
 return {port,finish:()=>{check(`${label}:all-recorded-calls-consumed`,cursor===savedCalls.length,{cursor,expected:savedCalls.length});return seen;}};
}
if(process.platform!=='linux'||!process.cwd().startsWith('/home/hyunlord/fls-runs/')||!process.env.FLS_REMOTE_PORT)throw Error('Official DGX only');
mkdirSync(OUT,{recursive:false});
let status='FAILED';const started=Date.now();
try{
 check('HEAD',execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===HEAD);
 const bytes=readFileSync(BASE+'/stage.json');check('input-sha',sha(bytes)===INPUT);
 const stage=freeze(JSON.parse(bytes.toString('utf8'))),initialHash=hash(stage);
 check('recorded-stage-scope',stage.origin==='reconstructed_stage'&&stage.officialPrefixIntercepted===false&&stage.input.tick===300001);
 check('source-range',BALANCE.DISTRIBUTOR_RANGE===40);
 const selected=stage.walkers.filter(row=>row.actualPortCalls.some(c=>c.method==='servicePath'&&c.arguments[1]?.buildingId===TARGET));
 check('exact-four-records-in-order',hash(selected.map(r=>r.walkerBefore.id))===hash(EXPECTED));
 for(const row of selected){
  const id=row.walkerBefore.id,saved=row.actualPortCalls.filter(c=>c.method==='servicePath');
  check(`${id}:nonempty-path-calls`,saved.length>0);
  const current=saved[0].arguments[0],houses=row.housesAfter;
  check(`${id}:one-current-tile`,saved.every(c=>hash(c.arguments[0])===hash(current)));
  check(`${id}:unique-house-call`,new Set(saved.map(c=>c.arguments[1].buildingId)).size===saved.length);
  check(`${id}:saved-house-arguments-match-post-service-houses`,saved.every(c=>hash(c.arguments[1])===hash(houses.find(h=>h.buildingId===c.arguments[1].buildingId))));
  check(`${id}:roaming-decision`,row.walkerBefore.phase==='roaming'&&row.walkerAfter?.phase==='roaming'&&row.walkerAfter.tilesTravelled===row.walkerBefore.tilesTravelled+1);
  const remainingRange=BALANCE.DISTRIBUTOR_RANGE-row.walkerBefore.tilesTravelled;
  const beforeHash=hash({current,houses,saved,remainingRange});
  const first=replayPort(saved,id+':best');calls.bestHouseDemand++;
  const selectedHouse=bestHouseDemand(current,houses,first.port,remainingRange,1);
  const bestCalls=first.finish();
  const second=replayPort(saved,id+':next');calls.nextHouseDemandTile++;
  const next=nextHouseDemandTile(current,houses,second.port,remainingRange);
  const nextCalls=second.finish();
  check(`${id}:independent-cursors-same-call-sequence`,hash(bestCalls)===hash(nextCalls));
  check(`${id}:next-equals-best-first-step`,hash(next)===hash(selectedHouse?.path[1]??null));
  const actualNext=row.walkerAfter.path[1]??null;
  check(`${id}:recorded-stage-next-tile-equals-replay`,hash(actualNext)===hash(next));
  check(`${id}:immutable-record-inputs`,hash({current,houses,saved,remainingRange})===beforeHash);
  const target=saved.find(c=>c.arguments[1].buildingId===TARGET);
  const targetHouse=target.arguments[1],edges=target.result===null?null:target.result.length-1;
  rows.push({origin:'original_exported_function_on_recorded_input',walkerId:id,current,remainingRangeDerived:remainingRange,minimumEdges:1,replaySelectedHouseId:selectedHouse?.house.buildingId??null,replaySelectedMeals:selectedHouse?.meals??null,replaySelectedPath:selectedHouse?.path??null,replayNextTile:next,recordedReconstructedStageNextTile:actualNext,nextTileEqual:hash(next)===hash(actualNext),directOfficialSelectionObserved:false,targetPredicateEvaluation:{origin:'source_predicate_evaluation_not_observed_branch',breadStock:targetHouse.breadStock,capacityFromOriginalFunction:houseBreadCapacity(targetHouse),pathEdges:edges,stockBelowCapacity:targetHouse.breadStock<houseBreadCapacity(targetHouse),pathPresent:target.result!==null,meetsMinimum:edges!==null&&edges>=1,fitsRemainingRange:edges!==null&&edges<=remainingRange},sameNextTileHouseIds:saved.filter(c=>c.result!==null&&hash(c.result[1]??null)===hash(next)).map(c=>c.arguments[1].buildingId),bestCalls,nextCalls});
 }
 check('exact-call-budget',calls.bestHouseDemand===4&&calls.nextHouseDemandTile===4&&calls.advanceTick===0,calls);
 check('whole-record-input-immutable',hash(stage)===initialHash);
 check('input-file-unchanged',sha(readFileSync(BASE+'/stage.json'))===INPUT);
 status='PASS_RECORDED_INPUT_FUNCTION_REPLAY_ONLY';
}catch(error){write('error',{message:String(error),stack:error?.stack});process.exitCode=1;}
finally{
 write('choices',{head:HEAD,inputSha256:INPUT,rows});
 write('scope',{origin:'recorded_input_function_replay',originalSourceFunctions:true,rankingReimplemented:false,officialTickExecuted:false,liveRouteSearch:false,officialPrefixIntercepted:false,liveChosenHouseIdObserved:false,warning:'Chosen IDs are returned by original functions on saved reconstructed inputs. They are not direct observations of the original official tick. Same next tile is not chosen-house proof.'});
 write('summary',{status,elapsedMs:Date.now()-started,calls,checks,completedRows:rows.length});
}
