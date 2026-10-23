import {readFile,writeFile} from 'node:fs/promises';
const css=(await readFile('dist/style.css','utf8')).replace(/^@import[^\n]*\n/,'')+'\n'+await readFile('dist/experience.css','utf8')+'\n'+await readFile('dist/mobile.css','utf8');
let modules='';for(const name of ['hand-zoom','responsive-layout','astronomy','gesture-core','gesture-camera','cloud-field','jiao-style','qinglong-posters','particle-effects','stage-editorial','experience','app'])modules+='\n'+(await readFile(`dist/${name}.js`,'utf8')).replace(/^import[^\n]+\n/gm,'').replaceAll('export ','');
let app=modules;
const data={};for(const name of ['stars','mansions','supplement']){data[name]=JSON.parse(await readFile(`dist/data/${name}.json`,'utf8'));app=app.replace(`fetch('./data/${name}.json${name==='jiao-poster'?'?v=35':''}')`,`Promise.resolve({ok:true,json:async()=>embeddedData[${JSON.stringify(name)}]})`);}
const {POSTER_DEFINITIONS}=await import('../dist/qinglong-posters.js');
const embeddedPosters={};
for(const spec of POSTER_DEFINITIONS){const file=spec.url.split('?')[0];embeddedPosters[file]=JSON.parse(await readFile('dist/'+file.slice(2),'utf8'));}
app=app.replace('fetcher=url=>fetch(url)','fetcher=url=>Promise.resolve({ok:true,json:async()=>embeddedPosters[url.split("?")[0]]})');
const worker=await readFile('dist/hand-worker.js','utf8');
let html=await readFile('dist/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="./style.css?v=38">',()=>`<style>${css}</style>`).replace('<link rel="stylesheet" href="./experience.css?v=38">','').replace('<link rel="stylesheet" href="./mobile.css?v=38">','').replace('<script type="module" src="./app.js?v=41"></script>',()=>`<script type="module">\nconst embeddedData=${JSON.stringify(data)};\nconst embeddedPosters=${JSON.stringify(embeddedPosters)};\nglobalThis.XINGYE_WORKER_SOURCE=${JSON.stringify(worker)};\n${app}\n</script>`);
html=html.replace('href="./" aria-label="星河化相首页"','href="#" aria-label="星河化相首页"');
for(const [name,mime]of [['provenance.json','application/json'],['NOTICE.txt','text/plain']]){const source=await readFile('dist/data/'+name,'utf8');html=html.replaceAll('./data/'+name,`data:${mime};charset=utf-8,${encodeURIComponent(source)}`);}
html=html.replaceAll('./assets/brand-emblem.png?v=35','data:image/png;base64,'+(await readFile('dist/assets/brand-emblem.png')).toString('base64'));
await writeFile('dist/standalone.html',html);
await writeFile('../星河化相-手势与彩塑-v41.html',html);
console.log('Standalone HTML generated, all star data and application code embedded.');
