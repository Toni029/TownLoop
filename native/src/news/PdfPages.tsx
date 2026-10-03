import { forwardRef } from "react";
import Pdf, { type PdfProps, type PdfRef } from "react-native-pdf";
export const PdfPages = forwardRef<PdfRef, PdfProps>(
  function PdfPages(props, ref) {
    return (
      <Pdf
        ref={ref}
        {...props}
        trustAllCerts={false}
        fitPolicy={0}
        enableDoubleTapZoom
        enableAnnotationRendering
        minScale={0.75}
        maxScale={2.5}
        spacing={8}
      />
    );
  },
);
