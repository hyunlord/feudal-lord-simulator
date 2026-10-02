import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const write=(n,t)=>fs.writeFileSync(path.join(root,n),t+'\n');
const sources=[...read('records/sources-land-kin.json'),...read('records/sources-trade-force.json')];
const sourceMap=new Map(sources.map(s=>[s.id,s]));
const catalog=read('records/engine-effects.json');
const effectMap=new Map(catalog.entries.map(e=>[e.key,e]));
const prov=read('records/provenance.json');
const repo='https://github.com/hyunlord/feudal-lord-simulator/blob/';
const codeLink=ref=>{const m=ref.match(/^(.*?):(\d+)$/);return repo+prov.head+'/'+(m?m[1]+'#L'+m[2]:ref);};
const stringify=x=>typeof x==='string'?x:JSON.stringify(x);
const esc=x=>stringify(x).replaceAll('|','\\|').replaceAll('\n',' ');
const events=['a','b','c'].flatMap(b=>read(`records/batch-${b}.json`)).sort((a,b)=>a.number-b.number);
for(const event of events){
 event.history.sources=event.history.sourceIds.map(id=>{const s=sourceMap.get(id);if(!s)throw Error('unknown source '+id);return {id,title:s.title,url:s.url};});
 for(const choice of event.choices)for(const effect of choice.effects){
  const entry=effectMap.get(effect.catalogKey);
  if(effect.catalogKey!=='no_op'&&!entry)throw Error('unknown effect '+effect.catalogKey);
  effect.codeReferences=(entry?.refs??[]).map(ref=>({ref,url:codeLink(ref)}));
 }
}
write('events.json',JSON.stringify(events,null,2));
const classLabels={existing_event_copy_revision:'기존 사건 문구 개선',existing_petition_variant:'기존 청원 변주',new_event_draft:'신규 사건 초안'};
let md='# Charter & Kin: 청원·사건 초안 60개 — 2차\n\n';
md+='검토용 원고이며 게임에 등록·설치하지 않았다. 조건·수치의 표기 규약과 엔진 연결 한계는 [README](README.md), [효과 계약](records/ENGINE_EFFECTS.md), [출처](SOURCES.md)에 있다. 인물 대사와 사건은 모두 가공·조합이며 사료의 사건을 그대로 재현한 것이 아니다.\n\n';
md+='범위는 1300~1450년이다. 각 연도창은 발동 가능한 기간이며 강제 발생일이 아니다. 조건을 충족하지 못하면 건너뛴다. 같은 실제 청원에 붙는 보충 장면은 별도 효과를 중복 실행하지 않는다.\n\n';
md+='| 번호 | 시대 | 종류 | 등장 기간 | 제목 | 선택 수 | 구분 |\n|---|---|---|---|---|---|---|\n';
for(const e of events)md+=`| ${e.number.toString().padStart(3,'0')} | ${e.period} | ${e.category} | ${e.years.join('~')}년 | [${e.title}](#${e.id}) | ${e.choices.length} | ${classLabels[e.contentClass]??e.contentClass} |\n`;
for(const e of events){
 md+=`\n<a id="${e.id}"></a>\n\n## ${e.number.toString().padStart(3,'0')}. ${e.title}\n\n`;
 md+=`**콘텐츠 구분:** ${classLabels[e.contentClass]??e.contentClass}\n\n`;
 if(e.existingEvent)md+=`**기존 사건 연결:** ${esc(e.existingEvent)}\n\n`;
 if(e.subtitle)md+=`*부제: ${e.subtitle}*\n\n`;
 md+=`- **ID:** \`${e.id}\`\n- **종류 / 시기:** ${e.category} · ${e.years.join('~')}년\n- **보낸 이:** ${esc(e.sender.faction)} · ${esc(e.sender.role)}\n\n`;
 md+='| 등장 조건 | 내용 |\n|---|---|\n';
 for(const [k,label] of Object.entries({land:'땅',population:'인구',rights:'권리',relations:'관계',season:'계절',state:'필수 상태'}))md+=`| ${label} | ${esc(e.conditions[k])} |\n`;
 md+=`\n**본문**\n\n${e.body}\n\n`;
 for(const c of e.choices){
  md+=`### ${c.id}. ${c.label}\n\n`;
  md+=`**대가의 축:** ${(c.costAxes??[]).join(', ')}\n\n`;
  const execution=c.executionContract??c.execution;
  if(execution)md+=`**명령 실행 계약:** ${esc(execution)}\n\n`;
  for(const f of c.effects){
   md+=`- **효과:** \`${f.catalogKey}\` · ${f.operation}\n- **매개값:** ${esc(f.parameters)}\n- **수치·범위:** ${f.rangeNote}\n- **실행 전제:** ${f.preconditions}\n- **효과 한계:** ${f.limits}\n`;
   if(f.codeReferences.length)md+='- **코드:** '+f.codeReferences.map(r=>`[${r.ref}](${r.url})`).join(', ')+'\n';
  }
  md+=`- **선택의 대가:** ${c.tradeoff}\n- **원장:** ${c.ledger}\n- **연대기:** ${c.chronicle}\n\n`;
 }
 md+=`**반복·청지기:** 재등장 ${e.recurrence.allowed?'가능':'불가'}; 재등장 간격 ${esc(e.recurrence.cooldownYears)}년(게임 추정 제안). ${e.recurrence.steward} ${e.recurrence.exclusions}\n\n`;
 md+=`**삽화 의뢰:** ${e.illustration}\n\n**역사 근거:** ${e.history.basis}\n\n**추측·각색:** ${e.history.inference}\n\n**근거의 한계:** ${e.history.limits}\n\n`;
 md+='**출처:** '+e.history.sources.map(s=>`[${s.id}: ${s.title}](${s.url})`).join('; ')+'\n\n';
 md+=`**연결 상태:** ${e.integration.mode} · ${esc(e.integration.requirements)}\n\n`;
 for(const [key,value] of Object.entries(e.integration)){if(!['mode','requirements'].includes(key))md+=`**연결 주의 ${key}:** ${esc(value)}\n\n`;}
 md+='**새 효과 제안 연결:** '+(e.newEffectLinks.length?e.newEffectLinks.map(id=>`[${id}](NEW_EFFECTS.md#${id.toLowerCase()})`).join(', '):'없음')+'\n';
}
write('EVENTS.md',md);
let sm='# 출처·읽기 범위\n\n';
sm+=`기준 가지 \`${prov.branch}\`, 코드 HEAD \`${prov.head}\`. 확인일 2026-10-02.\n\n`;
sm+='## 정본 문서와 원본 이력\n\n';
for(const p of prov.canonicalInputs)sm+=`- [${p.intendedRepoPath}](${repo+prov.head+'/'+p.intendedRepoPath}): 저장소 정본 \`${p.actualPath}\` 사용. SHA256 \`${p.sha256}\`. 사용자 지시에 따라 pull 후 저장소 경로를 기준으로 전환했다. 이전 /tmp 원본과의 대조 이력은 provenance.json에 있다.\n`;
sm+='\n사료의 금액·빈도를 게임 수치로 환산하지 않았다. 모든 선택 효과의 수치는 게임 규칙 또는 명시한 튜닝 범위다. 조사 문서의 자동 인용 표식은 근거 링크로 재사용하지 않았다. 학술 출판사 초록·기관 색인만 확인된 자료는 아래에 그 범위를 표시했다.\n\n## 저장소 독해\n\n';
for(const p of ['docs/design/lord-mode.md','docs/design/trades-and-force.md','docs/design/art-bible.md',...prov.researchFiles.map(f=>f.path)])sm+=`- [${p}](${repo+prov.head+'/'+p})\n`;
sm+='\n연구 문서 6개를 역할별로 모두 읽었다. 장원·간접통치 연구 2개는 [조사 기록](records/research-land-kin.md), 콘텐츠 목록·생업·무력 연구 3개는 [조사 기록](records/research-trade-force.md), UI 연구는 통합 담당이 읽었다. UI 연구는 기존 직접 건설 모드를 다루므로 현행 영주 모드의 권한 근거로 쓰지 않았다.\n\n엔진 효과는 [현행 경로 목록](records/engine-effects.json)과 각 초안의 코드 링크로 추적한다. `eventSchedule` 구현은 `src/engine/eventSchedule.ts`, 데이터는 `src/content/eventConfig.ts`에 있다.\n\n## 외부 근거\n\n';
for(const s of sources){const used=events.filter(e=>e.history.sourceIds.includes(s.id)).map(e=>String(e.number).padStart(3,'0'));
 sm+=`### ${s.id}\n\n[${s.title}](${s.url})\n\n- 뒷받침하는 관행: ${s.claimSupported}\n- 사용 한계: ${s.limits}\n- 확인 수준: ${s.verification}\n- 사용 초안: ${used.join(', ')||'보조 조사만; 초안 직접 인용 없음'}\n- 내부 대조: ${s.localResearchRefs.map(r=>'`'+r+'`').join(', ')}\n\n`;
}
sm+='## 배제한 일반화\n\nCely 서한(1475~1488)과 Caister 포위(1469)는 기간 밖이다. Paston 사례는 주로 Norfolk에서 왔으므로 남부 가공 가문의 가능성으로만 각색했다. 1338년 Southampton 설명 페이지의 Edward II 표기는 재위와 충돌하여 사용하지 않았다. 1349년 노동자 조례와 1351년 노동자법을 구분하며, 칼레 스테이플 중단을 영구 이전으로 쓰지 않는다.\n';
write('SOURCES.md',sm);
const periods=['1300–1347','1348–1381','1382–1450'];
const cats=['장원','도시','교회','이웃 가문','세력','자연','가문 내부'];
let dist='# 시대·종류 분포와 발동 빈도\n\n60개는 콘텐츠 후보 수이며 150년 동안 모두 강제 발생시키는 일정이 아니다. 발동 조건은 기존 상태를 읽고, 충족하는 후보에서 고른다. 달력상 끝 연도 1450년을 포함하므로 아래 연도 수는 48·34·69개다.\n\n| 시대 | 초안 수 | 연도 수 | 후보/연도(밀도, 발동률 아님) |\n|---|---:|---:|---:|\n';
for(const [i,p]of periods.entries()){const n=events.filter(e=>e.period===p).length;dist+=`| ${p} | ${n} | ${[48,34,69][i]} | ${(n/[48,34,69][i]).toFixed(2)} |\n`;}
dist+='\n| 종류 | 1300–1347 | 1348–1381 | 1382–1450 | 합계 |\n|---|---:|---:|---:|---:|\n';
for(const c of cats)dist+=`| ${c} | ${periods.map(p=>events.filter(e=>e.period===p&&e.category===c).length).join(' | ')} | ${events.filter(e=>e.category===c).length} |\n`;
dist+='\n## 빈도 제안: 기존 반복 청원의 대체 풀\n\n현재 `HOME_PETITION_PERMILLE=600`은 계절별 후보 확률이며 겨울 최소 1건 보정이 있다. 코드에는 1320년 종료 조건이 없다. 따라서 새 60건을 기존 발생량 위에 그대로 더하지 않는다. 아래는 미구현 편집·스케줄러 제안이며 역사적 실측 빈도가 아니다.\n\n- 평년: 기존·신규 일상 청원을 합쳐 1~2건/년, 계절당 새 결정 1건 이하. 새 초안은 평균 2~3년에 1건을 목표로 기존 슬롯을 대체한다.\n- 대기근·전쟁·흑사병·인두세 등 굵은 사건이 도착한 해: 선택형 보조 청원은 0~1건. 필수 장 사건과 진행 중 계약·감사의 기존 기한은 유지한다.\n- 같은 계절에 후보가 겹치면 이미 진행 중인 약속·감사·소송의 보충 장면, 좁은 연도창의 역사 장면, 처음 보는 일상 소재 순으로 고른다. 하나의 실제 청원에 선택을 두 번 실행하지 않는다.\n- 같은 종류는 연속 2회까지만, 같은 발신 역할은 연속 회피. 지난 5년 덜 본 종류에 가중치를 준다. 이는 새 스케줄러 제안이다.\n- 재등장 허용 초안은 각 사건의 간격을 적용하되 같은 당사자·같은 판결의 재포장 반복을 피한다. 감사·소송 단계·후계·혼인은 대상 ID당 1회이며 새 적합 상태가 없으면 다시 만들지 않는다.\n- 전쟁·병·날씨는 실제 상태에서 확인한다. 서사적 조건을 엔진이 아직 검사하지 못하면 임의 참 처리하지 않고 카드 발동을 보류한다.\n- 기한 있는 기존 결정을 큐가 뒤로 밀어 자동 실패시키지 않는다. 마감까지 확인할 수 없으면 해당 보충 장면을 생략하고 기존 화면을 유지한다.\n- 선택 자금·후보가 부족하면 해당 선택을 잠그고 이유를 표시한다. 유효 선택이 2개 미만이면 후보 카드 자체를 발동하지 않는다. 기존 명령 거부를 성공 원장으로 기록하지 않는다.\n\n## 연도창 점검\n\n| 10년 구간 | 이 구간에 시작하는 초안 | 창이 겹치는 후보 수 |\n|---|---|---:|\n';
for(let y=1300;y<=1450;y+=10){const end=Math.min(y+9,1450);dist+=`| ${y}~${end} | ${events.filter(e=>e.years[0]>=y&&e.years[0]<=end).map(e=>String(e.number).padStart(3,'0')).join(', ')||'—'} | ${events.filter(e=>e.years[0]<=end&&e.years[1]>=y).length} |\n`;}
dist+='\n## 남겨 둔 장기 변주\n\n장원 수선(003·023), 감사 방식(002·029), 감사 적발(013·025·052), 오래된 어업 청구권(010·051), 감독과 위임(019·037·059)은 서로 완전히 다른 제도로 세지 않는다. 150년 동안 되돌아오는 문제의 변주이며, 각 JSON의 variantGroup으로 묶었다. 같은 대상·같은 사정이면 하나만 사용하고 새 감사연도·현직·당사자 변화가 확인될 때만 다시 후보에 둔다. 이 필터도 미구현 편집 제안이다.\n\n좁은 연도창이 겹쳐도 동일 연도에 몰아 실행하지 않는다. 위 간격·상한은 코드에 적용하지 않았다. FIX-14 선례 경로는 확인한 HEAD의 지도 밖 위임 영지에 존재한다. 홈 청원의 자동처리 여부는 사용자 설명과 현재 소스가 달라 [효과 목록](records/ENGINE_EFFECTS.md)의 확인 한계를 따른다. NE10은 신규 제안에서 철회했다.\n';
write('DISTRIBUTION.md',dist);
const proposals=[
 ['NE01','사건별 조건·중복 억제·재등장 간격','새 카드의 상태 필터·연도창·대상별 1회 기록·대기열 상한을 함께 관리한다. 기존 엔진에 사건/계절 스케줄이 있지만 이 60개를 읽는 범용 등록기와 교차 중복 억제는 없다.','기존 state 조회와 새 저장 필드를 구분하고, 같은 실제 청원에 효과가 두 번 실행되지 않는지 확인한다.'],
 ['NE02','목적별 수선·시설 상태','수선비 지출과 해당 제방·지붕·울타리의 수선 완료를 연결한다. 기존 repair의 지도 밖 연가치 감소와 home 비용/관계 효과를 실제 지도 수리로 오해하지 않게 한다.','재료·공사 기간·착수 주체를 명시하고 지출 즉시 완공하지 않는다.'],
 ['NE03','기간 있는 감면·새 납기 약속','한 철 감면과 종료, 분할 납부, 재심 기한을 일반 청원에도 기록한다. 기존 혼인 약속과 영구 시장 좌판세 변경만으로 이를 흉내 내지 않는다.','미래 지급 의무·금고 여력·실제 위반을 구분하고 저장/불러오기 때 중복 부과를 막는다.'],
 ['NE04','목적별 생계 물자 지급','가구·교구·장원에 곡물·종자·연료를 실제 재고 범위 안에서 전달한다. 대기근 장의 구휼 경로와 목재 주문이 모든 자원을 지급하는 API는 아니다.','물자 보존, 저장 위치, 수혜 대상, 운송과 소비를 확인한다. 질병 치유나 사망률 하락을 자동 보장하지 않는다.'],
 ['NE05','후견·가구 이동·인물 상태 연결','후견 허가 기록과 실제 후견인/가구 관계 변경, 입주 승인과 실제 정착을 연결한다. 기존 인물·가구 시스템의 무조건 신규 효과라고 부르지 않고 청원에서의 범용 연결을 제안한다.','빈집·물 서비스·생존·동의·기존 관계 확인. 이름 없는 사람을 즉시 생성해 수를 맞추지 않는다.'],
 ['NE06','종교 후원과 지속 의무','추도미사나 자선 약정의 수입 부담과 이행 기록을 다룬다. 단순 주교 관계 변화는 정기 종교 의무를 만들지 않는다.','금액·기한·권리 범위를 분리하고 영적 효능을 수치 보상으로 확정하지 않는다.'],
 ['NE07','한시 동원과 생업 공백','경비·호송·원정 복무의 인원, 기간, 생업 이탈을 연결한다. 기존 전쟁 장의 징집 효과를 매년 어느 사건에서나 호출하지 않는다.','실제 인물과 기존 노동 배치를 보존하며 상비군·즉시 전투 승리로 축약하지 않는다.'],
 ['NE08','권리 범위·관습 판결','방목 상한, 통행 구간, 제분 의무 등 문서상 범위와 실제 이용을 연결한다. 현재 청원 플래그·관계 수치와 권리 조각의 권원·점유를 분리한다.','판결만으로 타인의 점유를 제거하지 않는다. 승소·집행·소득 변화는 별도 확인한다.'],
 ['NE09','가문 내부 중재와 승계 준비','친족 간 중재, 후견·혼담·후계 준비를 반복 가능한 가족 사건으로 표현한다. 기존 한정된 혼인 진행과 legacy 후보 선택을 아무 시기에 재생성하지 않는다.','인물 생애와 승계 가능성, 기존 청구권·과부산을 보존한다. 관계 손실을 없는 수치로 꾸미지 않는다.'],
 ['NE10','홈 청원의 선례 자동처리','집권 영지의 반복 소액 청원을 청지기가 과거 판결과 예외 규칙에 따라 처리하게 한다. 현행 지도 밖 영지 같은 kind 선례 경로를 홈까지 확장하는 제안이다.','새 당사자·권리·혼인·고액 사건은 재상신하며 서로 다른 초안이 같은 kind라는 이유만으로 잘못 자동 판결되지 않게 한다.']
];
let ne='# 새 효과 제안\n\n아래 9개는 현재 선택 효과에 포함하지 않았다. NE10은 사용자 정정에 따라 신규 제안에서 철회했다. 단, 확인 HEAD83b06802에서 FIX-14 SW-12는 지도 밖 위임 영지에만 보이며 홈 청원은 직접 상신한다. 이 불일치는 효과 목록에 코드 근거와 함께 남겼다. 기존 명령의 새 문구 등록·카드 연결만 필요한 일과 새로운 상태 변화가 필요한 일을 구별한다. 관련 번호는 각 사건의 `newEffectLinks`에서 자동 집계한다.\n\n';
for(const[id,title,desc,guard]of proposals.filter(p=>p[0]!=='NE10')){const nums=events.filter(e=>id==='NE01'||e.newEffectLinks.includes(id)).map(e=>String(e.number).padStart(3,'0'));
 ne+=`<a id="${id.toLowerCase()}"></a>\n\n## ${id}. ${title}\n\n${desc}\n\n- 유용한 초안: ${nums.join(', ')||'전체 풀의 통합 설계에서 사용; 개별 초안에 추가 효과로 요구하지 않음'}\n- 구현 시 확인할 경계: ${guard}\n\n`;
}
ne+='\n<a id="ne10"></a>\n\n## NE10. 철회 이력\n\n신규 효과 제안에서 제외. 기존 FIX-14 선례를 재사용하는 방향이며 홈 적용 범위는 ENGINE_EFFECTS.md의 코드 대조 결과를 따른다. 범용 새 사건 ID의 재등장·선례 키 연결은 NE01 등록기 과제다.\n';
write('NEW_EFFECTS.md',ne);
write('README.md',`# Charter & Kin 사건·청원 콘텐츠 초안\n\n60개 · 1300~1450년 잉글랜드 남부 시장도시·영주 가문 · 2026-10-02\n\n- [전체 표와 본문](EVENTS.md) / [기계 판독 원고](events.json)\n- [시대·종류·빈도](DISTRIBUTION.md) / [새 효과 제안 9개·NE10 철회](NEW_EFFECTS.md) / [출처·확인 한계](SOURCES.md)\n- [현행 효과 경로](records/ENGINE_EFFECTS.md) / [입력 해시](records/provenance.json)\n\n## 사용 규칙\n\n초안 JSON은 현행 엔진 입력 형식이 아니다. 신규 카드 등록·본문 연결·조건 조회·기록 문구 연결이 필요하며, 이번 산출물은 게임에 설치하지 않았다. 효과는 기존 명령/응답 경로를 온전히 사용한다. 장별 ID에 묶인 효과는 해당 기존 청원이 실제 열렸을 때 보충하는 장면으로 한정한다. 새 효과는 NEW_EFFECTS.md로 분리했다.\n\n\`rangeNote\`의 범위는 역사 가격표가 아니다. 현재 상수는 [x,x]로, 기존 명령에 줄 수 있는 조정값은 게임 추정 범위로 표시한다. 범위가 곧 엔진 난수 추첨을 뜻하지 않는다. 최종 연결 시 범위 안의 정수 하나를 확정하고 현재 금고·관계·유효 대상·기한을 다시 검사한다.\n\n\`conditions\`의 지형·인구·계절 조건은 편집 발동 기준이다. 현재 상태로 확인할 수 없는 세부 풍경·관습은 발신자의 보고 또는 역사적 각색이며 새로운 엔진 측정값으로 꾸미지 않는다. 날씨·병을 효과 선택으로 새로 발생시키지 않는다.\n\n\`ledger\`와 \`chronicle\`은 선택 성공 뒤 표시할 후보 문구다. 돈 이동이 없는 경우 0d 또는 결정 기록으로 표시하며 실제 현금 전표가 새로 생긴다고 주장하지 않는다. 실패한 명령에는 성공 문구를 기록하지 않는다. Ad·Cd·Rd·Ld 및 중괄호 표기는 아직 값이 정해지지 않은 템플릿 변수다. 실제 화면에서는 매개값으로 치환하고 페니 단위를 붙인다. 거절·유보가 기존 기한을 취소하지 않으며 이후 자동 처리는 기존 엔진을 따른다.\n\n모든 사건은 가공의 합성 사례다. 역사 근거는 관행·문서 형태를 뒷받침하며 인물의 실제 대사·해당 마을의 확정 사건·게임 수치까지 입증하지 않는다. \`history.inference\`와 \`history.limits\`를 함께 읽는다.\n\n청지기 자동 선례는 보유한 지도 밖 영지의 같은 kind에 한정된다. 홈 적용 여부는 사용자 설명과 확인 코드가 달라 효과 목록에 불일치를 기록했다. 새 ID별 선례 연결은 등록기 설계 사항이다. 정책·장려금은 도시가 행동할 조건이며 특정 건물·수선·이주를 보장하지 않는다. 혼인 제안은 수락이나 즉시 상속이 아니다.\n\n## 삽화 의뢰 공통 규격\n\n각 사건의 한 줄 설명은 미래 의뢰용이며 이번에 이미지를 생성하지 않았다. [아트 바이블](${repo+prov.head+'/docs/design/art-bible.md'})에 따라 사건 삽화는 960×540, 글자 없음, 프로젝트 승인 삽화의 회화 질감. 낮은 채도의 남부 잉글랜드 재료와 복식, 시대별 예외를 따른다. 초기 일반 주택 굴뚝·홉 표식·근세 역병 표식·현대 기계를 넣지 않는다.\n\n## 검수와 재현\n\n기준 HEAD: \`${prov.head}\`. 지정 가지의 소스는 수정하지 않았고 커밋·푸시하지 않았다. 검수 범위는 문서·효과 대응·수량·파일 무결성이다. 미설치 원고이므로 런타임 발동률·경제 균형·실제 플레이 결과는 검증하지 않았다. 검수 기록은 \`records/\`에 있다. ZIP을 풀고 \`shasum -a 256 -c SHA256SUMS\`로 내부 파일을 확인할 수 있다.\n`);
write('README.md',fs.readFileSync(path.join(root,'README.md'),'utf8')+'\n## 2차 보강 자료\n\n[변경 요약](REVISION_NOTES.md) · [기존 사건 문구 개선 목록](EXISTING_EVENT_COPY.md) · [등록기 형식 제안](REGISTRY_PROPOSAL.md) · [JSON Schema](registry.schema.json) · [등록 예시](registry.example.json)\n');
console.log(JSON.stringify({events:events.length,choices:events.reduce((n,e)=>n+e.choices.length,0),periods:periods.map(p=>[p,events.filter(e=>e.period===p).length]),categories:cats.map(c=>[c,events.filter(e=>e.category===c).length])}));
