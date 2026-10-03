import { forwardRef } from "react";
import { Text, View } from "react-native";
import type { PdfProps, PdfRef } from "react-native-pdf";
export const PdfPages = forwardRef<PdfRef, PdfProps>(function PdfPages() {
  return (
    <View>
      <Text>
        Open the TownLoop development build on Android or iOS to read this PDF.
      </Text>
    </View>
  );
});
