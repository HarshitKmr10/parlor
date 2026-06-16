'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Flex, Box, Text, Badge } from '@radix-ui/themes';
import AISparkle from 'components/icons/AISparkle';
import { EditorPanel } from '../components/EditorPanel';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';
import withAuth from 'components/withAuth';

function ComparePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');
  
  const recommendationData = useDocumentEditorStore((state) => state.recommendationData);
  const content = useDocumentEditorStore((state) => state.content);

  // Get full content for both panels
  const updatedContent = content || '';
  const originalContent = recommendationData?.document?.content || '';

  useEffect(() => {
    if (!recommendationData) {
      router.push(`/knowledge/editor/edit-document?id=${documentId}`);
    }
  }, [recommendationData, documentId, router]);

  if (!recommendationData) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <Flex
        justify="between"
        align="center"
        className="h-14 flex-shrink-0 border-b border-[var(--gray-8)] bg-white px-4"
      >
        <Text size="4" weight="bold">
          {t('knowledge_assist.compareView')}
        </Text>
        <Text
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={() => {
            router.push(`/knowledge/editor/edit-document?id=${documentId}`);
          }}
        >
          {t('knowledge_assist.backToSuggestions')}
        </Text>
      </Flex>

      <Box p="4" className="pl-0 pt-0">
        <Flex direction="row" gap="4">
          <Box className="w-1/2 flex flex-col">
            <Flex justify="between" p="2" className="border-b">
              <Flex align="center" gap="2" className="pl-2">
                <AISparkle />
                <Text size="5" weight="bold">
                  {t('knowledge_assist.updatedArticle')}
                </Text>
              </Flex>
            </Flex>
            <EditorPanel
              content={updatedContent}
              onChange={() => {}}
              disabled={false}
            />
          </Box>

          <Box className="w-1/2 flex flex-col">
            <Flex justify="between" p="2" className="border-b">
              <Flex align="center" gap="2">
                <Text size="5" weight="bold">
                  {t('knowledge_assist.originalDocument')}
                </Text>
                <Badge size="1" color="gray" variant="outline">
                  {t('knowledge_assist.viewOnly')}
                </Badge>
              </Flex>
            </Flex>
            <EditorPanel
              content={originalContent}
              onChange={() => {}}
              disabled={true}
            />
          </Box>
        </Flex>
      </Box>
    </div>
  );
}

export default withAuth(ComparePage);

