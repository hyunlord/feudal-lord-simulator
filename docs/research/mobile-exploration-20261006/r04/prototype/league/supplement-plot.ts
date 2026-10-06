import { AXES } from '../model/index.js';
import { average, growthRows } from './supplement-analysis-data.js';
/** Mean stocks only; does not imply confidence intervals or a balanced metagame. */
export function growthFoodPlot(results:readonly unknown[]):string{
 const rows=results.flatMap(growthRows),ticks=[48,96,144];
 const series=AXES.map(axis=>({axis,points:ticks.map(tick=>({tick,food:average(rows.filter(r=>r.strategy===axis&&r.tick===tick).map(r=>r.stocks.food))}))}));
 const ceiling=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.food)));
 const colors=['#a96924','#336ba1','#986294','#a14543','#5b8552','#616c99','#308d8b','#787154'];
 const paths=series.map((s,index)=>{const color=colors[index]??'#000000';return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${s.points.map(p=>`${70+(p.tick-48)*4.2},${330-p.food/ceiling*245}`).join(' ')}"/><text x="510" y="${100+index*25}" fill="${color}" font-size="13">${s.axis}</text>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="410" viewBox="0 0 680 410"><rect width="680" height="410" fill="#fffdf7"/><g font-family="sans-serif" fill="#252525"><text x="30" y="30" font-size="18">Mean food stock by pure policy</text><text x="30" y="52" font-size="12">5 terrains x 5 training seeds; no error bars, not balance evidence</text><path d="M70 80V330H474" fill="none" stroke="#777"/><text x="18" y="88" font-size="12">${Math.ceil(ceiling)}</text><text x="40" y="334" font-size="12">0</text>${ticks.map(t=>`<text x="${62+(t-48)*4.2}" y="354" font-size="12">${t}</text>`).join('')}<text x="210" y="382" font-size="13">Economic settlements</text>${paths}</g></svg>`;
}
