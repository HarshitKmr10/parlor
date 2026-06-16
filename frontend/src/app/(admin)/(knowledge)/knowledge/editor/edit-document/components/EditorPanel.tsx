'use client';

import React, { memo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ScrollArea } from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';
import { diffMarkdownStrings } from 'components/TipTap/highlight';

interface EditorPanelProps {
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
  compareWith?: string;
  diffType?: 'added' | 'removed';
}

export const EditorPanel = memo<EditorPanelProps>(({
  content,
  onChange,
  disabled,
  compareWith,
  diffType = 'added',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const displayContent = compareWith
    ? diffMarkdownStrings(content, compareWith, diffType)
    : content;

  return (
    <Box className="h-[80vh] rounded-md border" ref={scrollContainerRef}>
      <ScrollArea>
        <Box className="px-4 py-3">
          <RichTextEditor content={displayContent} onChange={onChange} disabled={disabled} />
        </Box>
      </ScrollArea>
    </Box>
  );
});

EditorPanel.displayName = 'EditorPanel';

