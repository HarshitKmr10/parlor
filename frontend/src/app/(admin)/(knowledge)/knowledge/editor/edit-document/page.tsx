'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Spinner, Text } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import withAuth from 'components/withAuth';
import { useGlobalContext } from 'contexts/store';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { ensureTranslationsLoaded } from '@/helper/i18n';
import { KbCollectionSource } from 'types/dashboard';
import { useDocumentEditorStore } from '@/stores/documentEditorStore';
import { DocumentEditorProvider } from './providers/DocumentEditorProvider';
import { DocumentHeader } from './components/DocumentHeader';
import { DocumentEditorPanel } from './components/DocumentEditorPanel';
import { AISuggestionsPanel } from './components/AISuggestionsPanel';
import { EditorPanel } from './components/EditorPanel';
import { LinkReplaceDialog } from './components/LinkReplaceDialog';
import VersionHistoryBar from './VersionHistoryBar';
import AISparkle from 'components/icons/AISparkle';
import 'react-toastify/dist/ReactToastify.css';

// Use Zustand selectors to minimize re-renders
const useRecommendationData = () => useDocumentEditorStore((state) => state.recommendationData);
const useIsLoading = () => useDocumentEditorStore((state) => state.isLoading);
const useIsFetchingFullData = () => useDocumentEditorStore((state) => state.isFetchingFullData);
const useIsVersionHistoryOpen = () => useDocumentEditorStore((state) => state.isVersionHistoryOpen);
const useSelectedTemplateId = () => useDocumentEditorStore((state) => state.selectedTemplateId);
const useIsCompareView = () => useDocumentEditorStore((state) => state.isCompareView);
const useContent = () => useDocumentEditorStore((state) => state.content);

