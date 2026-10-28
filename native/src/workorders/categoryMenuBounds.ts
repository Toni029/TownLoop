/** Anchor an overlay to the trigger without changing the form's measured height. */
export function categoryMenuBounds(anchor:{x:number;y:number;width:number;height:number},screen:{width:number;height:number},insets:{top:number;bottom:number;left:number;right:number}) {
 const margin=8, width=Math.max(1,Math.min(anchor.width,screen.width-insets.left-insets.right-margin*2));
 const left=Math.max(insets.left+margin,Math.min(anchor.x,screen.width-insets.right-margin-width));
 const y=Math.max(insets.top+margin,Math.min(anchor.y,screen.height-insets.bottom-margin-anchor.height));
 const below=Math.max(0,screen.height-insets.bottom-margin-y-anchor.height-6),above=Math.max(0,y-insets.top-margin-6);
 const down=below>=Math.min(240,above),height=Math.min(300,down?below:above);
 return {left,width,maxHeight:Math.max(1,height),top:down?y+anchor.height+6:Math.max(insets.top+margin,y-height-6)};
}
