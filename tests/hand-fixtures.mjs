export function handLandmarks({index=0,ring=0,dx=0,dy=0}={}){
 const p=Array.from({length:21},()=>({x:.5+dx,y:.7+dy,z:0}));p[0]={x:.5+dx,y:.86+dy,z:0};
 for(const [i,mcp]of [5,9,13,17].entries()){const x=.44+i*.05+dx;p[mcp]={x,y:.68+dy,z:0};p[mcp+1]={x,y:.58+dy,z:0};p[mcp+2]={x,y:.48+dy,z:0};p[mcp+3]={x,y:.38+dy,z:0};}
 p[8].y+=index;p[16].y+=ring;return p;
}
export const tapFrames=[[0,0],[60,0],[120,0],[180,.06],[240,.14],[300,.16],[360,.06],[420,0]];
