import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Text, Table, Flex, Box, Button, Tooltip, IconButton, Dialog } from "@radix-ui/themes";
import {
  PlusIcon,
  ExternalLinkIcon,
  CopyIcon,
  GearIcon,
  Cross2Icon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import UploadKBModal from "components/dashboard/UploadKBModal";
import { API_ENDPOINTS } from "constants/dashboard";
import { useGlobalContext } from "contexts/store";
import { toast } from "react-toastify";
import NewCollectionModal from "./NewCollectionModal";
import { KbCollectionSource } from "types/dashboard";
import { serviceDeskInstance } from "api/common/axiosInstance";
import Spinner from "components/spinner/spinner";
import { Trash, Download } from "lucide-react";
import DeleteModal from "components/KbArticles/DeleteModal";
import DocPreview from "./DocPreview";
import { useTranslation } from 'react-i18next';

/**
 * Extract storage path from full URL
 * Supports Azure Blob Storage and S3 URL formats
 * Returns: container/object_path
 */
const extractStoragePath = (url: string): string => {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (error) {
    console.error('Error parsing storage URL:', error);
    return url;
  }
};

const getFileExtension = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const path = value.startsWith('http://') || value.startsWith('https://')
      ? new URL(value).pathname
      : value;
    const cleanedPath = path.split('?')[0]?.split('#')[0] ?? path;
    const lastSegment = cleanedPath.split('/').pop() ?? cleanedPath;
    const match = lastSegment.match(/(\.[a-z0-9]+)$/i);

    return match ? match[1].toLowerCase() : null;
  } catch (error) {
    console.error('Error parsing file extension:', error);
    return null;
  }
};

const getDownloadFileName = (url: string, fileName?: string): string => {
  const artifactExtension = getFileExtension(url);

  if (!fileName) {
    return artifactExtension ? `download${artifactExtension}` : 'download';
  }

  const fileNameExtension = getFileExtension(fileName);
  if (!artifactExtension || artifactExtension === fileNameExtension) {
    return fileName;
  }

  if (!fileNameExtension) {
    return `${fileName}${artifactExtension}`;
  }

  return `${fileName.slice(0, -fileNameExtension.length)}${artifactExtension}`;
};

