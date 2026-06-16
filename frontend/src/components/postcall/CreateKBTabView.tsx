import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Flex,
  Text,
  Button,
  ScrollArea,
  AlertDialog,
  Dialog,
  Select,
  Spinner,
} from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';
import AISparkle from 'components/icons/AISparkle';
import { Link2Icon, TrashIcon } from 'lucide-react';
import { PostcallTopics } from 'api/postcallTopcs';
import { PostcallTopic } from 'types/postcallTopicTypes';
import { useGlobalContext } from 'contexts/store';
import { toast } from 'react-toastify';
import PostcallVersionHistory from './PostcallVersionHistory';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { API_ENDPOINTS } from 'constants/dashboard';
import { KbCollectionSource } from 'types/dashboard';

interface CreateKBTabViewProps {
  meetingId?: string;
  summary: string;
  transcript: string;
  postcallTopics: PostcallTopic[];
  isLoadingPostcallTopics: boolean;
  onUpdatePostcallTopics: (updatedTopics: PostcallTopic[]) => void;
}

interface Collection {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any>;
}

const CreateKBTabView: React.FC<CreateKBTabViewProps> = ({
  meetingId,
  postcallTopics,
  isLoadingPostcallTopics,
  onUpdatePostcallTopics,
}) => {
  const { t } = useTranslation();
  const [selectedPostCallTopicId, setSelectedPostCallTopicId] = useState<string | null>(null);
  const [kbContent, setKbContent] = useState<string>('');
  const [isKbLoading, setIsKbLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);
  const [topicToDelete, setTopicToDelete] = useState<PostcallTopic | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
  const [selectedCollectionForAdd, setSelectedCollectionForAdd] = useState('');
  const [isAddingToCollection, setIsAddingToCollection] = useState(false);
  const [showCollectionRequiredDialog, setShowCollectionRequiredDialog] = useState(false);

  const { user } = useGlobalContext();

  // Update the initial selection when postcallTopics changes
  useEffect(() => {
    if (postcallTopics?.length > 0 && !selectedPostCallTopicId) {
      setSelectedPostCallTopicId(postcallTopics[0].id);
      setKbContent(postcallTopics[0].kb_entry);
    }
  }, [postcallTopics, selectedPostCallTopicId]);

  // Fetch collections on mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setIsLoadingCollections(true);
        const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        if (data.success && data.data) {
          setCollections(data.data);
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
        toast.error(t('knowledge_assist.failedToLoadCollections'));
      } finally {
        setIsLoadingCollections(false);
      }
    };

    if (user?.access_token) {
      fetchCollections();
    }
  }, [user?.access_token, t]);

  // Handle KB selection
  const handleKbSelect = useCallback(
    (kbId: string) => {
      const selectedKb = postcallTopics.find((kb) => kb.id === kbId);
      if (selectedKb) {
        setKbContent(selectedKb.kb_entry);
        setSelectedPostCallTopicId(kbId);
      }
    },
    [postcallTopics]
  );

  // Handle PDF download
  const handleDownloadPDF = useCallback(async () => {
    if (!selectedPostCallTopicId || !postcallTopics.length) return;

    const selectedKb = postcallTopics.find((kb) => kb.id === selectedPostCallTopicId);
    if (!selectedKb) return;

    try {
      const pdfBlob = await PostcallTopics.convertMarkdownToPdf(kbContent, user);

      // Create a URL for the blob
      const url = window.URL.createObjectURL(pdfBlob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedKb.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('knowledge_assist.failedToGeneratePDF'));
    }
  }, [selectedPostCallTopicId, postcallTopics, kbContent, user]);

  // Handle KB save
  const handleSave = useCallback(async () => {
    if (!selectedPostCallTopicId || !kbContent) return;

    // Check if KB is already in a collection
    const selectedTopic = postcallTopics.find(topic => topic.id === selectedPostCallTopicId);
    if (!selectedTopic?.knowledgebase_collection_id) {
      // If not in collection, show the dialog
      setShowCollectionRequiredDialog(true);
      return;
    }
      // If already in collection, proceed with save
      setIsSaving(true);
      try {
        await PostcallTopics.updateKnowledgeBaseEntry(selectedPostCallTopicId, kbContent, user);
        const updatedTopics = postcallTopics.map((topic) =>
          topic.id === selectedPostCallTopicId ? { ...topic, kb_entry: kbContent } : topic
        );
        onUpdatePostcallTopics(updatedTopics);
        
        // Find the collection name
        const collectionName = collections.find(
          (collection) => collection.id === selectedTopic?.knowledgebase_collection_id
        )?.name;
        
        const successMessage = collectionName 
          ? `${t('knowledge_assist.knowledgeBaseArticleSavedSuccessfully')} to ${collectionName}`
          : t('knowledge_assist.knowledgeBaseArticleSavedSuccessfully');
        
        toast.success(successMessage);
      } catch (error) {
        console.error('Error saving KB:', error);
        toast.error(t('knowledge_assist.failedToSaveKnowledgeBaseArticle'));
      } finally {
        setIsSaving(false);
      }
  }, [selectedPostCallTopicId, kbContent, user, postcallTopics, onUpdatePostcallTopics, t, collections]);

  const handleVersionRestore = useCallback(
    (restoredTopic: PostcallTopic) => {
      setKbContent(restoredTopic.kb_entry);
      setEditorKey((prev) => prev + 1);
      const updatedTopics = postcallTopics.map((topic) =>
        topic.id === selectedPostCallTopicId ? restoredTopic : topic
      );
      onUpdatePostcallTopics(updatedTopics);
    },
    [selectedPostCallTopicId, postcallTopics, onUpdatePostcallTopics]
  );

  // Handle add to collection
  const handleAddToCollection = async () => {
    if (!selectedCollectionForAdd || !selectedPostCallTopicId || !user) return;

    setIsAddingToCollection(true);
    try {
      // Check if the selected KB is already in a collection
      const selectedTopic = postcallTopics.find(topic => topic.id === selectedPostCallTopicId);

      if (selectedTopic?.knowledgebase_collection_id) {
        toast.error(t('knowledge_assist.kbAlreadyInCollection'));
        return;
      }

      

      await PostcallTopics.addPostcallTopicsToKbCollection(
        [selectedPostCallTopicId],
        selectedCollectionForAdd,
        user
      );

      // Update local state to reflect the changes
      const updatedTopics = postcallTopics.map(topic => {
        if (topic.id === selectedPostCallTopicId) {
          return {
            ...topic,
            knowledgebase_collection_id: selectedCollectionForAdd
          };
        }
        return topic;
      });
      onUpdatePostcallTopics(updatedTopics);

      toast.success(t('knowledge_assist.kbAddedToCollection'));
      setShowCollectionsDialog(false);
      setSelectedCollectionForAdd('');
    } catch (error) {
      console.error('Error adding to collection:', error);
      toast.error(t('knowledge_assist.failedToAddToCollection'));
    } finally {
      setIsAddingToCollection(false);
    }
  };

  // Handle add to collection and save
  const handleAddToCollectionAndSave = async () => {
    if (!selectedCollectionForAdd || !selectedPostCallTopicId || !user || !kbContent) return;

    setIsAddingToCollection(true);
    setIsSaving(true);
    try {
      // First, add to collection
      await PostcallTopics.addPostcallTopicsToKbCollection(
        [selectedPostCallTopicId],
        selectedCollectionForAdd,
        user
      );

      // Then, save the KB content
      await PostcallTopics.updateKnowledgeBaseEntry(selectedPostCallTopicId, kbContent, user);

      // Update local state to reflect the changes
      const updatedTopics = postcallTopics.map(topic => {
        if (topic.id === selectedPostCallTopicId) {
          return {
            ...topic,
            kb_entry: kbContent,
            knowledgebase_collection_id: selectedCollectionForAdd
          };
        }
        return topic;
      });
      onUpdatePostcallTopics(updatedTopics);

      toast.success(t('knowledge_assist.kbAddedToCollectionAndSaved'));
      setShowCollectionRequiredDialog(false);
      setSelectedCollectionForAdd('');
    } catch (error) {
      console.error('Error adding to collection and saving:', error);
      toast.error(t('knowledge_assist.failedToAddToCollectionAndSave'));
    } finally {
      setIsAddingToCollection(false);
      setIsSaving(false);
    }
  };

  // Add delete handler
  const handleDelete = useCallback(async () => {
    if (!topicToDelete) return;

    try {
      await PostcallTopics.deletePostcallTopic(topicToDelete.id, user);
      const updatedTopics = postcallTopics.filter((topic) => topic.id !== topicToDelete.id);
      onUpdatePostcallTopics(updatedTopics);

      // If the deleted topic was selected, select the first remaining topic
      if (selectedPostCallTopicId === topicToDelete.id) {
        if (updatedTopics.length > 0) {
          setSelectedPostCallTopicId(updatedTopics[0].id);
          setKbContent(updatedTopics[0].kb_entry);
        } else {
          setSelectedPostCallTopicId(null);
          setKbContent('');
        }
      }

      toast.success(t('knowledge_assist.knowledgeBaseArticleDeletedSuccessfully'));
    } catch (error) {
      console.error('Error deleting KB:', error);
      toast.error(t('knowledge_assist.failedToDeleteKnowledgeBaseArticle'));
    } finally {
      setTopicToDelete(null);
    }
  }, [topicToDelete, user, postcallTopics, onUpdatePostcallTopics, selectedPostCallTopicId]);

  // Update the KB list rendering
  const renderKBList = () => (
    postcallTopics.map((kb) => (
      <Flex
        key={kb.id}
        justify="between"
        align="center"
        className={`px-4 py-3 border-b border-[var(--gray-4)] w-full group ${selectedPostCallTopicId === kb.id
            ? 'bg-[var(--accent-3)]'
            : 'hover:bg-[var(--gray-2)]'
          }`}
      >
        <Text
          size="2"
          className="cursor-pointer flex-1"
          onClick={() => handleKbSelect(kb.id)}
        >
          {kb.topic}
        </Text>
        <Button
          variant="ghost"
          size="1"
          className={`${selectedPostCallTopicId === kb.id
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
          onClick={(e) => {
            e.stopPropagation();
            setTopicToDelete(kb);
          }}
        >
          <TrashIcon width={20} height={20} className="text-[var(--gray-9)]" />
        </Button>
      </Flex>
    ))
  );

  // Add delete confirmation modal
  const renderDeleteModal = () => (
    <AlertDialog.Root open={!!topicToDelete} onOpenChange={() => setTopicToDelete(null)}>
      <AlertDialog.Content>
        <AlertDialog.Title>{t('knowledge_assist.deleteKnowledgeBaseArticle')}</AlertDialog.Title>
        <AlertDialog.Description>
          {t('knowledge_assist.areYouSureDeleteKBArticle', { topic: topicToDelete?.topic })}
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              {t('knowledge_assist.cancel')}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={handleDelete}>
              {t('knowledge_assist.delete')}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );

  return (
    <Flex gap="4" className="h-full overflow-hidden">
      {/* Left Panel - Created KBs */}
      <Box className="w-1/3 border-r overflow-hidden pt-2">
        <Text size="4" weight="bold" className="p-4 mt-">
          {t('knowledge_assist.createdKBs')}
        </Text>
        <ScrollArea type="auto" className="h-full pt-2 pb-10">
          <Box className="w-full">
            {isLoadingPostcallTopics ? (
              <Box className="px-4 py-1">
                <Text size="2">{t('knowledge_assist.loadingKBArticles')}</Text>
              </Box>
            ) : Array.isArray(postcallTopics) && postcallTopics.length > 0 ? (
              renderKBList()
            ) : (
              <Box className="px-4 py-1">
                <Text size="2">{t('knowledge_assist.noKBArticlesFound')}</Text>
              </Box>
            )}
          </Box>
        </ScrollArea>
      </Box>

      {/* Right Panel - KB Editor */}
      <Box className="w-2/3 overflow-hidden">
        {selectedPostCallTopicId ? (
          <Flex direction="column" className="h-full">
            <Box className="p-4 pb-2">
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <AISparkle />
                  <Text size="4" weight="bold">
                    {t('knowledge_assist.aiRecommendedKB')}
                  </Text>
                </Flex>
                <Flex gap="2" className='z-100'>
                  <Button
                    variant="soft"
                    size="2"
                    onClick={() => setIsVersionHistoryOpen(true)}
                  >
                    <Link2Icon /> {t('knowledge_assist.versionHistory')}
                  </Button>
                  {/* <Button
                    variant="soft"
                    size="2"
                    onClick={handleDownloadPDF}
                    disabled={isLoadingPostcallTopics}
                  >
                    <DownloadIcon /> Download PDF
                  </Button> */}
                  <Button
                    size="2"
                    onClick={handleSave}
                    disabled={isSaving || isLoadingPostcallTopics}
                  >
                    {isSaving ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        {t('knowledge_assist.saving')}
                      </>
                    ) : (
                      t('knowledge_assist.save')
                    )}
                  </Button>
                </Flex>
              </Flex>
            </Box>

            <Box className="flex-1 border rounded-md overflow-hidden">
              <ScrollArea type="auto" className="h-full">
                <Box p="4">
                  <RichTextEditor
                    key={`${selectedPostCallTopicId}-${editorKey}`}
                    content={kbContent}
                    onChange={setKbContent}
                    disabled={isLoadingPostcallTopics}
                  />
                </Box>
              </ScrollArea>
            </Box>
          </Flex>
        ) : (
          <Flex align="center" justify="center" className="h-full text-[var(--gray-8)]">
            <Text size="3">{t('knowledge_assist.selectKBArticleToViewAndEdit')}</Text>
          </Flex>
        )}
      </Box>

      <PostcallVersionHistory
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        postcallTopicId={selectedPostCallTopicId}
        onVersionRestore={handleVersionRestore}
      />

      {renderDeleteModal()}

      {/* Collection Required Dialog (for Save button) */}
      <Dialog.Root open={showCollectionRequiredDialog} onOpenChange={setShowCollectionRequiredDialog}>
        <Dialog.Content style={{ maxWidth: 400 }}>
          <Dialog.Title>{t('knowledge_assist.addToCollectionRequired')}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t('knowledge_assist.pleaseSelectCollectionBeforeSaving')}
          </Dialog.Description>

          <Flex direction="column" gap="3" className="my-4">
            {isLoadingCollections ? (
              <Flex align="center" justify="center" py="4">
                <Spinner size="2" />
              </Flex>
            ) : (
              <>
                <Select.Root
                  value={selectedCollectionForAdd}
                  onValueChange={setSelectedCollectionForAdd}
                >
                  <Select.Trigger
                    className="w-full"
                    placeholder={t('knowledge_assist.chooseCollection')}
                  />
                  <Select.Content>
                    <Select.Group>
                      {collections.map((collection) => (
                        <Select.Item
                          key={collection.id}
                          value={collection.id}
                          disabled={collection.source === KbCollectionSource.SERVICE_NOW || collection.source === KbCollectionSource.SHAREPOINT}
                        >
                          {collection.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <Text size="2" color="gray">
                  {t('knowledge_assist.documentsAutoApprovedWhenAddedToCollection')}
                </Text>
              </>
            )}
          </Flex>

          <Flex gap="3" justify="end">
            <Button
              variant="soft"
              color="gray"
              onClick={() => setShowCollectionRequiredDialog(false)}
            >
              {t('knowledge_assist.cancel')}
            </Button>
            <Button
              onClick={handleAddToCollectionAndSave}
              disabled={
                isAddingToCollection ||
                isSaving ||
                !selectedCollectionForAdd
              }
            >
              <Flex align="center" gap="2">
                {(isAddingToCollection || isSaving) && <Spinner size="1" />}
                {t('knowledge_assist.addToCollectionAndSave')}
              </Flex>
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Collections Dialog (for Add to Collection button) */}
      <Dialog.Root open={showCollectionsDialog} onOpenChange={setShowCollectionsDialog}>
        <Dialog.Content style={{ maxWidth: 400 }}>
          <Dialog.Title>{t('knowledge_assist.addToCollection')}</Dialog.Title>

          <Flex direction="column" gap="3" className="my-4">
            {isLoadingCollections ? (
              <Flex align="center" justify="center" py="4">
                <Spinner size="2" />
              </Flex>
            ) : (
              <>
                <Select.Root
                  value={selectedCollectionForAdd}
                  onValueChange={setSelectedCollectionForAdd}
                >
                  <Select.Trigger
                    className="w-full"
                    placeholder={t('knowledge_assist.chooseCollection')}
                  />
                  <Select.Content>
                    <Select.Group>
                      {collections.map((collection) => (
                        <Select.Item
                          key={collection.id}
                          value={collection.id}
                          disabled={collection.source === KbCollectionSource.SERVICE_NOW || collection.source === KbCollectionSource.SHAREPOINT}
                        >
                          {collection.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <Text size="2" color="gray">
                  {t('knowledge_assist.documentsAutoApprovedWhenAddedToCollection')}
                </Text>
              </>
            )}
          </Flex>

          <Flex gap="3" justify="end">
            <Button
              variant="soft"
              color="gray"
              onClick={() => setShowCollectionsDialog(false)}
            >
              {t('knowledge_assist.cancel')}
            </Button>
            <Button
              onClick={handleAddToCollection}
              disabled={
                isAddingToCollection ||
                !selectedCollectionForAdd
              }
            >
              <Flex align="center" gap="2">
                {isAddingToCollection && <Spinner size="1" />}
                {t('knowledge_assist.addToCollection')}
              </Flex>
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};

export default CreateKBTabView;