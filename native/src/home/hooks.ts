import {headerTime} from './headerTime';
import { createMotionPreferenceStore } from "../motion/preference";
import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { AppState, AccessibilityInfo } from "react-native";
import { protectedHomeStorage } from "../localData/nativeStorage";
import { HomeStore } from "./store";
import { localDate } from "./model";
export function useHomeStore(uid: string) {
  const store = useMemo(() => new HomeStore(uid, protectedHomeStorage), [uid]);
  const [, render] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const off = store.subscribe(render);
    void store.load();
    return off;
  }, [store]);
  return store;
}
export function useToday() {
  const [today, setToday] = useState(() => localDate(new Date()));
  useEffect(() => {
    const update = () => setToday(localDate(new Date()));
    const timer = setInterval(update, 15000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}
const motionPreference = createMotionPreferenceStore({
  read: () => AccessibilityInfo.isReduceMotionEnabled(),
  listen: next => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", next);
    return () => subscription.remove();
  },
});
export function useReducedMotion() {
  return useSyncExternalStore(motionPreference.subscribe, motionPreference.snapshot, () => true);
}

/** Renders only when the local greeting/date changes; background timers are suspended. */
export function useHeaderTime() {
  const [value,setValue]=useState(()=>headerTime(new Date()));
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const next=headerTime(new Date());
      setValue(old=>old.today===next.today && old.greeting===next.greeting ? old : next);
      if(AppState.currentState==='active') timer=setTimeout(update,Math.max(1,next.next-Date.now()));
    }
    update();
    const sub=AppState.addEventListener('change',state=>{if(state==='active')update();else clearTimeout(timer);});
    return ()=>{clearTimeout(timer);sub.remove();};
  },[]);
  return value;
}
