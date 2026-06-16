'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, TextField, Button, Text, Flex } from '@radix-ui/themes';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';

export const LinkReplaceDialog = memo(() => {
  const { t } = useTranslation();
  const isLinkModalOpen = useDocumentEditorStore((state) => state.isLinkModalOpen);
  const currentLinkToReplace = useDocumentEditorStore((state) => state.currentLinkToReplace);
  const newLink = useDocumentEditorStore((state) => state.newLink);
  
  const setIsLinkModalOpen = useDocumentEditorStore((state) => state.setIsLinkModalOpen);
  const setNewLink = useDocumentEditorStore((state) => state.setNewLink);
  const handleReplaceLink = useDocumentEditorStore((state) => state.handleReplaceLink);

  return (
    <Dialog.Root open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>{t('knowledge_assist.replaceLink')}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {t('knowledge_assist.enterNewLinkBelowToReplaceInvalidOne')}
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <Text as="label" size="2">
            {t('knowledge_assist.currentLink')}
          </Text>
          <Text>{currentLinkToReplace}</Text>

          <Text as="label" size="2">
            {t('knowledge_assist.newLink')}
          </Text>
          <TextField.Root
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder={t('knowledge_assist.enterNewLink')}
          />
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t('knowledge_assist.cancel')}
            </Button>
          </Dialog.Close>
          <Dialog.Close>
            <Button onClick={handleReplaceLink}>{t('knowledge_assist.replace')}</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
});

LinkReplaceDialog.displayName = 'LinkReplaceDialog';

