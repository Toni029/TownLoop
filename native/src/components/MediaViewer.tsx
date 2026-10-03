import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react-native";
import { Copy, Action, s } from "../news/ui";
import type { MediaAttachment } from "../../../src/types";
import { useVideoPlayer, VideoView } from "expo-video";
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
export function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  const [status, setStatus] = useState(player.status);
  const [error, setError] = useState("");
  useEffect(() => {
    const sub = player.addListener("statusChange", (event) => {
      setStatus(event.status);
      setError(event.error?.message || "");
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={{ gap: 12 }}>
      {status === "loading" && (
        <ActivityIndicator color="#fff" accessibilityLabel="Loading video" />
      )}
      <VideoView
        player={player}
        style={{ width: "100%", height: 360 }}
        nativeControls
        contentFit="contain"
      />
      {error && (
        <>
          <Copy style={{ color: "#fda4af", padding: 12 }}>
            Unable to play this video. {error}
          </Copy>
          <Action
            label="Retry Video"
            onPress={() => {
              setError("");
              player.replace(uri);
              player.play();
            }}
          />
        </>
      )}
    </View>
  );
}
function ZoomImage({ uri, title }: { uri: string; title: string }) {
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
export function MediaViewer({
  media,
  initialIndex = 0,
  title,
  onClose,
}: {
  media: MediaAttachment[];
  initialIndex?: number;
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const item = media[index];
  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0c0a09" }}>
        <View style={[s.row, { padding: 14 }]}>
          <Copy weight="bold" style={{ flex: 1, color: "#fff" }}>
            {title}
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close media"
            onPress={onClose}
            style={{ padding: 12 }}
          >
            <X size={24} color="#fff" />
          </Pressable>
        </View>
        {item?.type === "video" ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Video key={item.url} uri={item.url} />
          </View>
        ) : (
          item && (
            <ZoomImage
              key={`${index}-${item.url}`}
              uri={item.url}
              title={item.name || title}
            />
          )
        )}
        <View style={[s.row, { justifyContent: "center", padding: 14 }]}>
          <Action
            label="Previous"
            icon={ChevronLeft}
            disabled={index === 0}
            onPress={() => setIndex((i) => i - 1)}
          />
          <Copy style={{ color: "#fff" }}>
            {index + 1} / {media.length}
          </Copy>
          <Action
            label="Next"
            icon={ChevronRight}
            disabled={index >= media.length - 1}
            onPress={() => setIndex((i) => i + 1)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
