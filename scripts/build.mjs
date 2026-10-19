import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await import('./standalone.mjs');
const standalone=await readFile('dist/standalone.html','utf8');
const script=standalone.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!script||script.includes('fetch(')||standalone.includes('<link rel="stylesheet"'))throw new Error('Standalone has external runtime dependencies');
execFileSync(process.execPath,['--input-type=module','--check'],{input:script,stdio:['pipe','inherit','inherit']});
const files=['index.html','motion-qa.html','hand-ripple-qa.html','navigation-qa.html','style.css','experience.css','app.js','astronomy.js','gesture-core.js','gesture-camera.js','hand-worker.js','cloud-field.js','particle-effects.js','experience.js','data/stars.json','data/supplement.json','data/mansions.json','data/statues.json','data/provenance.json','data/NOTICE.txt','vendor/mediapipe/vision_bundle.mjs','vendor/mediapipe/hand_landmarker.task'];
for(const f of files)await stat('dist/'+f);
for(const f of ['app.js','astronomy.js','gesture-core.js','gesture-camera.js','hand-worker.js','cloud-field.js','particle-effects.js','experience.js'])execFileSync(process.execPath,['--check','dist/'+f],{stdio:'inherit'});
const stars=[...JSON.parse(await readFile('dist/data/stars.json','utf8')),...JSON.parse(await readFile('dist/data/supplement.json','utf8'))],ms=JSON.parse(await readFile('dist/data/mansions.json','utf8')),ids=new Set(stars.map(s=>s[0]));
if(ms.length!==28||stars.length<5044)throw new Error('Incomplete catalogue');
for(const m of ms)for(const id of m.lines.flat())if(!ids.has(id))throw new Error('Missing HIP '+id);
const statues=JSON.parse(await readFile('dist/data/statues.json','utf8'));if(statues.items.length!==28)throw new Error('Incomplete statues');for(let i=0;i<28;i++){const item=statues.items[i];if(item.id!==i||item.name!==ms[i].name||Buffer.from(item.data,'base64').length!==item.count*9)throw new Error('Invalid statue mapping '+i);}
for(const f of ['vision_wasm_module_internal.js','vision_wasm_module_internal.wasm'])await stat('dist/vendor/mediapipe/wasm/'+f);
await stat('dist/vendor/mediapipe/LICENSE');
console.log(`Build verified: ${files.length} core assets, ${stars.length} stars, 28 mansions and 28 statue clouds. MediaPipe optional; local model bundled.`);
