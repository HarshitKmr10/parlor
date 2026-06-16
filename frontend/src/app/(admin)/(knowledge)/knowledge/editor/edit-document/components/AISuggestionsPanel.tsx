'use client';

import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Button, Text, ScrollArea, Spinner } from '@radix-ui/themes';
import { Pencil } from 'lucide-react';
import Image from 'next/image';
import AISparkle from 'components/icons/AISparkle';
import { ScoreCard } from '@/components/knowledgeAssist/ScoreCard';
import LinkQualitySection, { LinkSuggestion } from '../LinkQualitySection';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';
import { KbCollectionSource } from 'types/dashboard';
import Shimmer from 'components/common/Shimmer/Shimmer';

interface AISuggestionsPanelProps {
  documentId: string;
  isFetchingFullData?: boolean;
}

export const AISuggestionsPanel = memo<AISuggestionsPanelProps>(({ documentId, isFetchingFullData = false }) => {
  const { t } = useTranslation();
  const recommendationData = useDocumentEditorStore((state) => state.recommendationData);
  const linkSuggestions = useDocumentEditorStore((state) => state.linkSuggestions);
  const invalidLinks = useDocumentEditorStore((state) => state.invalidLinks);
  const isEditingDocument = useDocumentEditorStore((state) => state.isEditingDocument);
  const appliedImprovements = useDocumentEditorStore((state) => state.appliedImprovements);
  const isApplying = useDocumentEditorStore((state) => state.isApplying);
  
  const handleApplyAll = useDocumentEditorStore((state) => state.handleApplyAll);
  const backToOriginal = useDocumentEditorStore((state) => state.backToOriginal);
  const handleFixLink = useDocumentEditorStore((state) => state.handleFixLink);
  const handleDismissLink = useDocumentEditorStore((state) => state.handleDismissLink);
  const handleInvalidLinkClick = useDocumentEditorStore((state) => state.handleInvalidLinkClick);

  const suggestedChanges = useMemo(
    () => recommendationData?.statistics?.suggested_changes ?? [],
    [recommendationData?.statistics?.suggested_changes]
  );

  const isRestrictedSource = useMemo(
    () =>
      recommendationData?.document?.kb_collection?.source &&
      [KbCollectionSource.SERVICE_NOW, KbCollectionSource.SHAREPOINT].includes(
        recommendationData.document.kb_collection.source
      ),
    [recommendationData?.document?.kb_collection?.source]
  );

  const hasSuggestedChanges = suggestedChanges.length > 0;

  // Shimmer skeleton for loading state
  const SuggestionsShimmer = () => (
    <Box className="space-y-4">
      {/* Section title shimmer */}
      <Shimmer height="20px" width="150px" borderRadius="4px" />
      
      {/* Suggestion cards shimmer */}
      {[...Array(3)].map((_, index) => (
        <Box
          key={index}
          className="rounded-md border border-[#E4E4FB] p-3"
        >
          <Flex direction="column" gap="2">
            <Shimmer height="16px" width="100%" borderRadius="4px" />
            <Shimmer height="16px" width="85%" borderRadius="4px" />
            <Shimmer height="16px" width="70%" borderRadius="4px" />
          </Flex>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box className="flex h-[82vh] w-2/5 flex-col">
      <Box className="flex-shrink-0">
        {!!documentId && (
          <ScoreCard
            documentId={documentId}
            showBlurOverlay={isEditingDocument || appliedImprovements}
            isRestrictedSource={isRestrictedSource}
          />
        )}
      </Box>

      <Box className="mt-4 flex w-full flex-col overflow-hidden bg-white">
        <Flex justify="between" align="center" p="1" className="flex-shrink-0">
          <Flex align="center" gap="2" className="pl-2">
            <AISparkle size={20} />
            <Text className="align-middle text-base font-medium leading-5 tracking-normal text-[#1C2024]">
              {t('knowledge_assist.aiSuggestions')}
            </Text>
          </Flex>
          {isEditingDocument && (
            <Button
              variant="outline"
              size="2"
              onClick={backToOriginal}
              className="cursor-pointer"
            >
              {t('knowledge_assist.restoreChanges')}
            </Button>
          )}
          {hasSuggestedChanges && !isEditingDocument && (
            <Button
              size="2"
              onClick={() => handleApplyAll(t)}
              disabled={isApplying}
              className="cursor-pointer"
            >
              {isApplying ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  {t('knowledge_assist.applying')}
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  {appliedImprovements
                    ? t('knowledge_assist.restoreChanges')
                    : t('knowledge_assist.applyAll')}
                </>
              )}
            </Button>
          )}
        </Flex>
        <ScrollArea
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: 'calc(82vh - 200px)' }}
        >
          <Box className="p-4">
            {isFetchingFullData && !recommendationData?.statistics ? (
              <SuggestionsShimmer />
            ) : isEditingDocument ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <Image
                  src="/img/noImprovements.png"
                  alt="Editing Mode"
                  width={200}
                  height={200}
                />
                <Text className="text-sm text-gray-500">
                  {t('knowledge_assist.allImprovementsHaveBeenApplied')}
                </Text>
              </div>
            ) : hasSuggestedChanges ? (
              appliedImprovements ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Image
                    src="/img/noImprovements.png"
                    alt="Improvements Applied"
                    width={200}
                    height={200}
                  />
                  <Text className="text-sm text-gray-500">
                    {t('knowledge_assist.allImprovementsHaveBeenApplied')}
                  </Text>
                </div>
              ) : (
                <div className="space-y-2">
                  <Text className="text-md font-medium text-gray-700">
                    {t('knowledge_assist.improvements')}
                  </Text>
                  {suggestedChanges.map((improvement, index) => (
                    <div key={index} className="rounded-md border border-[#E4E4FB] p-3">
                      <div className="flex items-start space-x-2">
                        <div className="flex-grow">
                          <p className="text-sm text-[var(--iris-9)]">- {improvement}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              !hasSuggestedChanges &&
              linkSuggestions.length === 0 &&
              invalidLinks.filter((link) => !link.resolved).length === 0 && (
                <Box className="mb-2 rounded-md bg-gray-50 p-3">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Image
                      src="/img/noImprovements.png"
                      alt="No Improvements"
                      width={200}
                      height={200}
                    />
                    <Text className="text-sm text-gray-500">
                      {t('knowledge_assist.noImprovementsAvailable')}
                    </Text>
                  </div>
                </Box>
              )
            )}

            <LinkQualitySection
              suggestions={linkSuggestions}
              onFixLink={handleFixLink}
              onDismissLink={handleDismissLink}
              t={t}
            />

            {invalidLinks.filter((link) => !link.resolved).length > 0 &&
              linkSuggestions.length === 0 && (
                <div className="space-y-2">
                  <Text className="text-md font-medium text-gray-700">
                    {t('knowledge_assist.urlLinks')}
                  </Text>
                  {invalidLinks
                    .filter((link) => !link.resolved)
                    .map((link, index) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-md bg-blue-50 p-3 transition-colors hover:bg-blue-100"
                        onClick={() => handleInvalidLinkClick(link)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-1 text-red-500">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </div>
                          <div className="flex-grow">
                            <p className="mb-1 text-sm font-medium text-[#6366f1]">
                              {link.description}
                            </p>
                            <p className="break-all text-sm text-[#4b5563] underline">
                              {link.url}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
          </Box>
        </ScrollArea>
      </Box>
    </Box>
  );
});

AISuggestionsPanel.displayName = 'AISuggestionsPanel';

