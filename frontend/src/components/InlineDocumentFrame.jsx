import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Vite emits the matching installed worker into assets; no CDN, second PDF copy
// or converter is involved. Relative assets also work in packaged app:// URLs.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function InlineDocumentFrame({ url, config = {}, title = "Document preview", className = "" }) {
  const [numPages, setNumPages] = useState(null);
  config = config || {};

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  if (!url) return null;

  // Extract config
  const isBW = config.colorType === 'bw';
  const pps = Number(config.pagesPerSheet) || 1;
  const isLandscape = config.orientation === 'landscape';

  // Parse selectedPages (e.g., "1,3,5-7")
  const getSelectedPagesList = () => {
    if (!config.selectedPages || String(config.selectedPages).trim() === '' || String(config.selectedPages).toLowerCase() === 'all') {
      return Array.from({ length: numPages }, (_, i) => i + 1);
    }
    const result = new Set();
    const parts = String(config.selectedPages).split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= numPages) result.add(i);
          }
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num) && num >= 1 && num <= numPages) result.add(num);
      }
    }
    return Array.from(result).sort((a, b) => a - b);
  };

  // Group pages into sheets based on pagesPerSheet
  const sheets = [];
  if (numPages) {
    const pagesToPrint = getSelectedPagesList();
    for (let i = 0; i < pagesToPrint.length; i += pps) {
      const sheetPages = [];
      for (let j = 0; j < pps && i + j < pagesToPrint.length; j++) {
        sheetPages.push(pagesToPrint[i + j]);
      }
      sheets.push(sheetPages);
    }
  }

  const gridCols = pps === 1 ? 1 : pps === 2 ? 1 : pps === 4 ? 2 : pps === 6 ? 2 : pps === 9 ? 3 : pps === 16 ? 4 : 1;
  const gridRows = pps === 1 ? 1 : pps === 2 ? 2 : pps === 4 ? 2 : pps === 6 ? 3 : pps === 9 ? 3 : pps === 16 ? 4 : 1;

  // Physical sheet aspect ratio (approx A4)
  const sheetAspectRatio = isLandscape ? "aspect-[1.414/1]" : "aspect-[1/1.414]";

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${className}`}>
      
      {/* Scrollable Document Area */}
      <div className="flex-1 overflow-auto bg-[#525659] p-4 sm:p-8">
        <div 
          className={`flex flex-col items-center gap-6 mx-auto ${isBW ? 'grayscale contrast-125 brightness-105' : ''}`}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-300 font-medium animate-pulse">Parsing Document...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center gap-2 text-rose-300 py-12">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">Failed to load PDF preview.</p>
              </div>
            }
            className="flex flex-col items-center gap-8 w-full max-w-3xl"
          >
            {sheets.map((sheetPages, sheetIndex) => (
              <div 
                key={`sheet-${sheetIndex}`}
                className={`bg-white shadow-2xl w-full ${sheetAspectRatio} p-4 sm:p-8`}
              >
                <div 
                  className="w-full h-full grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                  }}
                >
                  {sheetPages.map((pageNum) => (
                    <div key={`page-${pageNum}`} className="w-full h-full flex items-center justify-center overflow-hidden border border-slate-100 relative">
                      <Page 
                        pageNumber={pageNum} 
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={pps > 1 ? undefined : 600}
                        loading={
                          <div className="w-full h-full min-h-[300px] bg-slate-200 animate-pulse flex items-center justify-center">
                            <span className="text-slate-400 font-medium text-sm">Loading page...</span>
                          </div>
                        }
                        className="react-pdf-page-wrapper flex items-center justify-center w-full h-full" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Document>
          <style dangerouslySetInnerHTML={{__html: `
            .react-pdf-page-wrapper .react-pdf__Page__canvas {
              max-width: 100% !important;
              max-height: 100% !important;
              width: auto !important;
              height: auto !important;
              object-fit: contain;
            }
          `}} />
        </div>
      </div>

      {/* Footer Controls */}
      <div className="shrink-0 flex items-center justify-between bg-slate-100 border-t border-slate-300 px-4 py-2 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <p className="text-sm font-medium text-slate-700">
          {numPages ? `${numPages} page(s) • ${sheets.length} sheet(s)` : '-- pages'}
        </p>
      </div>
    </div>
  );
}
