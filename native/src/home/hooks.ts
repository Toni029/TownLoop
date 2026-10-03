import { useEffect, useMemo, useReducer, useState } from "react";
import { AppState, AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HomeStore } from "./store";
import { localDate } from "./model";
export function useHomeStore(uid: string) {
  const store = useMemo(() => new HomeStore(uid, AsyncStorage), [uid]);
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
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
