import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const events=read('events.json');
const sources=[...read('records/sources-land-kin.json'),...read('records/sources-trade-force.json')];
const catalog=read('records/engine-effects.json');
const keys=new Set(catalog.entries.map(e=>e.key));keys.add('no_op');
const src=new Set(sources.map(s=>s.id));
const expectedCats={'장원':9,'도시':9,'교회':8,'이웃 가문':8,'세력':9,'자연':8,'가문 내부':9};
const periods={'1300–1347':[1300,1347],'1348–1381':[1348,1381],'1382–1450':[1382,1450]};
const checks=[];
assert.equal(events.length,60);assert.equal(new Set(events.map(e=>e.id)).size,60);
const nonempty=(x,context)=>assert.ok(typeof x==='string'&&x.trim().length>0,context);
for(const [i,e] of events.entries()){
 assert.equal(e.number,i+1);assert.equal(e.id,`ck_evt_${String(i+1).padStart(3,'0')}`);
 assert.ok(Object.hasOwn(expectedCats,e.category));assert.ok(Object.hasOwn(periods,e.period));
 assert.equal(e.years.length,2);assert.ok(e.years.every(Number.isInteger));
 assert.ok(e.years[0]<=e.years[1]&&e.years[0]>=periods[e.period][0]&&e.years[1]<=periods[e.period][1],e.id+' year');
 for(const k of ['land','population','rights','relations','season','state'])nonempty(e.conditions[k],e.id+' condition '+k);
 for(const k of ['faction','role'])nonempty(e.sender[k],e.id+' sender '+k);
 for(const k of ['title','body','illustration'])nonempty(e[k],e.id+' '+k);
 assert.ok(['existing_event_copy_revision','existing_petition_variant','new_event_draft'].includes(e.contentClass),e.id+' classification');
 if(e.contentClass==='existing_event_copy_revision')assert.ok(e.existingEvent?.id&&e.existingEvent?.ref,e.id+' original chapter binding');
 assert.ok(e.choices.length>=2&&e.choices.length<=4);assert.equal(new Set(e.choices.map(c=>c.id)).size,e.choices.length);
 for(const c of e.choices){
  for(const k of ['id','label','tradeoff','ledger','chronicle'])nonempty(c[k],e.id+' choice '+k);
  assert.ok(c.effects.length>0);
  assert.ok(Array.isArray(c.costAxes)&&c.costAxes.length>0,e.id+' cost axes');
  for(const axis of c.costAxes)nonempty(axis,e.id+' axis');
  for(const f of c.effects){assert.ok(keys.has(f.catalogKey),f.catalogKey);
   for(const k of ['operation','rangeNote','preconditions','limits'])nonempty(f[k],e.id+' effect '+k);
   assert.ok(f.parameters!==undefined);
   assert.ok(f.catalogKey==='no_op'||f.codeReferences.length>0);
   for(const r of f.codeReferences){assert.ok(r.url.startsWith('https://github.com/'));const m=r.ref.match(/^(.*?):(\d+)$/);assert.ok(m);const p=path.resolve(root,'..',m[1]);assert.ok(fs.existsSync(p));assert.ok(Number(m[2])<=fs.readFileSync(p,'utf8').split('\n').length);}
  }
 }
 assert.equal(typeof e.recurrence.allowed,'boolean');assert.ok(e.recurrence.cooldownYears!==undefined);
 for(const k of ['steward','exclusions'])nonempty(e.recurrence[k],e.id+' recurrence '+k);
 assert.ok(e.history.sourceIds.length>0);for(const id of e.history.sourceIds)assert.ok(src.has(id),id);
 for(const k of ['basis','inference','limits'])nonempty(e.history[k],e.id+' history '+k);
 assert.equal(e.history.sources.length,e.history.sourceIds.length);
 for(const s of e.history.sources)assert.ok(new URL(s.url).protocol==='https:');
 nonempty(e.integration.mode,e.id+' integration');assert.ok(e.integration.requirements);
 assert.ok(Array.isArray(e.newEffectLinks));for(const id of e.newEffectLinks)assert.ok(/^NE0[1-9]$/.test(id));
}
for(const [cat,n]of Object.entries(expectedCats))assert.equal(events.filter(e=>e.category===cat).length,n,cat);
for(const p of Object.keys(periods))assert.equal(events.filter(e=>e.period===p).length,20,p);
checks.push('60개 고유 ID·번호·시대별20·종류별9/9/8/8/9/8/9 확인');
checks.push('모든 등장 조건·발신인·제목·본문·2~4선택·효과·대가·원장·연대기·반복·삽화·역사근거·추측·통합한계 확인');
checks.push('모든 효과 키와 코드 경로·행 번호 존재, 역사 출처 ID 및 HTTPS URL 형식 확인');
const md=fs.readFileSync(path.join(root,'EVENTS.md'),'utf8');
assert.equal((md.match(/<a id="ck_evt_/g)||[]).length,60);
for(const e of events){assert.ok(md.includes(e.body),e.id+' body fidelity');assert.ok(md.includes(e.illustration));for(const c of e.choices){assert.ok(md.includes(c.ledger));assert.ok(md.includes(c.chronicle));assert.ok(md.includes(c.tradeoff));}}
checks.push('60개 콘텐츠 구분·선택별 대가 축·NE10 신규 연결 제외 확인');
checks.push('events.json ↔ EVENTS.md 본문·삽화·선택 결과·대가 60개 동일성 확인');
const result={status:'PASS',scope:'문서 구조·참조·원고 동일성의 정적 검증; 런타임 검증 아님',count:60,choices:events.reduce((n,e)=>n+e.choices.length,0),checks,engineRuntimeTested:false};
fs.writeFileSync(path.join(root,'records/VALIDATION.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
