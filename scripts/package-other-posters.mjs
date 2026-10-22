import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {OTHER_POSTERS} from '../dist/qinglong-posters.js';
const targets=new Set(OTHER_POSTERS.map(p=>'dist/'+p.url.split('?')[0].slice(2)));
const manifest=JSON.parse(await readFile('deployment/assets.json','utf8')).filter(a=>!targets.has(a.path));
for(const spec of OTHER_POSTERS){
 const file='dist/'+spec.url.split('?')[0].slice(2),bytes=await readFile(file),compressed=gzipSync(bytes,{level:9});
 const dir='deployment/assets/'+file.replace(/[^a-z0-9]+/g,'-'),parts=[];await mkdir(dir,{recursive:true});
 for(let offset=0,index=0;offset<compressed.length;offset+=70000,index++){const part=dir+'/'+String(index).padStart(3,'0')+'.b64';parts.push(part);await writeFile(part,compressed.subarray(offset,offset+70000).toString('base64')+'\n');}
 manifest.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),parts});
 console.log(spec.title+': '+parts.length+' verified transport parts');
}
await writeFile('deployment/assets.json',JSON.stringify(manifest,null,2)+'\n');
