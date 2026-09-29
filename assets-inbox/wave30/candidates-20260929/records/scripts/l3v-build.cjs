const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{const rows=JSON.parse(fs.readFileSync(path.join(root,'records/l3v-generation.json')));for(const r of rows){const name=`house_pair_l3_vertical_${r.v}${r.state?'_'+r.state:''}-v1.png`;fs.copyFileSync(r.source,path.join(root,'native/l3v',name));await sharp(r.source).resize(183,183,{fit:'fill'}).png().toFile(path.join(root,'assets',name));} })();
