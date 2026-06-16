'use client';

import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Button, Text, Badge } from '@radix-ui/themes';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';
import { TemplateSelector } from './TemplateSelector';

export const DocumentPanelHeader = memo(() => {
  const { t } = useTranslation();
  const isCompareView = useDocumentEditorStore((state) => state.isCompareView);
  const isEditingDocument = useDocumentEditorStore((state) => state.isEditingDocument);
  const recommendationData = useDocumentEditorStore((state) => state.recommendationData);
  
  const setContent = useDocumentEditorStore((state) => state.setContent);
  const updateEditorKey = useDocumentEditorStore((state) => state.updateEditorKey);
  const setAppliedImprovements = useDocumentEditorStore((state) => state.setAppliedImprovements);
  const setSelectedTemplateId = useDocumentEditorStore((state) => state.setSelectedTemplateId);
  const setIsEditingDocument = useDocumentEditorStore((state) => state.setIsEditingDocument);

  const handleToggleEdit = useCallback(() => {
    if (isEditingDocument) {
      const originalContent = recommendationData?.document.content || '';
      setContent(originalContent);
      updateEditorKey();
      setAppliedImprovements(false);
      setSelectedTemplateId(null);
    }
    setIsEditingDocument(!isEditingDocument);
  }, [isEditingDocument, recommendationData, setContent, updateEditorKey, setAppliedImprovements, setSelectedTemplateId, setIsEditingDocument]);

  return (
    <Flex justify="between" className="h-14">
      <Flex align="center" gap="2" className="pl-2">
        <Text className="align-middle text-base font-medium leading-5 tracking-normal text-[#1C2024]">
          {isCompareView 
            ? t('knowledge_assist.originalDocument')
            : t('knowledge_assist.improvedKbDocument')}
        </Text>
        {isCompareView && (
          <Badge size="1" color="gray" variant="outline">
            {t('knowledge_assist.viewOnly')}
          </Badge>
        )}
      </Flex>
      {isCompareView ? null : isEditingDocument ? (
        <TemplateSelector />
      ) : (
        <Flex style={{ zIndex: '100' }} align="center" justify="end">
          <Button variant="soft" className="cursor-pointer" onClick={handleToggleEdit}>
            {t('knowledge_assist.edit')}
          </Button>
        </Flex>
      )}
    </Flex>
  );
});

DocumentPanelHeader.displayName = 'DocumentPanelHeader';

