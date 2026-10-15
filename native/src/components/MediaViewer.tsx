import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";
import { Copy, Action, s } from "../news/ui";
import type { MediaAttachment } from "../../../src/types";
import { useVideoPlayer, VideoView } from "expo-video";
import { ZoomImage } from "./ZoomImage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useReducedMotion } from "../home/hooks";
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
      {!!(error) && (
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
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(initialIndex);
  const item = media[index];
  return (
    <Modal animationType={reduced ? "none" : "fade"} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    </Modal>
  );
}
