const fs = require('fs');
const path = require('path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const specs = [
 ['baby','male',0.5,'sparse pale flaxen down','fair warm','blue grey','round broad cheeks','tiny upturned','soft round','fine pale','undyed linen swaddle with muted sage outer wrap'],
 ['baby','female',1,'dense dark brown soft curls','deep warm brown','dark brown','oval full cheeks','small broad rounded','soft narrow','soft dark arc','dusty rose wool wrap over cream linen swaddle'],
 ['baby','male',1.5,'fine short copper red wisps','light freckled warm','green grey','wide pear shaped','short gently straight','wide soft','light straight','muted blue grey linen swaddle'],
 ['baby','female',0.8,'moderately thick straight black tuft','medium olive brown','brown','round compact','small button','small round','dark curved','oatmeal linen swaddle with faded ochre outer cloth'],
 ['toddler','female',3,'wavy chestnut bob','fair rosy','hazel','round full cheeks','short rounded','soft broad','fine curved','plain muted green wool gown with linen neckline'],
 ['toddler','male',4,'short tightly curled black hair','deep warm brown','dark brown','rounded oval','small broad','soft taper','dark straight','plain clay red wool tunic over linen shift'],
 ['toddler','female',5,'fine straight pale blond chin length hair','light warm','blue grey','long oval child cheeks','short straight','narrow rounded','pale gentle arc','plain blue grey wool gown with simple linen neckline'],
 ['toddler','male',3.5,'thick auburn short tousled hair','medium warm beige','green brown','wide round','upturned broad tip','round wide','auburn low arc','ochre brown wool tunic with undyed linen collar'],
 ['child','male',7,'thick dark brown straight ear length hair','medium olive','hazel brown','slender oval','small straight','gently tapered','dark level','plain faded blue wool tunic with cream linen neck'],
 ['child','female',8,'copper red loosely waved shoulder length hair','fair lightly freckled','green','broad round','upturned','soft broad','copper arched','plain muted russet wool gown with oatmeal linen collar'],
 ['child','male',6,'light brown tight short curls','deep golden brown','dark brown','short oval full cheeks','broad round tip','rounded compact','dark softly curved','plain moss green wool tunic with undyed linen neckline'],
 ['child','female',9,'dark blond straight hair in two simple braids','light warm beige','grey blue','long oval','short gently convex','narrow soft','light straight','plain dark brown wool gown with cream linen neckline'],
];
const refs = ['references/초상풀_1차_화풍기준.jpg','references/노화사슬_성공예.jpg'];
function contracts() {
 return specs.map((s,i)=> {
 const [stage,sex,age,hair,skin,eyes,faceShape,nose,jaw,brow,clothing]=s;
 const identity=`L0_${String(i+1).padStart(3,'0')}`; const id=`${identity}_${stage}`;
 const traits={hair,skin,eyes,faceShape,nose,jaw,brow};
 const prompt=`Use case: historical-scene. Generate exactly ONE square individual painted game portrait, no contact sheet. Input images are project-owned STYLE REFERENCES ONLY: match their restrained handpainted gouache realism, muted palette, crisp readable face, modest brush texture; do not copy any reference identity or any text. Subject: a distinct commoner ${sex} ${stage}, age ${age} years, Southern England circa 1300–1450. Traits: ${JSON.stringify(traits)}. Clothing: ${clothing}. Age is crucial: ${stage==='baby'?'natural infant anatomy, large rounded head, tiny nose and jaw, very short neck, wrapped infant bust, swaddle below chin leaving entire face and hair visible':stage==='toddler'?'clearly a small preschool child with naturally large head, soft full cheeks, short neck and small shoulders, not a miniature adult':'natural primary-school child anatomy, soft immature jaw and cheeks, modest small shoulders, no adult facial structure'}. Composition: head and upper torso centered, gentle three-quarter turn, entire crown and chin visible, face readable at 96px. Plain solid muted warm grey background. Soft light from upper left. Ordinary clean linen and wool, no expensive trim. All skin tones treated with equal dignity, neutral attentive expression. No facial hair, makeup, adult jewelry, heraldry, badge, border, text, scenery, props, hands or visible arms. Single square image.`;
 fs.writeFileSync(path.join(root,'prompts/common',`${id}.txt`),prompt+'\n');
 return {id,file:`assets/common/${id}.png`,width:256,height:256,identity,lineage:'common',generation:null,fatherIdentity:null,motherIdentity:null,stage,sex,age,clothing,traits,inheritance:null,generationRecords:[{prompt,rawFile:`raw/common/${id}.png`,referenceImages:refs,tool:'image_gen.imagegen',model:null,seed:null}],processing:'Sharp Lanczos3 resize contain 256x256 preserving aspect; no repainting',qa:{status:'pending'}};
 });
}
async function main(){
 const action=process.argv[2];
 if(action==='init'){fs.writeFileSync(path.join(root,'records/common-trait-contracts.json'),JSON.stringify(contracts(),null,2));fs.writeFileSync(path.join(root,'records/metadata-common.json'),'[]\n');}
 if(action==='save'){
 const i=Number(process.argv[3]);const raw=process.argv[4];const rows=JSON.parse(fs.readFileSync(path.join(root,'records/common-trait-contracts.json')));const row=rows[i];
 fs.copyFileSync(raw,path.join(root,row.generationRecords[0].rawFile));
 await sharp(raw).resize(256,256,{fit:'contain',background:'#777264',kernel:'lanczos3'}).png().toFile(path.join(root,row.file));
 row.qa={status:'generated-awaiting-visual-review'};row.processing={operation:'aspect-preserving resize contain',width:256,height:256,kernel:'lanczos3',rawMetadata:await sharp(raw).metadata()};
 const dest=path.join(root,'records/metadata-common.json');const existing=JSON.parse(fs.readFileSync(dest));existing.push(row);existing.sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(dest,JSON.stringify(existing,null,2));
 }
 if(action==='contact'){
 const rows=JSON.parse(fs.readFileSync(path.join(root,'records/metadata-common.json')));const composites=[];
 for(let i=0;i<rows.length;i++)composites.push({input:path.join(root,rows[i].file),left:(i%4)*256,top:Math.floor(i/4)*256});
 await sharp({create:{width:1024,height:768,channels:3,background:'#ddd5c5'}}).composite(composites).png().toFile(path.join(root,'records/commoncontact.png'));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
