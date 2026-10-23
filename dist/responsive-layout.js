// Shared geometry keeps the sky and sculpture inside the phone's usable area.
export function compactViewport(width,height,coarse=false){return width<=850||(coarse&&height<=500);}
export function phoneLayout(width,height,{safeTop=0,safeBottom=0,aspect=.6}={}){
 const landscape=width>height;
 const sky=landscape?{left:164,right:64,top:76+safeTop,bottom:84+safeBottom}:{left:20,right:20,top:196+safeTop,bottom:240+safeBottom};
 const rect=landscape?{left:188,right:178,top:74+safeTop,bottom:70+safeBottom}:{left:24,right:24,top:166+safeTop,bottom:96+safeBottom};
 const freeWidth=Math.max(80,width-rect.left-rect.right),freeHeight=Math.max(100,height-rect.top-rect.bottom);
 const size=Math.min(freeHeight,freeWidth/Math.max(.2,aspect));
 return {sky:{w:Math.max(160,width-sky.left-sky.right),h:Math.max(100,height-sky.top-sky.bottom),cx:(sky.left+width-sky.right)/2,cy:(sky.top+height-sky.bottom)/2},statue:{cx:(rect.left+width-rect.right)/2,cy:(rect.top+height-rect.bottom)/2,size,width,height},rect};
}
