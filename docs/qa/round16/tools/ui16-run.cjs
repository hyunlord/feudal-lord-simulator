const fs=require('fs');fetch('http://127.0.0.1:4833',{method:'POST',body:JSON.stringify({code:fs.readFileSync(0,'utf8')})}).then(x=>x.text()).then(console.log);
