'use client';

import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';

// Context is kept for backward compatibility but components should use useDocumentEditorStore() directly
const DocumentEditorContext = createContext<null>(null);

export const useDocumentEditorContext = () => {
  const context = useContext(DocumentEditorContext);
  // Return the store directly for backward compatibility
  return useDocumentEditorStore();
};

interface DocumentEditorProviderProps {
  children: ReactNode;
  documentId: string | null;
}

export const DocumentEditorProvider: React.FC<DocumentEditorProviderProps> = ({
  children,
  documentId,
}) => {
  const reset = useDocumentEditorStore((state) => state.reset);
  const prevDocumentIdRef = useRef<string | null>(null);

  // Reset store state when documentId changes (navigating to a different document)
  useEffect(() => {
    if (prevDocumentIdRef.current !== null && prevDocumentIdRef.current !== documentId) {
      // Document changed - reset store to clear old data
      reset();
    }
    prevDocumentIdRef.current = documentId;

    return () => {
      reset();
    };
  }, [reset, documentId]);

  // Provider is now minimal - components can use useDocumentEditorStore() directly
  // Keeping this for backward compatibility with existing components
  return (
    <DocumentEditorContext.Provider value={null}>
      {children}
    </DocumentEditorContext.Provider>
  );
};
