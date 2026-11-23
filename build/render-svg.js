const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{const [,, svgPath, out, size]=process.argv; const s=+size||1024;
const svg=fs.readFileSync(svgPath,'utf8');
const b=await chromium.launch();const p=await b.newPage({viewport:{width:s,height:s}});
await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${s}px;height:${s}px">${svg.replace('width="1024" height="1024"',`width="${s}" height="${s}"`)}</div></body></html>`);
await p.screenshot({path:out,omitBackground:true,clip:{x:0,y:0,width:s,height:s}});await b.close();})();
