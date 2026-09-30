const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');let seed=20260930;
function rand(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
async function main(){const kit=shuffle(Array.from({length:216},(_,i)=>i+1)).slice(0,24).map(n=>({kind:'kit',source:'renders/base/C'+String(n).padStart(3,'0')+'.png'})),whole=Array.from({length:24},(_,i)=>({kind:'whole',source:'references/wave26_l2_'+['c','d','e','f'][i%4]+'.png'})),items=shuffle([...kit,...whole]),layers=[];
for(let i=0;i<items.length;i++){const label=String(i+1).padStart(2,'0'),src=path.join(root,items[i].source);fs.copyFileSync(src,path.join(root,'blind',label+'.png'));layers.push({input:src,left:(i%8)*150+6,top:Math.floor(i/8)*166+3},{input:Buffer.from('<svg width="150" height="23"><text x="64" y="17" fill="#f4efdf" font-size="14" font-family="sans-serif">'+label+'</text></svg>'),left:(i%8)*150,top:Math.floor(i/8)*166+141});items[i].slot=label;}
await sharp({create:{width:1200,height:996,channels:3,background:'#77806d'}}).composite(layers).jpeg({quality:95}).toFile(path.join(root,'blind/48-blind.jpg'));
fs.writeFileSync(path.join(root,'records/blind-answer-key.json'),JSON.stringify({seed:20260930,whole_unique:4,whole_repetitions:6,items},null,2));
fs.writeFileSync(path.join(root,'records/blind-frozen.sha256'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'blind/48-blind.jpg'))).digest('hex'));
}
main().catch(e=>{console.error(e);process.exit(1)});
