import React, { useEffect, useMemo, useState } from 'react';
import {
  Flex, Box, Text, Button, Badge, Tooltip,
  Dialog,
  Select,
  Spinner,
} from '@radix-ui/themes';
import { ArrowLeftIcon } from 'lucide-react';
import { IoDocumentText } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';
import { VIEW_TITLES, VIEWS, API_ENDPOINTS } from 'constants/dashboard';
import { KbCollectionSource, Recommendation, ViewType } from 'types/dashboard';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PostcallTopics } from 'api/postcallTopcs';
import { toast } from 'react-toastify';
import { useGlobalContext } from 'contexts/store';
import { serviceDeskInstance } from 'api/common/axiosInstance';


interface DashboardHeaderProps {
  view: ViewType;
  onBack: () => void;
  onUpload: () => void;
  onNavigateToLogs: () => void;
  onNavigateToInventory: () => void;
  onSubmitForApproval?: () => void;
  isCreatingKB?: boolean;
  onCreateKB?: (collectionId: string) => void;
  totalArticles?: number;
  isMergingKB?: boolean;
  onMergeKB?: () => void;
  enabledCompareForMerge?: boolean;
  setEnabledCompareForMerge?: (enabled: boolean) => void;
  enabledCompareForRefactor?: boolean;
  setEnabledCompareForRefactor?: (enabled: boolean) => void;
  showImprovedContent?: boolean;
  isEditingForRefactor?: boolean;
  handleRefactorAndSave?: () => void;
  handleCancelForRefactor?: () => void;
  handleCancelForMerge?: () => void;
  handleCancelForCreateKB?: () => void;
  currentArticle?: Recommendation;
  isTranslating?: boolean;
  onTranslate?: () => Promise<void>;
  handleCancelForTranslate?: () => void;
  handleTranslateAndSave?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  view,
  onBack,
  onUpload,
  onNavigateToLogs,
  onNavigateToInventory,
  totalArticles = 0,
  onSubmitForApproval,
  isCreatingKB,
  onCreateKB,
  isMergingKB,
  onMergeKB,
  enabledCompareForMerge,
  setEnabledCompareForMerge,
  enabledCompareForRefactor,
  setEnabledCompareForRefactor,
  showImprovedContent,
  isEditingForRefactor,
  handleRefactorAndSave,
  handleCancelForRefactor,
  handleCancelForMerge,
  handleCancelForCreateKB,
  currentArticle,
  isTranslating,
  onTranslate,
  handleCancelForTranslate,
  handleTranslateAndSave,
}) => {

  const { user, organization } = useGlobalContext();
  const { t } = useTranslation();
  const [displayCount, setDisplayCount] = useState(totalArticles);
  const [isDownloading, setIsDownloading] = useState(false);

  const config = useMemo(() => {
    return organization?.config ? JSON.parse(organization?.config) : {};
  }, [organization?.config]);

  useEffect(() => {
    setDisplayCount(totalArticles);
  }, [totalArticles]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Try to get name from kb_data if available
      const fileName = currentArticle?.kb_data?.[0]?.name || currentArticle?.title;
      // Convert the content to a PDF using the API
      const pdfBlob = await PostcallTopics.convertMarkdownToPdfDocxZip(
        currentArticle.content, 
        user,
        currentArticle?.id,
        fileName
      );

      // Create a URL for the blob
      const url = window.URL.createObjectURL(pdfBlob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      // Use fileName if available, otherwise use timestamp
      link.download = fileName 
        && `${fileName}.zip`;

      // Trigger the download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t('knowledge_assist.failedToGeneratePDF'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();

      // Add DOCX file to the zip
      const docxContent = await generateDocx(currentArticle);
      zip.file(`${currentArticle.title}.docx`, docxContent);
      console.log('docxContent', docxContent);
      // Add PDF file to the zip
      const pdfContent = await generatePdf(currentArticle);
      zip.file(`${currentArticle.title}.pdf`, pdfContent);

      // Generate the zip file and trigger download
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${currentArticle.title}_documents.zip`);
    } catch (error) {
      console.error('Error generating zip file:', error);
    }
  };

  const generateDocx = async (article) => {
    // Convert the content to a Blob with docx mime type
    console.log('article', article);
    const content = `Title: ${article.title}\n\n${article.content}`;
    return new Blob([content], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  };

  const generatePdf = async (article) => {
    const doc = new jsPDF();
    console.log('currentArticle', article);

    // Add title
    doc.setFontSize(14);
    doc.text(`Title: ${article.title}`, 20, 40);

    // Remove markdown formatting from content
    let cleanContent = article.content;
    if (cleanContent) {
      // Remove headers (# text)
      cleanContent = cleanContent.replace(/^#+\s+/gm, '');
      // Remove bold/italic (**text** or *text*)
      cleanContent = cleanContent.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
      // Remove links ([text](url))
      cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      // Remove code blocks (```text```)
      cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
      // Remove inline code (`text`)
      cleanContent = cleanContent.replace(/`([^`]+)`/g, '$1');
      // Remove bullet points
      cleanContent = cleanContent.replace(/^[-*+]\s+/gm, '');
      // Remove numbered lists
      cleanContent = cleanContent.replace(/^\d+\.\s+/gm, '');
    }

    doc.setFontSize(12);
    if (cleanContent) {
      const splitContent = doc.splitTextToSize(cleanContent, 170);
      doc.text(splitContent, 20, 60);
    }

    return doc.output('blob');
  };

  // for service now and sharepoint, new article createion is not allowed
  // instead they can only download
  const isCreateNewArticleDisabled = currentArticle && [
    KbCollectionSource.SERVICE_NOW,
    KbCollectionSource.SHAREPOINT,
  ].includes(currentArticle.kb_data?.[0]?.kb_collection?.source);

  // const isCreateNewArticleDisabled = false;

  // === New state and logic for "Create KB" modal ===
  const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
  const [collections, setCollections] = useState([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState('');

  useEffect(() => {
    if (showCollectionsDialog && user?.access_token) {
      const fetchCollections = async () => {
        try {
          setIsLoadingCollections(true);
          // Use Knowledge Assist collections endpoint with RBAC
          const response = await serviceDeskInstance.get(API_ENDPOINTS.KNOWLEDGE_ASSIST_COLLECTIONS);
          if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = response.data;
          if (data.success && data.data) {
            // Filter out collections with service_now or sharepoint sources
            const filteredCollections = data.data.filter(collection =>
              collection.source !== KbCollectionSource.SERVICE_NOW && collection.source !== KbCollectionSource.SHAREPOINT
            );
            setCollections(filteredCollections);
          }
        } catch (error) {
          console.error('Error fetching collections in create KB modal:', error);
          toast.error(t('knowledge_assist.failedToLoadCollections'));
        } finally {
          setIsLoadingCollections(false);
        }
      };
      fetchCollections();
    }
  }, [showCollectionsDialog, user?.access_token]);

  const handleModalSave = () => {
    if (onCreateKB) {
      onCreateKB(selectedCollection);
    }
    setShowCollectionsDialog(false);
    setSelectedCollection('');
  };

  return (
    <Box className="flex-shrink-0">
      <Flex
        align="center"
        justify="between"
        className="h-14 border-b border-[var(--gray-8)]"
        px="4"
      >
        <Flex
          justify="between"
          align="center"
          className="space-x-4 cursor-pointer"
        >
          {view !== VIEWS.DASHBOARD && <ArrowLeftIcon onClick={onBack} />}
          <Text size="4" weight="medium">
            {VIEW_TITLES[view]}
          </Text>
          {view === VIEWS.DASHBOARD && (
            <Badge 
              size="2" 
              color="iris" 
              variant="surface" 
              className="cursor-pointer hover:bg-[var(--iris-4)]"
              onClick={onNavigateToInventory}
            >
              <div className="flex items-center gap-2">
                <IoDocumentText size={16} />
                <Text size="2">
                  {displayCount}
                  {' '}
                  {t('knowledge_assist.articles')}
                </Text>
              </div>
            </Badge>
          )}
        </Flex>
        <Flex align="center" gap="4">
          {view === VIEWS.DASHBOARD && (
            <>
              {config["Modules"]?.knowledge_assist?.enable_knowledge_ai_logs !== false && (
                <Button
                  size="2"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={onNavigateToLogs}
                >
                  {t('knowledge_assist.knowledgeAI')}
                </Button>
              )}
              <Button
                size="2"
                variant="outline"
                className="cursor-pointer"
                onClick={onUpload}
              >
                <UploadIcon />
                {t('knowledge_assist.uploadDocument')}
              </Button>
              <Button
                size="2"
                variant="solid"
                className="cursor-pointer"
                onClick={onNavigateToInventory}
              >
                {t('knowledge_assist.documentInventory')}
              </Button>
            </>
          )}
          {view === VIEWS.CREATE_NEW_KB && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelForCreateKB}
                disabled={isCreatingKB}
              >
                {t('knowledge_assist.cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload()}
                disabled={isDownloading}
                style={{ minWidth: 100 }}
              >
                {isDownloading && <Spinner size="1" style={{ marginRight: 8 }} />}
                {t('knowledge_assist.download')}
              </Button>
              <Button
                variant="solid"
                onClick={() => setShowCollectionsDialog(true)}
                disabled={isCreatingKB || config["Modules"]?.knowledge_assist?.enable_save_create_knowledege_articles === false}
              >
                {isCreatingKB ? t('knowledge_assist.saving') : t('knowledge_assist.approveAndSave')}
              </Button>
            </>
          )}
          {view === VIEWS.MERGE && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelForMerge}
                disabled={isMergingKB}
              >
                {t('knowledge_assist.cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setEnabledCompareForMerge?.(!enabledCompareForMerge)}
              >
                {enabledCompareForMerge
                  ? t('knowledge_assist.backToSuggestions')
                  : t('knowledge_assist.compareChanges')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload()}
                disabled={isDownloading}
                style={{ minWidth: 100 }}
              >
                {isDownloading && <Spinner size="1" style={{ marginRight: 8 }} />}
                {t('knowledge_assist.download')}
              </Button>
              {isCreateNewArticleDisabled ? (
                <Tooltip content={t('knowledge_assist.disabledTooltip')}>
                  <Button
                    variant="solid"
                    onClick={onMergeKB}
                    disabled={isMergingKB || isCreateNewArticleDisabled}
                  >
                    {isMergingKB ? t('knowledge_assist.saving') : t('knowledge_assist.save')}
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  variant="solid"
                  onClick={onMergeKB}
                  disabled={isMergingKB || isCreateNewArticleDisabled}
                >
                  {isMergingKB ? t('knowledge_assist.saving') : t('knowledge_assist.approveAndSave')}
                </Button>
              )}
            </>
          )}
          {view === VIEWS.REFACTOR && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelForRefactor}
                disabled={isEditingForRefactor}
              >
                {t('knowledge_assist.cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setEnabledCompareForRefactor?.(!enabledCompareForRefactor)}
                disabled={!showImprovedContent}
              >
                {enabledCompareForRefactor
                  ? t('knowledge_assist.backToSuggestions')
                  : t('knowledge_assist.compareChanges')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload()}
                disabled={isDownloading}
                style={{ minWidth: 100 }}
              >
                {isDownloading && <Spinner size="1" style={{ marginRight: 8 }} />}
                {t('knowledge_assist.download')}
              </Button>
              <Button variant="solid" onClick={handleRefactorAndSave}>
                {isEditingForRefactor ? t('knowledge_assist.saving') : t('knowledge_assist.approveAndSave')}
              </Button>
            </>
          )}
          {view === VIEWS.MISSING_TRANSLATION && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelForTranslate}
                disabled={isTranslating}
              >
                {t('knowledge_assist.cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload()}
                disabled={isDownloading}
                style={{ minWidth: 100 }}
              >
                {isDownloading && <Spinner size="1" style={{ marginRight: 8 }} />}
                {t('knowledge_assist.download')}
              </Button>
              {isCreateNewArticleDisabled ? (
                <Tooltip content={t('knowledge_assist.disabledTooltip')}>
                  <Button
                    variant="solid"
                    onClick={handleTranslateAndSave}
                    disabled={isTranslating || isCreateNewArticleDisabled}
                  >
                    {isTranslating ? t('knowledge_assist.saving') : t('knowledge_assist.approveAndSave')}
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  variant="solid"
                  onClick={handleTranslateAndSave}
                  disabled={isTranslating || isCreateNewArticleDisabled}
                >
                  {isTranslating ? t('knowledge_assist.saving') : t('knowledge_assist.approveAndSave')}
                </Button>
              )}
            </>
          )}
        </Flex>
      </Flex>

      {/* Modal for selecting a collection when creating a new KB */}
      <Dialog.Root open={showCollectionsDialog} onOpenChange={setShowCollectionsDialog}>
        <Dialog.Content style={{ maxWidth: 400, margin: 'auto' }}>
          <Dialog.Title>{t('knowledge_assist.selectCollection')}</Dialog.Title>
          <Flex direction="column" gap="3" className="my-4">
            {isLoadingCollections ? (
              <Flex align="center" justify="center" py="4">
                <Spinner />
              </Flex>
            ) : (
              <Select.Root value={selectedCollection} onValueChange={setSelectedCollection}>
                <Select.Trigger className="w-full" placeholder={t('knowledge_assist.chooseCollection')} />
                <Select.Content>
                  <Select.Group>
                    {collections.map((collection) => (
                      <Select.Item key={collection.id} value={collection.id}>
                        {collection.name}
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            )}
          </Flex>
          <Flex gap="3" justify="end">
            <Button variant="soft" color="gray"  onClick={() => {
              setShowCollectionsDialog(false);
              setSelectedCollection('');
            }}>
              {t('knowledge_assist.cancel')}
            </Button>
            <Button onClick={handleModalSave} disabled={!selectedCollection}>
              {t('knowledge_assist.save')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};

const UploadIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ marginRight: '6px' }}
  >
    <path
      d="M7.81825 1.18188C7.64251 1.00615 7.35759 1.00615 7.18185 1.18188L4.18185 4.18188C4.00611 4.35762 4.00611 4.64254 4.18185 4.81828C4.35759 4.99401 4.64251 4.99401 4.81825 4.81828L7.05005 2.58648V9.49996C7.05005 9.74849 7.25152 9.94996 7.50005 9.94996C7.74858 9.94996 7.95005 9.74849 7.95005 9.49996V2.58648L10.1819 4.81828C10.3576 4.99401 10.6425 4.99401 10.8182 4.81828C10.994 4.64254 10.994 4.35762 10.8182 4.18188L7.81825 1.18188ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5528 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1041 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.1062 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);
