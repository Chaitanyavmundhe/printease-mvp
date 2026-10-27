import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AlertCircle, Minus, Plus, RotateCcw } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Match the installed PDF.js version; keep the worker local in packaged apps.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
const EMPTY_CONFIG = Object.freeze({});

const PreviewSheet = memo(function PreviewSheet({ pages, index, width, landscape, columns, rows, root }) {
  const element = useRef(null);
  const [visible, setVisible] = useState(index < 2);
  useEffect(() => {
    if (!root || !element.current || typeof IntersectionObserver === "undefined") {
      if (typeof IntersectionObserver === "undefined") setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root, rootMargin: "600px 0px",
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [root]);
  const cellWidth = Math.max(32, Math.floor((width - 32 - (columns - 1) * 12) / columns));
  return (
    <div ref={element} data-preview-sheet={index + 1} aria-label={`Sheet ${index + 1}`}
      className="relative shrink-0 border border-slate-300 bg-white p-4 shadow-sm"
      style={{ width, maxWidth: "none", aspectRatio: landscape ? "1.414 / 1" : "1 / 1.414" }}>
      {visible ? (
        <div className="grid h-full w-full gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {pages.map(page => (
            <div key={page} className="pe-pdf-cell flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
              <Page pageNumber={page} width={cellWidth} devicePixelRatio={Math.min(globalThis.devicePixelRatio || 1, 1.5)}
                renderTextLayer={false} renderAnnotationLayer={false}
                loading={<span className="text-xs text-slate-500">Loading page {page}...</span>} />
            </div>
          ))}
        </div>
      ) : <span className="text-xs text-slate-400">Sheet {index + 1}</span>}
    </div>
  );
});

function selectedPages(total, selection) {
  if (!selection || String(selection).trim().toLowerCase() === "all") return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set();
  for (const part of String(selection).split(",")) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
    if (!match) continue;
    // Clamp before iterating: an accidental huge range cannot freeze the UI.
    const start = Math.max(1, Number(match[1])), end = Math.min(total, Number(match[2] || match[1]));
    for (let page = start; page <= end; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

function InlineDocumentFrame({ url, config = EMPTY_CONFIG, title = "Document preview", className = "" }) {
  const [numPages, setNumPages] = useState(0);
  const [root, setRoot] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(640);
  const [zoom, setZoom] = useState(1);
  const [jump, setJump] = useState("1");
  const onLoad = useCallback(({ numPages }) => setNumPages(numPages), []);
  useEffect(() => { setNumPages(0); setZoom(1); setJump("1"); if (root) root.scrollTop = 0; }, [url]);
  useEffect(() => {
    if (!root) return;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewportWidth(Math.max(140, root.clientWidth - 32)));
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(root);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); cancelAnimationFrame(frame); };
  }, [root]);
  const options = config || EMPTY_CONFIG;
  const pps = [1, 2, 4, 6, 9, 16].includes(Number(options.pagesPerSheet)) ? Number(options.pagesPerSheet) : 1;
  const range = options.pages?.mode === "custom" ? options.pages.range : options.selectedPages;
  const reverse = options.pageOrder === "reverse";
  const sheets = useMemo(() => {
    const pages = selectedPages(numPages, range);
    if (reverse) pages.reverse();
    const result = [];
    for (let i = 0; i < pages.length; i += pps) result.push(pages.slice(i, i + pps));
    return result;
  }, [numPages, range, pps, reverse]);
  const columns = ({ 1: 1, 2: 1, 4: 2, 6: 2, 9: 3, 16: 4 })[pps];
  const rows = pps / columns;
  const width = Math.max(140, Math.floor(Math.min(viewportWidth, 1000) * zoom));
  const isBW = options.colorType === "bw" || ["black_white", "grayscale", "bw"].includes(options.colorMode);

  if (!url) return null;
  function goToSheet() {
    const number = Math.max(1, Math.min(sheets.length, Number(jump) || 1));
    setJump(String(number));
    root?.querySelector(`[data-preview-sheet="${number}"]`)?.scrollIntoView({ block: "start" });
  }
  return (
    <div aria-label={title} className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 py-2">
        <span role="status" className="text-xs text-slate-600">{numPages ? `${numPages} pages / ${sheets.length} sheets` : "Loading PDF..."}</span>
        <div className="flex items-center gap-2">
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.5, value - 0.25))} disabled={zoom <= 0.5} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-40"><Minus size={16} /></button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(2, value + 0.25))} disabled={zoom >= 2} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-40"><Plus size={16} /></button>
          <button type="button" title="Fit to width" aria-label="Fit to width" onClick={() => setZoom(1)} className="rounded p-1.5 hover:bg-slate-100"><RotateCcw size={16} /></button>
          {sheets.length > 1 && <label className="flex items-center gap-1 text-xs">Sheet
            <input aria-label="Go to sheet" type="number" min="1" max={sheets.length} value={jump}
              onChange={event => setJump(event.target.value)} onBlur={goToSheet} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); goToSheet(); } }}
              className="w-14 rounded border px-1 py-1" />
          </label>}
        </div>
      </div>
      <div ref={setRoot} data-testid="pdf-scroll" className="min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-200 p-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <Document key={url} file={url} onLoadSuccess={onLoad} style={{ minWidth: Math.max(viewportWidth, width) }} className={`flex min-w-full flex-col items-center gap-4 ${isBW ? "grayscale" : ""}`}
          loading={<p className="p-8 text-sm text-slate-600">Loading PDF...</p>}
          error={<div role="alert" className="flex flex-col items-center gap-2 p-8 text-rose-700"><AlertCircle size={24} /><p>Failed to load PDF preview.</p></div>}>
          {sheets.map((pages, index) => <PreviewSheet key={index} pages={pages} index={index} width={width} landscape={options.orientation === "landscape"} columns={columns} rows={rows} root={root} />)}
          {numPages > 0 && sheets.length === 0 && <p className="p-6 text-sm text-slate-700">No pages match the selected range.</p>}
        </Document>
      </div>
      <style>{".pe-pdf-cell .react-pdf__Page{max-width:100%;max-height:100%;display:flex;align-items:center;justify-content:center}.pe-pdf-cell .react-pdf__Page__canvas{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain}"}</style>
    </div>
  );
}

export default memo(InlineDocumentFrame);
