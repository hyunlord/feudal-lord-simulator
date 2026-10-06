import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Analysis, type AnalysisResult } from './analysis-summary.js';
import { readDataset } from './analysis-files.js';
import { outcomeWriter } from './analysis-outcomes.js';
const percent=(value:number)=>`${(100*value).toFixed(2)}%`;
function markdown(result:AnalysisResult,coverage:Awaited<ReturnType<typeof readDataset>>):string{
 const lines=['# R04 리그 집계', '', `입력: ${coverage.kind}. ${coverage.count}/${coverage.expected}판; ${coverage.complete?'예정 ID 전부 확인':'미완료 부분 집계'}. SHA256·소스·schedule·좌석·순서·V 정산 검증 통과.`, '', `소스 묶음: \`${coverage.sourceHash}\`. 독립 seed ${result.seeds.length}개.`, '', '**탐색 결과다. 시제품의 목적함수 안에서 측정한 성적이며 지배전략 부재나 상용 밸런스의 증명이 아니다.**',''];
 if(result.duel){lines.push('## 1:1 회복 후 승점률','','|전략|경기|승/무/패|승점률|95% seed bootstrap|분류|','|---|---:|---:|---:|---|---|');for(const row of [...result.duel.strategies].sort((a,b)=>b.scoreRate-a.scoreRate))lines.push(`|${row.strategy}|${row.games}|${row.wins}/${row.draws}/${row.losses}|${percent(row.scoreRate)}|${row.interval95.map(percent).join(' ~ ')}|${row.flag}|`);lines.push('',`공동 재표집에서 최대 전략 성적의95% 분포: ${result.duel.maxDistribution95.map(percent).join(' ~ ')}. 55% 초과 관찰,60% 초과 위험 후보. 6seed라도 확증적 동시 상한이 아니다.`,'');}
 const multi=result.multi.filter(r=>!r.key.includes('|'));if(multi.length){lines.push('## 4도시 우승 비중','','|전략|참가|분할 우승률|정규화 순위|','|---|---:|---:|---:|');for(const row of [...multi].sort((a,b)=>b.mean-a.mean))lines.push(`|${row.key}|${row.count}|${percent(row.mean)}|${percent(result.multiNormalizedRank.find(r=>r.key===row.key)?.mean??0)}|`);lines.push('',`참가당 균등 기대25%. 1:1의60% 문턱을 적용하지 않는다. 상위25%(각 판 1위,동률 분할) 주된축 엔트로피 ${result.diversity.topEntropy.toFixed(4)}, 참가 기준 ${result.diversity.participantEntropy.toFixed(4)}. 다자 ${result.seeds.length}seed는 매우 좁다.`,'');}
 lines.push('## 전쟁과 평화','',`대외 명령 기회 ${result.war.opportunities}. 실제 전투 ${result.war.attacks.reduce((s,r)=>s+r.attempts,0)}. 비출정 ${result.war.decisions['peace']??0}, 유상 평화 유지 ${result.war.decisions['honor-pact']??0}. 비출정을 군사 패배로 세지 않는다.`,'','|공격 전략/방식|출정|목표 확보율|평균 순자원|공격 사망|방어 사망|','|---|---:|---:|---:|---:|---:|');for(const row of result.war.attacks)lines.push(`|${row.key.replaceAll("|"," / ")}|${row.attempts}|${percent(row.successRate)}|${row.meanNetResources.toFixed(2)}|${row.attackerLosses}|${row.defenderLosses}|`);
 lines.push('','## 목적함수 민감도','','|인구값|자원배율|최고 성적 전략|최고 성적|','|---:|---:|---|---:|');for(const row of result.sensitivity){const sorted=[...(row.duel.length?row.duel:row.multi)].sort((a,b)=>b.mean-a.mean),leader=sorted[0];lines.push(`|${row.populationWeight}|${row.resourceScale}|${leader?.key??'자료 없음'}|${percent(leader?.mean??0)}|`);}
 lines.push('','전체 전략의9개 식별 성적, 지형·시점·좌석·상대별 표, 원장 흐름·시설의 단계별 평균, 성장→대외→회복 변화, 정책 전체 벡터 분포와 시설/공간/흐름 거리, 외교 영수증 수는 같은 이름의 JSON에 보관한다. 평균은 해당 schedule 참가 빈도 가중이며 별도 성장 실험을 대신하지 않는다.','',...result.limitations.map(note=>`- ${note}`),'','완료되지 않은 리그나 smoke는 최종 밸런스 판정에 사용하지 않는다.');return lines.join('\n')+'\n';
}
async function main():Promise<void>{
 const flags=new Map<string,string>();for(let index=2;index<process.argv.length;index+=2){const key=process.argv[index],value=process.argv[index+1];if(!key||!value||flags.has(key)||!['--input','--kind','--out','--partial'].includes(key))throw new RangeError('Use --input DIR --kind duel|multi|smoke --out DIR [--partial true]');flags.set(key,value);}
 const kind=flags.get('--kind');if(kind!=='duel'&&kind!=='multi'&&kind!=='smoke')throw new RangeError('--kind required');const partial=flags.get('--partial');if(partial!==undefined&&partial!=='true')throw new RangeError('--partial only accepts true');
 const input=resolve(flags.get('--input')??'records/league-run'),output=resolve(flags.get('--out')??'records/league-analysis'),analysis=new Analysis();
 await mkdir(output,{recursive:true});const writer=outcomeWriter(join(output,`${kind}-outcomes.ndjson.gz`));
 let coverage:Awaited<ReturnType<typeof readDataset>>;
 try{coverage=await readDataset({input,kind,partial:partial==='true'},async game=>{analysis.add(game);await writer.add(game);});if(coverage.count===0)throw new RangeError('No complete games');await writer.finish();}catch(error){await writer.abort();throw error;}const result=analysis.finish();
 await mkdir(output,{recursive:true});await writeFile(join(output,`${kind}-analysis.json`),JSON.stringify({coverage,...result},null,2)+'\n');await writeFile(join(output,`${kind}-analysis.md`),markdown(result,coverage));console.log(JSON.stringify({kind,games:result.games,complete:coverage.complete,output}));
}
await main();
