import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
const root=process.cwd(),manifest=JSON.parse(await readFile('deployment/assets.json','utf8'));
for(const asset of manifest){
 const destination=path.resolve(root,asset.path);
 if(!destination.startsWith(root+path.sep))throw new Error('Asset outside project: '+asset.path);
 const parts=await Promise.all(asset.parts.map(async p=>Buffer.from(await readFile(p,'utf8'),'base64')));
 const bytes=gunzipSync(Buffer.concat(parts));
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('Asset checksum mismatch: '+asset.path);
 await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);
}
console.log(`Restored and verified ${manifest.length} website assets.`);
