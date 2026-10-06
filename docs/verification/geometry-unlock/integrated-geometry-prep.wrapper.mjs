import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => cp.execFileSync('git',args,{maxBuffer:128*1024*1024});
const names = args => git(args).toString().split('\0').filter(Boolean);
const expectedHead='718dce4b60c5cb0c5be0178284034ed49bfc67f7';
const prefix='.omo/evidence/integrated-geometry-prep.';
const manifestPath=prefix+'freeze.json', contractPath=prefix+'contract.json', wrapperPath=prefix+'wrapper.mjs';
const own=[wrapperPath,contractPath,manifestPath];
const out='.remote/integrated-geometry';
const api=await import(pathToFileURL(path.resolve('scripts/checks/uiGeometry.mjs')).href);
const read=p=>JSON.parse(fs.readFileSync(p));
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');};
const record = filename => {const s=fs.lstatSync(filename);assert.ok(s.isFile()||s.isSymbolicLink(),filename);return s.isSymbolicLink()?{type:'symlink',target:fs.readlinkSync(filename)}:{type:'file',bytes:s.size,sha256:sha(fs.readFileSync(filename))};};
function lfsRecords(tracked) {
 const attr=cp.execFileSync('git',['check-attr','--cached','-z','--stdin','filter'],{input:tracked.join('\0')+'\0',maxBuffer:32*1024*1024}).toString().split('\0');
 const files=[];for(let i=0;i+2<attr.length;i+=3)if(attr[i+2]==='lfs')files.push(attr[i]);
 const batch=cp.execFileSync('git',['cat-file','--batch'],{input:files.map(p=>'HEAD:'+p+'\n').join(''),maxBuffer:128*1024*1024});
 let offset=0;return files.map(filename=>{const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString();const size=Number(header.split(' ')[2]);assert.ok(Number.isSafeInteger(size));offset=end+1;const blob=batch.subarray(offset,offset+size);offset+=size+1;
 const pointer=/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)\n?$/.exec(blob.toString());
 assert.ok(pointer,`filter=lfs but HEAD is not a canonical pointer: ${filename}`);
 const current=fs.readFileSync(filename);assert.equal(current.length,Number(pointer[2]),filename);assert.equal(sha(current),pointer[1],filename);
 return {path:filename,oid:pointer[1],bytes:Number(pointer[2])};});
}
function external() {
 const measure=p=>{assert.ok(p);const actual=fs.realpathSync(p);return {path:p,realpath:actual,...record(actual)};};
 const tree=(dir,root=dir)=>Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?Object.entries(tree(p,root)):[[path.relative(root,p),record(p)]];}));
 const dependencies=tree('node_modules');const playwright=tree(path.dirname(process.env.FLS_PLAYWRIGHT_CORE));
 return {node:measure(process.execPath),nodeVersion:process.version,chromium:measure(process.env.FLS_CHROMIUM_PATH),chromiumVersion:cp.execFileSync(process.env.FLS_CHROMIUM_PATH,['--version']).toString().trim(),playwrightEntry:measure(process.env.FLS_PLAYWRIGHT_CORE),shim:measure(process.env.PLAYWRIGHT_MODULE),dependencies,playwright,nmKey:fs.readFileSync('node_modules/.fls-nm-key','utf8').trim()};
}
export function compareExternal(before, after) {
 const {dependencies: previous,...beforeOther}=before;
 const {dependencies: current,...afterOther}=after;
 assert.deepEqual(afterOther,beforeOther,'External runtime bytes drift');
 for(const [name,entry] of Object.entries(previous))assert.deepEqual(current[name],entry,'Preexisting dependency changed or deleted: '+name);
 const additions=Object.fromEntries(Object.entries(current).filter(([name])=>!Object.hasOwn(previous,name)));
 for(const [name,entry] of Object.entries(additions)) {
  const allowed=/^\.vite(?:-temp)?\//.test(name)||/^\.cache\/keyart-derivatives\/[0-9a-f]{64}-v1-(?:jpeg-q70|png-half|portrait(?:-96)?-q82)$/.test(name);
  assert.ok(allowed&&entry.type==='file','Unexpected dependency addition: '+name);
 }
 return {preexistingFiles:Object.keys(previous).length,additions};
}

