import { ScrollView } from '../keyboard/KeyboardScrollView';
import { useRef, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryMenuBounds } from "./categoryMenuBounds";
import { Check, ChevronDown } from "lucide-react-native";
import Animated, {
  Easing,
  Keyframe,
  LinearTransition,
} from "react-native-reanimated";
import { WORK_ORDER_CATEGORIES } from "../../../src/data/workOrderCategories";
import { Copy } from "../news/ui";
import { usePresentation } from "../shell/TownLoopShell";
export function CategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [anchor, setAnchor] = useState<{x:number;y:number;width:number;height:number}|null>(null);
  const open = !!anchor;
  const trigger = useRef<View>(null);
  const screen = useWindowDimensions(),insets=useSafeAreaInsets();
  const bounds = anchor ? categoryMenuBounds(anchor,screen,insets) : null;
  const dark = !!usePresentation()?.dark;
  const ink = dark ? "#f1f5f9" : "#1c1917",
    muted = dark ? "#94a3b8" : "#78716c";
  const selected = WORK_ORDER_CATEGORIES.find((c) => c.name === value);
  return (
    <View style={{ gap: 6, zIndex: 50 }}>
      <Copy
        weight="bold"
        style={{
          fontSize: 12,
          letterSpacing: 1,
          color: dark ? "#cbd5e1" : "#44403c",
        }}
      >
        CATEGORY
      </Copy>
      <Pressable
        ref={trigger}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Work order category"
        accessibilityState={{ expanded: open, disabled }}
        onPress={() => trigger.current?.measureInWindow((x,y,width,height) => setAnchor({x,y,width,height}))}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: dark ? "#334155" : "#e7e5e4",
          backgroundColor: dark ? "#1e293b" : "#fafaf9",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Copy style={{ fontSize: 16 }}>{selected?.emoji || "🛠️"}</Copy>
        <Copy weight="bold" style={{ flex: 1, fontSize: 14, color: ink }}>
          {value}
        </Copy>
        <Animated.View
          layout={LinearTransition.duration(200)}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        >
          <ChevronDown size={16} color={open ? "#059669" : muted} />
        </Animated.View>
      </Pressable>
      {open && bounds && <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setAnchor(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close category menu" onPress={() => setAnchor(null)} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
        <Animated.View accessibilityViewIsModal
          entering={new Keyframe({
            0: { opacity: 0, transform: [{ translateY: -6 }, { scale: 0.98 }] },
            100: {
              opacity: 1,
              transform: [{ translateY: 0 }, { scale: 1 }],
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          }).duration(180)}
          exiting={new Keyframe({
            0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
            100: {
              opacity: 0,
              transform: [{ translateY: -6 }, { scale: 0.98 }],
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          }).duration(180)}
          style={{
            position: "absolute",
            ...bounds,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: dark ? "#334155" : "#e7e5e4",
            backgroundColor: dark ? "#0f172a" : "#fff",
            padding: 6,
            boxShadow:
              "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
            zIndex: 50,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{maxHeight:Math.max(1,bounds.maxHeight-12)}} contentContainerStyle={{gap:4}}>
            {WORK_ORDER_CATEGORIES.map((c) => {
              const active = c.name === value;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    onChange(c.name);
                    setAnchor(null);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active
                      ? dark
                        ? "#047857"
                        : "#6ee7b7"
                      : dark
                        ? "#33415599"
                        : "#e7e5e499",
                    backgroundColor: active
                      ? dark
                        ? "#022c22b3"
                        : "#ecfdf5"
                      : dark
                        ? "#1e293b99"
                        : pressed
                          ? "#f5f5f4"
                          : "#fafaf9e6",
                  })}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: dark ? "#334155" : "#e7e5e4cc",
                      backgroundColor: dark ? "#0f172a" : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Copy style={{ fontSize: 16 }}>{c.emoji}</Copy>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Copy
                      weight="bold"
                      style={{ fontSize: 14, color: ink }}
                    >
                      {c.name}
                    </Copy>
                    <Copy
                      numberOfLines={1}
                      style={{ fontSize: 11, color: muted, marginTop: 2 }}
                    >
                      {c.description}
                    </Copy>
                  </View>
                  {active && <Check size={16} color="#059669" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Modal>}
    </View>
  );
}
