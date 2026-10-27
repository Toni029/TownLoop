type Insets={top:number;bottom:number;left:number;right:number};
/** Contain the entire approved frame inside the usable display, never crop or stretch it. */
export function fitPortrait(width:number,height:number,insets:Insets){
 const usableWidth=Math.max(1,width-insets.left-insets.right);
 const usableHeight=Math.max(1,height-insets.top-insets.bottom);
 const videoWidth=Math.min(usableWidth,usableHeight*1320/2868);
 const videoHeight=videoWidth*2868/1320;
 return {width:videoWidth,height:videoHeight,left:insets.left+(usableWidth-videoWidth)/2,top:insets.top+(usableHeight-videoHeight)/2};
}
export function menuBounds(width:number,height:number,insets:Insets){
 return {width:Math.max(1,Math.min(width-insets.left-insets.right-24,width>=640?540:500)),
  height:Math.max(1,Math.min(width>=640?680:640,height-insets.top-insets.bottom-24))};
}
