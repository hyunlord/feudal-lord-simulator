const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
let sharp;
try { sharp = require('sharp'); } catch { sharp = require(process.env.MAPKIT_SHARP || '/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp'); }
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const xml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

async function main() {
  const mapId = 'open_field-01';
  const map = read(`slots/${mapId}.json`);
  const source = read('references/neighbor-world.json');
  const markers = read('overlays/manifest.json');
  const remaining = new Set(map.slots.map(slot => slot.id));
  const assigned = [];
  // Reserve scarce large slots first; preserve household identity, not old geography.
  const ordered = [...source.placements].sort((a,b) => Number(a.sprite === 'manor') - Number(b.sprite === 'manor') || a.houseId.localeCompare(b.houseId));
  for (const estate of ordered) {
    const eligible = map.slots.filter(slot => remaining.has(slot.id) && slot.allowedKinds.includes(estate.sprite));
    eligible.sort((a,b) => Math.hypot(a.x-estate.x,a.y-estate.y)-Math.hypot(b.x-estate.x,b.y-estate.y) || a.id.localeCompare(b.id));
    assert(eligible.length, `No compatible slot for ${estate.houseId}`);
    const slot = eligible[0]; remaining.delete(slot.id);
    assigned.push({houseId:estate.houseId,houseNameEn:estate.houseNameEn,houseNameKo:estate.houseNameKo,estateId:estate.estateId,kind:estate.sprite,sourceAnchor:[estate.x,estate.y],slotId:slot.id,x:slot.x,y:slot.y,clearance:slot.clearance,flag:estate.houseId==='h01'?'flag-direct':'flag-neighbor'});
  }
  assigned.sort((a,b) => a.houseId.localeCompare(b.houseId));
  assert.equal(assigned.length,18);assert.equal(new Set(assigned.map(a=>a.slotId)).size,18);
  const layers=[];
  for (const estate of assigned) {
    const marker=markers.find(m=>m.id===estate.flag), scale=0.50;
    const input=await sharp(path.join(root,marker.path)).resize(Math.round(marker.width*scale),Math.round(marker.height*scale)).png().toBuffer();
    layers.push({input,left:Math.round(estate.x-marker.pivot[0]*scale),top:Math.round(estate.y-marker.pivot[1]*scale)});
    // Native blank ribbon retained on disk; display derivative is trimmed and reduced.
    const ribbon=await sharp(path.join(root,'overlays/name-ribbon.png')).trim().resize(76,16,{fit:'fill'}).png().toBuffer();
    layers.push({input:ribbon,left:estate.x-38,top:estate.y+5});
    layers.push({input:Buffer.from(`<svg width="76" height="16"><text x="38" y="12" text-anchor="middle" font-family="serif" font-size="11" fill="#392c20">${xml(estate.houseId)}</text></svg>`),left:estate.x-38,top:estate.y+5});
  }
  const imagePath=path.join(root,'proofs/neighbor-18.jpg');
  await sharp(path.join(root,`maps/${mapId}.jpg`)).composite(layers).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toFile(imagePath);
  const result={schemaVersion:1,status:'visual-slot-assignment-demo-not-engine-world',mapId,baseMapSha256:sha(path.join(root,`maps/${mapId}.jpg`)),image:'proofs/neighbor-18.jpg',imageSha256:sha(imagePath),placements:assigned,unusedSlotIds:[...remaining],preserved:'18 household and estate IDs, names, source sprite kind',changed:'Coordinates reassigned to compatible dry slots; old road graph, journey distances and travelDays are NOT transplanted.',display:'Flags and houseId ribbons only; no buildings baked into base maps. h01 direct and others neighbor; no invented political hostility.',source:'references/neighbor-world.json'};
  fs.writeFileSync(path.join(root,'proofs/neighbor-18.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({mapId,placed:18,remaining:remaining.size,image:imagePath}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
