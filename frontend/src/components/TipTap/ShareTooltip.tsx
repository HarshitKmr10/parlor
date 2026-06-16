import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';

const TOOLTIP_OFFSET_Y = 20; // pixels above the selection
const TOOLTIP_OFFSET_X = 10; // pixels to center the tooltip horizontally

const createShareLink = (type, title = '', summary = '', text, pageUrl) => {
  if (!text) return '';
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`${summary}: "${text}"`)}&via=yourTwitterHandle`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`"${text}"\n\n${summary}\n${pageUrl}`)}`;
  return type === 'twitter' ? twitterUrl : emailUrl;
};

function ShareTooltip({ text, position }) {
  const [shareApi, setShareApi] = useState({ supported: false, navigator: null });
  const tooltipRef = useRef(null);
  const pageUrl = window.location.href;

  useEffect(() => {
    setShareApi({ supported: !!navigator.share, navigator });
  }, []);

  const handleShare = async (e, type) => {
    e.preventDefault();
    if (type === 'shareButton' && shareApi.supported) {
      try {
        await shareApi.navigator.share({
          title: document.title,
          text,
          url: pageUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  return (
    <div
      ref={tooltipRef}
      className="absolute bg-[#041e42] text-white rounded shadow-md p-2 flex space-x-4 z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <a
        href={createShareLink('twitter', document.title, 'Check this out', text, pageUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-blue-400"
      >
        🐦
      </a>
      <a
        href={createShareLink('email', document.title, 'Check this out', text, pageUrl)}
        className="hover:text-blue-400"
      >
        ✉️
      </a>
      {shareApi.supported && (
        <button onClick={(e) => handleShare(e, 'shareButton')} className="hover:text-blue-400">
          🔗
        </button>
      )}
      <div
        className="absolute bottom-0 left-1/2 w-3 h-3 bg-[#041e42] transform rotate-45 translate-y-1/2 -translate-x-1/2"
      />
    </div>
  );
}

export function SharableContentWrapper({ children }) {
  const [selection, setSelection] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();
    if (windowSelection.toString().trim().length > 0) {
      const range = windowSelection.getRangeAt(0);
      const rects = range.getClientRects();
      const firstRect = rects[0]; // Start of selection
      const lastRect = rects[rects.length - 1]; // End of selection

      // Calculate new position with additional manual offsets
      const tooltipX = (firstRect.left + lastRect.right) / 2 - TOOLTIP_OFFSET_X; // Subtract some pixels to center horizontally
      const tooltipY = firstRect.top + window.pageYOffset - TOOLTIP_OFFSET_Y; // Offset Y to place tooltip above

      setSelection({
        text: windowSelection.toString(),
        selection: windowSelection,
      });

      setTooltipPosition({
        top: tooltipY,
        left: tooltipX,
      });
    } else {
      setSelection(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  return (
    <div className="relative">
      {children}
      {selection && (
        <ShareTooltip text={selection.text} position={tooltipPosition} />
      )}
    </div>
  );
}
