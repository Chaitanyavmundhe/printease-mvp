import React, { useEffect, useState, useRef } from "react";
import { X, Download, FileText, Image, FileCode, AlertCircle, Loader2 } from "lucide-react";
import InlineDocumentFrame from "./InlineDocumentFrame";
import FileSettingsPanel from "./upload/FileSettingsPanel";
import { getDocumentPreviewBlob } from "../services/api";

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  blobUrl,
  previewKind,
  fileName,
  fileType,
  fileSize,
  loading: externalLoading,
  error: externalError,
  onDownload,
  documentId,
  fetchConvertedPdf,
  config,
  onChangeConfig,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
}) {
  const [internalBlobUrl, setInternalBlobUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !documentId) {
      setInternalBlobUrl("");
      setFetchError("");
      setIsFetching(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let isSubscribed = true;
    
    const fetchBlob = async () => {
      try {
        if (!internalBlobUrl) setIsFetching(true);
        const blob = await getDocumentPreviewBlob(documentId, fetchConvertedPdf);
        if (isSubscribed) {
          const url = URL.createObjectURL(blob);
          setInternalBlobUrl(url);
          setIsFetching(false);
          setFetchError("");
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (err) {
        if (isSubscribed) {
          if (fetchConvertedPdf) {
            // If waiting for converted PDF, it might not be ready yet. Keep polling.
            setFetchError("Waiting for Hub to convert document...");
            setIsFetching(true);
          } else {
            setFetchError("Could not load preview. " + err.message);
            setIsFetching(false);
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      }
    };

    fetchBlob();
    
    if (fetchConvertedPdf) {
      timerRef.current = setInterval(fetchBlob, 3000);
    }

    return () => {
      isSubscribed = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (internalBlobUrl) URL.revokeObjectURL(internalBlobUrl);
    };
  }, [isOpen, documentId, fetchConvertedPdf]);

  const activeBlobUrl = blobUrl || internalBlobUrl;
  const loading = externalLoading || isFetching;
  const error = externalError || fetchError;
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const isPdfPreview = previewKind === "pdf" && activeBlobUrl && !loading && !error;

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Render file icon based on kind
  const renderIcon = () => {
    switch (previewKind) {
      case "image":
        return <Image className="h-12 w-12 text-blue-500" />;
      case "text":
        return <FileCode className="h-12 w-12 text-green-500" />;
      case "pdf":
        return <FileText className="h-12 w-12 text-rose-500" />;
      default:
        return <FileText className="h-12 w-12 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
      
      {/* Modal Container: Full Screen Print Dialog Style */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
        className="relative flex h-[95vh] w-[95vw] max-w-[1400px] overflow-hidden rounded-2xl bg-white shadow-2xl flex-col-reverse md:flex-row"
      >
        
        {/* Left Sidebar: Print Settings */}
        <div className="flex w-full flex-col border-t md:border-t-0 md:border-r border-slate-200 bg-slate-50 md:w-[340px] h-[50vh] md:h-full shrink-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-white shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Print settings</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0">
            {config && onChangeConfig ? (
              <FileSettingsPanel 
                activeConfig={config} 
                setConfigVal={onChangeConfig} 
                layoutType="dialog" 
              />
            ) : (
              <div className="p-6 text-sm text-slate-500">Settings not available for this document.</div>
            )}
          </div>
          
          <div className="border-t border-slate-200 bg-white p-5 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm hidden md:block"
              >
                Done
              </button>
              {onContinue && (
                <button
                  onClick={() => {
                    onClose();
                    onContinue();
                  }}
                  disabled={continueDisabled}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {continueLabel}
                </button>
              )}
              {!onContinue && (
                <button
                  onClick={onClose}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Main Area: Preview */}
        <div className="flex-1 flex flex-col bg-slate-200/80 overflow-hidden relative min-h-0">
          
          {/* Top Bar for filename and actions */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-slate-900/60 to-transparent px-4 py-3 pb-8">
            <div className="flex items-center gap-2 text-white drop-shadow-md">
              {renderIcon()}
              <div>
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs opacity-80">{fileSize > 0 ? formatSize(fileSize) : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!loading && !error && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-2 rounded-md bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/30 transition shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-2 rounded-md bg-rose-600/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md hover:bg-rose-500 transition shadow-sm"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                <p className="text-sm font-medium text-slate-500">Loading preview...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <AlertCircle className="h-8 w-8 text-rose-500" />
                <p className="text-sm font-medium text-slate-700">{error}</p>
                <button
                  onClick={onDownload}
                  className="mt-2 flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  Download File Instead
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex justify-center overflow-hidden">
                {previewKind === "pdf" && activeBlobUrl && (
                  <InlineDocumentFrame url={activeBlobUrl} config={config} className="w-full h-full border-none !bg-transparent" />
                )}

                {previewKind === "image" && activeBlobUrl && (
                  <div className="overflow-auto max-h-full max-w-full rounded-md shadow-lg bg-white p-2">
                    <img
                      src={activeBlobUrl}
                      alt={fileName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                {previewKind === "text" && (
                  <div className="w-full max-w-3xl overflow-hidden bg-white shadow-lg rounded-md flex flex-col h-full">
                    <pre className="flex-1 w-full overflow-auto p-6 font-mono text-sm leading-relaxed text-slate-800">
                      <code>{textContent}</code>
                    </pre>
                  </div>
                )}
                
                {previewKind === "unsupported" && (
                  <div className="flex flex-col items-center justify-center gap-4 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      {renderIcon()}
                    </div>
                    <div className="text-center">
                      <h4 className="text-base font-semibold text-slate-800">Cannot Preview Inline</h4>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        This file type doesn't support direct in-browser previews.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
