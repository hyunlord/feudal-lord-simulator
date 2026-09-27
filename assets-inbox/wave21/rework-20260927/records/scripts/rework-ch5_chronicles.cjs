const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const b=path.resolve(__dirname,'..');
const rows=JSON.parse(fs.readFileSync(path.join(b,'records/metadata-rework-ch5_chronicles.json')));
(async()=>{for(const r of rows){const g=r.generationRecords.at(-1);fs.mkdirSync(path.dirname(path.join(b,g.rawFile)),{recursive:true});fs.mkdirSync(path.dirname(path.join(b,r.file)),{recursive:true});fs.copyFileSync(g.sourcePath,path.join(b,g.rawFile));await sharp(path.join(b,g.rawFile)).resize(r.width,r.height,{fit:'cover',kernel:'lanczos3'}).png().toFile(path.join(b,r.file));}await sharp({create:{width:768,height:768,channels:3,background:'#b4ad9e'}}).composite(rows.map((r,i)=>({input:path.join(b,r.file),left:(i%2)*384,top:Math.floor(i/2)*384}))).png().toFile(path.join(b,'raw/rework-ch5_chronicles/contact.png'));})();
