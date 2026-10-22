import {deltaAngle,formatRA,formatDec} from './astronomy.js?v=30';

const stageGroups=['东方青龙','北方玄武','西方白虎','南方朱雀'];
const stageOrders=['一','二','三','四','五','六','七'];
const stageNames=['角亢氐房心尾箕','斗牛女虚危室壁','奎娄胃昴毕觜参','井鬼柳星张翼轸'];
const escapeStageText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Make a self-contained, screen-space snapshot. Neither camera nor hand motion
// is an input to this diagram; its aspect ratio follows the catalogue positions.
export function stagePresentation(mansion,item){
 const id=mansion?.id??item.id,group=mansion?.group??Math.floor(id/7),name=mansion?.name??item.name;
 const members=mansion?.members||[],center=mansion?.center;
 const raw=center?members.map(star=>({id:star.id,x:-deltaAngle(star.ra,center.ra)*Math.cos(center.dec),y:-(star.dec-center.dec),mag:star.mag})):[];
 const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=raw.length?Math.min(172/Math.max(.025,maxX-minX),132/Math.max(.025,maxY-minY)):1;
 const points=raw.map(p=>({id:p.id,x:120+(p.x-(minX+maxX)/2)*scale,y:92+(p.y-(minY+maxY)/2)*scale,r:Math.max(1.6,Math.min(3.2,3.1-(p.mag||0)*.22))}));
 const ids=new Set(points.map(p=>p.id)),lines=(mansion?.lines||[]).map(chain=>chain.filter(hip=>ids.has(hip))).filter(chain=>chain.length>1).map(chain=>[...chain]);
 const groupName=stageGroups[group]||'',chapter=groupName+' · 第'+stageOrders[id%7]+'宿';
 return {id,name,groupName,chapter,points,lines,sequence:[...(stageNames[group]||'')],active:id%7,
  coordinates:center?formatRA(center.ra)+' / '+formatDec(center.dec):'',
  title:item.title,pinyin:item.pinyin,
  motif:id===0?'春生 · 东方 · 木 · 蛟':groupName+' · '+name+'宿',
  note:id===0?'角为东方青龙七宿之首。执珠而起，象征春生与万物之始。':'由'+name+'宿的星子连线，寻访'+item.title+'的彩塑形象。',
  collection:'府城玉皇庙 · 二十八宿彩塑'};
}

export function stageEditorialMarkup(view){
 const byHip=new Map(view.points.map(p=>[p.id,p]));
 const paths=view.lines.map(chain=>'<polyline points="'+chain.map(id=>{const p=byHip.get(id);return p.x.toFixed(2)+','+p.y.toFixed(2);}).join(' ')+'"/>').join('');
 const stars=view.points.map(p=>'<g><circle class="chart-aura" cx="'+p.x+'" cy="'+p.y+'" r="10"/><circle class="chart-star" cx="'+p.x+'" cy="'+p.y+'" r="'+p.r+'"/></g>').join('');
 const sequence=view.sequence.map((name,i)=>'<span'+(i===view.active?' class="current" aria-current="true"':'')+'><i></i>'+escapeStageText(name)+'</span>').join('');
 const atlas='<div class="stage-atlas-heading"><small>THE CELESTIAL SIGN</small><h2>'+escapeStageText(view.name)+'<span>宿</span></h2><p>'+escapeStageText(view.chapter)+'</p></div><div class="stage-atlas-body"><div class="stage-sequence" aria-label="'+escapeStageText(view.groupName)+'七宿序列">'+sequence+'</div><div class="stage-chart"><svg viewBox="0 0 240 184" role="img" aria-label="'+escapeStageText(view.name)+'宿固定星点连线"><ellipse class="chart-orbit" cx="120" cy="92" rx="104" ry="69" transform="rotate(-24 120 92)"/><g class="chart-lines">'+paths+'</g>'+stars+'</svg><span>'+escapeStageText(view.name)+'宿星官 · '+view.points.length+' 颗主体恒星</span></div></div><p class="stage-atlas-foot">以星为引，化相成形。<small>FROM CELESTIAL SIGN TO SCULPTURAL FORM</small></p>';
 const record='<p class="stage-record-label">CHINESE ASTRONOMY<br>CULTURAL HERITAGE</p><dl>'+(view.coordinates?'<div><dt>赤经 / 赤纬 · J2000</dt><dd>'+escapeStageText(view.coordinates)+'</dd></div>':'')+'<div><dt>星象</dt><dd>'+escapeStageText(view.motif)+'</dd></div></dl><p class="stage-story">'+escapeStageText(view.note)+'</p><p class="stage-collection">'+escapeStageText(view.collection)+'<small>FUCHENG YUHUANG TEMPLE</small></p>';
 return {atlas,record,index:'MANSION '+String(view.id+1).padStart(2,'0')+' / 28'};
}
