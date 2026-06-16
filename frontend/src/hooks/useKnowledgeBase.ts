import { useState, useEffect, useCallback } from 'react';

export interface KbCollection {
  sys_id: string;
  title: string;
  name: string;
  sys_created_on: string;
  document_count: number;
}

interface KbArticle {
  sys_id: string;
  title: string;
  number: string;
  collection: string;
  upload_date: string;
  status: string;
}

interface NewCollection {
  title: string;
  description: string;
}

interface NewArticle {
  collectionId: string;
  title: string;
  content: string;
}

export const useKnowledgeBase = () => {
  const [kbCollections, setKbCollections] = useState<KbCollection[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKbData = async () => {
    try {
      const response = await fetch('/api/getKbData');

      if (!response.ok) {
        throw new Error('Failed to fetch KB data');
      }

      const data = await response.json();
      setKbCollections(data.kbCollections);
      setKbArticles(data.kbArticles);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching KB data:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKbData();
  }, []);

  const createCollection = useCallback(async (newCollection: NewCollection) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/createKbCollection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCollection),
      });

      if (!response.ok) {
        throw new Error('Failed to create collection');
      }

      await fetchKbData();
    } catch (err) {
      console.error('Error creating collection:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createArticle = useCallback(async (newArticle: NewArticle) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/createKbArticle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newArticle),
      });

      if (!response.ok) {
        throw new Error('Failed to create article');
      }

      await fetchKbData();
    } catch (err) {
      console.error('Error creating article:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    kbCollections,
    kbArticles,
    createCollection,
    createArticle,
  };
};
