import{W,D,fs,path,sha}from'./lib.mjs';
import JSZip from '/tmp/astra-wave7-rework-csv-work/node_modules/jszip/lib/index.js';
import crypto from 'node:crypto';
const out='/tmp/astra-wave20-rework-20260927.zip',prefix='astra-wave20-rework-v2/';
async function walk(dir,rel=''){let list=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(rel,e.name);if(e.isDirectory())list.push(...await walk(path.join(dir,e.name),p));else if(e.isFile())list.push(p);else throw Error('Unexpected non-file '+p);}return list.sort();}
let files=(await walk(D)).filter(p=>p!=='SHA256SUMS.txt');const sums=[];for(const p of files)sums.push((await sha(D+'/'+p))+'  '+p);await fs.writeFile(D+'/SHA256SUMS.txt',sums.join('\n')+'\n');files=await walk(D);
const zip=new JSZip();for(const p of files)zip.file(prefix+p,await fs.readFile(D+'/'+p),{date:new Date('2026-09-27T02:00:00+09:00')});const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});await fs.writeFile(out,bytes);
const loaded=await JSZip.loadAsync(await fs.readFile(out),{checkCRC32:true});let verified=0;for(const line of sums){const [expected,p]=[line.slice(0,64),line.slice(66)];const b=await loaded.file(prefix+p).async('nodebuffer');if(crypto.createHash('sha256').update(b).digest('hex')!==expected)throw Error('ZIP sha mismatch '+p);verified++;}
const candidates=files.filter(p=>p.startsWith('assets/houses/')&&p.endsWith('.png')),proofs=files.filter(p=>p.startsWith('proofs/')&&p.endsWith('.png'));
if(candidates.length!==20||proofs.length!==2)throw Error('Final count failed');
const report={archive:out,bytes:bytes.length,sha256:await sha(out),crc:'all ZIP entries passed checkCRC32',internal_sha256_verified:verified,file_count:files.length,candidates:candidates.length,proofs:proofs.length,new_overlays:9,status:'PASS'};await fs.writeFile('/tmp/astra-wave20-rework-package-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
