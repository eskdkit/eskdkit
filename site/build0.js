const fs=require('fs'),R=p=>fs.readFileSync(p,'utf8');
const L={
 __PDFJS__:R('node_modules/pdfjs-dist/build/pdf.min.js'),
 __PDFWORKER__:R('node_modules/pdfjs-dist/build/pdf.worker.min.js'),
 __CORE__:R('core.js'),
 __XLSX__:R('node_modules/xlsx/dist/xlsx.full.min.js'),
 __PDFLIB__:R('node_modules/pdf-lib/dist/pdf-lib.min.js'),
 __FONTKIT__:R('node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js'),
 __FONT_REG__:fs.readFileSync('DejaVuSansCondensed.sub.ttf').toString('base64'),
 __FONT_IT__:fs.readFileSync('DejaVuSansCondensed-Oblique.sub.ttf').toString('base64'),
 __SPEC__:R('speccore.js'),__CMP__:R('cmpcore.js'),__ESKDPDF__:R('eskdpdf.js'),__PE__:R('pecore.js'),__VP__:R('vpcore.js'),__BOMCMP__:R('bomcmp.js'),__FRAME__:R('framecore.js'),__GOST__:R('gost3411.js'),__UL__:R('ulcore.js'),__GRP__:R('grpspec.js'),__II__:R('iicore.js'),__BLANK__:R('blankcore.js')};
for(const k in L)L[k]=L[k].replace(/\/\/# sourceMappingURL=\S+/g,'');
function inj(s){for(const k in L)s=s.split('/*'+k+'*/').join(L[k]);return s;}
module.exports=inj;
