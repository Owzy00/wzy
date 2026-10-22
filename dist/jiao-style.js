const jiaoSmooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function jiaoPresence(formation,release=0){return jiaoSmooth((formation-.12)/.64)*(1-jiaoSmooth(release));}
// Fine, changing astronomical lines behind this one poster figure. These never
// alter the celestial catalogue, navigation, or another mansion's appearance.
export function jiaoOrbit(u,time,layer=0,motion=1,out={}){
 const angle=u*Math.PI*2+time*.10*motion,tilt=-.38+layer*.19+Math.sin(time*.27)*.025*motion;
 const x=Math.cos(angle)*(.36+layer*.035),y=Math.sin(angle)*(.12+layer*.024);
 out.x=x*Math.cos(tilt)-y*Math.sin(tilt);
 out.y=x*Math.sin(tilt)+y*Math.cos(tilt)-.32+layer*.20;
 return out;
}
export function drawJiaoAtmosphere(c,l,time,formation,release,pointer={x:0,y:0},reduced=false){
 const presence=jiaoPresence(formation,release);c.clearRect(0,0,l.width,l.height);if(presence<.001)return;
 const motion=reduced?.18:1,p={};c.save();c.translate(l.cx+pointer.x*46,l.cy+pointer.y*16);c.scale(l.size,l.size);
 c.lineWidth=.00065;c.setLineDash([.0014,.004]);
 for(let k=0;k<4;k++){
  c.strokeStyle=k%2?'#a8c4da':'#93dcd6';c.globalAlpha=presence*(k%2?.22:.31);c.lineDashOffset=-time*.014*motion;
  c.beginPath();for(let i=0;i<=140;i++){jiaoOrbit(i/140,time,k,motion,p);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
 }
 c.setLineDash([]);c.lineWidth=.00055;c.strokeStyle='#b8d4dd';c.fillStyle='#d5edea';
 const chains=[[[-.17,-.63],[-.19,-.56],[-.15,-.51],[-.09,-.52]],[[.38,-.41],[.40,-.34],[.39,-.26],[.42,-.20],[.44,-.15]]];
 for(const chain of chains){c.globalAlpha=presence*.24;c.beginPath();chain.forEach(([x,y],i)=>{const dx=Math.sin(time*.23+i)*.003*motion;if(i)c.lineTo(x+dx,y);else c.moveTo(x+dx,y);});c.stroke();for(let i=0;i<chain.length;i++){const [x,y]=chain[i],dx=Math.sin(time*.23+i)*.003*motion;c.globalAlpha=presence*(.38+.16*Math.sin(time*.75+i));c.beginPath();c.arc(x+dx,y,.0026,0,Math.PI*2);c.fill();}}
 c.restore();
}
