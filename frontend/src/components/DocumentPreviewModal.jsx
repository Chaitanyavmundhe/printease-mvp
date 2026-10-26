import React, { useEffect, useState } from "react";
import { X, Download, FileText, Image, FileCode, AlertCircle, Loader2, Settings, Eye } from "lucide-react";
import InlineDocumentFrame from "./InlineDocumentFrame";
import FileSettingsPanel from "./upload/FileSettingsPanel";
import { getDocumentPreviewBlob } from "../services/api";
import { isPreviewPending } from "../utils/documentPreview";

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  blobUrl,
  previewKind,
  fileName,
  fileType,
  fileSize,
  textContent = "",
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
  const [pendingMessage, setPendingMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setInternalBlobUrl("");
    setFetchError("");
    setPendingMessage("");
    setIsFetching(false);
    if (!isOpen || !documentId || blobUrl) return;
    let isSubscribed = true;
    let timer;
    let ownedUrl;
    const deadline = Date.now() + 120000;

    const fetchBlob = async () => {
      setIsFetching(true);
      try {
        const blob = await getDocumentPreviewBlob(documentId, fetchConvertedPdf);
        if (isSubscribed) {
          ownedUrl = URL.createObjectURL(blob);
          setInternalBlobUrl(ownedUrl);
          setIsFetching(false);
          setFetchError("");
          setPendingMessage("");
        }
      } catch (err) {
        if (isSubscribed) {
          // Only the backend's explicit pending status permits another read.
          // Sequential, bounded polling never starts/retries conversion itself.
          if (fetchConvertedPdf && isPreviewPending(err) && Date.now() < deadline) {
            setPendingMessage("Preparing PDF preview...");
            timer = setTimeout(fetchBlob, 3000);
          } else {
            setFetchError(isPreviewPending(err) ? "PDF preview is still preparing. Try again shortly." : "Could not load preview. " + err.message);
            setPendingMessage("");
            setIsFetching(false);
          }
        }
      }
    };

    fetchBlob();
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [isOpen, documentId, fetchConvertedPdf, blobUrl, retry]);

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
        className="relative flex h-[100dvh] w-screen max-w-[1400px] flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[95dvh] md:w-[95vw] md:flex-row-reverse md:rounded-2xl"
      >
        
        {/* Right Main Area / Top Area: Preview */}
        <div className="relative flex h-[42dvh] shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-200/80 md:h-auto md:min-h-0 md:flex-1 md:border-b-0 md:border-l">
          
          {/* Top Bar for filename and actions */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-900/70 to-transparent px-3 py-3 pb-8 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 text-white drop-shadow-md">
              <div className="hidden sm:block">{renderIcon()}</div>
              <div className="min-w-0">
                <p id="document-preview-title" className="truncate text-xs font-medium sm:text-sm">{fileName}</p>
                <p className="text-xs opacity-80">{fileSize > 0 ? formatSize(fileSize) : ""}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {!loading && !error && (
                <button
                  onClick={onDownload}
                  className="flex min-h-9 items-center gap-2 rounded-md bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/30 sm:px-3"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close preview"
                className="flex min-h-9 items-center gap-2 rounded-md bg-rose-600/90 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md transition hover:bg-rose-500 sm:px-3"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 pt-12 sm:p-8 sm:pt-14">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                <p className="text-sm font-medium text-slate-500">{pendingMessage || "Loading preview..."}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <AlertCircle className="h-8 w-8 text-rose-500" />
                <p className="text-sm font-medium text-slate-700">{error}</p>
                {documentId && !externalError && (
                  <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
                    Retry preview
                  </button>
                )}
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

        {/* Sidebar / Bottom Area: Print Settings */}
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50 md:h-full md:w-[340px] md:shrink-0">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-5 md:py-4">
            <h2 className="text-base font-bold text-slate-800 md:text-lg">Print settings</h2>
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
          
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-5">
            <button
              onClick={onClose}
              className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:px-4"
            >
              Cancel
            </button>
            <div className="flex min-w-0 gap-2">
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
                  className="min-h-10 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 md:px-6"
                >
                  {continueLabel}
                </button>
              )}
              {!onContinue && (
                <button
                  onClick={onClose}
                  className="min-h-10 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 md:px-6"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
