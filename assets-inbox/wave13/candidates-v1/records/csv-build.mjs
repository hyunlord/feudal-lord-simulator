import fs from 'node:fs/promises';
import { Workbook } from '@oai/artifact-tool';
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-wave13-candidates-v1';
const rows=JSON.parse(await fs.readFile(root+'/records/asset-rows.json','utf8'));
const headers=Object.keys(rows[0]);const data=[headers,...rows.map(a=>headers.map(k=>a[k]))];
const book=Workbook.create(),sheet=book.worksheets.add('AssetRecords');sheet.getRange('A1:L35').values=data;book.recalculate();
const actual=sheet.getRange('A1:L35').values;
if(actual.length!==35||actual[0].length!==12)throw Error('count');
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=actual.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
const imported=await Workbook.fromCSV(csv,{sheetName:'Check'});const back=imported.worksheets.getItem('Check').getRange('A1:L35').values;
for(let i=1;i<back.length;i++){JSON.parse(back[i][7]);if(back[i][0]!==rows[i-1].asset_id||back[i][6]!==rows[i-1].sha256)throw Error('roundtrip');}
await fs.writeFile(root+'/assets.csv','\uFEFF'+csv);
await fs.writeFile(root+'/records/csv-validation.json',JSON.stringify({tool:'artifact-tool workbook authoring and CSV reimport',dataRows:34,columns:12,fullGenerationJsonParsed:true,idsAndHashesPreserved:true},null,2));
console.log('CSV34x12 authored/reimport verified');
