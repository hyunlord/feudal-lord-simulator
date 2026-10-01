const fs=require('fs'),cp=require('child_process'),path=require('path');const dir='/tmp/QA_CONSOLIDATED_03_14/evidence';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.gif'));const rows=[];
function probe(p){return JSON.parse(cp.execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames','-of','json',p],{encoding:'utf8'})).streams[0]}
async function one(f){const src=path.join(dir,f),dst=src+'.compressed.gif',before=probe(src);if(before.width<=640)return;
 await new Promise((resolve,reject)=>{const child=cp.spawn('ffmpeg',['-v','error','-threads','1','-i',src,'-filter_complex_threads','1','-filter_complex','[0:v]scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',dst]);child.on('exit',code=>code===0?resolve():reject(Error(f+':'+code)))});
 const after=probe(dst);if(before.nb_read_frames!==after.nb_read_frames)throw Error('frame loss '+f);
 const bytesBefore=fs.statSync(src).size,bytesAfter=fs.statSync(dst).size;fs.renameSync(dst,src);rows.push({file:f,before,after,bytesBefore,bytesAfter});}
(async()=>{for(let i=0;i<files.length;i+=2)await Promise.all(files.slice(i,i+2).map(one));fs.writeFileSync('/tmp/QA_CONSOLIDATED_03_14/repro/compression.json',JSON.stringify({note:'GIF spatial downscale only; every frame retained. JPEG evidence unchanged. Source originals untouched.',rows},null,2));console.log(rows)})().catch(e=>{console.error(e);process.exitCode=1});
