import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {renderLedgerCandidate} from './money-slot-adapter.mjs';
const repo=process.argv[2];
assert.ok(repo, 'source repository argument required');
const candidatePath=new URL('./variants.ko.json',import.meta.url);
const candidate=JSON.parse(readFileSync(candidatePath,'utf8'));
const snapshot=JSON.parse(readFileSync(new URL('./SOURCE_SNAPSHOT.json',import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const formatterPath=`${repo}/src/ledger/moneyWords.ko.ts`;
assert.equal(digest(readFileSync(formatterPath)),snapshot['src/ledger/moneyWords.ko.ts']);
const formatters=await import(pathToFileURL(formatterPath).href);
function decode(text){
 const sign=text.startsWith('−')?-1:1;
 const pounds=Number((text.match(/£([\d,]+)/)?.[1]??'0').replaceAll(',',''));
 return sign*(pounds*240+Number(text.match(/(\d+)s/)?.[1]??0)*12+Number(text.match(/(\d+)d/)?.[1]??0));
}
const rows=[];
const values=[-38447,-479,-399,-253,-241,-240,-239,-12,-1,0,1,12,239,240,241,253,399,479,38447];
for(const row of candidate.ledgerCategories){
 for(const amount of values){
  const result=renderLedgerCandidate(candidate,{category:row.category,account:'cash',amount},formatters);
  assert.equal(result.status,'rendered');
  assert.equal(result.variant,`${row.category}.${amount>0?'cash_in':amount<0?'cash_out':'other'}`);
  assert.equal(decode(result.moneyDisplay),amount<0?Math.abs(amount):amount);
  assert.equal(result.rawAmountPennies,amount);
  assert.ok(!/\{\w+\}/.test(result.text));
  rows.push({account:'cash',category:row.category,amount,...result});
 }
 for(const account of ['restricted','arrears']) for(const amount of [-253,0,253]){
  const result=renderLedgerCandidate(candidate,{category:row.category,account,amount},formatters);
  assert.equal(result.status,'rendered');assert.equal(decode(result.moneyDisplay),amount);
  assert.ok(!result.text.includes('금고에')&&!result.text.includes('금고에서'));
  rows.push({account,category:row.category,amount,...result});
 }
}
let blockedInKind=0;
for(const row of candidate.ledgerCategories){
 const entry={account:'in_kind',category:row.category,amount:-253,resource:row.category==='famine_relief'?'bread':'fleece',sourceRefs:row.category==='famine_relief'?[{type:'building',id:'fixture',detail:'bread:7'}]:[{type:'claim',id:'wool_levy',detail:'fleece:7'}]};
 const result=renderLedgerCandidate(candidate,entry,formatters);
 if(['famine_relief','wool_levy'].includes(row.category)){
  assert.equal(result.status,'rendered');assert.equal(result.verifiedQuantity,7);assert.equal(decode(result.moneyDisplay),-253);assert.ok(result.text.includes('평가액'));
  rows.push({...entry,...result});
 }else{assert.equal(result.status,'blocked');blockedInKind++;}
}
assert.equal(blockedInKind,44);
const quantityFailures=[];
for(const category of ['famine_relief','wool_levy']){
 const resource=category==='famine_relief'?'bread':'fleece';
 const ref={type:category==='famine_relief'?'building':'claim',id:category==='famine_relief'?'fixture':'wool_levy',detail:`${resource}:7`};
 for(const patch of [{sourceRefs:[]},{sourceRefs:[ref,ref]},{resource:'timber'},{sourceRefs:[{...ref,detail:`${resource}:0`}]},{sourceRefs:[{...ref,type:'other'}]}]){
  const entry={category,account:'in_kind',amount:-253,resource,sourceRefs:[ref],...patch};
  const result=renderLedgerCandidate(candidate,entry,formatters);
  assert.equal(result.status,'quantity_unknown');assert.ok(result.text.includes('수량 미확인'));assert.equal(result.rawAmountPennies,-253);quantityFailures.push({entry,...result});
 }
}
for(const amount of [NaN,Infinity,-Infinity,1.5,Number.MAX_SAFE_INTEGER+1]) assert.equal(renderLedgerCandidate(candidate,{account:'cash',category:'rent',amount},formatters).status,'invalid_amount');
assert.equal(renderLedgerCandidate(candidate,{account:'cash',category:'unknown',amount:253},formatters).status,'unknown_category');
const ids=[...new Set(rows.map(r=>r.variant))].sort();
const expected=candidate.ledgerCategories.flatMap(r=>r.variants).filter(v=>/\{amount(?:Abs|Signed)?Exact\}/.test(v.text)).map(v=>v.id).sort();
assert.deepEqual(ids,expected);assert.equal(ids.length,142);
const cashIds=[...new Set(rows.filter(r=>r.account==='cash').map(r=>r.variant))];assert.equal(cashIds.length,138);
assert.ok(rows.some(r=>r.amount===253&&r.moneyDisplay==='+£1 1s 1d'));
const result={status:'pass_pure_candidate_money_adapter_no_engine_no_ui',sourceHead:candidate.sourceHead,candidateSha256:digest(readFileSync(candidatePath)),formatterSha256:snapshot['src/ledger/moneyWords.ko.ts'],renderedRows:rows.length,cashVariantIds:cashIds.length,uniqueMoneyVariantIds:ids.length,uniqueMoneyVariantIdList:ids,blockedInKindCategories:blockedInKind,quantityFailureCases:quantityFailures.length,invalidAmountCases:5,unknownCategoryCases:1,engineExecuted:false,browserExecuted:false,fixturesAreSynthetic:true,rows,quantityFailures};
writeFileSync(new URL('./MONEY_ADAPTER_VALIDATION.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined,quantityFailures:undefined,uniqueMoneyVariantIdList:undefined}));
