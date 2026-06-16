'use client';

import { Flex, Section, Heading, Text, Avatar, Card, Box, Badge } from '@radix-ui/themes';
import { CheckIcon, MobileIcon } from '@radix-ui/react-icons';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  getTrainAssistTopics,
  getTrainAssistCollections,
  TrainAssistTopic,
  KnowledgebaseCollection,
} from '../../../api/trainAssist';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import DocumentHeader from 'components/dashboard/DocumentHeader';
import SimulationRecommendations from './components/SimulationRecommendations';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { API_ENDPOINTS } from 'constants/dashboard';
import withAuth from 'components/withAuth';
import { useTranslation } from 'react-i18next';

interface Tag {
  id: string;
  name: string;
  description?: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface CollectionWithTags extends KnowledgebaseCollection {
  tags?: Tag[];
}

function TrainAssist2Page() {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [topics, setTopics] = useState<TrainAssistTopic[]>([]);
  const [allCollections, setAllCollections] = useState<CollectionWithTags[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<CollectionWithTags[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useGlobalContext();

  const clientName = process.env.NEXT_PUBLIC_CLIENT;
  const isPROFILE_GD = clientName === 'PROFILE_GD';
  const pageTitle = isPROFILE_GD ? t('trainAssist.pageTitleAI') : t('trainAssist.pageTitle');


  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      setTagsLoading(true);
      try {
        const response = await serviceDeskInstance.get(API_ENDPOINTS.TAGS_FOR_USER);
        if (response.data.success) {
          setTags(response.data.data);
          // Set "All" as default (no tag filter)
          setSelectedTag('');
        }
      } catch (err) {
        console.error('Error fetching tags:', err);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchTags();
  }, []);

  // Fetch collections with tags
  useEffect(() => {
    const fetchCollections = async () => {
      setCollectionsLoading(true);
      try {
        // First get the train assist collections (only collections marked for train assist)
        const trainAssistCollections = await getTrainAssistCollections();

        // Then get all collections with tags to merge the tag data
        const response = await serviceDeskInstance.get(
          API_ENDPOINTS.COLLECTIONS_WITH_TAGS_FOR_USER,
        );

        if (response.data.success) {
          // Merge tag data with train assist collections
          const collectionsWithTags = trainAssistCollections.map((trainCollection) => {
            const collectionWithTags = response.data.data.find(
              (c: CollectionWithTags) => c.id === trainCollection.id,
            );
            return {
              ...trainCollection,
              tags: collectionWithTags?.tags || [],
            };
          });

          setAllCollections(collectionsWithTags);
        } else {
          // Fallback to train assist collections without tags if tags API fails
          setAllCollections(trainAssistCollections.map((c) => ({ ...c, tags: [] })));
        }
      } catch (err) {
        console.error('Error fetching collections:', err);
        // Fallback to just train assist collections without tags
        try {
          const trainAssistCollections = await getTrainAssistCollections();
          setAllCollections(trainAssistCollections.map((c) => ({ ...c, tags: [] })));
        } catch (fallbackErr) {
          console.error('Error fetching train assist collections:', fallbackErr);
        }
      } finally {
        setCollectionsLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // Filter collections based on selected tag
  useEffect(() => {
    if (!selectedTag) {
      // Show all collections if no tag is selected
      setFilteredCollections(allCollections);
    } else {
      // Filter collections that have the selected tag
      const filtered = allCollections.filter((collection) =>
        collection.tags?.some((tag) => tag.id === selectedTag),
      );
      setFilteredCollections(filtered);
    }
  }, [selectedTag, allCollections]);

  // Handle collection selection after filtering
  useEffect(() => {
    if (filteredCollections.length > 0) {
      // Check if there's a collection ID in the URL
      const collectionFromUrl = searchParams.get('collection');

      // If collection ID exists in URL and it's in filtered collections, select it
      if (collectionFromUrl && filteredCollections.some((c) => c.id === collectionFromUrl)) {
        setSelectedCollection(collectionFromUrl);
        setSelectedTab(collectionFromUrl);
      }
      // Otherwise, select the first filtered collection as default
      else {
        setSelectedCollection(filteredCollections[0].id);
        setSelectedTab(filteredCollections[0].id);
      }
    } else {
      setSelectedCollection('');
      setSelectedTab('');
    }
  }, [filteredCollections, searchParams]);

  useEffect(() => {
    const fetchTopics = async () => {
      // Only fetch topics if selectedCollection exists
      if (!selectedCollection) {
        return;
      }

      setLoading(true);
      try {
        const fetchedTopics = await getTrainAssistTopics(selectedCollection);
        setTopics(fetchedTopics);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching topics:', err);
        setError(t('trainAssist.errorLoadingContent'));
        setLoading(false);
      }
    };

    fetchTopics();
  }, [selectedCollection]);

  const handleTopicClick = (topicId: string, tab?: string) => {
    // Include the current collection ID when navigating to a topic
    router.push(
      `/train-assist-2/topic?id=${topicId}&collection=${selectedCollection}${tab ? tab : ''}`,
    );
  };

  const handleTagChange = (tagId: string) => {
    setSelectedTag(tagId);
  };

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setSelectedTab(collectionId);
  };

  // Function to check if a topic is completed based on train_assist_activity
  const isTopicCompleted = (topic: TrainAssistTopic): boolean => {
    return Boolean(
      topic.train_assist_activity &&
        topic.train_assist_activity.length > 0 &&
        topic.train_assist_activity.some((activity) => activity.type === 'quiz'),
    );
  };

  // Calculate the number of completed topics
  const completedTopicsCount = topics.filter(isTopicCompleted).length;
  const completionPercentage =
    topics.length > 0 ? Math.round((completedTopicsCount / topics.length) * 100) : 0;

  // Function to check if a topic was created within the last 3 days
  const isTopicRecentlyCreated = useCallback((createdAt: string): boolean => {
    const createdDate = new Date(createdAt);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return createdDate >= threeDaysAgo;
  }, []);

  return (
    <div className="h-screen overflow-hidden">
      <DocumentHeader header={pageTitle} />
      <Flex direction="row" className="h-full">
        {/* Main Content Section - Takes up most of the space - with scrollable content */}
        <Section className="min-h-full flex-1 overflow-y-scroll border-r-1 border-[#E3E6EA] bg-white p-1 px-4 pb-32 pt-4">
          <Flex direction="column" gap="4">
            {/* Tag selector - New horizontal selector */}
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium" className="text-gray-700">
                {t('trainAssist.tower')}
              </Text>
              <Flex gap="3" className="max-w-max flex-wrap rounded-md bg-[#F2F2F7] px-1 py-1.5">
                {tagsLoading ? (
                  <Text>{t('trainAssist.loadingTags')}</Text>
                ) : (
                  <>
                    {/* "All" option to show collections without tag filter */}
                    <Flex
                      align="center"
                      justify="center"
                      className={`cursor-pointer rounded-lg px-4 py-2.5 transition-all duration-200 ${selectedTag === '' && 'bg-white'}`}
                      onClick={() => handleTagChange('')}
                    >
                      <Text
                        size="2"
                        weight="medium"
                        className={selectedTag === '' ? '' : 'text-gray-700'}
                      >
                        {t('trainAssist.all')}
                      </Text>
                    </Flex>
                    {tags.map((tag) => (
                      <Flex
                        key={tag.id}
                        align="center"
                        justify="center"
                        className={`cursor-pointer rounded-lg px-4 py-2.5 transition-all duration-200 ${selectedTag === tag.id && 'bg-white'}`}
                        onClick={() => handleTagChange(tag.id)}
                      >
                        <Text
                          size="2"
                          weight="medium"
                          className={selectedTag === tag.id ? '' : 'text-gray-700'}
                        >
                          {tag.name}
                        </Text>
                      </Flex>
                    ))}
                  </>
                )}
              </Flex>
            </Flex>

            {/* Collection tabs/buttons - Filtered by selected tag */}
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium" className="text-gray-700">
                {t('trainAssist.collection')}
              </Text>
              <Flex gap="3" className="max-w-max flex-wrap rounded-md bg-[#F2F2F7] px-1 py-1.5">
                {collectionsLoading ? (
                  <Text>{t('trainAssist.loadingCollections')}</Text>
                ) : filteredCollections.length === 0 ? (
                  <Text>{t('trainAssist.noCollectionsAvailable')}</Text>
                ) : (
                  filteredCollections.map((collection) => (
                    <Flex
                      key={collection.id}
                      align="center"
                      justify="center"
                      className={`cursor-pointer rounded-lg px-4 py-2.5 transition-all duration-200 ${selectedTab === collection.id && 'bg-white'}`}
                      onClick={() => handleCollectionChange(collection.id)}
                    >
                      <Text
                        size="2"
                        weight="medium"
                        className={selectedTab === collection.id ? '' : 'text-gray-700'}
                      >
                        {collection.name}
                      </Text>
                    </Flex>
                  ))
                )}
              </Flex>
            </Flex>

            {/* Conditional content based on selected collection */}
            {!!selectedTab && filteredCollections.find((c) => c.id === selectedTab) && (
              <Box className="mt-4 p-2">
                <Heading size="5">
                  {filteredCollections.find((c) => c.id === selectedTab)?.name}
                </Heading>
                {/* Show selected tag if any */}
                {!!selectedTag && (
                  <Flex gap="2" align="center" className="mt-2">
                    <Text size="2" color="gray">
                      {t('trainAssist.filteredByTag')}
                    </Text>
                    <Badge variant="soft" color="violet">
                      {tags.find((t) => t.id === selectedTag)?.name}
                    </Badge>
                  </Flex>
                )}

                <Box className="mb-8">
                  <Flex align="center" gap="2" className="mb-2 mt-2">
                    <Text size="2">
                      {completedTopicsCount}/{topics.length} {t('trainAssist.modules')}
                    </Text>
                    <Text size="2" color="gray">
                      {completionPercentage}% {t('trainAssist.completed')}
                    </Text>
                  </Flex>
                  <Box className="h-2 w-32 rounded-full bg-gray-200">
                    <Box
                      className="h-2 rounded-full bg-iris-9"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </Box>
                </Box>

                {loading ? (
                  <Text>{t('trainAssist.loadingTopics')}</Text>
                ) : error ? (
                  <Text color="red">{error}</Text>
                ) : topics.length === 0 ? (
                  <Text>{t('trainAssist.noTopicsFound')}</Text>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {topics.map((topic, index) => {
                      const completed = isTopicCompleted(topic);
                      return (
                        <Card
                          key={topic.id}
                          className={`min-h-48 cursor-pointer rounded-lg p-4 transition-all hover:shadow-md`}
                          style={{ '--base-card-border-radius': '7px' } as React.CSSProperties}
                          onClick={() => handleTopicClick(topic.id)}
                        >
                          <Flex
                            direction="column"
                            gap="4"
                            className="rounder-lg flex h-[100%] flex-1 justify-between"
                          >
                            <Box>
                              <Flex justify="between" align="center" className="mb-4">
                                <Avatar
                                  size="3"
                                  fallback={<MobileIcon />}
                                  radius="medium"
                                  className={`${completed ? 'bg-green-100 text-green-600' : 'bg-iris-3 text-iris-9'} border-0`}
                                />
                                <Flex gap="2" align="center">
                                  {!!topic?.created_at && isTopicRecentlyCreated(topic.created_at) && (
                                     <div
                                     className="flex flex-1 max-h-[24px] rounded-sm shadow-[0px_1px_3px_0px_#19213D1A] bg-pink-100 py-0.5 px-1"
                                   >
                                     <svg
                                       width="12"
                                       height="12"
                                       viewBox="0 0 12 12"
                                       fill="none"
                                       xmlns="http://www.w3.org/2000/svg"
                                     >
                                       <path
                                         d="M3.79541 7.37496C6.02979 7.37496 7.00374 6.43492 7.00374 4.16663C7.00374 6.43492 7.97083 7.37496 10.2121 7.37496C7.97083 7.37496 7.00374 8.34204 7.00374 10.5833C7.00374 8.34204 6.02979 7.37496 3.79541 7.37496ZM1.04541 3.47913C2.48183 3.47913 3.10791 2.87504 3.10791 1.41663C3.10791 2.87504 3.72987 3.47913 5.17041 3.47913C3.72987 3.47913 3.10791 4.10108 3.10791 5.54163C3.10791 4.10108 2.48183 3.47913 1.04541 3.47913Z"
                                         fill="#D6409F"
                                         stroke="#D6409F"
                                         stroke-linejoin="round"
                                       />
                                     </svg>
 
                                     <Text size="1" weight="medium" className="text-pink-500">
                                       {' '}
                                       {t('trainAssist.new')}
                                     </Text>
                                   </div>
                                  )}
                               
                                  {completed ? (
                                    <Badge
                                      color="green"
                                      variant="solid"
                                      size="1"
                                      className="max-h-[24px] rounded-sm shadow-[0px_1px_3px_0px_#19213D1A]"
                                    >
                                      <Text size="1" weight="medium" className="text-white">
                                        {' '}
                                        {t('trainAssist.completed')}
                                      </Text>
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="solid"
                                      size="1"
                                      className="max-h-[24px] rounded-sm bg-[#F7F8FA] shadow-[0px_1px_3px_0px_#19213D1A]"
                                    >
                                      <Text size="1" weight="medium" className="text-[#19213D]">
                                        {' '}
                                        {t('trainAssist.notCompleted')}
                                      </Text>
                                    </Badge>
                                  )}
                                  
                                </Flex>
                              </Flex>
                              <Heading
                                size="3"
                                className="overflow-y-hidden text-[18px] font-medium"
                                style={{
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: 2, // Limits the text to 2 lines
                                }}
                              >
                                {topic.title}
                              </Heading>
                            </Box>
                            <Flex
                              direction="column"
                              gap="2"
                              className="border-t-1 border-coolGrey-100 pt-2"
                            >
                              <Flex align="center" gap="2">
                                <Text size="2" weight="medium">
                                  {completed ? t('trainAssist.completed') : t('trainAssist.notCompleted')}
                                </Text>
                                <Text size="2" color="gray" className="ml-auto">
                                  {completed ? '100%' : '0%'}
                                </Text>
                              </Flex>
                              <Box className="h-2 w-full rounded-full bg-gray-200">
                                <Box
                                  className={`${completed ? 'bg-green-600' : 'bg-iris-9'} h-2 rounded-full`}
                                  style={{ width: completed ? '100%' : '0%' }}
                                ></Box>
                              </Box>
                            </Flex>
                          </Flex>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Box>
            )}
          </Flex>
        </Section>

        {/* Right Side Section - Fixed width */}
        <Section
          className="flex w-[396px] flex-col overflow-y-scroll px-4  pt-5"
          style={{ maxHeight: '100vh', paddingBottom: '20rem' }}
        >
          <Flex className="h-full flex-1" direction="column" gap="6">
            {/* User Profile */}
            <Flex direction="column" gap="3" className="mb-32">
              <Flex gap="4" align="center">
                <Avatar
                  size="7"
                  src="/path-to-profile-image.jpg"
                  fallback={user?.name ? user.name.substring(0, 2).toUpperCase() : 'JD'}
                  radius="full"
                  className="border border-gray-200"
                />
                <Flex direction="column" gap="1">
                  <Heading
                    className="overflow-y-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 1,
                    }}
                    size="5"
                  >
                    {`${user?.name}` || ''}
                  </Heading>
                  {/* <Text size="2" color="gray">Intermediate level</Text> */}
                  <Text size="2" color="gray">
                    💫 {t('trainAssist.modulesLeftToComplete', { count: topics.length - completedTopicsCount })}
                  </Text>
                </Flex>
              </Flex>

              {/* Stats Cards */}
              <Flex gap="3" className="mt-2">
                <Flex className="flex h-[88px] flex-1 flex-col gap-1 rounded-lg bg-[#F5F5F5] p-3 text-center">
                  <Heading size="5">{completedTopicsCount}</Heading>
                  <Text size="2" color="gray">
                    {t('trainAssist.modulesCompleted').split(' ').join(' \n')}
                  </Text>
                </Flex>
                <Flex className="flex h-[88px] flex-1 flex-col gap-1 rounded-lg bg-[#F5F5F5] p-3 text-center">
                  <Heading size="5">{topics.length}</Heading>
                  <Text size="2" color="gray">
                    {t('trainAssist.totalModules').split(' ').join(' \n')}
                  </Text>
                </Flex>
                <Flex className="flex h-[88px] flex-1 flex-col gap-1 rounded-lg bg-[#F5F5F5] p-3 text-center">
                  <Heading size="5">{completionPercentage}%</Heading>
                  <Text size="2" color="gray">
                    {t('trainAssist.completionRate').split(' ').join(' \n')}
                  </Text>
                </Flex>
              </Flex>
              <SimulationRecommendations
                guideIds={topics.map((t) => t.id)}
                onClick={handleTopicClick}
              />
              <Box className="h-96" />
            </Flex>
          </Flex>
        </Section>
      </Flex>
    </div>
  );
}

export default withAuth(TrainAssist2Page);
