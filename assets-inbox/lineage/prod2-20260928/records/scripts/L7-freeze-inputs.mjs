import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-lineage-prod2-v1';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(e.name.endsWith('.png'))files.push(q);}}
walk(root+'/records');
const hashes=new Map(files.map(p=>[hash(p),p]));
const jobs=JSON.parse(fs.readFileSync(root+'/records/L7-jobs.json'));
const changes=[];
for(const j of jobs){
 // The revision303 target is the preserved rejected first output, not the later canonical.
 // Earlier save runs rehashed mutable canonical names; recover this one known input explicitly.
 if(j.id==='L7_303_young-v2'){
  const p=root+'/records/L7_303_young-rejected.png';
  const old=j.referenceSHA256[0];
  if(old.sha256!==hash(p))changes.push({id:j.id,reason:'Correct helper rehash of mutable canonical after generation; actual edit target preserved as rejected first attempt',previous:old,actual:{file:p,sha256:hash(p)}});
  j.referenceSHA256[0]={file:p,sha256:hash(p)};j.refs[0]=p;
 }
 for(let i=0;i<j.referenceSHA256.length;i++){
  const ref=j.referenceSHA256[i];
  if(fs.existsSync(ref.file)&&hash(ref.file)===ref.sha256)continue;
  const frozen=hashes.get(ref.sha256);if(!frozen)throw Error('Missing exact historical input '+j.id+' '+ref.sha256);
  changes.push({id:j.id,original:ref.file,frozen,sha256:ref.sha256});
  ref.file=frozen;j.refs[i]=frozen;
 }
}
fs.writeFileSync(root+'/records/L7-jobs.json',JSON.stringify(jobs,null,2));
fs.writeFileSync(root+'/records/L7-reference-freeze-audit.json',JSON.stringify(changes,null,2));
console.log('Resolved',changes.length,'references');
