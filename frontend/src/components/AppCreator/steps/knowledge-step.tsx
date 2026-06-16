'use client';

import { useState, useEffect, useCallback } from 'react';
import { FormData, KnowledgeSource, useAppCreator } from '../AppCreatorProvider';
import { Text, Flex, Heading, Spinner } from '@radix-ui/themes';
import { RadioGroup } from '@radix-ui/themes';
import { API_ENDPOINTS } from 'constants/dashboard';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export function KnowledgeStep() {
  const { formData, updateFormData } = useAppCreator();
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);

  const [selectedSource, setSelectedSource] = useState<string>(
    formData.knowledgeSources?.[0]?.id ?? '',
  );

  const [isLoadingArticles, setIsLoadingKbs] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchKnowledgeSources = useCallback(async () => {
    try {
      setIsLoadingKbs(true);
      const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS);
      const data = response.data;
      if (data.success) {
        setKnowledgeSources(data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingKbs(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeSources();
  }, []);

  const handleSourceChange = (sourceId: string) => {
    setSelectedSource(sourceId);
  };

  useEffect(() => {
    updateFormData((prevFormData: FormData) => ({
      ...prevFormData,
      knowledgeSources: knowledgeSources.filter((source) => source.id === selectedSource),
    }));
  }, [selectedSource, knowledgeSources, updateFormData]);

  return (
    <Flex direction="column" gap="6">
      <Heading size="3">Select Knowledge Sources</Heading>
      <Flex direction="column" gap="4">
        {knowledgeSources?.length > 0 ? (
          <RadioGroup.Root value={selectedSource} onValueChange={handleSourceChange}>
            {knowledgeSources.map((source) => (
              <Flex direction="row" key={source.id} gap="4" align="center">
                <RadioGroup.Item value={source.id} id={source.id} />
                <label htmlFor={source.id} className="flex cursor-pointer flex-col">
                  <Text htmlFor={source.id}>{source.name}</Text>
                </label>
              </Flex>
            ))}
          </RadioGroup.Root>
        ) : (
          <>
            {isLoadingArticles ? (
              <Spinner />
            ) : (
              <Text size="4" weight="medium" className="text-iris-8">
                No Knowledge source found
              </Text>
            )}
          </>
        )}
      </Flex>
    </Flex>
  );
}
