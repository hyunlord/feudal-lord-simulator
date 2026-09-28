const fs=require('fs'),path=require('path');
const p=path.resolve(__dirname,'..'),rows=JSON.parse(fs.readFileSync(p+'/records/asset-rows.json'));
const proofs=fs.readdirSync(p+'/proofs').filter(f=>f.endsWith('.png')).sort();if(proofs.length!==4)throw Error('proof count');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
fs.writeFileSync(p+'/index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>혈통 초상 파일럿</title><style>body{background:#2b2925;color:#eee7d8;font:16px system-ui;margin:24px}a{color:#e8c582}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(256px,1fr));gap:16px}article{background:#3d3830;padding:10px}img{width:256px;height:256px;object-fit:contain}small{display:block}</style><h1>혈통 초상 파일럿</h1><p>80 PNG · 후보 · 게임 미설치</p><p>${proofs.map(f=>`<a href="proofs/${f}">${f}</a>`).join(' · ')}</p><main>${rows.map(r=>`<article><a href="${r.file}"><img src="${r.file}" loading="lazy" alt="${r.identity} ${r.stage}"></a><p>${r.asset_id}</p><small>${esc(r.clothing)}</small></article>`).join('')}</main></html>`);
fs.writeFileSync(p+'/IMAGE_LINKS.md','# 개별 초상 링크\n\n'+proofs.map(f=>`- [${f}](${p}/proofs/${f})`).join('\n')+'\n\n'+rows.map(r=>`- [${r.asset_id}](${p}/${r.file})`).join('\n')+'\n');
console.log('gallery80+proof4links');
