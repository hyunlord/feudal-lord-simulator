import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const w=JSON.parse(fs.readFileSync(path.join(dir,'../world/hundred.json'),'utf8'));
const schema=JSON.parse(fs.readFileSync(path.join(dir,'engine-records.schema.json'),'utf8'));
const errors=[],warnings=[];let checks=0;
const check=(ok,msg)=>{checks++;if(!ok)errors.push(msg);};
function validate(v,s,p){
 if(s.$ref)return validate(v,schema.$defs[s.$ref.split('/').at(-1)],p);
 if(s.enum)check(s.enum.includes(v),`${p}: enum ${JSON.stringify(v)}`);
 if(s.type){const ts=Array.isArray(s.type)?s.type:[s.type];const typ=v===null?'null':Array.isArray(v)?'array':typeof v;check(ts.some(t=>t===typ||(t==='integer'&&Number.isInteger(v))),`${p}: type ${ts}`);}
 if(typeof v==='number'){check(Number.isFinite(v),`${p}: nonfinite`);if(s.minimum!==undefined)check(v>=s.minimum,`${p}: below minimum`);if(s.maximum!==undefined)check(v<=s.maximum,`${p}: above maximum`);}
 if(s.type==='object'&&v&&typeof v==='object'&&!Array.isArray(v)){for(const k of s.required||[])check(k in v,`${p}.${k}: required`);for(const[k,x]of Object.entries(v)){if(s.properties?.[k])validate(x,s.properties[k],`${p}.${k}`);else if(s.additionalProperties===false)check(false,`${p}.${k}: extra field`);else if(s.additionalProperties&&typeof s.additionalProperties==='object')validate(x,s.additionalProperties,`${p}.${k}`);}}
 if(s.type==='array'&&Array.isArray(v))v.forEach((x,i)=>validate(x,s.items,`${p}[${i}]`));
}
for(const[k,def]of Object.entries({persons:'PersonState',estates:'EstatesState',factions:'FactionState'}))validate(w.engine[k],schema.$defs[def],`engine.${k}`);
w.engine.stewards.forEach((v,i)=>validate(v,schema.$defs.StewardRecord,`engine.stewards[${i}]`));
const d=w.engine.diplomacy;check(Object.keys(d).sort().join(',')==='negotiations,nextNegotiation,nextPromise,promises,relations','opening diplomacy exact keys');check(d.negotiations.length===0&&d.promises.length===0,'opening diplomacy is empty');check(d.nextNegotiation===1&&d.nextPromise===1,'opening diplomacy counters');check(Object.values(d.relations).every(v=>Number.isFinite(v)&&v>=-100&&v<=100),'diplomacy relations range');
const all=[...w.engine.persons.people,...w.engine.persons.past,...w.engine.estates.people,...w.engine.factions.people];
const people=new Map(all.map(p=>[p.id,p]));check(people.size===all.length,'global unique person IDs');
const estates=new Map(w.engine.estates.estates.map(e=>[e.id,e]));check(estates.size===w.engine.estates.estates.length,'unique estate IDs');
const pieces=new Map();for(const e of estates.values())for(const r of e.pieces){check(!pieces.has(r.id),`unique piece ${r.id}`);pieces.set(r.id,e.id);}
const houses=new Map(w.proposals.houses.map(h=>[h.id,h]));const profiles=new Map(w.proposals.personProfiles.map(p=>[p.id,p]));
const factions=new Set(w.engine.factions.factions.map(f=>f.id));
const holder=(h,p)=>{if(h.startsWith('person:'))check(people.has(h.slice(7)),`${p}: unknown person holder ${h}`);else if(h.startsWith('estate:'))check(estates.has(h.slice(7)),`${p}: unknown estate holder ${h}`);else check(['lord','merchants','townsfolk',...factions].includes(h)||/^house:\d+$/.test(h),`${p}: unknown holder ${h}`);};
const lines=new Set((w.engine.persons.lineages||[]).map(l=>l.id));
for(const p of all){check(p.birthYear<=1300,`${p.id}: unborn at1300`);if(p.deathYear!==undefined)check(p.deathYear>=p.birthYear&&p.deathYear<=1300&&!p.alive,`${p.id}: death chronology`);
 for(const key of ['fatherId','motherId','godparentId'])if(p[key]){check(people.has(p[key]),`${p.id}.${key}: missing`);const q=people.get(p[key]);if(q&&key!=='godparentId'){check(q.birthYear<=p.birthYear-12,`${p.id}.${key}: implausible generation`);check(q.sex===(key==='fatherId'?'male':'female'),`${p.id}.${key}: sex`);check(q.deathYear===undefined||q.deathYear>=p.birthYear-(key==='fatherId'?1:0),`${p.id}.${key}: dead before conception/birth`);}}
 for(const tag of p.tags.filter(t=>t.startsWith('spouse-of:')))check(people.has(tag.slice(10)),`${p.id}: missing spouse`);
 if(p.lineageId==='')check(profiles.get(p.id)?.isInstitution===true,`${p.id}: empty lineage only explicit institution profile`);else check(lines.has(p.lineageId),`${p.id}: unknown lineage ${p.lineageId}`);
 const pr=profiles.get(p.id);check(!!pr,`${p.id}: missing profile`);if(pr){check(p.alive ? pr.age1300===1300-p.birthYear : pr.age1300===null,`${p.id}: age mismatch`);check(pr.age===(p.deathYear??1300)-p.birthYear,`${p.id}: age/death-age mismatch`);check(Object.values(pr.abilities).every(v=>Number.isFinite(v)&&v>=0&&v<=100),`${p.id}: abilities range`);}
}
for(const l of w.engine.persons.lineages||[]){check(l.since===0,`${l.id}: initial registration tick should be0`);for(const id of Object.values(l.slots))check(people.has(id),`${l.id}: missing slot person`);}
for(const e of estates.values()){for(const key of ['titleHolder','possessor','lifeTenant','remainder','patron','steward'])if(e[key])holder(e[key],`${e.id}.${key}`);check(e.annualValue===e.pieces.reduce((a,p)=>a+p.annualValue,0),`${e.id}: pieces/gross sum`);if(e.house){check(people.has(e.house.lordId),`${e.id}: missing head`);for(const id of e.house.familyIds)check(people.has(id),`${e.id}: missing family ${id}`);}for(const r of e.pieces){for(const key of ['titleHolder','possessor','lifeTenant','remainder'])if(r[key])holder(r[key],`${r.id}.${key}`);}}
const claims=new Set(w.engine.estates.claims.map(c=>c.id));for(const c of w.engine.estates.claims){holder(c.claimant,c.id);check(estates.has(c.estateId),`${c.id}: estate`);if(c.pieceId)check(pieces.get(c.pieceId)===c.estateId,`${c.id}: piece belongs to estate`);}
for(const s of w.engine.estates.suits){check(claims.has(s.claimId),`${s.id}: claim`);check(estates.has(s.estateId),`${s.id}: estate`);holder(s.plaintiff,s.id);holder(s.defendant,s.id);}
for(const s of w.engine.stewards){check(people.has(s.personId),`steward missing ${s.personId}`);check(estates.has(s.estateId),`steward estate ${s.estateId}`);}
for(const f of w.engine.factions.factions)if(f.leaderId)check(people.has(f.leaderId),`faction ${f.id} leader`);
for(const f of w.proposals.finances){const loans=w.proposals.loans.filter(l=>l.debtorHouseId===f.houseId);check(loans.every(l=>f.loanIds.includes(l.id)),`${f.houseId}: debts indexed`);check(w.proposals.loans.filter(l=>l.creditorHouseId===f.houseId).every(l=>f.receivableLoanIds.includes(l.id)),`${f.houseId}: receivables indexed`);const e=[...estates.values()].find(e=>e.id===(f.houseId==='h01'?'estate-home':`estate-${f.houseId}`));if(e){check(e.burdens.debt===loans.reduce((a,l)=>a+l.principalD,0),`${f.houseId}: debt stock sum`);check(f.annualGrossD===e.annualValue,`${f.houseId}: gross`);check(f.annualFixedCostD===e.burdens.rentCharges+e.burdens.repairs,`${f.houseId}: fixed flows exclude loan principal`);}}
for(const l of w.proposals.loans){check(houses.has(l.debtorHouseId)&&houses.has(l.creditorHouseId),`${l.id}: house refs`);check(l.principalD>=0&&Number.isInteger(l.principalD),`${l.id}: principal`);for(const id of l.collateralPieceIds)check(pieces.has(id),`${l.id}: collateral`);}
for(const a of w.proposals.annuities)check(houses.has(a.payerHouseId)&&houses.has(a.payeeHouseId),`${a.id}: house refs`);
for(const r of w.proposals.relations){check(houses.has(r.fromHouseId)&&houses.has(r.toHouseId),`${r.id}: house refs`);for(const id of r.personIds)check(people.has(id),`${r.id}: person refs`);}
warnings.push('기관 lineageId 빈 문자열은 string 타입상 허용하며 기관의 생물학적 혈통을 만들지 않기 위한 저작 선택이다. 기존 엔진의 일반 초기화 관행으로 확인되지 않았으므로 NF02/NF07 importer 정책 필요.');
warnings.push('검증은 타입 하위집합과 참조·초기연대·재정 stock/flow이다. 게임 저장 로드나150년 실제엔진 실행 검증이 아니다.');
const report={status:errors.length?'FAIL':'PASS',checks,counts:{persons:all.length,estates:estates.size,pieces:pieces.size,claims:claims.size,stewards:w.engine.stewards.length},errors,warnings};fs.writeFileSync(path.join(dir,'native-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