function EditDocumentPageContent() {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');

  // Use selectors to minimize re-renders
  const recommendationData = useRecommendationData();
  const isLoading = useIsLoading();
  const isFetchingFullData = useIsFetchingFullData();
  const isVersionHistoryOpen = useIsVersionHistoryOpen();
  const selectedTemplateId = useSelectedTemplateId();
  const isCompareView = useIsCompareView();
  const content = useContent();

  // Use direct selectors for actions
  const setRecommendationData = useDocumentEditorStore((state) => state.setRecommendationData);
  const setTemplates = useDocumentEditorStore((state) => state.setTemplates);
  const setIsLoadingTemplates = useDocumentEditorStore((state) => state.setIsLoadingTemplates);
  const setSelectedTemplateId = useDocumentEditorStore((state) => state.setSelectedTemplateId);
  const setIsVersionHistoryOpen = useDocumentEditorStore((state) => state.setIsVersionHistoryOpen);
  const handleSave = useDocumentEditorStore((state) => state.handleSave);
  const handleDownload = useDocumentEditorStore((state) => state.handleDownload);
  const handleVersionRestore = useDocumentEditorStore((state) => state.handleVersionRestore);
  const setDefaultTemplateSnapshot = useDocumentEditorStore((state) => state.setDefaultTemplateSnapshot);
  const fetchDocument = useDocumentEditorStore((state) => state.fetchDocument);
  const processSuggestions = useDocumentEditorStore((state) => state.processSuggestions);

  // Get collection source from store (set during initial fetch)
  const collectionSource = useDocumentEditorStore((state) => state.collectionSource);
  
  // Check if source is restricted - use collectionSource from store or fallback to recommendationData
  const isRestrictedSource =
    (collectionSource || recommendationData?.document?.kb_collection?.source) &&
    [KbCollectionSource.SERVICE_NOW, KbCollectionSource.SHAREPOINT].includes(
      (collectionSource || recommendationData?.document?.kb_collection?.source) as KbCollectionSource,
    );

  const titleRef = useRef<string>('');
  const translationsLoadedRef = useRef(false);

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      await ensureTranslationsLoaded();
      translationsLoadedRef.current = true;
    };
    loadTranslations();
  }, []);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await serviceDeskInstance.get('/service_desk/knowledgebase_templates');
        setTemplates(response.data.data || []);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // Fetch document - handled by store
  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId, t);
    }
  }, [documentId, fetchDocument, t]);

  // Process suggestions when recommendationData changes
  // Note: processSuggestions is also called in fetchDocument, so we use a ref to prevent double processing
  const processedSuggestionsRef = useRef<string | null>(null);
  useEffect(() => {
    const suggestionsKey = recommendationData?.document?.suggestions;
    if (suggestionsKey && processedSuggestionsRef.current !== suggestionsKey) {
      processedSuggestionsRef.current = suggestionsKey;
      processSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendationData?.document?.suggestions]);

  // Update default template snapshot - only when template is deselected
  const defaultTemplateSnapshot = useDocumentEditorStore((state) => state.defaultTemplateSnapshot);
  const appliedImprovements = useDocumentEditorStore((state) => state.appliedImprovements);
  const isEditingDocument = useDocumentEditorStore((state) => state.isEditingDocument);
  const prevSelectedTemplateIdRef = useRef<number | null>(null);
  useEffect(() => {
    // Only update when selectedTemplateId changes from a value to null (template deselected)
    if (prevSelectedTemplateIdRef.current !== null && selectedTemplateId === null) {
      setDefaultTemplateSnapshot({
        content,
        appliedImprovements,
        isEditingDocument,
      });
    }
    prevSelectedTemplateIdRef.current = selectedTemplateId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);



  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    titleRef.current = newTitle;
    if (recommendationData) {
      setRecommendationData({
        ...recommendationData,
        title: newTitle,
      });
    }
  }, [recommendationData, setRecommendationData]);
  
  // Update title ref when recommendationData changes
  useEffect(() => {
    if (recommendationData?.title) {
      titleRef.current = recommendationData.title;
    }
  }, [recommendationData?.title]);


  // Show spinner only while initial content is loading or translations are loading
  if (isLoading || !translationsLoadedRef.current) {
    return (
      <Flex justify="center" align="center" className="h-full">
        <Spinner />
      </Flex>
    );
  }

  // Show error only if we have no content (initial fetch failed)
  // If we have content but no recommendationData yet, that's okay - full data is still loading
  if (!content) {
    return <div>{t('knowledge_assist.invalidOrMissingDocumentData')}</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <DocumentHeader
        title={recommendationData?.title || ''}
        onTitleChange={handleTitleChange}
        onSave={() => handleSave(documentId, router, t)}
        onDownload={() => handleDownload(user, t)}
        onVersionHistory={() => setIsVersionHistoryOpen(true)}
        isRestrictedSource={isRestrictedSource}
        isFetchingFullData={isFetchingFullData}
      />

      <Box p="4" className="pl-0 pt-0">
        {isCompareView ? (
          <Flex direction="row" gap="4">
            <Box className="w-1/2">
              <Flex justify="between" className="h-14">
                <Flex align="center" gap="2" className="pl-2">
                  <AISparkle />
                  <Text className="align-middle text-base font-medium leading-5 tracking-normal text-[#1C2024]">
                    {t('knowledge_assist.updatedArticle')}
                  </Text>
                </Flex>
              </Flex>
              <EditorPanel
                content={content}
                onChange={() => {}}
                disabled={true}
              />
            </Box>
            <Box className="w-1/2">
              <DocumentEditorPanel />
            </Box>
          </Flex>
        ) : (
          <Flex direction="row" gap="0">
            <DocumentEditorPanel />
            <AISuggestionsPanel documentId={documentId || ''} isFetchingFullData={isFetchingFullData} />
          </Flex>
        )}
      </Box>

      <VersionHistoryBar
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        documentId={documentId}
        onVersionRestore={handleVersionRestore}
      />

      <LinkReplaceDialog />

      <ToastContainer />
    </div>
  );
}

function EditDocumentPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');

  return (
    <DocumentEditorProvider documentId={documentId}>
      <EditDocumentPageContent />
    </DocumentEditorProvider>
  );
}

export default withAuth(EditDocumentPage);

