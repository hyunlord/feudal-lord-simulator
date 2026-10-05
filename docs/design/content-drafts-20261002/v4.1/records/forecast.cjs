const fs=require('node:fs');
const out='/tmp/astra-content-v4.1-20261005/';
const recipes=JSON.parse(fs.readFileSync(out+'records/recipes.json'));
const assumptions={201:{q:.8},202:{contexts:20,reach:.8},203:{q:.55},204:{q:.5},205:{q:.2},206:{contexts:10},207:{q:.25},208:{q:.55},209:{q:.15},210:{contexts:10},211:{contexts:4},212:{q:.55},213:{contexts:3},214:{q:.15},215:{q:.8}};
const scenarios=[];
for(const [name,selection] of [['low',.25],['middle',.4],['high',.6]]){
 const rows=recipes.map(r=>{const a=assumptions[r.n];function forecast(start,end){const lo=Math.max(start,r.years[0]),hi=Math.min(end,r.years[1]);if(lo>hi)return 0;const years=hi-lo+1;const totalYears=Math.max(0,Math.min(1424,r.years[1])-Math.max(1300,r.years[0])+1);if(a.contexts!==undefined)return a.contexts*(a.reach??1)*selection*years/totalYears;const annual=1-Math.pow(1-r.chance/1000,r.seasons.length);return years*annual*a.q*selection*.9;}
 return {id:`ck_evt_${r.n}`,category:r.cat,assumptions:a,additional125:forecast(1300,1424),additionalLate:forecast(1381,1424)};});
 const cats=Object.fromEntries(['도시','자연','세력'].map(cat=>[cat,rows.filter(r=>r.category===cat).reduce((sum,r)=>sum+r.additional125,0)]));
 scenarios.push({name,selection,categoryAdditions:cats,lateAdditions:rows.reduce((sum,r)=>sum+r.additionalLate,0),rows});
}
const p='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill-lme9b/docs/verification/lm-e9b/runs/';
const old=JSON.parse(fs.readFileSync('/Users/rexxa/fls-astra-content41/docs/design/content-drafts-20261002/v4/events-v4.json'));const cat=Object.fromEntries(old.map(e=>[e.id,e.category]));
const baseline=[1,2,3].map(seed=>{const x=JSON.parse(fs.readFileSync(p+`v4e-run-${seed}.json`));const byCategory={};for(const o of x.occurrences)byCategory[cat[o.entry]]=(byCategory[cat[o.entry]]??0)+1;const late=x.occurrences.filter(o=>o.year>=1381&&o.year<=1424).length;return {seed,total:x.occurrences.length,byCategory,early:x.occurrences.length-late,late,source:`lm-e9b/runs/v4e-run-${seed}.json`};});
fs.writeFileSync(out+'proofs/distribution-model.json',JSON.stringify({kind:'assumption_based_editorial_sensitivity_model_NOT_world_simulation',notes:['q and context counts are not measured','selection includes competition and stale contexts, not validated','0.9 is an assumed spacing correction, not exact cooldown integration','new 011 neighbor appearances excluded; recalculate target after installation'],scenarios,baseline},null,2)+'\n');
console.log(JSON.stringify({baseline,scenarios:scenarios.map(({name,categoryAdditions,lateAdditions})=>({name,categoryAdditions,lateAdditions}))},null,2));
