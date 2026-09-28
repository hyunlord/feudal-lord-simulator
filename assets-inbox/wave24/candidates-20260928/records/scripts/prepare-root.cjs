const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  await sharp(path.join(root, 'records/main-native-v2.png')).resize(1232,706,{fit:'fill'}).png({compressionLevel:9}).toFile(path.join(root,'assets/steam_main_capsule.png'));
  const native = path.join(root, 'records/emblem-native.png');
  await sharp(native).resize(1280,720,{fit:'fill'}).png({compressionLevel:9}).toFile(path.join(root,'assets/steam_library_logo_emblem.png'));
  // Only technical alpha-bound trim for icon derivation. The capsule paintings
  // are independently composed; no scene is cropped into another capsule.
  const trimmed = await sharp(native).trim({threshold:1}).toBuffer();
  for(const [id,size] of [['steam_app_icon',184],['steam_shortcut_icon',256]]){
    await sharp(trimmed).resize(size-16,size-16,{fit:'contain',background:'#00000000'}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'}).png({compressionLevel:9}).toFile(path.join(root,`assets/${id}.png`));
  }
  const light = await sharp(native).resize(560).flatten({background:'#e8ddc5'}).png().toBuffer();
  const dark = await sharp(native).resize(560).flatten({background:'#172432'}).png().toBuffer();
  await sharp({create:{width:1120,height:315,channels:3,background:'#e8ddc5'}}).composite([{input:light,left:0,top:0},{input:dark,left:560,top:0}]).png().toFile(path.join(root,'records/emblem-alpha-check.png'));
  const stats = await sharp(native).stats();
  await fs.writeFile(path.join(root,'records/root-export.json'),JSON.stringify({main:{native:await sharp(path.join(root,'records/main-native-v2.png')).metadata(),final:[1232,706],method:'independently generated, technical aspect normalization'},emblem:{native:await sharp(native).metadata(),alpha:stats.channels[3],final:[1280,720]},icons:{method:'same emblem alpha-bound trim, fit, eight-pixel padding',sizes:[184,256]}},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
