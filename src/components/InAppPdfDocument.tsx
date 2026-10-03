import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const PdfPage: React.FC<{
  pdf: PDFDocumentProxy; number: number; width: number; scrollRoot: React.RefObject<HTMLDivElement | null>;
}> = ({ pdf, number, width, scrollRoot }) => {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(792 / 612);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: scrollRoot.current, rootMargin: '400px',
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [scrollRoot]);
  useEffect(() => {
    if (!visible || !host.current) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Newsletter page ${number}`);
    canvas.style.display = 'block';
    host.current.appendChild(canvas);
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setError(false);
    void pdf.getPage(number).then(async page => {
      if (cancelled) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / original.width });
      setRatio(original.height / original.width);
      // Bound canvas memory on phones, especially when zoomed in.
      const density = Math.min(window.devicePixelRatio || 1, 2, 2400 / Math.max(viewport.width, viewport.height));
      canvas.width = Math.ceil(viewport.width * density);
      canvas.height = Math.ceil(viewport.height * density);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] });
      await renderTask.promise;
      if (!cancelled) canvas.dataset.rendered = 'true';
    }).catch(error => {
      if (!cancelled && error?.name !== 'RenderingCancelledException') setError(true);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      canvas.remove();
      canvas.width = canvas.height = 0;
    };
  }, [pdf, number, width, visible]);
  return <section data-pdf-page={number} aria-label={`Page ${number}`} className="mx-auto mb-2" style={{ width }}>
    <p className="text-center text-[10px] text-stone-300 mb-1">Page {number} of {pdf.numPages}</p>
    <div ref={host} className="bg-white relative shadow-lg" style={{ width, height: width * ratio }}>
      {error && <p role="alert" className="absolute inset-0 p-6 text-stone-900">Unable to display this page. Close and reopen the newsletter to retry.</p>}
    </div>
  </section>;
}

/** Renders PDF pages inside the app, without an embedded browser PDF plugin or a new tab. */
export const InAppPdfDocument: React.FC<{ url: string }> = ({ url }) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(320);
  const [attempt, setAttempt] = useState(0);
  const scrollRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    setPdf(null); setError(''); setZoom(1);
    const task = getDocument({ url });
    void task.promise.then(document => { if (active) setPdf(document); }).catch(() => {
      if (active) setError('The newsletter could not be opened. Please try again.');
    });
    return () => { active = false; void task.destroy(); };
  }, [url, attempt]);
  useEffect(() => {
    const element = scrollRoot.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(160, Math.min(1000, element.clientWidth - 8))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const buttonClass = 'min-w-10 min-h-10 px-2 rounded-lg bg-stone-800 text-white disabled:opacity-40';
  return <div className="flex flex-col w-full h-full min-h-0" aria-label="Newsletter PDF reader">
    {pdf && <div className="order-last shrink-0 flex flex-wrap items-center justify-center gap-1 py-0.5 text-xs text-white border-t border-stone-800" role="toolbar" aria-label="PDF controls">
      <label>Page <select aria-label="Go to page" defaultValue="1" className="min-h-10 rounded-lg bg-stone-800 px-2" onChange={event => {
        const target = scrollRoot.current?.querySelector<HTMLElement>(`[data-pdf-page="${event.target.value}"]`);
        if (target && scrollRoot.current) scrollRoot.current.scrollTop += target.getBoundingClientRect().top - scrollRoot.current.getBoundingClientRect().top;
      }}>{Array.from({ length: pdf.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select> of {pdf.numPages}</label>
      <button type="button" className={buttonClass} aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))}>−</button>
      <span className="w-12 text-center" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button type="button" className={buttonClass} aria-label="Zoom in" disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, value + 0.25))}>+</button>
      <button type="button" className={buttonClass} onClick={() => setZoom(1)}>Fit width</button>
    </div>}
    <div ref={scrollRoot} data-pdf-scroll className="flex-1 min-h-0 overflow-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
      {error ? <div className="p-8 text-center text-white" role="alert"><p>{error}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
        : !pdf ? <p role="status" className="p-8 text-center text-white">Opening newsletter pages…</p>
        : Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={`${url}-${i}`} pdf={pdf} number={i + 1} width={Math.round(width * zoom)} scrollRoot={scrollRoot} />)}
    </div>
  </div>;
}
