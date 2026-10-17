import urllib.request,json,tarfile,io,pathlib,hashlib
root=pathlib.Path(__file__).resolve().parent.parent/'dist/vendor/mediapipe';root.mkdir(parents=True,exist_ok=True)
meta=json.load(urllib.request.urlopen('https://registry.npmjs.org/@mediapipe/tasks-vision/1.1.1',timeout=30))
archive=urllib.request.urlopen(meta['dist']['tarball'],timeout=60).read()
assert hashlib.sha1(archive).hexdigest()==meta['dist']['shasum']
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
 for item in tar.getmembers():
  name=item.name.removeprefix('package/')
  if item.isfile() and (name=='vision_bundle.mjs' or name.startswith('wasm/') or name in ['LICENSE','NOTICE','package.json']):
   target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(item).read())
model_url='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
model=urllib.request.urlopen(model_url,timeout=60).read();(root/'hand_landmarker.task').write_bytes(model)
(root/'provenance.json').write_text(json.dumps({'package':'@mediapipe/tasks-vision','version':'1.1.1','integrity':meta['dist']['integrity'],'tarball':meta['dist']['tarball'],'model':model_url,'modelSha256':hashlib.sha256(model).hexdigest(),'license':'Apache-2.0'},indent=2),encoding='utf8')
print('MediaPipe files:',[(str(p.relative_to(root)),p.stat().st_size) for p in root.rglob('*') if p.is_file()])
