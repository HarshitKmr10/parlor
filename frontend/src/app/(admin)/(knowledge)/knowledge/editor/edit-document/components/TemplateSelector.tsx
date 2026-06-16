'use client';

import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Text, Select } from '@radix-ui/themes';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';

export const TemplateSelector = memo(() => {
  const { t } = useTranslation();
  const templates = useDocumentEditorStore((state) => state.templates);
  const selectedTemplateId = useDocumentEditorStore((state) => state.selectedTemplateId);
  const isLoadingTemplates = useDocumentEditorStore((state) => state.isLoadingTemplates);
  const isChangingTemplate = useDocumentEditorStore((state) => state.isChangingTemplate);
  const handleTemplateChange = useDocumentEditorStore((state) => state.handleTemplateChange);

  const handleTemplateChangeWithTranslation = useCallback((templateId: string) => {
    handleTemplateChange(templateId, t);
  }, [handleTemplateChange, t]);

  return (
    <Flex style={{ zIndex: '100' }} align="center" gap="2" justify="end">
      <Text size="2" weight="medium" color="gray" className="whitespace-nowrap">
        {t('knowledge_assist.template', 'Template')}:
      </Text>
      <div className="min-w-[200px]">
        <Select.Root
          value={selectedTemplateId ? selectedTemplateId.toString() : 'default-template'}
          onValueChange={handleTemplateChangeWithTranslation}
          disabled={isLoadingTemplates || isChangingTemplate}
        >
          <Select.Trigger
            placeholder={
              isLoadingTemplates
                ? t('knowledge_assist.loadingTemplates', 'Loading templates...')
                : t('knowledge_assist.selectTemplate', 'Select a template')
            }
          />
          <Select.Content>
            <Select.Item value="default-template">
              <Text size="2" weight="medium">
                {t('knowledge_assist.defaultTemplate', 'Default template')}
              </Text>
            </Select.Item>
            {templates.length > 0
              ? templates.map((template) => (
                  <Select.Item key={template.id} value={template.id.toString()}>
                    <Text size="2" weight="medium">
                      {template.name}
                    </Text>
                  </Select.Item>
                ))
              : !isLoadingTemplates && (
                  <Select.Item value="no-templates" disabled>
                    <Text size="2" color="gray">
                      {t('knowledge_assist.noTemplates', 'No templates available')}
                    </Text>
                  </Select.Item>
                )}
          </Select.Content>
        </Select.Root>
      </div>
    </Flex>
  );
});

TemplateSelector.displayName = 'TemplateSelector';

