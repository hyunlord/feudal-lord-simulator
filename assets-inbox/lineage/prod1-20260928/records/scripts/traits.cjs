const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const entries=JSON.parse(fs.readFileSync(base+'/records/assets.json'));
const value=x=>Array.isArray(x)?x.join('; '):Object.entries(x||{}).map(([k,v])=>`${k}: ${v}`).join('; ');
const identities=[...new Set(entries.map(r=>r.identity))];
const parts=['# 혈통·개인 표식 계약','가족 공통은 머리색·전체 얼굴형·눈썹(또는 가문 표식) 세 가지다. 코와 턱을 부모 얼굴에서 그대로 복제하는 계약이 아니다. 나이는 제작 목표이며 보이는 나이 검수와 구분한다. 외부 배우자는 새 얼굴이며, 후손은 실제 양부모 이미지를 참조했다. 개인 표식은 화상에서 읽히는지 별도로 검수한다.'];
for(const id of identities){const group=entries.filter(r=>r.identity===id),r=group.find(r=>r.stage==='young')||group[0];parts.push(`## ${id}`,`- 혈통: ${r.lineage} / 부모: ${r.fatherIdentity||'—'} + ${r.motherIdentity||'—'}`,`- 가족 공통: ${value(r.commonTraits)}`,`- 차이 표식: ${value(r.differenceMarkers)}`,`- 단계별 나이·혼인: ${group.map(g=>`${g.stage} ${g.age}세 (${g.maritalStatus})`).join(' / ')}`,`- 복식: ${group.map(g=>`${g.stage}: ${g.clothing}`).join(' / ')}`);}
fs.writeFileSync(base+'/TRAITS.md',parts.join('\n\n')+'\n');
console.log('TRAITS '+identities.length+' identities');
