const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const out='/tmp/QA_CONSOLIDATED_03_14', records=[];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function put(p,kind='evidence'){
 if(!fs.existsSync(p))throw Error('missing '+p);
 const round=p.match(/QA_ROUND_(\d+)/)?.[1]||'audit';
 const rel=kind+'/'+round+'-'+path.basename(p);
 if(!fs.existsSync(path.join(out,rel)))fs.copyFileSync(p,path.join(out,rel));
 if(!records.some(r=>r.output===rel))records.push({source:p,output:rel,sha256:sha(p)});
 if(kind==='evidence'){
  const meta=p.replace('/evidence/','/repro/').replace(/\.(jpg|jpeg|gif)$/i,'.json');
  if(fs.existsSync(meta))put(meta,'repro');
 }
 return rel;
}
function history(p){
 const dest=put(p,'history');
 const text=fs.readFileSync(p,'utf8').replace(/\[([^\]]*)\]\(([^)]+)\)/g,(_,label,target)=>`${label} (원문 경로: ${target})`);
 fs.writeFileSync(path.join(out,dest),text);return dest;
}
for(let n=3;n<=14;n++){
 const dir='/tmp/QA_ROUND_'+String(n).padStart(2,'0');
 for(const name of ['README.md','FINDINGS.md','REGRESSION.md','CHECKLIST.md'])if(fs.existsSync(dir+'/'+name))history(dir+'/'+name);
}
function transform(file){
 const full=path.join(out,file),text=fs.readFileSync(full,'utf8');
 const rewritten=text.replace(/\[([^\]]*)\]\(([^)]+)\)/g,(m,label,target)=>{
  if(/^https?:/.test(target))return m;
  const p=path.resolve(path.dirname(full),target);
  if(!fs.existsSync(p))throw Error('audit missing '+p);
  const rel=/\.(jpg|jpeg|gif|png)$/i.test(p)?put(p):p.endsWith('.md')?history(p):put(p,'repro');
  return `[${label}](${rel})`;
 });
 fs.writeFileSync(full,rewritten);
}
transform('closure-audit.md');transform('candidate-audit.md');
const extra={
 QA001:['14/evidence/wall14-tree-paused20-detail.jpg'],
 QA002:['14/evidence/wall14-idle1-valid120-detail.jpg'],
 QA004:['14/evidence/root14-020-auto-paused-end.jpg'],
 QA006:['03/evidence/26-ledger.jpg','14/evidence/ui14-021-resources375-bottom.jpg'],
 QA007:['14/evidence/wall14-exact003.jpg'],
 QA008:['03/evidence/04-zoom056.jpg'],
 QA009:['14/evidence/ui14-025-tax-paused.jpg'],
 QA013:['09/evidence/ui9-74-fullgoalchip375.jpg','09/evidence/ui9-75-goalcollapsedchip375.jpg'],
 QA031:['14/evidence/ui14-extra-02-problem-qaoff1600.jpg','14/evidence/ui14-extra-03-problem-qaoff375.jpg']
};
const audit=fs.readFileSync(out+'/closure-audit.md','utf8');
const rows=audit.split('\n').filter(l=>/^\| QA\d{3} \|/.test(l)).map(l=>{const c=l.split('|').map(s=>s.trim());return {id:c[1],status:c[2],round:c[3],description:c[4]}});
for(const r of rows){for(const f of extra[r.id]||[])r.description+=` · [사진](${put('/tmp/QA_ROUND_'+f)})`;}
const status={OPEN:'열림',CLOSED:'닫힘',NOT_REPRODUCED:'미재현',UNVERIFIED:'미검증',CANDIDATE:'후보'};
const category={QA001:'수목 움직임',QA002:'주민 움직임',QA003:'성벽 연결',QA004:'반복 길',QA005:'인물 가림',QA006:'장부 틀',QA007:'물가 성벽',QA008:'먼 줌 화풍',QA009:'빈 예측',QA010:'호칭·나이',QA011:'사건 삽화',QA012:'계절 경계',QA013:'목표·칩 가림',QA014:'직함 언어',QA015:'전기 장식선',QA016:'결정 버튼',QA017:'건설 분류',QA018:'설정 겹침',QA019:'설정 잘림',QA020:'가계도 이름',QA021:'닫기 기호',QA022:'더보기',QA023:'사건칩·상세 가림',QA024:'인물창 닫기',QA025:'목표보기·정지',QA026:'수레 보행',QA027:'영주관 화풍',QA028:'인구 기록',QA029:'연대기 접근',QA030:'재개 수치',QA031:'문제 범례',QA032:'장 결산 재노출',QA033:'서비스 거리 설명'};
function owner(id){return ['QA010','QA030','QA032','QA033'].includes(id)?'엔진/렌더 추정':['QA003','QA026','QA027'].includes(id)?'그림/렌더 추정':'렌더 추정'}
const lines=['# 3~14회차 통합 발견','', '번호가 같은 반복은 한 행으로 합쳤다. **현재 열림24·닫힘4·미재현3·미검증1·후보1 = 33개 ID**. 무번호 후보는 CANDIDATES.md에 별도. 최신 관찰 HEAD267b43b8 기준이며 이후 본선3acc04ff 변경은 미검증이다.',''];
for(const r of rows){const severity=r.status==='OPEN'?(r.id==='QA032'?'높음':'중간'):'판정 보류/해당 없음';lines.push(`- **${r.id} · ${category[r.id]} · ${severity} · ${owner(r.id)} · ${status[r.status]}** — ${r.description}`)}
fs.writeFileSync(out+'/FINDINGS.md',lines.join('\n')+'\n');
const csvval=v=>'"'+String(v).replaceAll('"','""')+'"';
fs.writeFileSync(out+'/ISSUES.csv','\ufeff'+[['id','category','status','owner_estimate','latest_evidence_round','evidence_and_reproduction'],...rows.map(r=>[r.id,category[r.id],status[r.status],owner(r.id),r.round,r.description])].map(r=>r.map(csvval).join(',')).join('\n')+'\n');
fs.copyFileSync('/tmp/QA_ROUND_14/CHECKLIST.md',out+'/CHECKLIST.md');
fs.writeFileSync(out+'/CHECKLIST.md',fs.readFileSync(out+'/CHECKLIST.md','utf8').replace(/\[([^\]]*)\]\(([^)]+)\)/g,(_,l,t)=>`${l} (14회차 원문: ${t})`)+'\n\n운영 우선순위는 NEXT_ROUND_RULES.md를 따른다. 49기준 전수 시험은 하루 한 번이며, 회차별 전수 반복 금지.\n');
for(const name of ['root14-observation.md','ui14-extra-observation.md','control14-observation.md','independent14-season-service.md'])history('/tmp/QA_ROUND_14/repro/'+name);
fs.writeFileSync(out+'/PROVENANCE.json',JSON.stringify({createdAt:new Date().toISOString(),evidenceUnchanged:true,historyLinksRenderedAsSourceText:true,files:records},null,2));
console.log(JSON.stringify({issues:rows.length,imported:records.length,evidence:records.filter(r=>r.output.startsWith('evidence/')).length},null,2));
