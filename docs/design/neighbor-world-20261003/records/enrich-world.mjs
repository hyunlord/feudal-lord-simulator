import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'world/hundred.json'),w=JSON.parse(fs.readFileSync(file));
const byAuthor=Object.fromEntries(w.proposals.personProfiles.map(p=>[p.authorId,p.id]));
const pieces=w.engine.estates.estates.flatMap(e=>e.pieces);
for(const [piece,person,remainder] of [['home:mill','h01-g1f','h01-head'],['h08:land_rent','h08-g1f','h08-head'],['h14:manor_court','h14-head','h14-c1']]){
 const p=pieces.find(p=>p.id===piece);p.lifeTenant=`person:${byAuthor[person]}`;p.remainder=`person:${byAuthor[remainder]}`;
}
for(const lineage of w.engine.persons.lineages)lineage.since=0;
for(const h of w.proposals.houses){
 if(h.patronHouseId===h.id){h.patronHouseId=null;const e=w.engine.estates.estates.find(e=>h.estateIds.includes(e.id));delete e.patron;}
 for(const r of h.relations)if(r.personIds)r.personIds=r.personIds.map(id=>byAuthor[id]??id);
 if(h.officeSuccession)for(const term of h.officeSuccession.periods)term.personId=byAuthor[term.personId]??term.personId;
}
w.proposals.appearanceNote+=' 서로 다른 가문의 초상이 같은 L3·L7 원화 혈통에서 와서 실제 화면에서 친족처럼 닮는 경우가 있다. 독립 가문별 얼굴 다양성과 유전 닮음은 추가 미술 검수 대상이다.';
w.proposals.institutionLineageNote='기관 대표의 native lineageId는 빈 문자열이다. 타입은 허용하지만 비혈연 기관을 뜻하는 현재 엔진 관행은 없으므로 NF02/NF07의 새 연결 계약이 필요하다. 기관 ID를 혈통 ID로 만들지 않는다.';
w.proposals.map=JSON.parse(fs.readFileSync(path.join(root,'world/map.json')));
w.proposals.rightDetails=pieces.map(p=>({pieceId:p.id,annualValueUnit:'d_per_year',valueStatus:'게임 추정 평가액, 보장 현금수입 아님',titleBasis:p.kind==='advowson'?'추천 차례를 보유하는 가공 기증 문서. 교회 소유·성직 매매 권한이 아님.':p.kind==='market'?'가공 특허장에 정한 주간 장터와 좌판세. 인접 시장 손해 소송 여지.':p.kind==='tolls'?'가공 통행세 징수권 또는 정기 임대 약정. 길 자체의 소유와 구분.':p.kind==='hunting'?'가공 문서에 정한 사냥권·허가 수입만. 왕실 삼림법 면책 아님.':p.kind==='manor_court'?'법정의 적법한 관할·수입에 대한 가공 권원. 형사재판 무제한 권한 아님.':'가공 증서·장원 기록에 적힌 정기 수입 권리',tenureRestrictions:['기존 과부 몫·생애권 우선','공유 이용권은 매매로 자동 소멸하지 않음',...(p.id.startsWith('h10:')||p.id.startsWith('h11:')?['기관 재산 처분은 유효한 승인 절차 선행']:[])],lifeInterestType:p.lifeTenant?'가공 생애권 설정; 과부 몫과 자동 동의어 아님':null,burdensAllocation:'영지 총액에 기록된 부담. 개별 조각에 배분되지 않은 담보는 자동 추정 금지.'}));
w.proposals.rightDetails.find(p=>p.pieceId==='h05:land_rent').titleBasis='삼림 소작지 사용료·돼지방목 허가 관련 수입을 합산한 게임 추정 지대. 별도 벌채·방목 허가권 타입은 미구현이며 공유 이용권을 독점 소유로 바꾸지 않는다.';
w.proposals.successionPolicies=w.proposals.houses.map(h=>({houseId:h.id,mode:h.isInstitution?'office_continuity_no_blood_inheritance':'document_first_then_common_law',maleLineExtinctionIsTotalExtinction:false,daughters:'같은 차순위의 적격 딸은 공동상속 후보; 맏딸 독점 금지',collateralPedigreeComplete:false,unknownKinshipAction:'검증되지 않은 방계·친정이 있으면 자동 혼인 확정 금지; 문서 조사 조건으로 남김',wardship:'미성년자의 권원과 후견인의 관리·수익을 별도 기록'}));
w.proposals.registerBridge={status:'proposal_only',definitionScope:'world/rules.json의 세계 갱신과 사건 등록기 문구 노출을 분리',worldEventKey:'ruleVersion|year|ruleId|stableSubjectId|rightOrContractId',uiBudget:'새 변주 연2회·계절1회 제안만 재사용. 세계의 사망·상환을 억제하지 않음',effectOwner:'future_world_handler',bindingPolicy:'이미 확정된 세계 사건 인스턴스에 문구를 연결. 등록기에서 금고·권리를 다시 갱신하지 않음',existingDrafts:'docs/design/content-drafts-20261002/v2/registry.schema.json은 이 세계 루트를 검증하지 않는다',atomicity:'대금·권원·점유·원장을 한 성공 경계로 처리; 실패하면 일괄 거부. 로더/실행기 구현 전 실행 금지'};
fs.writeFileSync(file,JSON.stringify(w,null,2)+'\n');console.log('map/rights/succession/registry proposals linked');