interface Tag {
  id: string;
  name: string;
  description?: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface KBCollection {
  id: string;
  name: string;
  source: string;
  source_config: any;
  count?: number;
  tags?: Tag[];
}

interface KBArticle {
  id: string;
  name: string;
  number?: string | null;
  knowledgebase_collection_id: string;
  created_at: string;
  access_url: string;
  updated_at: string;
}

interface TableProps {
  isLoading: boolean;
  error: string | null;
  kbCollections: KBCollection[];
  kbArticles: KBArticle[];
  selectedCollection: { id: string; name: string, source: string } | null;
  onCollectionSelect: (collection: { id: string; name: string, source: string }) => void;
  onNewCollection?: () => void;
  onEditCollection?: (collectionId: string) => void;
  onDeleteCollection?: (collectionId: string) => void;
  onAddDocument?: () => void;
  onCollectionCreated?: () => void;
  isLoadingArticles: boolean;
}

const TagManagement = ({ 
  collection, 
  onUpdateTags, 
  availableTags, 
  onCreateTag 
}: { 
  collection: KBCollection, 
  onUpdateTags: (collectionId: string, tagIds: string[]) => void,
  availableTags: Tag[],
  onCreateTag: (name: string) => Promise<Tag>
}) => {
  const { t } = useTranslation();
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleAddExistingTag = (tagId: string) => {
    const currentTagIds = (collection.tags || []).map(tag => tag.id);
    if (!currentTagIds.includes(tagId)) {
      onUpdateTags(collection.id, [...currentTagIds, tagId]);
    }
    setSearchTerm("");
    setIsAddingTag(false);
  };

  const handleCreateTag = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      const newTag = await onCreateTag(searchTerm.trim());
      const currentTagIds = (collection.tags || []).map(tag => tag.id);
      onUpdateTags(collection.id, [...currentTagIds, newTag.id]);
      setSearchTerm("");
      setIsAddingTag(false);
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(t('admin_panel.failedToCreateTag'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If there's an exact match, add it; otherwise create new
      const exactMatch = filteredAvailableTags.find(
        tag => tag.name.toLowerCase() === searchTerm.toLowerCase()
      );
      if (exactMatch) {
        handleAddExistingTag(exactMatch.id);
      } else if (searchTerm.trim()) {
        handleCreateTag();
      }
    } else if (e.key === 'Escape') {
      setIsAddingTag(false);
      setSearchTerm("");
    }
  };

  const handleRemoveTag = (tagId: string) => {
    const currentTagIds = (collection.tags || []).map(tag => tag.id);
    const newTagIds = currentTagIds.filter(id => id !== tagId);
    console.log(`Removing tag from ${collection.name}:`, { before: currentTagIds, after: newTagIds });
    onUpdateTags(collection.id, newTagIds);
  };

  // Filter available tags that aren't already in this collection
  const availableTagsToAdd = availableTags.filter(tag => 
    !(collection.tags || []).some(collectionTag => collectionTag.id === tag.id)
  );

  // Filter available tags based on search term
  const filteredAvailableTags = availableTagsToAdd.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if search term matches any existing tag exactly
  const exactMatch = filteredAvailableTags.find(
    tag => tag.name.toLowerCase() === searchTerm.toLowerCase()
  );

  return (
    <Box className="mt-2">
      <Flex gap="2" wrap="wrap">
        {/* Display current tags for this collection only */}
        {(collection.tags || []).map(tag => (
          <Flex
            key={tag.id}
            align="center"
            gap="1"
            className="rounded-full px-2 py-1 text-xs bg-[var(--violet-3)] text-[var(--violet-11)]"
          >
            <Text size="1">{tag.name}</Text>
            <IconButton
              size="1"
              variant="ghost"
              onClick={() => handleRemoveTag(tag.id)}
              className="hover:bg-transparent"
            >
              <Cross2Icon width="12" height="12" />
            </IconButton>
          </Flex>
        ))}

        {/* Tag search/add interface */}
        {isAddingTag ? (
          <Box className="relative">
            <Flex gap="2" align="center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t('admin_panel.searchOrCreateTag')}
                className="w-40 rounded-md border border-[var(--gray-6)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--violet-8)]"
                autoFocus
              />
              <Button size="1" variant="ghost" onClick={() => {
                setIsAddingTag(false);
                setSearchTerm("");
              }}>
                {t('admin_panel.cancel')}
              </Button>
            </Flex>
            
            {/* Dropdown with suggestions */}
            {!!searchTerm && (isAddingTag) && (
              <Box className="absolute top-8 left-0 z-10 w-48 max-h-32 overflow-y-auto bg-white border border-[var(--gray-6)] rounded-md shadow-lg">
                {filteredAvailableTags.length > 0 ? (
                  <>
                    {filteredAvailableTags.slice(0, 5).map(tag => (
                      <Box
                        key={tag.id}
                        className="px-3 py-2 text-xs hover:bg-[var(--gray-3)] cursor-pointer"
                        onClick={() => handleAddExistingTag(tag.id)}
                      >
                        <Text size="1">{tag.name}</Text>
                      </Box>
                    ))}
                    {filteredAvailableTags.length > 5 && (
                      <Box className="px-3 py-1 text-xs text-[var(--gray-10)] border-t border-[var(--gray-5)]">
                        {t('admin_panel.more', { count: filteredAvailableTags.length - 5 })}
                      </Box>
                    )}
                  </>
                ) : null}
                
                {/* Create new tag option */}
                {searchTerm.trim() && !exactMatch && (
                  <Box
                    className="px-3 py-2 text-xs hover:bg-[var(--violet-3)] cursor-pointer border-t border-[var(--gray-5)]"
                    onClick={handleCreateTag}
                  >
                    <Flex align="center" gap="1">
                      <PlusIcon width="12" height="12" />
                      <Text size="1">{t('admin_panel.create', { name: searchTerm.trim() })}</Text>
                    </Flex>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        ) : (
          <Button
            size="1"
            variant="ghost"
            onClick={() => setIsAddingTag(true)}
            className="text-[var(--gray-11)] hover:text-[var(--gray-12)]"
          >
            <PlusIcon width="12" height="12" /> {t('admin_panel.assignTower')}
          </Button>
        )}
      </Flex>
    </Box>
  );
};

export function KBArticles({
  isLoading,
  error,
  kbCollections = [],
  kbArticles = [],
  selectedCollection,
  onCollectionSelect,
  onNewCollection,
  onEditCollection,
  onDeleteCollection,
  onAddDocument,
  onCollectionCreated,
  isLoadingArticles,
}: TableProps) {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(
    false
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [editingCollection, setEditingCollection] = useState<KBCollection | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string>();

  const [docxUrl, setDocxUrl] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);

  // Fetch available tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await serviceDeskInstance.get(API_ENDPOINTS.TAGS);
        if (response.data.success) {
          setAvailableTags(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };

    fetchTags();
  }, []);

  const filteredArticles = useMemo(() => {
    if (!kbArticles || kbArticles.length === 0) return [];

    const collectionFiltered = selectedCollection?.id
      ? kbArticles.filter(
          (article) => article?.knowledgebase_collection_id === selectedCollection.id
        )
      : kbArticles;

    return searchTerm?.trim()
      ? collectionFiltered.filter(
          (article) =>
            (article?.name
              ?.toLowerCase()
              .includes(searchTerm.trim().toLowerCase()) ?? false) ||
            (article?.number
              ?.toLowerCase()
              .includes(searchTerm.trim().toLowerCase()) ?? false)
        )
      : collectionFiltered;
  }, [kbArticles, selectedCollection, searchTerm]);

  // Check if any article has a KB number to show the column
  const hasKbNumbers = useMemo(() => {
    return filteredArticles.some(article => article.number);
  }, [filteredArticles]);

  const deleteArticle = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setSelectedArticleId(undefined);
    setIsDeleteModalOpen((prev) => !prev);
  }, []);

  if (isLoading) {
    return (
      <Box className="w-full">
        <Flex justify="center" align="center" className="h-[200px]">
          <Text size="3">{t('admin_panel.loadingKBArticles')}</Text>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="w-full">
        <Flex justify="center" align="center" className="h-[200px]">
          <Text size="3" color="red">
            {error}
          </Text>
        </Flex>
      </Box>
    );
  }

  const handleCreateCollection = async (
    name: string,
    selectedTowerIds: string[],
    source: string,
    config: any,
    selectedRoleIds: string[],
    collectionId?: string
  ): Promise<boolean> => {
    try {
      const payload = {
        name,
        integration_source: {
          name: source,
          config: config,
        },
        tag_ids: selectedTowerIds.length > 0 ? selectedTowerIds : undefined,
        allowed_role_ids: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
      };

      let response;
      if (collectionId) {
        // Update existing collection
        response = await serviceDeskInstance.put(
          `${API_ENDPOINTS.COLLECTIONS}/${collectionId}`,
          payload
        );
        toast.success(t('admin_panel.collectionUpdatedSuccessfully'));
      } else {
        // Create new collection
        response = await serviceDeskInstance.post(
          API_ENDPOINTS.COLLECTIONS,
          payload
        );
        toast.success(t('admin_panel.collectionCreatedSuccessfully'));
      }

      if (onCollectionCreated) {
        onCollectionCreated();
      }
      setIsNewCollectionModalOpen(false);
      setEditingCollection(null);
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(error.response.data.message || t('admin_panel.collectionWithNameExists'));
      } else {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message ||
          (collectionId ? t('admin_panel.failedToUpdateCollection') : t('admin_panel.failedToCreateCollection'));
        toast.error(errorMessage);
      }
      console.error("Error with collection:", error);
      return false;
    }
  };

  const handleUploadSuccess = (contents: string[], collectionId: string) => {
    if (onCollectionCreated) {
      onCollectionCreated();
    }
    setIsUploadModalOpen(false);
    // toast.success("Documents uploaded successfully!");
  };

  const handleCloseNewCollectionModal = () => {
    setIsNewCollectionModalOpen(false);
    setEditingCollection(null);
  };

  const selectedCollectionData = selectedCollection
    ? kbCollections.find((c) => c.id === selectedCollection.id)
    : null;

  const isUploadDisabled =
    selectedCollectionData?.source === KbCollectionSource.SERVICE_NOW ||
    selectedCollectionData?.source === KbCollectionSource.SHAREPOINT;

  const handleCreateTag = async (name: string): Promise<Tag> => {
    try {
      const response = await serviceDeskInstance.post(API_ENDPOINTS.TAGS, {
        name,
      });

      if (response.data.success) {
        const newTag = response.data.data;
        setAvailableTags(prev => [newTag, ...prev]);
        toast.success(t('admin_panel.tagCreatedSuccessfully'));
        return newTag;
      } else {
        throw new Error(t('admin_panel.failedToCreateTag'));
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(t('admin_panel.failedToCreateTag'));
      throw error;
    }
  };

  const handleUpdateTags = async (collectionId: string, tagIds: string[]) => {
    try {
      console.log(`Updating collection ${collectionId} with tags:`, tagIds);
      
      const response = await serviceDeskInstance.post(
        `/knowledgebase/collections/${collectionId}/tags`,
        { tag_ids: tagIds }
      );

      if (response.data.success) {
        // Trigger refresh to get updated collections with tags
        if (onCollectionCreated) {
          onCollectionCreated();
        }
        
        toast.success(t('admin_panel.tagsUpdatedSuccessfully'));
      } else {
        throw new Error(t('admin_panel.failedToUpdateTags'));
      }
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error(t('admin_panel.failedToUpdateTags'));
    }
  };

  // Render empty collections state
  if (kbCollections.length === 0) {
    return (
      <Flex
        justify="center"
        align="center"
        className="h-full"
        direction="column"
        gap="4"
      >
        <Text size="3" color="gray">
          {t('admin_panel.noCollectionsAvailable')}
        </Text>
        <Button onClick={() => setIsNewCollectionModalOpen(true)} size="2">
          <PlusIcon />
          {t('admin_panel.createCollection')}
        </Button>
        <NewCollectionModal
          isOpen={isNewCollectionModalOpen}
          onClose={handleCloseNewCollectionModal}
          onSubmit={handleCreateCollection}
          initialData={editingCollection}
        />
      </Flex>
    );
  }

  const handleEditCollection = (collectionId: string) => {
    if (onEditCollection) onEditCollection(collectionId);
  };

  const handleDeleteCollection = (collectionId: string) => {
    if (onDeleteCollection) onDeleteCollection(collectionId);
  };

  const handleArticleClick = (accessUrl: string, name?: string) => {
    try {
      const resolvedExtension = getFileExtension(accessUrl) || getFileExtension(name);
      if (resolvedExtension === '.docx') {
        setDocxUrl(accessUrl);
        const cleanName = name?.toLowerCase().endsWith('.docx')
          ? name.slice(0, -5)
          : (name || 'Document');
        setDocName(cleanName);
      } else {
        window.open(accessUrl, '_blank'); // Open in new tab
      }
    } catch (error) {
      console.error('Error handling article click:', error);
    }
  };

  const downloadFile = async (url: string, fileName?: string) => {
    try {
      // Extract storage path from URL and use the secure proxy endpoint
      const storagePath = extractStoragePath(url);
      const response = await serviceDeskInstance.post('/service_desk/proxy/fetch_file', {
        storage_path: storagePath
      });

      // The proxy returns JSON with content field and is_binary flag
      const { content, is_binary } = response.data;
      
      // Convert content to blob for download
      let blob;
      if (is_binary) {
        // Content is base64 encoded binary data
        const binaryString = atob(content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes]);
      } else {
        // Content is text data
        blob = new Blob([content]);
      }
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getDownloadFileName(url, fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t('admin_panel.downloadFailed'));
      console.error("Error downloading file:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleAddDocument = () => {
    setIsUploadModalOpen(true);
  };

  return (
    <Flex className="h-screen overflow-hidden">
      {/* Left Sidebar with independent scroll */}
      <Box className="flex  w-1/4 flex-col border-r">
        <Box className="p-4">
          <Flex justify="between" align="center" mb="4">
            <Text size="3" weight="bold">
              {t('admin_panel.kbCollections')}
            </Text>
            <Button
              size="1"
              variant="soft"
              onClick={() => setIsNewCollectionModalOpen(true)}
              className="cursor-pointer bg-[var(--violet-4)]"
            >
              <PlusIcon />
              {t('admin_panel.newCollection')}
            </Button>
          </Flex>
        </Box>

        {/* Scrollable collection list */}
        <Box className="flex-1 overflow-y-auto">
          <Flex direction="column" gap="2" className="px-4">
            {kbCollections.map((collection, index) => (
              <React.Fragment key={collection.id}>
                <Box
                  className={`rounded-md transition-colors hover:bg-[var(--iris-3)] ${
                    selectedCollection?.id === collection.id ? 'bg-[var(--iris-3)]' : ''
                  }`}
                >
                  <Flex
                    direction="column"
                    justify="between"
                    className="min-h-[100px] cursor-pointer p-4"
                    onClick={() =>
                      onCollectionSelect({
                        id: collection.id,
                        name: collection.name,
                        source: collection?.source,
                      })
                    }
                  >
                    <Flex justify="between" align="start" className="w-full">
                      <Box className="flex flex-col items-start gap-2">
                        <Box className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--iris-3)]">
                          <GearIcon className="h-6 w-6 text-[var(--iris-9)]" />
                        </Box>
                        <Box>
                          <Flex align="center" gap="2">
                            <Text size="2" weight="medium" className="block">
                              {collection.name}
                            </Text>
                            <IconButton
                              size="1"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCollection(collection);
                                setIsNewCollectionModalOpen(true);
                              }}
                              className="hover:bg-[var(--gray-4)]"
                            >
                              <Pencil1Icon width="14" height="14" />
                            </IconButton>
                          </Flex>
                          <Text size="1" color="gray" className="mt-1 block">
                            {collection.count || 0} {t('admin_panel.documents')}
                          </Text>
                          <Text size="1" color="gray" className="mt-1 block">
                            {[
                              KbCollectionSource.SERVICE_NOW,
                              KbCollectionSource.SHAREPOINT,
                            ].includes(collection.source as KbCollectionSource) &&
                              collection.source}
                          </Text>
                        </Box>
                      </Box>
                    </Flex>
                    <TagManagement
                      collection={collection}
                      onUpdateTags={handleUpdateTags}
                      availableTags={availableTags}
                      onCreateTag={handleCreateTag}
                    />
                  </Flex>
                </Box>
                {index < kbCollections.length - 1 && <Box className="h-[1px] bg-[var(--gray-5)]" />}
              </React.Fragment>
            ))}
          </Flex>
        </Box>
      </Box>

