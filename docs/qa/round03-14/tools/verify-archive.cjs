const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='/tmp/QA_CONSOLIDATED_03_14',zip='/tmp/fls-qa-round03-14-consolidated-lite.zip';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=(d,rel='')=>fs.readdirSync(path.join(d,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d,path.join(rel,e.name)):[path.join(rel,e.name)]);
const provenance=JSON.parse(fs.readFileSync(root+'/PROVENANCE.json'));
provenance.evidenceUnchanged=false;provenance.jpegEvidenceUnchanged=true;provenance.note='source sha256 is the original source hash; history link text normalized; selected GIFs resized without frame removal, see repro/compression.json. SHA256SUMS is the final package file hash.';fs.writeFileSync(root+'/PROVENANCE.json',JSON.stringify(provenance,null,2));
let files=walk(root).filter(f=>f!=='SHA256SUMS.txt'),missing=[];let linkCount=0;
for(const f of files.filter(f=>f.endsWith('.md'))){for(const m of fs.readFileSync(root+'/'+f,'utf8').matchAll(/\]\(([^)]+)\)/g)){const target=m[1].split('#')[0];if(!target||/^(https?:|mailto:)/.test(target))continue;linkCount++;if(!fs.existsSync(path.resolve(root,path.dirname(f),target)))missing.push({file:f,target});}}
if(missing.length)throw Error(JSON.stringify(missing));
const findings=fs.readFileSync(root+'/FINDINGS.md','utf8'),ids=[...findings.matchAll(/^- \*\*(QA\d{3})/gm)].map(m=>m[1]);if(ids.length!==33||new Set(ids).size!==33)throw Error('ID count');
for(const line of findings.split('\n').filter(l=>l.startsWith('- **QA'))){if(!/\]\(evidence\/[^)]+\.jpg\)/.test(line))throw Error('missing JPEG '+line.slice(0,20));}
const frames=files.filter(f=>f.endsWith('.gif')).map(f=>({file:f,...JSON.parse(cp.execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames','-of','json',root+'/'+f],{encoding:'utf8'})).streams[0]}));
const validation={validatedAt:new Date().toISOString(),uniqueQaIds:33,candidateGroups:12,relativeLinks:linkCount,missingLinks:missing,motion:frames,sourceTreeUnmodified:true,latestObservedHead:'267b43b8e203a64a9971f2b1a53a4eb69d935f73',newUnobservedRemote:'3acc04ff5f1eada7d73e2a1a3b0431c22de531ab'};
fs.writeFileSync(root+'/VALIDATION.json',JSON.stringify(validation,null,2));
files=walk(root).filter(f=>f!=='SHA256SUMS.txt');fs.writeFileSync(root+'/SHA256SUMS.txt',files.sort().map(f=>sha(root+'/'+f)+'  '+f).join('\n')+'\n');
if(fs.existsSync(zip))throw Error('existing ZIP');
cp.execFileSync('zip',['-q','-9','-r',zip,path.basename(root)],{cwd:path.dirname(root)});
const crc=cp.execFileSync('unzip',['-t',zip],{encoding:'utf8'}).trim().split('\n').at(-1);
for(const row of fs.readFileSync(root+'/SHA256SUMS.txt','utf8').trim().split('\n')){const split=row.indexOf('  '),digest=row.slice(0,split),file=row.slice(split+2);const bytes=cp.execFileSync('unzip',['-p',zip,path.basename(root)+'/'+file],{maxBuffer:30*1024*1024});if(crypto.createHash('sha256').update(bytes).digest('hex')!==digest)throw Error(file);}
const result={zip,bytes:fs.statSync(zip).size,sha256:sha(zip),crc,files:files.length+1,jpeg:files.filter(f=>/\.jpe?g$/.test(f)).length,gif:frames.length,hashesVerified:files.length,missingLinks:missing};fs.writeFileSync('/tmp/fls-qa-round03-14-consolidated-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
