import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const roster=read('records/roster.json'),catalog=read('records/portrait-catalog.json').assets;
const all=roster.houses.flatMap(h=>h.persons.map(p=>({...p,houseId:h.id,isInstitution:h.isInstitution})));
const idMap=Object.fromEntries(all.map((p,i)=>[p.id,`p${String(i+1).padStart(4,'0')}`]));
const byId=Object.fromEntries(all.map(p=>[p.id,p]));
const estateId=h=>h==='h01'?'estate-home':`estate-${h}`;
const holder=h=>h==='h01'?'lord':`estate:${estateId(h)}`;
const pid=p=>idMap[p];
const familyClass=p=>p.isInstitution?'clerical':['h12','h13'].includes(p.houseId)?'merchant':'gentry';
const isStaff=p=>p.id.endsWith('steward')||p.id.endsWith('retainer');
const used=new Map(),bindings=[];
function matching(p,a,relaxAge=false){
 const sex=a.sex==='m'?'male':a.sex==='f'?'female':a.sex;
 if(sex!==p.sex)return false;
 if(['I104','I106'].includes(a.identity))return false;
 if(isStaff(p)&&/apron|habit|clerical|monastic|municipal chain|parish servant/i.test(a.clothing||''))return false;
 const age=p.alive?1300-p.birthYear:p.deathYear-p.birthYear;
 if(!relaxAge&&Math.abs(Number(a.age)-age)>(age<18?4:10))return false;
 if(age<16&&Number(a.age)>=18)return false;
 const ermine=a.lineage==='L6'||a.furType==='ermine'||/ermine/i.test(a.clothing||'');
 if(p.houseId!=='h18'&&ermine)return false;
 if(p.id==='h10-head')return a.identity==='I113';
 if(p.id==='h11-head')return a.identity==='I111';
 if(p.isInstitution&&!isStaff(p))return a.identity===(p.houseId==='h10'?'I113':'I111');
 if(isStaff(p))return !ermine&&(p.id.endsWith('steward')?['I123','I124'].includes(a.identity)||['artisan','merchant','clerical'].includes(a.socialClass)||a.lineage==='L5':['gentry','artisan'].includes(a.socialClass)||['L2','L5','L7'].includes(a.lineage));
 if(p.houseId==='h18')return a.lineage==='L6'||['I101','I102','I103'].includes(a.identity);
 if(familyClass(p)==='merchant')return a.socialClass==='merchant'||a.lineage==='L4';
 return a.socialClass==='gentry'||['L1','L2','L3','L7'].includes(a.lineage);
}
const priority=[...all].sort((a,b)=>Number(b.id.endsWith('head'))-Number(a.id.endsWith('head'))||Number(b.alive)-Number(a.alive)||a.id.localeCompare(b.id));
for(const p of priority){
 const age=p.alive?1300-p.birthYear:p.deathYear-p.birthYear;
 let pool=catalog.filter(a=>matching(p,a));
 const ageFallback=pool.length===0;
 if(ageFallback)pool=catalog.filter(a=>matching(p,a,true));
 if(p.id==='h01-head')pool=catalog.filter(a=>a.id==='L3_101_mature');
 const score=a=>Math.abs(Number(a.age)-age)+(a.collection.includes('costume-v2')?-2:0)+(a.collection.includes('pilot')?4:0);
 pool.sort((a,b)=>score(a)-score(b)||a.path.localeCompare(b.path));
 const a=pool.find(a=>!used.has(a.identity))||pool[0];
 if(!a)throw Error(`No age/costume compatible fallback for ${p.id}`);
 const reused=used.get(a.identity);used.set(a.identity,reused||p.id);
 bindings.push({personId:pid(p.id),authorId:p.id,portraitId:a.id,identity:a.identity,path:a.path,sha256:a.sha256,sourceAge:Number(a.age),depictedAge:age,sourceSex:a.sex,sourceLineage:a.lineage,sourceParentIdentities:[a.father,a.mother].filter(Boolean),clothing:a.clothing,status:(reused||ageFallback)?'temporary_duplicate_needs_new_face':'candidate_existing',duplicateOf:reused?pid(reused):null,needsNewPortrait:!!reused||ageFallback,reason:ageFallback?"적합 연령대가 없어 같은 성별·복식의 임시 대역. 해당 나이 신규 얼굴 필요.":reused?'독립 인물의 동일 얼굴 중복을 피하려면 신규 초상 필요. 현 연결은 검수용 임시 대역.':'성별·연령·복식 조건에 맞는 기존 초상 후보. 새 가계와 원화 혈통의 유전 정합은 미검증.',ageChain:catalog.filter(x=>x.identity===a.identity).map(x=>({id:x.id,age:Number(x.age),path:x.path})).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i)});
}
const bindingById=Object.fromEntries(bindings.map(b=>[b.authorId,b]));
const people=all.map((p,i)=>{
 const parents=p.parentIds.map(id=>byId[id]);
 const role=p.id.endsWith('head')?'head':p.id.endsWith('spouse')?'spouse':p.id.endsWith('steward')?'steward':p.generation===3?'child':'kin';
 const appearance={hair:['brown','dark_brown','chestnut','auburn'][i%4],skin:i%4,eye:['hazel','grey','brown','blue'][i%4],faceShape:['long','round','square','pointed'][i%4],nose:['straight','hooked','snub','bulbous'][i%4],buildBias:['average','thin','heavy'][i%3]};
 const tags=[`world-house:${p.houseId}`,`authored-id:${p.id}`];
 if(p.spouseId)tags.push(`spouse-of:${pid(p.spouseId)}`);
 if(p.houseId==='h01'&&!isStaff(p))tags.push('lord-family','lord-house:1');
 return {id:pid(p.id),givenName:p.nameEn.split(' ')[0],surname:p.nameEn.split(' ').slice(1).join(' '),sex:p.sex,birthYear:p.birthYear,householdId:p.houseId==='h01'?'manor':`world-household:${p.houseId}`,role,classBand:isStaff(p)?'artisan':familyClass(p),occupation:p.role,build:appearance.buildBias,hair:appearance.hair,alive:p.alive,...(!p.alive?{deathYear:p.deathYear,deathCause:'age'}:{}),portraitIdentity:bindingById[p.id].identity,tags,lineageId:p.isInstitution?'':`lineage:${p.houseId}`,traits:appearance,...(parents.find(q=>q.sex==='male')?{fatherId:pid(parents.find(q=>q.sex==='male').id)}:{}),...(parents.find(q=>q.sex==='female')?{motherId:pid(parents.find(q=>q.sex==='female').id)}:{})};
});
const weights=[['land_rent',50,'manor_court',10,'market',20,'tolls',10,'mill',10],['land_rent',75,'manor_court',10,'fishery',15],['land_rent',65,'manor_court',10,'mill',25],['land_rent',85,'manor_court',15,'advowson',0],['land_rent',80,'manor_court',10,'fishery',10],['land_rent',80,'manor_court',10,'mill',10],['land_rent',60,'manor_court',10,'tolls',30,'advowson',0],['land_rent',70,'manor_court',10,'tolls',20],['land_rent',85,'manor_court',15],['land_rent',75,'manor_court',10,'fishery',15,'advowson',0],['land_rent',80,'manor_court',10,'mill',10,'advowson',0],['land_rent',85,'tolls',15],['land_rent',70,'mill',30],['land_rent',85,'manor_court',15,'advowson',0],['land_rent',75,'manor_court',10,'hunting',15],['land_rent',85,'manor_court',15],['land_rent',70,'mill',30],['land_rent',65,'manor_court',10,'tolls',15,'hunting',10]];
const estates=roster.houses.map((h,i)=>{
 const pieces=[];for(let j=0;j<weights[i].length;j+=2){const kind=weights[i][j];pieces.push({id:`${h.id==='h01'?'home':h.id}:${kind}`,kind,annualValue:Math.round(h.annualGrossPounds*240*weights[i][j+1]/100),titleHolder:holder(h.id),possessor:holder(h.id),possessedSince:0});}
 if(h.id==='h14'){pieces[0].possessor=holder('h02');pieces[0].loss='seized';}
 const e={id:estateId(h.id),name:h.estateNameKo,kind:['h01','h12'].includes(h.id)?'market_town':h.id==='h13'?'mill_estate':'manor',manors:['h12','h13','h17'].includes(h.id)?0:h.id==='h18'?2:1,annualValue:pieces.reduce((s,p)=>s+p.annualValue,0),burdens:{debt:h.debtPounds*240,rentCharges:(h.annualBurdenPounds-3)*240,repairs:720},pieces,titleHolder:holder(h.id),possessor:holder(h.id),titleStrength:80,possessionStrength:h.id==='h14'?45:80,offMap:h.id!=='h01',steward:`person:${pid(`${h.id}-steward`)}`,...(h.patronHouseId&&h.patronHouseId!==h.id?{patron:holder(h.patronHouseId)}:{})};
 if(!h.isInstitution&&!['h12','h13','h18'].includes(h.id))e.house={name:h.nameKo,lordId:pid(`${h.id}-head`),familyIds:h.persons.filter(p=>!isStaff(p)).map(p=>pid(p.id)),rank:h.rank.includes('기사')?'knight':'gentry'};
 return e;
});
const claims=[['h12','h07','tolls','purchase_deed',65],['h04','h03','mill','grant',45],['h14','h14','land_rent','old_possession',75]].map((a,i)=>({id:`claim-${i+1}`,claimant:holder(a[0]),estateId:estateId(a[1]),pieceId:`${a[1]}:${a[2]}`,basis:a[3],strength:a[4],evidence:[{kind:i===0?'deed':i===1?'charter':'court_roll',weight:25,tick:0}],since:0,status:'open'}));
const profiles=all.map(p=>({...p,id:pid(p.id),authorId:p.id,personalityTraits:p.traits,abilities:Object.fromEntries(Object.entries(p.abilities).map(([k,v])=>[k,v*10])),abilityBasis:'게임 추정 0~100. 원작가 0~10값을 10배 변환.',parentIds:p.parentIds.map(pid),spouseId:p.spouseId?pid(p.spouseId):null,portrait:bindingById[p.id],traits:undefined}));
const houses=roster.houses.map(h=>({...h,persons:undefined,personIds:h.persons.map(p=>pid(p.id)),headId:pid(`${h.id}-head`),stewardId:pid(`${h.id}-steward`),retainerIds:[pid(`${h.id}-retainer`)],estateIds:[estateId(h.id)],holderId:holder(h.id)}));
const loans=houses.filter(h=>h.debtPounds>0).map(h=>({id:`loan-${h.id}`,debtorHouseId:h.id,creditorHouseId:h.creditorHouseId,principalD:h.debtPounds*240,annualScheduledPrincipalD:Math.ceil(h.debtPounds*240/5),termYears:5,collateralPieceIds:[],interestD:0,basis:'게임 추정. 1300년 개시 전 사인간 증서 채무. 이자는 기록 없음; 무조건 현대 담보대출로 간주하지 않음.'}));
const annuities=houses.filter(h=>h.annuityPounds>0).map(h=>({id:`annuity-${h.id}`,payerHouseId:h.id,payeeHouseId:h.annuityRecipientHouseId,annualD:h.annuityPounds*240,purpose:'가문간 봉사·기존 화해의 정기 지급',includedInRentCharges:true}));
const relations=houses.flatMap(h=>h.relations.map((r,i)=>({id:`relation-${h.id}-${i+1}`,fromHouseId:h.id,toHouseId:r.targetHouseId,type:r.type,score:r.score,reasons:[{year:1297+i,delta:r.score,text:r.reason}],personIds:(r.personIds||[]).map(pid)})));
for(const h of houses){if(h.patronHouseId&&h.patronHouseId!==h.id)relations.push({id:`patron-${h.id}`,fromHouseId:h.id,toHouseId:h.patronHouseId,type:'patronage',score:15,reasons:[{year:1299,delta:15,text:'법정 출석·소개·보호를 기대하는 기존 후원 관계; 재산 소유와 별개'}],personIds:[]});}
const factions=[['overlord','overlord','h18'],['crown','crown',null],['neighbour_1','neighbour','h02'],['neighbour_2','neighbour','h03'],['bishop','church','h11'],['merchant_house_1','merchant_house','h12'],['merchant_house_2','merchant_house','h13'],['town','town',null],['commons','commons',null]].map(([id,kind,h],i)=>({id,kind,name:h?houses.find(x=>x.id===h).nameKo:({crown:'왕실',town:'도시 공동체',commons:'농민 공동체'})[id],leaderId:h?pid(`${h}-head`):null,heraldrySeed:100+i,relation:0,memory:[],timeline:[]}));
const world={schemaVersion:'ck-neighbor-authoring-1',status:'candidate_not_runtime_save',meta:{titleKo:'인장과 가문 — 이웃 세계',hundred:roster.hundred,startYear:1300,endYear:1450,sourceCommit:'618c5ec28b2c191e85e0b448da7e0739660ad88a',moneyUnit:'integer_penny_d',pencePerPound:240,ticksPerYear:4000,yearZero:1300,allEconomicValues:'게임 추정 초기 평가액. 개인 가문별 전 재산이 아닌 이 고을 권리 묶음.',count:{groups:18,neighbours:16,biologicalHouses:16,institutions:2,persons:people.length},importable:false},engine:{persons:{people:people.filter(p=>p.householdId==='manor'&&p.alive),past:people.filter(p=>p.householdId==='manor'&&!p.alive),nextOrdinal:139,lordOrdinal:1,lineages:houses.filter(h=>!h.isInstitution).map(h=>({id:`lineage:${h.id}`,kind:h.id==='h01'?'lord':h.id==='h18'?'overlord':['h12','h13'].includes(h.id)?'merchant':'neighbour',set:null,since:0,slots:{}}))},estates:{estates,claims,suits:[],nextClaim:4,nextSuit:1,people:people.filter(p=>p.householdId!=='manor')},factions:{factions,people:[],nextOrdinal:139},diplomacy:{negotiations:[],promises:[],relations:{},nextNegotiation:1,nextPromise:1},stewards:houses.map(h=>({personId:h.stewardId,estateId:estateId(h.id),ability:profiles.find(p=>p.id===h.stewardId).abilities.stewardship,loyalty:60,disposition:h.id==='h12'||h.id==='h13'?'merchant':'peasant',connection:h.patronHouseId,since:0,kept:0,errors:0,status:'serving'}))},proposals:{newFieldIds:Array.from({length:14},(_,i)=>`NF${String(i+1).padStart(2,'0')}`),houses,personProfiles:profiles,loans,annuities,relations,finances:houses.map(h=>({houseId:h.id,treasuryD:h.treasuryPounds*240,annualGrossD:h.annualGrossPounds*240,annualFixedCostD:h.annualBurdenPounds*240,loanIds:loans.filter(l=>l.debtorHouseId===h.id).map(l=>l.id),receivableLoanIds:loans.filter(l=>l.creditorHouseId===h.id).map(l=>l.id),annuityIds:annuities.filter(a=>a.payerHouseId===h.id).map(a=>a.id),scope:'고을 보유분 장부; 원금상환은 annualFixedCostD에 불포함. 지급 연금은 포함. 채권·수취 연금은 별도.'})),retinues:houses.map(h=>({houseId:h.id,namedPersonIds:h.retainerIds,annualServiceDays:20,standingArmy:false,unnamedFollowers:0,contractNote:'게임 추정. 호위·문서 전달·법정 동행; 전투 인원이나 왕실 원정 계약으로 자동 환산하지 않는다.'})),priorHoldings:estates.flatMap(e=>e.pieces.map(p=>({pieceId:p.id,claimedSinceYear:1280,basis:'초기 서사 가정. native possessedSince=0과 구별; 미검증 점유연수를 자동 합산하지 않음.'}))),portraitRequirements:bindings.filter(b=>b.needsNewPortrait),appearanceNote:'native 외모 유전값은 재현 가능한 초기 임시값. 초상에서 피부색·성격·능력을 추론하지 않았고 새 가계의 유전 얼굴 일치까지 검증하지 않았다.',factionBridgeNote:'9개 기존 세력 레코드는 호환용. 모든 가문을 이 9개로 압축하지 않으며 기관 소유·도시 공동체 대표를 상인 가주와 자동 동일시하지 않음.'}};
fs.writeFileSync(path.join(root,'world/hundred.json'),JSON.stringify(world,null,2)+'\n');
fs.writeFileSync(path.join(root,'records/person-id-map.json'),JSON.stringify(idMap,null,2));
fs.writeFileSync(path.join(root,'records/portrait-bindings.json'),JSON.stringify(bindings,null,2));
console.log({persons:people.length,estates:estates.length,pieces:estates.flatMap(e=>e.pieces).length,portraitsMissing:bindings.filter(b=>b.needsNewPortrait).length});
