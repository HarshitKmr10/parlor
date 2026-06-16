'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Text } from '@radix-ui/themes';
import { LoadingCircle } from 'components/icons/LoadingCircle';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';

export const TemplateLoadingOverlay = memo(() => {
  const { t } = useTranslation();
  const isChangingTemplate = useDocumentEditorStore((state) => state.isChangingTemplate);

  if (!isChangingTemplate) {
    return null;
  }

  return (
    <Flex
      className="absolute inset-0 z-10 rounded-md bg-white/60 backdrop-blur-sm"
      align="center"
      justify="center"
      direction="column"
      gap="2"
    >
      <LoadingCircle />
      <Text size="2" color="blue" weight="medium">
        {t('knowledge_assist.convertingTemplate', 'Converting to new template...')}
      </Text>
    </Flex>
  );
});

TemplateLoadingOverlay.displayName = 'TemplateLoadingOverlay';

