import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export {sharp,fs,path};
export const W='/tmp/astra-wave20-rework-20260927',D=W+'/delivery',R='/tmp/astra-wave20-work-20260926/astra-wave20-reference-files';
export async function pixels(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,w:info.width,h:info.height};}
export function bounds(p,threshold=8){let left=p.w,top=p.h,right=-1,bottom=-1;for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)if(p.data[(y*p.w+x)*4+3]>threshold){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<left)throw Error('Empty alpha');return{left,top,width:right-left+1,height:bottom-top+1};}
export const original=l=>R+`/house_l${l}-v${l?2:3}.png`;
export async function save(p,file){await fs.mkdir(path.dirname(file),{recursive:true});await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).png().toFile(file);}
export function xml(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
export function label(x,y,s,size=14,color='#443e33'){return`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${xml(s)}</text>`;}
export function svg(w,h,content){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${content}</svg>`);}
export async function sha(file){return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}
export function csv(rows,keys=Object.keys(rows[0])){const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])).join(','))].join('\r\n')+'\r\n';}
export async function sheet(items,file,{columns=5,width=220,height=225,scale=1}={}){const rows=Math.ceil(items.length/columns),cw=width*columns,ch=height*rows,comps=[];let labels='';for(let i=0;i<items.length;i++){const item=items[i],p=await pixels(item.file),x=(i%columns)*width,y=Math.floor(i/columns)*height;const b=await sharp(item.file).resize(Math.round(p.w*scale),Math.round(p.h*scale),{kernel:scale>1?'nearest':'lanczos3'}).png().toBuffer();comps.push({input:b,left:x+Math.round((width-p.w*scale)/2),top:y+height-40-Math.round(p.h*scale)});labels+=label(x+8,y+height-19,item.name,12);}comps.push({input:svg(cw,ch,labels),left:0,top:0});await sharp({create:{width:cw,height:ch,channels:4,background:'#c6bda9'}}).composite(comps).png().toFile(file);}
