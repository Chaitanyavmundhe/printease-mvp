import { useState, useEffect, useRef, useCallback } from "react";
import { getDocumentDownloadBlob } from "../services/api";
import { loadDocumentPreview } from "../services/documentPreview";

export function useDocumentPreview() {
  const [documentId, setDocumentId] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [previewKind, setPreviewKind] = useState("unsupported");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeUrlRef = useRef(null);
  const requestRef = useRef(0);

  const revokeActive = useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    requestRef.current++;
    revokeActive();
    setDocumentId(null);
    setBlobUrl(null);
    setPreviewKind("unsupported");
    setFileName("");
    setFileType("");
    setFileSize(0);
    setTextContent("");
    setError("");
    setLoading(false);
  }, [revokeActive]);

  useEffect(() => {
    return () => {
      requestRef.current++;
      revokeActive();
    };
  }, [revokeActive]);

  const openPreview = useCallback(async (docId, name, type, size) => {
    closePreview();
    const request = requestRef.current;
    setLoading(true);
    setDocumentId(docId);
    setFileName(name || "Document");
    setFileType(type || "");
    setFileSize(size || 0);

    try {
      const preview = await loadDocumentPreview({ documentId: docId, fileName: name, fileType: type });
      // Closing/switching documents invalidates older in-flight responses.
      if (request !== requestRef.current) return;
      setTextContent(preview.textContent);
      setFileName(preview.name);
      setFileType(preview.fileType);
      setFileSize(preview.blob.size);
      const url = URL.createObjectURL(preview.blob);
      activeUrlRef.current = url;
      setBlobUrl(url);
      setPreviewKind(preview.kind);
    } catch (err) {
      if (request === requestRef.current) setError(err.status === 425 ? 'PDF preview is still preparing. Please try again shortly.' : err.message || "Failed to load document preview.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [closePreview]);

  const downloadDocument = useCallback(async (docId, name) => {
    try {
      const blob = await getDocumentDownloadBlob(docId);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = name || "document";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download document.");
    }
  }, []);

  return {
    documentId,
    openPreview,
    closePreview,
    downloadDocument,
    blobUrl,
    previewKind,
    fileName,
    fileType,
    fileSize,
    textContent,
    loading,
    error
  };
}
