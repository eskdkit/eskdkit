// Сборка базы стандартов из открытых данных Росстандарта: «обозначение\tстатус\tзаглавие», deflate-raw, base64.
const fs=require('fs'),zlib=require('zlib'),path=require('path');
function readCsv(f){
  const t=fs.readFileSync(f,'utf8'),out=[];let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;continue;}
    if(c==='"')q=true;else if(c===';'){row.push(cur);cur='';}else if(c==='\n'){row.push(cur.replace(/\r$/,''));out.push(row);row=[];cur='';}else cur+=c;}
  if(cur||row.length){row.push(cur);out.push(row);}
  return out.slice(1);
}
const dir=path.join(__dirname,'data'),seen={},lines=[];
for(const f of fs.readdirSync(dir).filter(f=>/\.csv$/.test(f)).sort()){
  for(const r of readCsv(path.join(dir,f))){
    if(!r[0])continue; const d=r[0].replace(/\s+/g,' ').trim(); if(seen[d])continue; seen[d]=1;
    const s=/^Принят/i.test(r[2])?'n':'a';
    lines.push(d+'\t'+s+'\t'+(r[1]||'').replace(/\s+/g,' ').trim());
  }
}
lines.sort();
const raw=Buffer.from(lines.join('\n'),'utf8'),z=zlib.deflateRawSync(raw,{level:9});
module.exports={count:lines.length,b64:z.toString('base64'),date:'06.08.2024',lines};
if(require.main===module)console.log(lines.length,'строк',raw.length,'байт ->',z.length,'сжато,',Math.round(z.length*4/3/1024),'КБ base64');
