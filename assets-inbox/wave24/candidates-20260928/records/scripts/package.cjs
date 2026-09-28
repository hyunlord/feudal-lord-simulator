const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const stage='/tmp/astra-wave24-candidates-20260928-lite';
const zip='/tmp/astra-wave24-candidates-20260928-lite.zip';
const raw='/Users/rexxa/feudal-lord-analysis/astra-raw/wave24-20260928';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function files(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(e.isFile())out.push(p);}return out;}
async function main(){
 await fs.mkdir(raw,{recursive:true});
 const manifest=[];
 for(const f of await files(path.join(root,'records'))){
  if(!/native.*\.png$/.test(path.basename(f)))continue;
  const b=await fs.readFile(f),m=await sharp(b).metadata();const dest=path.join(raw,path.basename(f));
  try{const old=await fs.readFile(dest);if(sha(old)!==sha(b))throw Error(`Raw preservation conflict ${dest}`);}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(dest,b);}
  manifest.push({record_reference:path.relative(root,f),raw_path:dest,sha256:sha(b),width:m.width,height:m.height,bytes:b.length});
 }
 await fs.writeFile(path.join(root,'records/raw-manifest.json'),JSON.stringify({archive_includes_native_png:false,raw_directory:raw,files:manifest},null,2));
 await fs.mkdir(stage,{recursive:true});
 const allowedRoot=['README.md','QA.md','generation-records.csv','index.html'];
 const selected=(await files(root)).filter(f=>{
  const rel=path.relative(root,f);
  if(rel==='records/package-result.json')return false;
  return allowedRoot.includes(rel)||['assets/','guides/','proofs/','exports/','references/','scripts/'].some(p=>rel.startsWith(p))||(rel.startsWith('records/')&&/\.(json|md)$/.test(rel));
 });
 for(const f of selected){const dest=path.join(stage,path.relative(root,f));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(f,dest);}
 // The archive receipt is written after ZIP creation and belongs outside it.
 // Remove only this script's stale staging receipt from a previous attempt.
 await fs.unlink(path.join(stage,'records/package-result.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 const rows=[];
 for(const f of (await files(stage)).sort()){
  const rel=path.relative(stage,f);if(['SHA256SUMS','PACKAGE-CHECK.json'].includes(rel))continue;
  rows.push(`${sha(await fs.readFile(f))}  ${rel}`);
 }
 await fs.writeFile(path.join(stage,'SHA256SUMS'),rows.join('\n')+'\n');
 const names=await files(stage);
 const count=prefix=>names.filter(f=>path.relative(stage,f).startsWith(prefix)).length;
 if(count('assets/')!==10||count('guides/')!==10||count('proofs/')!==2||count('exports/')!==1)throw Error('Wrong deliverable count');
 const validation={art_png:10,guide_png:10,proof_png:2,jpg_export:1,csv_rows:21,raw_png_excluded:manifest.length,hash_entries:rows.length+1,game_installation:false,steam_upload:false};
 await fs.writeFile(path.join(stage,'PACKAGE-CHECK.json'),JSON.stringify(validation,null,2));
 rows.push(`${sha(await fs.readFile(path.join(stage,'PACKAGE-CHECK.json')))}  PACKAGE-CHECK.json`);
 await fs.writeFile(path.join(stage,'SHA256SUMS'),rows.sort().join('\n')+'\n');
 // A new staging directory only contains this task. Zip is refreshed from it;
 // generated source PNGs remain untouched in both source and raw archive.
 try{await fs.access(zip);throw Error('Archive already exists; choose a versioned filename instead of overwriting');}catch(e){if(e.code!=='ENOENT')throw e;}
 // Python's ZIP writer marks non-ASCII names as UTF-8. The platform zip utility
 // omitted that flag, breaking Unicode filename lookup against SHA256SUMS.
 const zipScript="import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:\n for f in sorted(p.rglob('*')):\n  if f.is_file(): z.write(f, f.relative_to(p).as_posix())\n";
 cp.execFileSync('python3',['-c',zipScript,stage,zip]);
 const test=cp.execFileSync('unzip',['-t',zip],{encoding:'utf8'});
 const size=(await fs.stat(zip)).size;const digest=sha(await fs.readFile(zip));
 await fs.writeFile(zip+'.sha256',`${digest}  ${path.basename(zip)}\n`);
 await fs.writeFile(path.join(root,'records/package-result.json'),JSON.stringify({...validation,zip,zip_bytes:size,zip_sha256:digest,crc:test.trim().split('\n').at(-1)},null,2));
 console.log(JSON.stringify({...validation,zip,bytes:size,MiB:(size/1024/1024).toFixed(2),sha256:digest,crc:test.trim().split('\n').at(-1)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
