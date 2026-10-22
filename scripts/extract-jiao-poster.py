"""Extract only the user's Jiao poster figure into real moving particle targets.
No STL, generated replacement figure, poster typography or miniature insets.
"""
from pathlib import Path
import argparse,base64,hashlib,json,struct
from PIL import Image,ImageDraw,ImageFilter
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('poster')
parser.add_argument('--output',default='dist/data/jiao-poster.json')
args=parser.parse_args()
source=Path(args.poster)
image=Image.open(source).convert('RGB')
w,h=image.size
# Outline of the main human / dragon / pedestal in the 1024 x 1536 reference.
# Typography, left navigation, miniature views and captions lie outside it.
outline=[(620,118),(662,140),(681,178),(688,219),(677,264),(668,301),(704,348),(763,373),(816,346),(846,313),(854,281),(874,267),(893,259),(905,240),(927,226),(943,211),(944,236),(947,255),(942,271),(950,295),(941,321),(923,331),(917,349),(918,383),(910,438),(901,492),(889,533),(866,565),(838,601),(824,630),(828,666),(826,715),(817,757),(818,803),(823,844),(819,885),(809,933),(798,970),(803,1016),(801,1051),(782,1071),(768,1104),(788,1140),(798,1177),(792,1226),(771,1261),(754,1284),(733,1320),(713,1352),(675,1369),(635,1388),(580,1414),(515,1438),(458,1450),(406,1462),(347,1456),(284,1432),(240,1395),(203,1352),(184,1307),(166,1257),(160,1227),(180,1208),(204,1188),(193,1160),(182,1119),(179,1082),(170,1041),(164,996),(180,959),(195,927),(204,882),(193,841),(177,807),(167,773),(156,740),(159,700),(181,665),(201,638),(214,616),(237,599),(268,592),(299,593),(326,581),(351,562),(365,540),(371,514),(389,481),(417,448),(439,417),(448,391),(474,365),(513,351),(537,331),(547,311),(548,284),(544,258),(550,227),(561,201),(569,175),(592,165),(603,137)]
mask=Image.new('L',(w,h))
ImageDraw.Draw(mask).polygon([(round(x*w/1024),round(y*h/1536)) for x,y in outline],fill=255)
soft=np.asarray(mask.filter(ImageFilter.GaussianBlur(1.8)),dtype=float)/255
rgb=np.asarray(image,dtype=float)
bright=rgb.max(axis=2)/255
valid=(soft>.35)&(bright>.12)
yy,xx=np.where(valid)
left,right=int(xx.min()),int(xx.max());top,bottom=int(yy.min()),int(yy.max())
height=bottom-top+1;width=right-left+1
lum=rgb.mean(axis=2)/255
gy,gx=np.gradient(lum)
face=(xx>w*.52)&(xx<w*.69)&(yy>h*.075)&(yy<h*.23)
hand=(xx>w*.81)&(yy>h*.12)&(yy<h*.25)
weights=(.15+bright[yy,xx]**1.25+np.clip(np.hypot(gx,gy)[yy,xx]*5,0,1.6)+face*1.8+hand*.8)*soft[yy,xx]
rng=np.random.default_rng(230028)
count=min(96000,len(yy))
chosen=rng.choice(len(yy),count,replace=False,p=weights/weights.sum())
yy,xx=yy[chosen],xx[chosen]
soft_lum=np.asarray(Image.fromarray(np.uint8(lum*255)).filter(ImageFilter.GaussianBlur(4)),dtype=float)/255
packed=bytearray()
for y,x in zip(yy,xx):
 px=round(((x+.5+rng.uniform(-.32,.32)-left)/height-width/height/2)*1000)
 py=round(((y+.5+rng.uniform(-.32,.32)-top)/height-.5)*1000)
 pz=round((soft_lum[y,x]-.38)*.075*1000)
 color=np.minimum(255,np.power(rgb[y,x]/255,.86)*255*1.05).astype(int)
 packed.extend(struct.pack('<hhhBBB',px,py,pz,*color))
# Weathering anchors are the quantized surface samples themselves. No separate
# exterior mist or hand-placed wisps are created. Interior / face stays intact.
edge=np.asarray(mask.filter(ImageFilter.GaussianBlur(12)),dtype=float)/255
edge_alpha=.22+.78*np.clip((edge[yy,xx]-.43)/.49,0,1)**.75
protected=(xx>w*.54)&(xx<w*.67)&(yy>h*.12)&(yy<h*.22)
edge_alpha[protected]=1
ey,ex=np.gradient(edge)
weathering=bytearray();active=0
for y,x,safe in zip(yy,xx,protected):
 proximity=float(np.clip((.94-edge[y,x])/.46,0,1))
 norm=float(np.hypot(ex[y,x],ey[y,x]))
 if safe or proximity<.08 or norm<1e-7:
  weathering.extend(struct.pack('<hh',0,0));continue
 distance=(.09+.11*proximity)*rng.uniform(.72,1)
 vx,vy=-ex[y,x]/norm*distance,-ey[y,x]/norm*distance
 weathering.extend(struct.pack('<hh',round(vx*1000),round(vy*1000)));active+=1
item={'id':0,'name':'角','title':'角木蛟','pinyin':'Jiao Mu Jiao','style':'jiao-poster','count':count,'aspect':width/height,'source':'user-jiao-poster.png','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':[w,h],'crop':[left,top,width,height],'encoding':'base64-int16le-xyz-uint8-rgb/9bytes','depthNote':'Subtle image-based parallax, no 3D mesh.','data':base64.b64encode(packed).decode(),'edgeAlpha':base64.b64encode(np.uint8(np.round(edge_alpha*255)).tobytes()).decode(),'weathering':{'kind':'surface-edge','count':count,'active':active,'encoding':'base64-int16le-xy/4bytes','data':base64.b64encode(weathering).decode()}}
Path(args.output).write_text(json.dumps(item,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({k:item[k] for k in ['count','sourceSha256','sourceSize','crop']},ensure_ascii=False))
print('Weathering surface samples:',active)
