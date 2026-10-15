import { useState } from "react";
import { Animated, Image, PanResponder, View } from "react-native";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react-native";
import { Copy, Action, s } from "../news/ui";
import { MediaZoom } from "./zoom";
function nativeZoom(
  scale: Animated.Value,
  pan: Animated.ValueXY,
  label: (value: number) => void,
) {
  const zoom = new MediaZoom((value, x, y, finished) => {
    scale.setValue(value);
    pan.setValue({ x, y });
    if (finished) label(value);
  });
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => zoom.begin(e.nativeEvent.touches),
    onPanResponderMove: (e, g) => zoom.move(e.nativeEvent.touches, g.dx, g.dy),
    onPanResponderRelease: (_, g) => zoom.end(g.dx, g.dy, Date.now()),
    onPanResponderTerminate: () => label(zoom.scale),
  });
  return { zoom, responder };
}
export function ZoomImage({ uri, title }: { uri: string; title: string }) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pan] = useState(() => new Animated.ValueXY());
  const [label, setLabel] = useState(1);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [{ zoom, responder }] = useState(() =>
    nativeZoom(scale, pan, setLabel),
  );
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View
        {...responder.panHandlers}
        accessibilityLabel={title}
        accessibilityActions={[
          { name: "increment", label: "Zoom in" },
          { name: "decrement", label: "Zoom out" },
        ]}
        onAccessibilityAction={(e) =>
          zoom.zoom(e.nativeEvent.actionName === "increment" ? 0.5 : -0.5)
        }
        onLayout={(e) =>
          zoom.resize(e.nativeEvent.layout.width, e.nativeEvent.layout.height)
        }
        style={{ flex: 1, overflow: "hidden", justifyContent: "center" }}
      >
        <Animated.View
          style={{
            width: "100%",
            height: "100%",
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          }}
        >
          <Image
            key={retry}
            source={{ uri }}
            accessibilityLabel={title}
            resizeMode="contain"
            onError={() => setError(true)}
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>
        {error && (
          <View style={{ position: "absolute", alignSelf: "center", gap: 10 }}>
            <Copy style={{ color: "#fff" }}>Unable to load this picture.</Copy>
            <Action
              label="Retry Picture"
              onPress={() => {
                setError(false);
                setRetry((v) => v + 1);
              }}
            />
          </View>
        )}
      </View>
      <View style={[s.row, { justifyContent: "center" }]}>
        <Action
          label="Zoom Out"
          icon={ZoomOut}
          disabled={label <= 1}
          onPress={() => zoom.zoom(-0.5)}
        />
        <Copy style={{ color: "#fff" }}>{Math.round(label * 100)}%</Copy>
        <Action
          label="Zoom In"
          icon={ZoomIn}
          disabled={label >= 5}
          onPress={() => zoom.zoom(0.5)}
        />
        <Action
          label="Reset Zoom"
          icon={RotateCcw}
          onPress={() => zoom.reset()}
        />
      </View>
    </View>
  );
}
