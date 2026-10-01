import fs from 'node:fs/promises';import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const W='/tmp/astra-wave38-work',p=W+'/reference/card-crop.png',b=await fs.readFile(p);
const parchment=await sharp(b).extract({left:320,top:190,width:192,height:46}).png().toBuffer();
const bottom=await sharp(b).extract({left:34,top:285,width:280,height:18}).resize(478,18).png().toBuffer();
const right=await sharp(b).extract({left:510,top:140,width:14,height:50}).png().toBuffer();
await sharp(b).composite([{input:parchment,left:320,top:240},{input:right,left:510,top:240},{input:bottom,left:34,top:285}]).png().toFile(W+'/reference/card-clean.png');
await fs.mkdir(W+'/records',{recursive:true});await fs.writeFile(W+'/records/card-placement.json',JSON.stringify({source:'사용자_인물카드.png',source_size:[3456,2234],normalized_width:1920,crop:[664,462,544,312],interior:[28,29,482,256],controls:[{id:'button_primary_normal',rect:[224,230,128,40],label:'전기 보기'},{id:'button_secondary_normal',rect:[364,230,128,40],label:'닫기'},{id:'close_normal',rect:[462,45,32,32]}],minimumClearance:15,cleanup:'Clone blank original parchment onto old footer and clone existing frame strips to restore occluded bottom/right borders; preserve portrait/text.'},null,2));
