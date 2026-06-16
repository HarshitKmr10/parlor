"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import withAuth from "components/withAuth";
import { API_ENDPOINTS } from "constants/dashboard";
import { useGlobalContext } from "contexts/store";
import UserManagementTabs from "./UserManagementTabs";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { serviceDeskInstance } from "api/common/axiosInstance";
import { useTranslation } from 'react-i18next';

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
  knowledgebase_collection_id: string;
  created_at: string;
  access_url: string;
  updated_at: string;
}

function UserManagement() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [kbCollections, setKbCollections] = useState<KBCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<{
    id: string;
    name: string;
    source: string
  } | null>(null);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);

  const fetchArticles = useCallback(async (collectionId: string) => {
    try {
      setIsLoadingArticles(true);
      const response = await serviceDeskInstance.get(
        `${API_ENDPOINTS.DOCUMENT_LIST}?kb_collection_id=${collectionId}`
      );
      const data = response.data;
      if (data.success) {
        setKbArticles(data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingArticles(false);
    }
  }, []);

  const updateCollections = useCallback(async () => {
    try {
      // Use the admin endpoint that allows all 4 admin roles to see all collections
      const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS_WITH_TAGS_ADMIN);
      const data = response.data;
      if (data.success) {
        // Also fetch counts for each collection (if needed)
        const collectionsResponse = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS);
        const collectionsData = collectionsResponse.data;
        
        if (collectionsData.success) {
          // Merge the count data with the collections with tags
          const collectionsWithTagsAndCounts = data.data.map(collection => {
            const collectionWithCount = collectionsData.data.find(c => c.id === collection.id);
            return {
              ...collection,
              count: collectionWithCount?.count || 0
            };
          });
          
          setKbCollections(collectionsWithTagsAndCounts);

          // If no collection is selected and we have collections, select the first one
          if (!selectedCollection && collectionsWithTagsAndCounts.length > 0) {
            const firstCollection = {
              id: collectionsWithTagsAndCounts[0].id,
              name: collectionsWithTagsAndCounts[0].name,
              source: collectionsWithTagsAndCounts[0]?.source
            };
            setSelectedCollection(firstCollection);
            await fetchArticles(firstCollection.id);
          }
          else if (collectionsWithTagsAndCounts.length > 0 && selectedCollection) {
            await fetchArticles(selectedCollection.id);
          }
        } else {
          setError(collectionsData.message);
          setKbCollections([]);
        }
      } else {
        setError(data.message);
        setKbCollections([]);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchArticles, selectedCollection]);

  useEffect(() => {
    updateCollections();
  }, [updateCollections]);

  const handleCollectionSelect = async (collection: {
    id: string;
    name: string;
    source: string
  }) => {
    setSelectedCollection(collection);
    await fetchArticles(collection.id);
  };

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {t('admin_panel.adminPanel')}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-full h-full overflow-y-auto">
          <UserManagementTabs
            isLoading={isLoading}
            error={error}
            kbCollections={kbCollections}
            kbArticles={kbArticles}
            selectedCollection={selectedCollection}
            onRefreshCollections={updateCollections}
            onCollectionSelect={handleCollectionSelect}
            isLoadingArticles={isLoadingArticles}
          />
        </Box>
      </Flex>
      <ToastContainer />
    </Flex>
  );
}

export default withAuth(UserManagement);