      {/* Main Content with independent scroll */}
      <Box className="flex h-full w-3/4 flex-col">
        {/* Fixed header */}
        <Box className="p-4">
          <Flex justify="between" align="center">
            <Text size="4" weight="bold">
              {selectedCollectionData ? selectedCollectionData.name : t('admin_panel.allDocuments')}
            </Text>
            <Flex gap="2" align="center">
              <Box className="relative">
                <input
                  type="text"
                  placeholder={t('admin_panel.searchArticles')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="focus:border-transparent w-[250px] rounded-md border border-[var(--gray-6)]
                  px-3 py-1 pl-8 text-sm focus:outline-none
                  focus:ring-2 focus:ring-[var(--violet-8)]"
                />
                <Box className="absolute left-2 top-1/2 -translate-y-1/2 transform text-[var(--gray-9)]">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    />
                  </svg>
                </Box>
              </Box>
              {isUploadDisabled ? (
                <Tooltip
                  content={
                    isUploadDisabled
                      ? t('admin_panel.documentUploadNotAvailable')
                      : ''
                  }
                >
                  <Button
                    size="2"
                    onClick={handleAddDocument}
                    disabled={isUploadDisabled}
                    className={isUploadDisabled ? 'cursor-not-allowed opacity-50' : ''}
                  >
                    <PlusIcon /> {t('admin_panel.addDocument')}
                  </Button>
                </Tooltip>
              ) : (
                <Button size="2" onClick={handleAddDocument} className="cursor-pointer">
                  <PlusIcon /> {t('admin_panel.addDocument')}
                </Button>
              )}
            </Flex>
          </Flex>
        </Box>

        {/* Scrollable content area */}
        <Box className="flex-1 overflow-y-auto p-4">
          {isLoadingArticles ? (
            <Flex justify="center" align="center" className="h-[200px]">
              <Spinner />
            </Flex>
          ) : !kbArticles || filteredArticles.length === 0 ? (
            <Flex justify="center" align="center" className="h-[200px] rounded-md border">
              <Text size="2" color="gray">
                {selectedCollection
                  ? t('admin_panel.noArticlesFoundInCollection')
                  : t('admin_panel.noArticlesAvailable')}
              </Text>
            </Flex>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>{t('admin_panel.articleID')}</Table.ColumnHeaderCell>
                  {hasKbNumbers && <Table.ColumnHeaderCell>{t('admin_panel.kbNumber')}</Table.ColumnHeaderCell>}
                  <Table.ColumnHeaderCell>{t('admin_panel.articleName')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t('admin_panel.createdAt')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {selectedCollection?.source !== 'service_now' &&
                    selectedCollection?.source !== 'sharepoint'
                      ? t('admin_panel.actions')
                      : ''}
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredArticles.map((article) => (
                  <Table.Row key={article.id} className="cursor-pointer hover:bg-[var(--gray-3)]">
                    <Table.Cell className="w-[140px]">
                      <Tooltip content={article.id}>
                        <Flex align="center" gap="1" className="group">
                          <Text>{`${article.id.slice(0, 6)}...${article.id.slice(-6)}`}</Text>
                          <Box
                            className="cursor-pointer opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(article.id);
                            }}
                          >
                            <CopyIcon />
                          </Box>
                        </Flex>
                      </Tooltip>
                    </Table.Cell>
                    {/* KB Number - show only if hasKbNumbers */}
                    {hasKbNumbers && (
                      <Table.Cell className="w-[120px]">
                        {article.number ? (
                          <Text>{article.number}</Text>
                        ) : (
                          <Text color="gray">-</Text>
                        )}
                      </Table.Cell>
                    )}
                    {/* Article Name - flexible width */}
                    <Table.Cell className="max-w-[200px] overflow-hidden truncate whitespace-nowrap">
                      <Text
                        onClick={() => handleArticleClick(article.access_url, article?.name)}
                        title={article.name}
                        className="flex items-center gap-1 overflow-hidden truncate whitespace-nowrap hover:text-blue-500 hover:underline"
                      >
                        {article.name}
                        <ExternalLinkIcon className="opacity-0 group-hover:opacity-100" />
                      </Text>
                    </Table.Cell>
                    {/* Created At - fixed width */}
                    <Table.Cell className="w-[150px]">
                      {new Date(article.created_at).toLocaleDateString()}
                    </Table.Cell>
                    {/* Actions - fixed width */}
                    <Table.Cell className="flex h-[100%] w-[80px] items-center justify-center">
                      {selectedCollection?.source !== 'service_now' &&
                        selectedCollection?.source !== 'sharepoint' && (
                          <Flex className="gap-4">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(article.access_url, article.name);
                              }}
                              variant="ghost"
                              className="flex cursor-pointer items-center justify-center"
                            >
                              <Download className="h-4 w-4 text-[var(--gray-12)]" />
                            </IconButton>

                            <IconButton
                              onClick={() => deleteArticle(article?.id)}
                              variant="ghost"
                              className="flex cursor-pointer items-center justify-center"
                            >
                              <Trash color="#f53939" className="h-4 w-4" />
                            </IconButton>
                          </Flex>
                        )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Box>

      {showToast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-[var(--gray-12)] px-4 py-2 text-white shadow-lg">
          {t('admin_panel.copiedToClipboard')}
        </div>
      )}

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        articleId={selectedArticleId}
        refreshPage={onCollectionCreated}
      />

      <NewCollectionModal
        isOpen={isNewCollectionModalOpen}
        onClose={handleCloseNewCollectionModal}
        onSubmit={handleCreateCollection}
        initialData={editingCollection}
      />

      <UploadKBModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        selectedCollectionId={selectedCollection?.id}
        selectedCollectionName={selectedCollection?.name}
        disableCollectionSelect={!!selectedCollection}
      />
      {!!docxUrl && (
        <Dialog.Root open={!!docxUrl} onOpenChange={() => setDocxUrl(null)}>
          <Dialog.Content className="max-h-[95vh] w-[95vw] max-w-[920px] overflow-y-hidden ">
            <DocPreview url={docxUrl} title={docName} onClose={() => setDocxUrl(null)} />
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Flex>
  );
}

export default KBArticles;
