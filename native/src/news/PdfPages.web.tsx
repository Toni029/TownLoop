import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type FC,
  type RefObject,
} from "react";
import type { PdfProps, PdfRef } from "react-native-pdf";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
const PdfPage: FC<{
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  scrollRoot: RefObject<HTMLDivElement | null>;
}> = ({ pdf, number, width, scrollRoot }) => {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(792 / 612);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      {
        root: scrollRoot.current,
        rootMargin: "400px",
      },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [scrollRoot]);
  useEffect(() => {
    if (!visible || !host.current) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Newsletter page ${number}`);
    canvas.style.display = "block";
    host.current.appendChild(canvas);
    let cancelled = false;
    let renderTask:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setError(false);
    void pdf
      .getPage(number)
      .then(async (page) => {
        if (cancelled) return;
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / original.width });
        setRatio(original.height / original.width);
        // Bound canvas memory on phones, especially when zoomed in.
        const density = Math.min(
          window.devicePixelRatio || 1,
          2,
          2400 / Math.max(viewport.width, viewport.height),
        );
        canvas.width = Math.ceil(viewport.width * density);
        canvas.height = Math.ceil(viewport.height * density);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({
          canvas,
          viewport,
          transform: [density, 0, 0, density, 0, 0],
        });
        await renderTask.promise;
        if (!cancelled) canvas.dataset.rendered = "true";
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "RenderingCancelledException")
          setError(true);
      });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      canvas.remove();
      canvas.width = canvas.height = 0;
    };
  }, [pdf, number, width, visible]);
  return (
    <section
      data-pdf-page={number}
      aria-label={`Page ${number}`}
      style={{ width, margin: "0 auto 8px" }}
    >
      <p
        style={{
          textAlign: "center",
          fontSize: 10,
          color: "#d6d3d1",
          margin: 4,
        }}
      >
        Page {number} of {pdf.numPages}
      </p>
      <div
        ref={host}
        style={{
          background: "white",
          position: "relative",
          width,
          height: width * ratio,
        }}
      >
        {error && (
          <p
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              padding: 24,
              color: "#1c1917",
            }}
          >
            Unable to display this page. Close and reopen the newsletter to
            retry.
          </p>
        )}
      </div>
    </section>
  );
};

export const PdfPages = forwardRef<PdfRef, PdfProps>(
  function PdfPages(props, ref) {
    const { source, scale = 1 } = props;
    const uri = typeof source === "object" ? source.uri : "";
    const callbacks = useRef(props);
    useEffect(() => { callbacks.current = props; }, [props]);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [width, setWidth] = useState(320);
    const root = useRef<HTMLDivElement>(null);
    useImperativeHandle(
      ref,
      () => ({
        setPage(page) {
          const host = root.current;
          const target = host?.querySelector<HTMLElement>(
            `[data-pdf-page="${page}"]`,
          );
          if (host && target)
            host.scrollTop +=
              target.getBoundingClientRect().top -
              host.getBoundingClientRect().top;
        },
      }),
      [],
    );
    useEffect(() => {
      if (!uri) return;
      let active = true;
      const task = getDocument({
        url: uri,
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
      });
      void task.promise
        .then((doc) => {
          if (!active) return;
          setPdf(doc);
          callbacks.current.onLoadComplete?.(
            doc.numPages,
            uri,
            { width: 0, height: 0 },
            [],
          );
        })
        .catch((error) => {
          if (active) callbacks.current.onError?.(error);
        });
      return () => {
        active = false;
        void task.destroy();
      };
    }, [uri]);
    useEffect(() => {
      const host = root.current;
      if (!host) return;
      const observer = new ResizeObserver(() =>
        setWidth(Math.max(160, host.clientWidth - 16)),
      );
      observer.observe(host);
      return () => observer.disconnect();
    }, []);
    function onScroll() {
      const host = root.current;
      if (!host || !pdf) return;
      const top = host.getBoundingClientRect().top;
      const pages = [...host.querySelectorAll<HTMLElement>("[data-pdf-page]")];
      const current = pages.find(
        (page) => page.getBoundingClientRect().bottom > top + 30,
      );
      if (current)
        callbacks.current.onPageChanged?.(
          Number(current.dataset.pdfPage),
          pdf.numPages,
        );
    }
    return (
      <div
        ref={root}
        aria-label="Newsletter PDF pages"
        onScroll={onScroll}
        style={{
          flex: 1,
          height: "100%",
          minHeight: 0,
          overflow: "auto",
          overscrollBehavior: "contain",
          background: "#0c0a09",
        }}
      >
        {!pdf ? (
          <p role="status" style={{ color: "white", padding: 24 }}>
            Opening newsletter pages…
          </p>
        ) : (
          Array.from({ length: pdf.numPages }, (_, i) => (
            <PdfPage
              key={`${uri}-${i}`}
              pdf={pdf}
              number={i + 1}
              width={Math.round(width * scale)}
              scrollRoot={root}
            />
          ))
        )}
      </div>
    );
  },
);
