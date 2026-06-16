'use client';

import React, { memo } from 'react';
import { Box } from '@radix-ui/themes';
import { EditorPanel } from './EditorPanel';
import { DocumentPanelHeader } from './DocumentPanelHeader';
import { TemplateLoadingOverlay } from './TemplateLoadingOverlay';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';

export const DocumentEditorPanel = memo(() => {
  const content = useDocumentEditorStore((state) => state.content);
  const editorKey = useDocumentEditorStore((state) => state.editorKey);
  const isCompareView = useDocumentEditorStore((state) => state.isCompareView);
  const isEditingDocument = useDocumentEditorStore((state) => state.isEditingDocument);
  const isChangingTemplate = useDocumentEditorStore((state) => state.isChangingTemplate);
  const recommendationData = useDocumentEditorStore((state) => state.recommendationData);
  
  // In compare view, show original content; otherwise show current content
  const displayContent = isCompareView 
    ? (recommendationData?.document?.content || '')
    : content;
  
  const handleContentChange = useDocumentEditorStore((state) => state.handleContentChange);

  return (
    <Box className={`relative ${isCompareView ? 'w-full' : 'w-3/5'} px-2`}>
      <DocumentPanelHeader />
      
      <div className="relative">
        <TemplateLoadingOverlay />
            <EditorPanel
              key={editorKey}
          content={displayContent}
          onChange={handleContentChange}
          disabled={isCompareView || !isEditingDocument || isChangingTemplate}
            />
      </div>
    </Box>
  );
});

DocumentEditorPanel.displayName = 'DocumentEditorPanel';

