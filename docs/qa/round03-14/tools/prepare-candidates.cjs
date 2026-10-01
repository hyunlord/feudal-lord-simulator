const fs=require('fs');const p='/tmp/QA_CONSOLIDATED_03_14/candidate-audit.md';let s=fs.readFileSync(p,'utf8');
s=s.replace(/\/tmp\/QA_ROUND_\d+\/evidence\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|gif)/g,p=>`[사진](${p})`);fs.writeFileSync(p,s);
