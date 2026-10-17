from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw,ImageFont
import numpy as np,json,hashlib,base64,struct,argparse
from collections import deque

project=Path(__file__).resolve().parent.parent; root=project/'dist';dest=root/'assets/statues';dest.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--input-dir',required=True);args=parser.parse_args();temp=Path(args.input_dir)
rows=[
 ('codex-clipboard-040d3a87-5463-41b9-918a-564a96817920.png',['角','亢','氐','房','心','尾','箕'],['角木蛟','亢金龙','氐土貉','房日兔','心月狐','尾火虎','箕水豹']),
 ('codex-clipboard-216e8b98-f4e0-4bbc-9c93-9c6458c63e2c.png',['斗','牛','女','虚','危','室','壁'],['斗木獬','牛金牛','女土蝠','虚日鼠','危月燕','室火猪','壁水貐']),
 ('codex-clipboard-4a7167d0-a8c1-4c23-a2fe-eaeda6b9c6b6.png',['奎','娄','胃','昴','毕','觜','参'],['奎木狼','娄金狗','胃土雉','昴日鸡','毕月乌','觜火猴','参水猿']),
 ('codex-clipboard-bcfc59eb-9722-48d9-a021-2d0c57ba2b5f.png',['井','鬼','柳','星','张','翼','轸'],['井木犴','鬼金羊','柳土獐','星日马','张月鹿','翼火蛇','轸水蚓'])]
pinyin=['Jiao Mu Jiao','Kang Jin Long','Di Tu He','Fang Ri Tu','Xin Yue Hu','Wei Huo Hu','Ji Shui Bao','Dou Mu Xie','Niu Jin Niu','Nü Tu Fu','Xu Ri Shu','Wei Yue Yan','Shi Huo Zhu','Bi Shui Yu','Kui Mu Lang','Lou Jin Gou','Wei Tu Zhi','Mao Ri Ji','Bi Yue Wu','Zi Huo Hou','Shen Shui Yuan','Jing Mu An','Gui Jin Yang','Liu Tu Zhang','Xing Ri Ma','Zhang Yue Lu','Yi Huo She','Zhen Shui Yin']
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
sheet=Image.new('RGB',(1400,1560),'#080b0f');draw=ImageDraw.Draw(sheet)
draw.text((25,15),'府城玉皇庙二十八宿 · 用户授权素材与宿名核对',font=font,fill='#e9d69d')
pack={'version':1,'authorization':'User confirmed image processing, web display and particle morph use on 2026-10-16.','depthNote':'Luminance plus inward mask distance pseudo-depth; not a measured 3D reconstruction.','credit':'用户提供摄影拼图；原图水印：乐观人文 / LeGuan Culture。','items':[]}
for row,(filename,names,titles) in enumerate(rows):
 original=Image.open(temp/filename).convert('RGB');srcsha=hashlib.sha256((temp/filename).read_bytes()).hexdigest();w,h=original.size
 for col,name in enumerate(names):
  idx=row*7+col;tile=original.crop((round(col*w/7),0,round((col+1)*w/7),h));tile.save(dest/f'{idx:02d}-source.png')
  rgb=np.asarray(tile).copy();th,tw=rgb.shape[:2]
  mask=rgb.max(axis=2)>27
  # Exclude printed titles and the bottom credit band from subject point sampling. Source tiles remain intact.
  mask[:215,:26]=False;mask[:90,26:56]=False;mask[488:,:]=False;mask[:,:3]=False;mask[:,-3:]=False
  visited=np.zeros_like(mask);components=[]
  for y,x in zip(*np.where(mask)):
   if visited[y,x]:continue
   q=deque([(int(y),int(x))]);visited[y,x]=True;comp=[]
   while q:
    yy,xx=q.pop();comp.append((yy,xx))
    for ny,nx in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
     if 0<=ny<th and 0<=nx<tw and mask[ny,nx] and not visited[ny,nx]:visited[ny,nx]=True;q.append((ny,nx))
   components.append(comp)
  largest=max(len(c) for c in components);subject=np.zeros_like(mask)
  for comp in components:
   if len(comp)>max(300,largest*.005):
    yy,xx=zip(*comp);subject[yy,xx]=True
  ys,xs=np.where(subject);left,right=int(xs.min()),int(xs.max());top,bottom=int(ys.min()),int(ys.max());height=bottom-top+1;width=right-left+1
  cropped=rgb[top:bottom+1,left:right+1];cmask=subject[top:bottom+1,left:right+1]
  edge=np.zeros_like(cmask);edge[1:-1,1:-1]=cmask[1:-1,1:-1]&~(cmask[:-2,1:-1]&cmask[2:,1:-1]&cmask[1:-1,:-2]&cmask[1:-1,2:])
  luminance=cropped.mean(axis=2)/255;gy,gx=np.gradient(luminance);detail=np.hypot(gx,gy)
  yy,xx=np.where(cmask);weights=1+edge[yy,xx]*5+np.clip(detail[yy,xx]*18,0,4)+(yy/height<.36)*1.1
  rng=np.random.default_rng(2800+idx);count=min(48000,len(yy));chosen=rng.choice(len(yy),size=count,replace=False,p=weights/weights.sum());yy=yy[chosen];xx=xx[chosen]
  depthmask=np.zeros_like(cmask,dtype=np.float32);inner=cmask.copy()
  for step in range(1,22):
   depthmask+=inner
   padded=np.pad(inner,1);inner=inner&padded[:-2,1:-1]&padded[2:,1:-1]&padded[1:-1,:-2]&padded[1:-1,2:]
  depths=depthmask[yy,xx]/21*.14+luminance[yy,xx]*.07
  packed=bytearray();colors=cropped[yy,xx]
  for n,(y,x) in enumerate(zip(yy,xx)):
   px=round(((x+.5+rng.uniform(-.38,.38))/height-width/height/2)*1000);py=round(((y+.5+rng.uniform(-.38,.38))/height-.5)*1000);pz=round((depths[n]-.07)*1000)
   r,g,b=map(int,colors[n]);packed.extend(struct.pack('<hhhBBB',px,py,pz,r,g,b))
  item={'id':idx,'name':name,'title':titles[col],'pinyin':pinyin[idx],'count':count,'aspect':round(width/height,5),'source':filename,'sourceSha256':srcsha,'sourceTile':f'./assets/statues/{idx:02d}-source.png','crop':[left,top,width,height],'encoding':'base64-int16le-xyz-uint8-rgb/9bytes','data':base64.b64encode(packed).decode()}
  pack['items'].append(item)
  # High density point rendering preview; original colors, without inferred geometry claims.
  preview=Image.new('RGBA',(width,height),(0,0,0,0));preview.putdata([tuple(v)+(255 if m else 0,) for v,m in zip(cropped.reshape(-1,3),cmask.flat)])
  preview.thumbnail((172,310));cellx=col*200+14;celly=row*375+60;sheet.paste(preview,(cellx+(172-preview.width)//2,celly),preview)
  draw.text((cellx,celly+314),f'{idx+1:02d}  {titles[col]}',font=small,fill='#ead6a0')
  draw.text((cellx,celly+336),f'{count:,} 点 · 近似深度',font=small,fill='#8397aa')
  print(idx,name,count,flush=True)
(root/'data/statues.json').write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')),encoding='utf8')
sheet.save(project/'二十八宿素材核对图.png')
print('Wrote 28 point clouds, source tiles and contact sheet.')
