export const tipIds={thumb:4,index:8,middle:12,ring:16,pinky:20};
export function handLandmarks({dx=0,dy=0,...motion}={}){
 const p=Array.from({length:21},()=>({x:.5+dx,y:.7+dy,z:0}));p[0]={x:.5+dx,y:.86+dy,z:0};
 p[4]={x:.38+dx,y:.56+dy,z:0};
 for(const [i,mcp]of [5,9,13,17].entries()){const x=.44+i*.05+dx;p[mcp]={x,y:.68+dy,z:0};p[mcp+1]={x,y:.58+dy,z:0};p[mcp+2]={x,y:.48+dy,z:0};p[mcp+3]={x,y:.38+dy,z:0};}
 for(const [finger,id]of Object.entries(tipIds))p[id].y+=motion[finger]||0;return p;
}
