import fs from 'node:fs/promises';
import {Workbook} from '@oai/artifact-tool';
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-wave21-rework-v1';
const rows=JSON.parse(await fs.readFile(root+'/records/asset-rows.json','utf8'));
const checks=[];
for(const [file,items] of [['assets.csv',rows],['rework.csv',rows.filter(a=>a.revision==='reworked')]]){
 const headers=Object.keys(items[0]),data=[headers,...items.map(a=>headers.map(k=>a[k]))];
 const range=`A1:O${data.length}`,book=Workbook.create(),sheet=book.worksheets.add('Records');
 sheet.getRange(range).values=data;book.recalculate();
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const csv=sheet.getRange(range).values.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
 const imported=await Workbook.fromCSV(csv,{sheetName:'Check'});
 const back=imported.worksheets.getItem('Check').getRange(range).values;
 for(let i=0;i<data.length;i++)for(let j=0;j<15;j++)if(String(back[i][j])!==String(data[i][j]))throw Error(`roundtrip ${file}:${i}:${j}`);
 for(const row of back.slice(1))for(const j of [12,13,14])JSON.parse(row[j]);
 await fs.writeFile(root+'/'+file,'\uFEFF'+csv);
 checks.push({file,dataRows:items.length,columns:15,allCellsRoundtrip:true,jsonFieldsParsed:true});
}
await fs.writeFile(root+'/records/csv-validation.json',JSON.stringify({tool:'artifact-tool authoring/reimport',checks},null,2));
console.log('PASS CSV58+24 rows');
