type Lifecycle={currentState:string|null;addEventListener:(type:'change',next:(state:string)=>void)=>{remove:()=>void}};
type Clock={setInterval:(run:()=>void,ms:number)=>ReturnType<typeof setInterval>;clearInterval:(timer:ReturnType<typeof setInterval>)=>void};
/** Keep periodic work only in the foreground; real-time listeners stay independent. */
export function foregroundPoll(app:Lifecycle,run:()=>void|Promise<unknown>,period:number,onPause=()=>{},clock:Clock={setInterval,clearInterval}){
 let stopped=false,foreground=app.currentState==='active',timer:ReturnType<typeof setInterval>|undefined;
 const stop=()=>{if(timer!==undefined)clock.clearInterval(timer);timer=undefined;};
 const invoke=()=>{if(stopped||!foreground)return;try{void Promise.resolve(run()).catch(()=>{});}catch{}};
 const start=()=>{stop();if(stopped||!foreground)return;invoke();timer=clock.setInterval(invoke,period);};
 const listener=app.addEventListener('change',state=>{const next=state==='active';if(next===foreground)return;foreground=next;if(next)start();else{stop();onPause();}});
 start();return()=>{stopped=true;stop();listener.remove();onPause();};
}
