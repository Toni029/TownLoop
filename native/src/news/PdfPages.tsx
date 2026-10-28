import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import Pdf, { type PdfProps, type PdfRef } from "react-native-pdf";
export interface NewsletterPdfRef extends PdfRef { setScale(value: number): void }
// Pinned react-native-pdf exposes setNativeProps, although PdfRef omits it.
type NativePdfRef = PdfRef & { setNativeProps(props: {scale: number}): void };
export const PdfPages = memo(forwardRef<NewsletterPdfRef, PdfProps>(
  function PdfPages(props, ref) {
    const native = useRef<NativePdfRef>(null);
    useImperativeHandle(ref, () => ({
      setPage: (page: number) => native.current?.setPage(page),
      setScale: (value: number) => native.current?.setNativeProps({scale: value}),
    }), []);
    return (
      <Pdf
        ref={native}
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
));
