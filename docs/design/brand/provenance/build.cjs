const fs=require('node:fs'),path=require('node:path');
const sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root='/tmp/charter-kin-brand-20261002';
const lines=JSON.parse(fs.readFileSync('/tmp/charter-kin-work-20261002/outlines.json'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const n=x=>Number(x.toFixed(3));
const themes={light:{ink:'#493522',bg:'#F3EBDD',rim:'#693726'},dark:{ink:'#F7E8CD',bg:'#242A26',rim:'#D9B875'}};
function waxPath(){
 const pts=Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;const r=87+4.2*Math.sin(a*9+.6)+2.2*Math.cos(a*5);return [100+r*Math.cos(a),100+r*Math.sin(a)];});
 let d=`M${pts[0].map(n).join(' ')}`;
 for(let i=0;i<pts.length;i++){const a=pts[(i+47)%48],b=pts[i],c=pts[(i+1)%48],e=pts[(i+2)%48];d+=` C${n(b[0]+(c[0]-a[0])/6)} ${n(b[1]+(c[1]-a[1])/6)} ${n(c[0]-(e[0]-b[0])/6)} ${n(c[1]-(e[1]-b[1])/6)} ${n(c[0])} ${n(c[1])}`;}
 return d+'Z';
}
function seal(theme,small=false){return `<g id="wax-seal"><path id="wax-edge" d="${waxPath()}" fill="#934631" stroke="${themes[theme].rim}" stroke-width="${small?5:2}"/><circle id="pressed-rim" cx="100" cy="100" r="69" fill="#693726" stroke="#D9B875" stroke-width="${small?4:2.8}"/><circle id="wax-face" cx="100" cy="100" r="61" fill="#AB5B3D"/>${small?'':'<path id="press-highlight" d="M55 67 A57 57 0 0 1 143 62" fill="none" stroke="#D9B875" stroke-width="2" stroke-linecap="round"/>'}<g id="oak-impression" transform="rotate(24 100 100)"><path id="oak-leaf" d="M100 151 C86 143 75 143 78 131 C65 134 58 126 65 116 C49 112 50 99 65 98 C50 86 56 74 72 80 C67 62 79 57 88 70 C85 48 93 39 100 39 C108 40 115 50 112 70 C122 58 133 64 128 80 C143 74 150 86 135 98 C150 99 151 112 135 116 C143 127 135 134 122 131 C125 143 112 143 100 151Z" fill="#D9B875"/><path id="leaf-midvein" d="M100 57V163" fill="none" stroke="#693726" stroke-width="${small?5:3.2}" stroke-linecap="round"/>${small?'':'<path id="leaf-veins" d="M100 90L84 79M100 108L75 96M100 128L81 116M100 90L116 79M100 108L125 96M100 128L119 116" fill="none" stroke="#934631" stroke-width="2.5" stroke-linecap="round"/>'}</g></g>`;}
function textLine(str,x,y,width,theme,outlined,id){const l=lines.find(l=>l.text===str);const scale=width/l.width;const body=outlined?`<g id="${id}" aria-label="${escape(str)}" transform="translate(${x} ${y}) scale(${n(scale)} ${n(-scale)})"><path d="${l.path}"/></g>`:`<text id="${id}" x="0" y="0" transform="translate(${x} ${y}) scale(${n(scale)})" font-family="${l.family}" font-weight="600" font-size="100" style="font-kerning:normal;font-variation-settings:'wght' 600">${str === "인장과 가문" ? '<tspan x="0">인장과 </tspan><tspan x="315.088">가문</tspan>' : escape(str)}</text>`;return `<g fill="${themes[theme].ink}">${body}</g>`;}
function svg(w,h,body,title,meta=''){return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${escape(title)}</title><metadata>Charter &amp; Kin / 인장과 가문; identity v1; ${meta}; original vector seal, not traced raster.</metadata>${body}</svg>\n`;}
async function main(){
 const entries=[];
 for(const lang of ['en','ko'])for(const layout of ['horizontal','vertical'])for(const theme of ['light','dark'])for(const mode of ['text','outlined']){
 const en=lang==='en',hor=layout==='horizontal',outlined=mode==='outlined';let w=hor?1200:720,h=hor?280:640;
 let body=hor?`<g transform="translate(28 40)">${seal(theme)}</g>`:`<g transform="translate(265 25) scale(.95)">${seal(theme)}</g>`;
 if(hor)body+=textLine(en?'Charter & Kin':'인장과 가문',270,en?183:186,860,theme,outlined,'wordmark');
 else {body+=textLine(en?'Charter':'인장과',en?95:132,en?371:370,en?530:456,theme,outlined,'wordmark-line-1');body+=textLine(en?'& Kin':'가문',en?168:185,en?530:548,en?384:350,theme,outlined,'wordmark-line-2');}
 const name=`charter-kin-${lang}-${layout}-on-${theme}-${mode}.svg`;
 const data=svg(w,h,body,en?'Charter & Kin':'인장과 가문',`${en?'EB Garamond':'Noto Serif KR'} SemiBold 600; SIL OFL 1.1; ${mode}`);
 fs.writeFileSync(path.join(root,'logos',name),data);
 entries.push({file:'logos/'+name,lang,layout,theme,mode,width:w,height:h});
 if(outlined){await sharp(Buffer.from(data)).png().toFile(path.join(root,'logos',name.replace('-outlined.svg','.png')));await sharp(Buffer.from(data)).flatten({background:themes[theme].bg}).jpeg({quality:92}).toFile(path.join(root,'previews',name.replace('-outlined.svg','.jpg')));}
 }
 for(const size of [32,64,256])for(const theme of ['light','dark']){
 const data=svg(size,size,`<g transform="scale(${size/200})">${seal(theme,size===32)}</g>`,'Charter & Kin seal',size===32?'optical-small; secondary veins omitted':'standard seal');const name=`seal-${size}-on-${theme}`;
 fs.writeFileSync(path.join(root,'icons',name+'.svg'),data);await sharp(Buffer.from(data)).png().toFile(path.join(root,'icons',name+'.png'));
 entries.push({file:'icons/'+name+'.svg',theme,width:size,height:size,mode:size===32?'optical-small':'standard'});
 }
 const tiles=[];const W=1280,H=1090;
 for(const [col,theme] of ['light','dark'].entries()){
 const bg=themes[theme].bg;
 tiles.push({input:await sharp({create:{width:640,height:H,channels:3,background:bg}}).png().toBuffer(),left:col*640,top:0});
 for(const [row,lang]of ['en','ko'].entries()){
 const prefix=`charter-kin-${lang}`;
 tiles.push({input:await sharp(path.join(root,'logos',`${prefix}-horizontal-on-${theme}.png`)).resize(590).toBuffer(),left:col*640+25,top:25+row*145});
 tiles.push({input:await sharp(path.join(root,'logos',`${prefix}-vertical-on-${theme}.png`)).resize(300).toBuffer(),left:col*640+20+row*310,top:350});
 }
 let x=45;for(const size of [32,64,256]){tiles.push({input:path.join(root,'icons',`seal-${size}-on-${theme}.png`),left:col*640+x,top:730+Math.floor((256-size)/2)});x+=size+52;}
 }
 await sharp({create:{width:W,height:H,channels:3,background:'#F3EBDD'}}).composite(tiles).jpeg({quality:92}).toFile(path.join(root,'previews','BRAND-BOARD.jpg'));
 fs.writeFileSync(path.join(root,'provenance','vector-manifest.json'),JSON.stringify(entries,null,2)+'\n');
 console.log('Created 16 logo SVG + 8 PNG, 6 icon SVG + 6 PNG, 9 preview JPEG');
}
main().catch(e=>{console.error(e);process.exitCode=1});
