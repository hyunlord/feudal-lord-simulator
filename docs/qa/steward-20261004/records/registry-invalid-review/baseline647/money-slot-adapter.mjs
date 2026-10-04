// Proposed standalone read-time adapter: no engine/state imports or installation.
const accountLabels=Object.freeze({cash:'현금',restricted:'목적 기금',arrears:'미납 의무',in_kind:'현물 의무'});
function matches(condition,entry){
 const [scope,key]=condition.field.split('.');
 if(scope!=='entry'||entry[key]===undefined)return false;
 const value=entry[key];
 switch(condition.op){
  case 'eq':return value===condition.value;
  case 'in':return condition.value.includes(value);
  case 'gt':return typeof value==='number'&&value>condition.value;
  case 'lt':return typeof value==='number'&&value<condition.value;
  case 'gte':return typeof value==='number'&&value>=condition.value;
  case 'lte':return typeof value==='number'&&value<=condition.value;
  default:return false;
 }
}
function quantity(entry){
 const bread=entry.category==='famine_relief';
 if(!bread&&entry.category!=='wool_levy')return null;
 const resource=bread?'bread':'fleece';
 if(entry.account!=='in_kind'||entry.resource!==resource||entry.amount>=0)return null;
 const references=(entry.sourceRefs??[]).filter(ref=>ref.type===(bread?'building':'claim')&&(bread||ref.id==='wool_levy')&&new RegExp(`^${resource}:([0-9]+)$`).test(ref.detail??''));
 if(references.length!==1)return null;
 const count=Number(references[0].detail.split(':')[1]);
 return Number.isSafeInteger(count)&&count>0?count:null;
}
export function renderLedgerCandidate(candidate,entry,formatters){
 if(!Number.isSafeInteger(entry.amount))return {status:'invalid_amount'};
 const row=candidate.ledgerCategories.find(row=>row.category===entry.category);
 if(row===undefined)return {status:'unknown_category'};
 const variant=[...row.variants].sort((a,b)=>b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0)).find(v=>!v.disabled&&v.when.every(c=>matches(c,entry)));
 if(variant===undefined)return {status:'blocked',rawAmountPennies:entry.amount};
 const verifiedQuantity=variant.requiresAdapter?quantity(entry):null;
 const missingQuantity=variant.requiresAdapter&&verifiedQuantity===null;
 const template=missingQuantity?variant.missingQuantityFallback:variant.text;
 const slots={label:row.label,accountLabel:accountLabels[entry.account],amountExact:formatters.moneyWordsFull(entry.amount),amountAbsExact:formatters.moneyWordsFull(Math.abs(entry.amount)),amountSignedExact:formatters.moneyWordsFullDelta(entry.amount),verifiedQuantity};
 const text=template.replace(/\{(\w+)\}/g,(match,key)=>slots[key]===undefined||slots[key]===null?match:String(slots[key]));
 if(/\{\w+\}/.test(text))return {status:'missing_slot',rawAmountPennies:entry.amount};
 const moneyKey=template.match(/\{(amount(?:Abs|Signed)?Exact)\}/)?.[1];
 return {status:missingQuantity?'quantity_unknown':'rendered',variant:variant.id,text,moneyDisplay:moneyKey===undefined?null:slots[moneyKey],rawAmountPennies:entry.amount,verifiedQuantity};
}
