/** Scroll events change no React state unless the card crosses the viewport edge. */
export function createWeatherViewport(){
 let offset=0,height=0,top=0,origin=0,cardHeight=0,visible=true;const listeners=new Set<()=>void>();
 const update=()=>{const next=height<=0||cardHeight<=0||origin+top+cardHeight>offset&&origin+top<offset+height;if(next===visible)return;visible=next;for(const listener of listeners)listener();};
 return{snapshot:()=>visible,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  origin:(y:number)=>{origin=y;update();},scroll:(y:number)=>{offset=y;update();},viewport:(value:number)=>{height=value;update();},card:(y:number,value:number)=>{top=y;cardHeight=value;update();}};
}
