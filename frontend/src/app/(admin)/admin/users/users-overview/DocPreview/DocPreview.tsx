"use client";
import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { X } from "lucide-react";
import { serviceDeskInstance } from "api/common/axiosInstance";

import "./DocPreview.css";

/**
 * Extract storage path from full URL
 * Supports Azure Blob Storage and S3 URL formats
 * Returns: container/object_path
 */
const extractStoragePath = (url: string): string => {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (error) {
    console.error('Error parsing storage URL:', error);
    return url;
  }
};

interface DocPreviewProps {
  url: string;
  title?: string;
  onClose?: () => void;
}

const DocPreview = ({ url, title, onClose }: DocPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const file = new URL(url);
  const isDocx = file.pathname.toLowerCase().endsWith(".docx");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDocx = async () => {
      if (!isDocx || !containerRef.current) return;

      try {
        // Extract storage path from URL and use the secure proxy endpoint
        const storagePath = extractStoragePath(url);
        const response = await serviceDeskInstance.post('/service_desk/proxy/fetch_file', {
          storage_path: storagePath
        });
        
        // The proxy returns JSON with content field and is_binary flag
        const { content, is_binary } = response.data;
        
        let blob;
        if (is_binary) {
          // Content is base64 encoded binary data
          const binaryString = atob(content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        } else {
          // Content is text data
          blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        }
        
        await renderAsync(blob, containerRef.current);
      } catch (err) {
        console.error("Error rendering DOCX:", err);
        setError("Unable to preview this document. Opening in a new tab...");
        window.open(url, "_blank"); // Open fallback
      }
    };

    if (isDocx) renderDocx();
  }, [url, isDocx]);

  return (
    <div className="relative">
      {(!!title || onClose) && (
        <div className="flex items-center justify-between mb-4">
          {!!title && <h2 className="text-xl font-semibold">{title}</h2>}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-black p-1 ml-2"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {error ? (
        <div className="text-red-600 p-4 bg-red-50 rounded-md">{error}</div>
      ) : (
        <div
          ref={containerRef}
          className="docx-preview bg-white p-4 overflow-auto max-h-[95vh]"
        />
      )}
    </div>
  );
};

export default DocPreview;