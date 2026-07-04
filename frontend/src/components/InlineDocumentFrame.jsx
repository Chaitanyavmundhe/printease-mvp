import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function InlineDocumentFrame({ url, title = "Document preview", className = "" }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  if (!url) return null;

  return (
    <div className={`flex min-h-[360px] flex-col overflow-hidden rounded-xl border bg-slate-50 ${className}`}>
      <div className="flex-1 overflow-auto bg-slate-200/50 flex items-center justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center gap-2 text-slate-500 py-12">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
              <p className="text-sm">Loading PDF...</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-2 text-rose-500 py-12">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">Failed to load PDF preview.</p>
            </div>
          }
          className="flex flex-col items-center"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-xl" 
          />
        </Document>
      </div>

      <div className="shrink-0 flex items-center justify-between border-t bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="text-sm font-medium text-slate-700 min-w-[80px] text-center">
            Page {pageNumber} of {numPages || '--'}
          </p>
          <button 
            type="button"
            disabled={pageNumber >= numPages}
            onClick={() => changePage(1)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="px-2 py-1 text-xs font-semibold text-slate-600 rounded-md hover:bg-slate-100 border"
          >
            A-
          </button>
          <button 
            onClick={() => setScale(s => Math.min(3.0, s + 0.25))}
            className="px-2 py-1 text-xs font-semibold text-slate-600 rounded-md hover:bg-slate-100 border"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
}
