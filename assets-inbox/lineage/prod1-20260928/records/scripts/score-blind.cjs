const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(base+'/records/'+f));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(base+'/'+f)).digest('hex');
const frozen=read('frozen.json');
for(const f of frozen.inputs)if(hash(f.file)!==f.sha256)throw Error('Image changed after freeze: '+f.file);
const family=read('family-judge.json'),identity=read('identity-judge.json');
const key=read('family-key.json'),pairKey=read('identity-key.json');
const groups=Object.values(family.groups),seen=groups.flat();
if(groups.length!==3||seen.length!==30||new Set(seen).size!==30||seen.some(n=>!Number.isInteger(n)||n<1||n>30))throw Error('Invalid family response');
const permutations=[['L3','L4','L5'],['L3','L5','L4'],['L4','L3','L5'],['L4','L5','L3'],['L5','L3','L4'],['L5','L4','L3']];
const scores=permutations.map(labels=>({labels,correct:key.items.filter(i=>groups[labels.indexOf(i.family)].includes(i.number)).length})).sort((a,b)=>b.correct-a.correct);
if(identity.pairs.length!==18||new Set(identity.pairs.map(p=>p.number)).size!==18)throw Error('Invalid pair response');
const pairs=pairKey.pairs.map(p=>{const got=identity.pairs.find(i=>i.number===p.number);if(!got||!['same','different'].includes(got.answer))throw Error('Invalid pair answer');return{number:p.number,left:p.left,right:p.right,expected:p.relation,actual:got.answer,correct:got.answer===p.relation};});
const result={family:{correct:scores[0].correct,total:30,accuracy:scores[0].correct/30,required:0.8,pass:scores[0].correct>=24,bestGroupMapping:scores[0].labels},identity:{correct:pairs.filter(p=>p.correct).length,total:18,required:18,pass:pairs.every(p=>p.correct),pairs},limitations:'Independent AI visual judgment, not human recognition study. Clothing, hair and sex cues are visible. 96px and256px viewing specified in raw judge records.'};
if(identity.pairs96?.length===18){result.identity.actual96px={correct:pairKey.pairs.filter(p=>identity.pairs96.find(i=>i.number===p.number)?.answer===p.relation).length,total:18};}
result.pass=result.family.pass&&result.identity.pass;
fs.writeFileSync(base+'/records/blind-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
