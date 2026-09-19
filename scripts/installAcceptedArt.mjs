import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseWorldAssetManifest } from './worldAssetManifest.ts';
import { BUILDING_SPECS, renderScaleForWorldAsset } from './worldAssetContracts.ts';
import { measureTerrainSeams, assertTerrainSeams, buildTerrainTile2x2 } from './terrainTexturePipeline.ts';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH ?? '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] ?? path.join(root, '../feudal-lord-simulator/output'));
const evidence = path.join(root, 'docs/asset-evidence/accepted-art');
const manifestPath = path.join(root, 'public/assets/world_asset_manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const levelThreeHouse = manifest.assets.find(asset => asset.key === 'house_l3');
if (levelThreeHouse) levelThreeHouse.footprint = BUILDING_SPECS.house_l3.footprint;
parseWorldAssetManifest(manifest);
const mappings = {
 tree_dead:'playable-edges-v1/assets/tree_dead_v1.png',
 house_l4:'housing-p0-v1/house_l4_1x1_sw_a.png',
 house_l3:'housing-p0-v1/house_l3_1x1_sw_a.png',
 house_l0:'housing-p0-v1/house_l0_1x1_sw_a.png',house_l1:'housing-p0-v1/house_l1_1x1_sw_a.png',house_l2:'housing-p0-v1/house_l2_1x1_sw_a.png',
 well:'civic-p1-v1/well_1x1_sw_a.png',barn:'civic-p1-v1/granary_2x2_sw_a.png',storehouse:'civic-p1-v1/storehouse_2x2_sw_a.png',
 logging_camp:'industry-p1-v1/logging_camp_1x1_sw_a.png',sawmill:'industry-p1-v1/sawmill_1x1_sw_a.png',
 tree_oak_large:'nature-canopy-v1/assets/oak_large.png',tree_oak_small:'nature-edge-v1/assets/oak_small_b.png',
 tree_pine_tall:'nature-canopy-v1/assets/pine_large.png',tree_pine_short:'nature-edge-v1/assets/pine_small_b.png',tree_birch:'nature-edge-v1/assets/birch_small_b.png',
 stump_fresh:'nature-edge-v1/assets/stump_a.png',stump_old:'nature-edge-v1/assets/stump_b.png',shrub_a:'nature-edge-v1/assets/bush_a.png',shrub_b:'nature-edge-v1/assets/bush_b.png',
 grass_tuft:'nature-canopy-v1/assets/grass_tuft_a_v2.png',field_stone:'nature-edge-v1/assets/rock_b.png',
 grass:'terrain-ground-v1/assets/grass_a.png',forest_floor:'terrain-ground-v1/assets/forest_floor.png',packed_earth_road:'terrain-ground-v1/assets/dirt.png',
};
const hash = data => createHash('sha256').update(data).digest('hex');
await fs.mkdir(path.join(evidence,'before'),{recursive:true});
try { await fs.copyFile(manifestPath,path.join(evidence,'before/world_asset_manifest.json'),fs.constants.COPYFILE_EXCL); } catch(e) { if(e.code!=='EEXIST')throw e; }
const entries=[];
for(const [key,relative] of Object.entries(mappings)) {
 const asset=manifest.assets.find(a=>a.key===key); if(!asset)throw new Error(`Missing ${key}`);
 const sourcePath=path.join(sourceRoot,relative),source=await fs.readFile(sourcePath),target=path.join(root,asset.path);
 const backup=path.join(evidence,'before',`${key}.png`);
 try { await fs.copyFile(target,backup,fs.constants.COPYFILE_EXCL); } catch(e) { if(e.code!=='EEXIST')throw e; }
 const original=await fs.readFile(backup);
 let output,transform;
 if(asset.category==='terrain') {
  const {data,info}=await sharp(source).resize(asset.width,asset.height,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,band=8;
  for(let i=3;i<data.length;i+=4)data[i]=255;
  for(const axis of [0,1])for(let d=0;d<band;d++)for(let p=0;p<(axis===0?h:w);p++) {
   const lo=axis===0?(p*w+d)*4:(d*w+p)*4,hi=axis===0?(p*w+w-1-d)*4:((h-1-d)*w+p)*4;
   for(let c=0;c<3;c++){const avg=(data[lo+c]+data[hi+c])/2,f=1-d/band;data[lo+c]=Math.round(data[lo+c]+(avg-data[lo+c])*f);data[hi+c]=Math.round(data[hi+c]+(avg-data[hi+c])*f);}
  }
  const texture={dimensions:{width:w,height:h},rgba:data};
  const metrics=measureTerrainSeams(w===256?buildTerrainTile2x2(texture):texture);assertTerrainSeams(metrics);
  asset.seamMetrics={horizontalJoinDelta:metrics.horizontalJoinBandDelta,verticalJoinDelta:metrics.verticalJoinBandDelta,horizontalInternalDelta:metrics.horizontalInternalBandDelta,verticalInternalDelta:metrics.verticalInternalBandDelta,threshold:24,passed:true};
  output=await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();transform={method:'lanczos3-resize-periodic-edge-blend',edgeBand:band,seamMetrics:metrics};
 } else {
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error(`${key}: empty alpha`);
  const bounds={left,top,width:right-left+1,height:bottom-top+1};
  const singleTileWidth=key==='house_l3'?88*renderScaleForWorldAsset('house_l2',BUILDING_SPECS.house_l2.height)/asset.renderScale:88;
  const maxW=asset.category==='building'?Math.min(asset.width-4,asset.footprint.width===1?singleTileWidth:139):asset.width-4;
  const base=Math.min(asset.anchor.y,asset.height-2),maxH=base-2;
  const ratio=Math.min(maxW/bounds.width,maxH/bounds.height),width=Math.max(1,Math.round(bounds.width*ratio)),height=Math.max(1,Math.round(bounds.height*ratio));
  const sprite=await sharp(source).extract(bounds).resize(width,height,{fit:'fill'}).png().toBuffer();
  const dest={left:Math.round(asset.anchor.x-width/2),top:base-height+1};
  output=await sharp({create:{width:asset.width,height:asset.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,...dest}]).png().toBuffer();
  asset.alphaPolicy='transparent-native-alpha';
  transform={method:'alpha-bounds-uniform-fit-lanczos3',boundsAlphaThreshold:8,sourceBounds:bounds,scale:ratio,resized:{width,height},destination:dest,baseline:base,quantization:false,addedOutline:false};
 }
 await fs.writeFile(target,output);
 asset.sha256=hash(output);asset.source={kind:'accepted-art',path:path.relative(root,sourcePath),sha256:hash(source)};
 entries.push({key,sourcePath:asset.source.path,sourceSha256:hash(source),destination:asset.path,beforeSha256:hash(original),outputSha256:hash(output),dimensions:{width:asset.width,height:asset.height},anchor:asset.anchor,footprint:asset.footprint,renderScale:asset.renderScale,transform});
}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(evidence,'integration.json'),JSON.stringify({version:1,entries,untouchedKeys:manifest.assets.filter(a=>!mappings[a.key]).map(a=>a.key),limitations:['house_l3 sprite footprint aligned to existing 1x1 gameplay footprint; housing merging remains separate','No gameplay footprint, anchor, dimension, or renderScale changes']},null,2)+'\n');
console.log(`Installed ${entries.length} accepted assets with hashes and native aspect/alpha`);
