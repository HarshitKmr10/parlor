'use client';

import React, { memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Flex, Button, Spinner, Tooltip } from '@radix-ui/themes';
import { ArrowLeft, History, ChevronDown, Save, Download } from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';
import { editDocumentStyles } from '../editDocument.styles';

interface DocumentHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onDownload: () => void;
  onVersionHistory: () => void;
  isRestrictedSource: boolean;
  isFetchingFullData?: boolean;
}

export const DocumentHeader = memo<DocumentHeaderProps>(({
  title,
  onTitleChange,
  onSave,
  onDownload,
  onVersionHistory,
  isRestrictedSource,
  isFetchingFullData = false,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const isSaving = useDocumentEditorStore((state) => state.isSaving);
  const isCompareView = useDocumentEditorStore((state) => state.isCompareView);
  const setIsCompareView = useDocumentEditorStore((state) => state.setIsCompareView);
  
  const handleCompareToggle = () => {
    setIsCompareView(!isCompareView);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/knowledge/dashboard');
    }
  };

  return (
    <Flex
      justify="between"
      align="center"
      className="h-14 flex-shrink-0 border-b border-[var(--gray-8)] bg-white px-4"
    >
      <Flex align="center" gap="3" className="min-w-0 flex-1 pl-2">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex-shrink-0 cursor-pointer p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t('knowledge_assist.untitledDocument')}
          className="min-w-0 flex-1 truncate px-0 text-[18px] font-medium focus:border-none focus:outline-none focus:ring-0"
          style={editDocumentStyles.titleInput}
        />
      </Flex>
      <Flex gap="3" className="flex-shrink-0">
        <Button variant="soft" onClick={handleBack}>
          {t('knowledge_assist.cancel')}
        </Button>
        <Button 
          variant={"soft"} 
          onClick={handleCompareToggle}
          disabled={isFetchingFullData}
        >
          {isCompareView ? t('knowledge_assist.backToSuggestions') : t('knowledge_assist.compare')}
        </Button>
        {!isRestrictedSource && (
          <Button variant="soft" onClick={onVersionHistory}>
            <History className="mr-2 h-4 w-4" />
            {t('knowledge_assist.versionHistory')}
          </Button>
        )}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button variant="solid" disabled={isSaving}>
              {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <></>}
              {t('knowledge_assist.applyChanges')}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Content
            align="end"
            className="z-50 min-w-[150px] rounded-lg bg-white p-1 shadow-lg"
            sideOffset={1}
          >
            {isRestrictedSource ? (
              <Tooltip content={t('knowledge_assist.changesCannotBeAppliedForServiceNowAndSharePoint')}>
                <DropdownMenuPrimitive.Item
                  className="pointer-events-none flex cursor-not-allowed items-center rounded px-2 py-1.5 text-sm text-gray-400 opacity-50"
                  disabled
                  onSelect={(e) => e.preventDefault()}
                >
                  <Save className="mr-2 h-4 w-4 opacity-50" />
                  {t('knowledge_assist.applyChanges')}
                </DropdownMenuPrimitive.Item>
              </Tooltip>
            ) : (
              <DropdownMenuPrimitive.Item
                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm hover:bg-gray-100"
                onClick={onSave}
              >
                <Save className="mr-2 h-4 w-4" />
                {t('knowledge_assist.applyChanges')}
              </DropdownMenuPrimitive.Item>
            )}
            <DropdownMenuPrimitive.Item
              className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm hover:bg-gray-100"
              onClick={onDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('knowledge_assist.downloadFile')}
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Root>
      </Flex>
    </Flex>
  );
});

DocumentHeader.displayName = 'DocumentHeader';