function filesIn(root, dir='') {
 return fs.readdirSync(path.join(root,dir||'.'),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  const rel=dir?dir+'/'+e.name:e.name,p=path.join(root,rel),s=fs.lstatSync(p);assert.ok(!s.isSymbolicLink(),'Private fixture symlink: '+p);
  return s.isDirectory()?filesIn(root,rel):(assert.ok(s.isFile()),[{path:rel,sha256:sha(fs.readFileSync(p))}]);
 }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function snapshot(ending=false) {
 assert.equal(git(['rev-parse','HEAD']).toString().trim(),expectedHead);
 const tracked=names(['ls-files','-z']).sort();
 const untracked=names(['ls-files','--others','--exclude-standard','-z']).sort();
 const resultPrefix=`docs/verification/uiaudit1/geometry/${process.env.FLS_REMOTE_RUN}/`;
 assert.deepEqual(untracked.filter(p=>!own.includes(p)&&!(ending&&p.startsWith(resultPrefix))),[],'Unapproved untracked export input');
 const status=git(['status','--porcelain','--untracked-files=no']).toString();
 if(!ending)assert.equal(status,'','Dirty export');
 else assert.deepEqual(names(['diff','--name-only','-z','HEAD']).filter(p=>p!==api.UI_GEOMETRY_SUMMARY),[],'Unexpected tracked mutation');
 const files=Object.fromEntries(tracked.filter(p=>p!==api.UI_GEOMETRY_SUMMARY).map(p=>[p,record(p)]));
 const inputs=api.geometryInputs('HEAD');
 assert.equal(read(api.UI_GEOMETRY_BASELINE).entries.length,0);assert.equal(read(api.UI_GEOMETRY_EXCEPTIONS).exceptions.length,0);
 const exported=[...tracked,...own].sort();assert.equal(new Set(exported).size,exported.length);
 assert.ok(!exported.some(p=>p.includes('\n')),'Official line inventory cannot carry newline paths');
 return {head:expectedHead,tracked,files,summaryBefore:ending?null:record(api.UI_GEOMETRY_SUMMARY),helpers:Object.fromEntries([wrapperPath,contractPath].map(p=>[p,record(p)])),exported,lfs:lfsRecords(tracked),inputs,inputHash:api.geometryInputHash(inputs)};
}
export function validateReport(summary, report, contract, inputHash, run) {
 for(const v of [summary,report]){assert.equal(v.commit,expectedHead);assert.equal(v.dirty,false);assert.equal(v.inputHash,inputHash);assert.equal(v.run,run);assert.deepEqual(v.axes,contract.axes);}
 for(const key of ['rows','conditions','measured']){assert.equal(summary[key],contract.expected[key]);assert.equal(report.totals[key],contract.expected[key]);}
 for(const key of ['failures','unopened','unregisteredFramed'])assert.equal(summary[key],0);
 for(const key of ['failures','unopened'])assert.equal(report.totals[key],0);
 assert.deepEqual(summary.failureKeys,[]);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.unregisteredFramed,[]);
 assert.deepEqual(summary.unreachable,contract.unreachable);assert.deepEqual(report.totals.unreachable,contract.unreachable);
 for(const n of Object.values(summary.baseline))assert.equal(n,0,'Nonzero baseline/exception/new/fixed');
 assert.deepEqual(Object.keys(report.rows).sort(),Object.keys(contract.rows).sort());
 let total=0,unreachable=0;
 for(const [id,expected]of Object.entries(contract.rows)){
  const row=report.rows[id];assert.equal(row.unreachable??null,expected.unreachable);
  assert.deepEqual(Object.keys(row.conditions).sort(),expected.conditions);
  for(const cell of Object.values(row.conditions)){total++;assert.equal(cell.status,expected.unreachable?'unreachable':'measured');if(expected.unreachable)unreachable++;else{assert.equal(cell.total,0);assert.deepEqual(cell.keys,[]);assert.deepEqual(cell.failures,[]);}}
 }
 assert.equal(total,2262);assert.equal(unreachable,60);
 assert.ok(Number.isSafeInteger(summary.warnings)&&summary.warnings>=0);assert.equal(report.totals.warnings,summary.warnings);
 return {rows:122,reachable:2202,unreachableRows:4,unreachableRecords:60,warnings:summary.warnings,retried:report.retried};
}
function compareSnapshot(before,after){for(const k of Object.keys(before).filter(k=>k!=='summaryBefore'))assert.deepEqual(after[k],before[k],k);}
function census(plan,ending=false){
 const walk=(dir='')=>fs.readdirSync(dir||'.',{withFileTypes:true}).flatMap(e=>{const p=dir?dir+'/'+e.name:e.name;if(/^(\.git|\.remote|\.remote-in|node_modules)(\/|$)/.test(p))return[];return e.isDirectory()?walk(p):[p];});
 const extras=walk().filter(p=>!plan.exported.includes(p));const allowed=`docs/verification/uiaudit1/geometry/${process.env.FLS_REMOTE_RUN}/`;
 assert.ok(extras.every(p=>ending&&p.startsWith(allowed)),'Unknown remote files: '+extras.join(','));return extras;
}
export async function withFixtureWriteRestoration(work) {
 const targets = [], errors = [];
 const restore = filename => {
  let stat;
  try { stat = fs.lstatSync(filename); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat.isSymbolicLink()) return;
  fs.chmodSync(filename, (stat.mode & 0o7777) | 0o200);
  if (stat.isDirectory()) for (const name of fs.readdirSync(filename)) {
   try { restore(path.join(filename, name)); } catch (error) { errors.push(error); }
  }
 };
 try { return await work(target => targets.push(target)); }
 catch (error) { errors.push(error); }
 finally {
  for (const target of targets) {
   try { restore(target); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Fixture run or owner-write restoration failed');
 }
}
async function main(){
 const [mode,hash]=process.argv.slice(2);
 if(mode==='freeze'){const snap=snapshot();write(manifestPath,{schema:1,...snap});console.log(JSON.stringify({head:snap.head,tracked:snap.tracked.length,exported:snap.exported.length,lfs:snap.lfs.length,native:snap.inputs.length,inputHash:snap.inputHash,freezeSHA256:sha(fs.readFileSync(manifestPath)),notSubmitted:true}));return;}
 assert.equal(sha(fs.readFileSync(manifestPath)),hash,'Freeze bytes changed');const plan=read(manifestPath);const before=snapshot();assert.deepEqual(before,Object.fromEntries(Object.keys(before).map(k=>[k,plan[k]])));
 if(mode==='verify'){console.log('Full local freeze verified; NOT SUBMITTED');return;}
 assert.equal(mode,'run');assert.equal(process.env.FLS_REMOTE,'1');assert.equal(process.env.DIRTY,'0');assert.equal(process.env.FLS_REMOTE_COMMIT,expectedHead);
 assert.equal(cp.execFileSync('git',['-C',process.env.FLS_REMOTE_MIRROR,'rev-parse','refs/remote-runs/'+process.env.FLS_REMOTE_RUN],{encoding:'utf8'}).trim(),expectedHead);
 assert.deepEqual(fs.readFileSync('.remote-in/in-files.txt','utf8').split('\n').filter(Boolean).sort(),plan.exported);census(plan);
 const contract=read(contractPath), fixtures=[],env={...process.env,FLS_UI_GEOMETRY_GATE:'enforce'};delete env.FLS_UI_GEOMETRY_REASON;
 assert.ok(!fs.existsSync(out),'Refuse duplicate run');fs.mkdirSync(out,{recursive:true});write(out+'/source-freeze.json',plan);
 const dependenciesBefore=external();write(out+'/external-start.json',dependenciesBefore);
 await withFixtureWriteRestoration(async registerTarget => {
 for(const [key,expected]of Object.entries(contract.fixtures)){
  const source=path.resolve(process.env[key]||path.join(os.homedir(),expected.defaultFolder));const target=path.resolve(out,'private-scenes',key);assert.ok(!fs.lstatSync(source).isSymbolicLink());
  assert.deepEqual(filesIn(source),expected.files,'Historical fixture bytes differ: '+key);registerTarget(target);fs.mkdirSync(target,{recursive:true});
  for(const r of expected.files){const dest=path.join(target,r.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,r.path),dest);fs.chmodSync(dest,0o444);}
  assert.deepEqual(filesIn(source),expected.files);assert.deepEqual(filesIn(target),expected.files);
  const lock=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory())lock(path.join(dir,e.name));fs.chmodSync(dir,0o555);};lock(target);
  fixtures.push({key,source,target,files:expected.files});env[key]=target;
 }
 write(out+'/fixtures-start.json',fixtures);write(out+'/start.json',{head:expectedHead,clean:true,inputHash:plan.inputHash,tracked:plan.tracked.length,exported:plan.exported.length,lfs:plan.lfs.length,command:['bash','scripts/remote/tasks.sh','ui-geometry']});
 const r=cp.spawnSync('bash',['scripts/remote/tasks.sh','ui-geometry'],{env,stdio:'inherit'});const errors=[];const check=f=>{try{return f();}catch(e){errors.push(e.stack);return null;}};
 const end=check(()=>snapshot(true));if(end)check(()=>compareSnapshot(before,end));check(()=>assert.equal(sha(fs.readFileSync(manifestPath)),hash));check(()=>census(plan,true));
 const fixtureEnd=check(()=>fixtures.map(row=>({key:row.key,files:filesIn(row.target)})));write(out+'/fixtures-end.json',fixtureEnd);
 check(()=>assert.deepEqual(fixtureEnd,fixtures.map(({key,files})=>({key,files}))));
 const dependenciesAfter=check(()=>external());write(out+'/external-end.json',dependenciesAfter);const dependencyComparison=check(()=>compareExternal(dependenciesBefore,dependenciesAfter));
 const summary=check(()=>read(api.UI_GEOMETRY_SUMMARY));const report=summary&&check(()=>{assert.equal(summary.report,`docs/verification/uiaudit1/geometry/${process.env.FLS_REMOTE_RUN}/geometry.json`);return read(summary.report);});
 const geometry=summary&&report&&check(()=>{assert.equal(summary.inputs,plan.inputs.length);assert.equal(report.inputs,plan.inputs.length);return validateReport(summary,report,contract,plan.inputHash,process.env.FLS_REMOTE_RUN);});
 write(out+'/final.json',{pass:r.status===0&&errors.length===0,auditExit:r.status,signal:r.signal,head:expectedHead,inputHash:plan.inputHash,errors,geometry,dependencyComparison,summary,sourceUnchanged:!!end&&errors.length===0});process.exitCode=r.status===0&&errors.length===0?0:1;
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(wrapperPath))await main();
