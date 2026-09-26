import fs from 'node:fs/promises';
import {Workbook} from '@oai/artifact-tool';
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-wave16-candidates-v1';
const rows=JSON.parse(await fs.readFile(root+'/records/asset-rows.json','utf8'));
if(rows.length!==35)throw Error('Expected35assets');
const headers=Object.keys(rows[0]);
const data=[headers,...rows.map(a=>headers.map(k=>a[k]))];
const book=Workbook.create(),sheet=book.worksheets.add('AssetRecords');
sheet.getRange('A1:O36').values=data;book.recalculate();
const actual=sheet.getRange('A1:O36').values;
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=actual.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
const imported=await Workbook.fromCSV(csv,{sheetName:'Check'});
const back=imported.worksheets.getItem('Check').getRange('A1:O36').values;
if(back.length!==36||back[0].length!==15)throw Error('count');
for(let i=1;i<back.length;i++){
 JSON.parse(back[i][10]);JSON.parse(back[i][11]);JSON.parse(back[i][12]);JSON.parse(back[i][14]);
 for(let j=0;j<15;j++)if(String(back[i][j])!==String(data[i][j]))throw Error(`CSV roundtrip ${i},${j}`);
}
await fs.writeFile(root+'/assets.csv','\uFEFF'+csv);
await fs.writeFile(root+'/records/csv-validation.json',JSON.stringify({tool:'artifact-tool authoring/reimport',dataRows:35,columns:15,allCellsRoundtrip:true,jsonFieldsParsed:true},null,2));
console.log('PASS CSV35x15 allcells roundtrip');
