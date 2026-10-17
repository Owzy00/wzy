import {readFile,writeFile} from 'node:fs/promises';
const css=(await readFile('dist/style.css','utf8')).replace(/^@import[^\n]*\n/,'')+'\n'+await readFile('dist/experience.css','utf8');
let modules='';for(const name of ['astronomy','gesture-core','gesture-camera','particle-effects','experience','app'])modules+='\n'+(await readFile(`dist/${name}.js`,'utf8')).replace(/^import[^\n]+\n/gm,'').replaceAll('export ','');
let app=modules;
const data={};for(const name of ['stars','mansions','supplement','statues']){data[name]=JSON.parse(await readFile(`dist/data/${name}.json`,'utf8'));app=app.replace(`fetch('./data/${name}.json')`,`Promise.resolve({ok:true,json:async()=>embeddedData.${name}})`);}
const worker=await readFile('dist/hand-worker.js','utf8');
let html=await readFile('dist/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<link rel="stylesheet" href="./experience.css">','').replace('<script type="module" src="./app.js?v=8"></script>',()=>`<script type="module">\nconst embeddedData=${JSON.stringify(data)};\nglobalThis.XINGYE_WORKER_SOURCE=${JSON.stringify(worker)};\n${app}\n</script>`);
html=html.replace('href="./" aria-label="星野首页"','href="#" aria-label="星野首页"');
for(const [name,mime]of [['provenance.json','application/json'],['NOTICE.txt','text/plain']]){const source=await readFile('dist/data/'+name,'utf8');html=html.replaceAll('./data/'+name,`data:${mime};charset=utf-8,${encodeURIComponent(source)}`);}
await writeFile('dist/standalone.html',html);
await writeFile('../星野-手势与彩塑-v8.html',html.replace('<title>星野 · 二十八宿观测台</title>','<title>星野 · 手势与彩塑 v8</title>'));
console.log('Standalone HTML generated, all star data and application code embedded.');
