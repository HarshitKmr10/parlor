import React, { useEffect, useRef, useState } from 'react';
import * as PDFJS from 'pdfjs-dist';
import clsx from 'clsx';

// Use CDN for PDF.js worker
PDFJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;

type PDFModalProps = {
  url: string;
  onClose: () => void;
};


function PDFModal({ url, onClose }: PDFModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const sanitizedUrl: string = url.slice(0, url.lastIndexOf('#'));
  const fileName: string = sanitizedUrl.replace(/^.*[\\/]/, '');

  const getFileType = (fileUrl: string): string => {
    const extension: string = fileUrl.split('.').pop()?.toLowerCase() ?? '';
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'docx':
        return 'docx';
      case 'txt':
        return 'txt';
      default:
        return 'unknown';
    }
  };

  const renderPDF = async (pdfUrl: string): Promise<void> => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const loadingTask = PDFJS.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);

      const containerWidth = containerRef?.current?.offsetWidth ?? 0;
      const pageViewport = page.getViewport({ scale: 1 });
      const scale: number = containerWidth / pageViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.height = viewport.height * window.devicePixelRatio;
      canvas.width = viewport.width * window.devicePixelRatio;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.width = `${viewport.width}px`;

      const context = canvas.getContext('2d');
      if (context) {
        context.scale(window.devicePixelRatio, window.devicePixelRatio);

        const renderContext = {
          canvasContext: context,
          viewport,
        };
        containerRef.current.appendChild(canvas);
        await page.render(renderContext).promise;
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (
      sanitizedUrl
      && containerRef.current
      && getFileType(sanitizedUrl) === 'pdf'
    ) {
      renderPDF(sanitizedUrl);
    }
  }, [sanitizedUrl]);

  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!sanitizedUrl) return null;
  return (
    <div
      className="_wrapper w-screen h-screen fixed inset-0 bg-gray-600 bg-opacity-50 grid place-items-center cursor-pointer"
      onClick={handleWrapperClick}
      role="button"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={0}
    >
      <div
        className="_main-container relative h-10/12 w-4/6 lg:w-3/6 xl:w-2/6 object-contain flex flex-col gap-4 bg-white p-8 rounded-2xl shadow-lg dark:!bg-navy-800 cursor-default"
      >
        <div className="_top flex justify-between relative">
          <div className="_heading text-xl font-semibold dark:text-white max-w-[85%] text-wrap break-words">
            {fileName}
          </div>
          <button onClick={onClose} className="text-2xl cursor-pointer" aria-label="Close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-textColor-light dark:text-textColor-dark p-1 rounded-lg hover:text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {loading && (
        <div role="status" className="max-w-sm animate-pulse">
          <div className="h-4 bg-blueGrey-200 rounded-md dark:bg-navy-700 w-48 mb-3" />
          <div className="h-4 bg-blueGrey-200 rounded-md dark:bg-navy-700 max-w-[360px] mb-3" />
          <div className="h-4 bg-blueGrey-200 rounded-md dark:bg-navy-700 mb-3" />
          <div className="h-4 bg-blueGrey-200 rounded-md dark:bg-navy-700 max-w-[330px] mb-3" />
          <span className="sr-only">Loading...</span>
        </div>
        )}

        <div
          className={clsx(
            '_pdf-container h-full w-full overflow-y-auto max-h-[75vh] transition-opacity duration-1000',
            loading && 'scale-0 opacity-0',
            !loading && 'scale-1 opacity-100',
          )}
          ref={containerRef}
        />
      </div>
    </div>
  );
}

export default PDFModal;
