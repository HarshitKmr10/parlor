// Import React and hooks
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
// Import Radix UI components for layout, table, forms, and UI elements
import {
  Flex,
  Heading,
  Text,
  Table,
  Spinner,
  Button,
  Checkbox,
  Badge,
  TextField,
  Tooltip,
} from '@radix-ui/themes';
// Import context for global state
import { useGlobalContext } from 'contexts/store';
// Import API endpoints
import { API_ENDPOINTS } from 'constants/dashboard';
// Import toast for notifications
import { toast } from 'react-toastify';
// Import axios instance for API calls
import { serviceDeskInstance } from 'api/common/axiosInstance';
// Import API functions for updating and syncing train assist config
import { updateTrainAssistConfig, syncTrainAssistCollections } from 'api/trainAssist';
// Import styles and utilities
import { cellBaseClass, dividerSpan } from './TrainAssistConfig.styles';
// Import moment for date formatting
import moment from 'moment';
// Import TagBadges component for tag display and management
import TagBadges from '../TagBadges';

// Type definitions for collections and tags
export interface CollectionTag {
  id: string;
  name: string;
  description: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any> | null;
  count: number;
  tags: CollectionTag[];
  train_assist_sync_status: string;
  train_assist_last_synced_at: string | null;
  train_assist_sync_started_at: string | null;
  train_assist_sync_error_message: string | null;
  org_id: string;
  created_at: string;
  last_synced_at: string | null;
}

export interface CollectionsWithTagsResponse {
  success: boolean;
  message: string;
  data: CollectionItem[];
  total_count: number | null;
}

function TrainAssistConfig() {
  const { t } = useTranslation();
  // Global context and state
  const { user, organization, setOrganization } = useGlobalContext();
  const [collections, setCollections] = React.useState<CollectionItem[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = React.useState(true);
  const [collectionChecbox, setCollectionCheckbox] = React.useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [passingScore, setPassingScore] = React.useState<number>(70);
  const [numQuestions, setNumQuestions] = React.useState<number>(8);
  const [availableTags, setAvailableTags] = React.useState<CollectionTag[]>([]);


  // Memoized config and initial values (move these up so they're available before use)
  const config = useMemo(() => {
    return organization?.config ? JSON.parse(organization.config) : {};
  }, [organization?.config]);

  const collectionIds = useMemo(
    () => config?.Modules?.train_assist?.features?.collection_ids ?? [],
    [config],
  );
  const initialPassingScore = useMemo(
    () => config?.Modules?.train_assist?.features?.passing_score ?? 70,
    [config],
  );
  const initialNumQuestions = useMemo(
    () => config?.Modules?.train_assist?.features?.num_questions ?? 8,
    [config],
  );

  // Fetch available tags on mount
  React.useEffect(() => {
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

  // Fetch collections with tags (used on mount and after tag update)
  const fetchCollections = useCallback(async () => {
    try {
      setIsLoadingCollections(true);
      const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS_WITH_TAGS);
      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = response.data;
      if (data.success && data.data) {
        setCollections(data.data);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error(t('dashboard.failedToLoadCollectionsPleaseRefresh'));
    } finally {
      setIsLoadingCollections(false);
    }
  }, []);

  // Fetch collections on mount and when user token changes
  useEffect(() => {
    if (user?.access_token) {
      fetchCollections();
    }
  }, [user?.access_token, fetchCollections]);

  // Initialize checkboxes based on current saved config (collectionIds)
  useEffect(() => {
    if (collections.length > 0) {
      const newCheckboxState: Record<string, boolean> = {};
      collections.forEach((collection) => {
        newCheckboxState[collection.id] = collectionIds.includes(collection.id);
      });
      setCollectionCheckbox(newCheckboxState);
    } else {
      setCollectionCheckbox({}); // Clear if no collections
    }
  }, [collections, collectionIds]);

  // Initialize quiz configuration values
  useEffect(() => {
    setPassingScore(initialPassingScore);
    setNumQuestions(initialNumQuestions);
  }, [initialPassingScore, initialNumQuestions]);

  // Toggle all checkboxes
  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setCollectionCheckbox(() => {
        const newCheckbox: Record<string, boolean> = {};
        collections.forEach((collection) => {
          newCheckbox[collection.id] = checked;
        });
        return newCheckbox;
      });
    },
    [collections],
  );

  // Toggle individual collection checkbox
  const handleCollectionCheckbox = useCallback((key: string, checked: boolean) => {
    setCollectionCheckbox((prev) => ({
      ...prev,
      [key]: checked,
    }));
  }, []);

  // Compute initial checkbox state for change detection
  const initialSelectionsBasedOnConfig = useMemo(() => {
    const state: Record<string, boolean> = {};
    if (collections.length > 0) {
      collections.forEach((collection) => {
        state[collection.id] = collectionIds.includes(collection.id);
      });
    }
    return state;
  }, [collections, collectionIds]);

  // Detect if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (collections.length === 0 && Object.keys(collectionChecbox).length === 0) {
      return passingScore !== initialPassingScore || numQuestions !== initialNumQuestions;
    }
    if (
      Object.keys(collectionChecbox).length !==
        Object.keys(initialSelectionsBasedOnConfig).length &&
      collections.length > 0
    ) {
      return true;
    }
    for (const id of Object.keys(initialSelectionsBasedOnConfig)) {
      if (collectionChecbox[id] !== initialSelectionsBasedOnConfig[id]) {
        return true;
      }
    }
    for (const id of Object.keys(collectionChecbox)) {
      if (!(id in initialSelectionsBasedOnConfig) && collectionChecbox[id] === true) {
        return true;
      }
    }
    if (passingScore !== initialPassingScore || numQuestions !== initialNumQuestions) {
      return true;
    }
    return false;
  }, [
    collectionChecbox,
    initialSelectionsBasedOnConfig,
    collections,
    passingScore,
    initialPassingScore,
    numQuestions,
    initialNumQuestions,
  ]);

  // Save handler for quiz config and selected collections
  const handleSave = useCallback(async () => {
    const selectedCollectionIdsForSave = Object.keys(collectionChecbox).filter(
      (key) => collectionChecbox[key],
    );
    if (passingScore < 1 || passingScore > 100) {
      toast.error(t('dashboard.passingScoreMustBeBetween1And100'));
      return;
    }
    if (numQuestions < 1) {
      toast.error(t('dashboard.numberOfQuestionsMustBeAtLeast1'));
      return;
    }
    setIsSaving(true);
    try {
      const response = await updateTrainAssistConfig(
        selectedCollectionIdsForSave,
        passingScore,
        numQuestions,
      );
      if (response.status !== 200) {
        toast.error(t('dashboard.failedToUpdateTrainAssistConfiguration'));
        return;
      }
      toast.success(t('dashboard.trainAssistConfigurationUpdatedSuccessfully'));
      const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
      if (!updatedConfig.Modules) updatedConfig.Modules = {};
      if (!updatedConfig.Modules.train_assist) updatedConfig.Modules.train_assist = {};
      if (!updatedConfig.Modules.train_assist.features)
        updatedConfig.Modules.train_assist.features = {};
      updatedConfig.Modules.train_assist.features.collection_ids = selectedCollectionIdsForSave;
      updatedConfig.Modules.train_assist.features.passing_score = passingScore;
      updatedConfig.Modules.train_assist.features.num_questions = numQuestions;
      if (setOrganization && organization) {
        setOrganization({ ...organization, config: JSON.stringify(updatedConfig) });
      }
      // Refetch collections to get updated sync status from backend
      await fetchCollections();
      // collectionChecbox will be reset by the useEffect watching collectionIds
    } catch (error) {
      console.error('Failed to save Train Assist configuration:', error);
      toast.error(t('dashboard.failedToUpdateTrainAssistConfiguration'));
    } finally {
      setIsSaving(false);
    }
  }, [collectionChecbox, passingScore, numQuestions, config, organization, setOrganization, fetchCollections, t]);

  // Handle toggle collection and save
  const handleToggleCollectionAndSave = useCallback(async (collectionId: string, name: string, isCurrentlyEnabled: boolean) => {
    // First, update the checkbox state
    const newCheckboxState = {
      ...collectionChecbox,
      [collectionId]: !isCurrentlyEnabled
    };
    
    // Update the state
    setCollectionCheckbox(newCheckboxState);
    
    // Calculate the new selected collections based on the updated state
    const selectedCollectionIdsForSave = Object.keys(newCheckboxState).filter(
      (key) => newCheckboxState[key],
    );
    
    
    // Validate inputs
    if (passingScore < 1 || passingScore > 100) {
      toast.error(t('dashboard.passingScoreMustBeBetween1And100'));
      return;
    }
    if (numQuestions < 1) {
      toast.error(t('dashboard.numberOfQuestionsMustBeAtLeast1'));
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await updateTrainAssistConfig(
        selectedCollectionIdsForSave,
        passingScore,
        numQuestions,
      );
      if (response.status !== 200) {
        toast.error(t('dashboard.failedToUpdateTrainAssistConfiguration'));
        return;
      }
      toast.success(t('dashboard.collectionConfigurationUpdatedSuccessfully', { name }));
      const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
      if (!updatedConfig.Modules) updatedConfig.Modules = {};
      if (!updatedConfig.Modules.train_assist) updatedConfig.Modules.train_assist = {};
      if (!updatedConfig.Modules.train_assist.features)
        updatedConfig.Modules.train_assist.features = {};
      updatedConfig.Modules.train_assist.features.collection_ids = selectedCollectionIdsForSave;
      updatedConfig.Modules.train_assist.features.passing_score = passingScore;
      updatedConfig.Modules.train_assist.features.num_questions = numQuestions;
      if (setOrganization && organization) {
        setOrganization({ ...organization, config: JSON.stringify(updatedConfig) });
      }
      // Refetch collections to get updated sync status from backend
      await fetchCollections();
    } catch (error) {
      console.error('Failed to save Train Assist configuration:', error);
      toast.error(t('dashboard.failedToUpdateTrainAssistConfiguration'));
    } finally {
      setIsSaving(false);
    }
  }, [collectionChecbox, passingScore, numQuestions, config, organization, setOrganization, fetchCollections, t]);

  // Sync a single collection handler
  const handleSyncSingleCollection = useCallback(async (collectionId: string) => {
    // Find the collection name for display in toast messages
    const collection = collections.find(c => c.id === collectionId);
    const collectionName = collection?.name || collectionId;
    
    try {
      const response = await serviceDeskInstance.post(
        `/service_desk/train_assist/collections/${collectionId}/sync`,
        { dry_run: false },
      );
      if (response.data?.error) {
        toast.error(t('dashboard.syncFailedForCollection', { name: collectionName }));
      } else {
        fetchCollections();
        toast.success(t('dashboard.syncedCollectionSuccessfully', { name: collectionName }));
      }
    } catch (err) {
      console.error(`Sync failed for ${collectionName}`, err);
      toast.error(t('dashboard.syncFailedPleaseTryAgain'));
    }
  }, [fetchCollections, collections, t]);

  // Add or remove tags for a collection, then refresh collections
  const handleUpdateTags = async (collectionId: string, tagIds: string[]) => {
    try {
      const response = await serviceDeskInstance.post(
        `/knowledgebase/collections/${collectionId}/tags`,
        { tag_ids: tagIds },
      );
      if (response.data.success) {
        // Immediately refresh collections after updating tags
        await fetchCollections();
        toast.success(t('dashboard.tagsUpdatedSuccessfully'));
      } else {
        throw new Error('Failed to update tags');
      }
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error(t('dashboard.failedToUpdateTags'));
    }
  };

  // Create a new tag
  const handleCreateTag = async (name: string): Promise<CollectionTag | null> => {
    try {
      const response = await serviceDeskInstance.post(API_ENDPOINTS.TAGS, { name });
      if (response.data.success) {
        const newTag = response.data.data;
        setAvailableTags((prev) => [newTag, ...prev]);
        toast.success(t('dashboard.tagCreatedSuccessfully'));
        return newTag;
      } else {
        throw new Error('Failed to create tag');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(t('dashboard.failedToCreateTag'));
      return null;
    }
  };

  const collectionCheckAll = useMemo((): boolean | 'indeterminate' => {
    if (collections.length === 0) return false;
    const checkedCount = Object.values(collectionChecbox).filter((val) => val).length;
    return checkedCount === collections.length ? true : checkedCount > 0 ? 'indeterminate' : false;
  }, [collectionChecbox, collections]);

  const numSelectedForSave = useMemo(() => {
    return Object.values(collectionChecbox).filter(Boolean).length;
  }, [collectionChecbox]);

  return (
    <Flex direction="column" px="5" py="4" gap="6" mb="4" className="w-full">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Heading weight="medium">{t('dashboard.trainAssistConfiguration')}</Heading>
          <Text color="gray" size="2">
            {t('dashboard.trainAssistConfigurationDescription')}
          </Text>

          {/* Quiz Configuration Section */}
          <Flex
            direction="column"
            gap="4"
            mt="4"
            p="4"
            style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-2)' }}
          >
            <Heading size="3" weight="medium">
              {t('dashboard.quizSettings')}
            </Heading>
            <Flex gap="4" wrap="wrap">
              <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                <Text size="2" weight="medium">
                  {t('dashboard.passingScorePercent')}
                </Text>
                <TextField.Root
                  value={passingScore.toString()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setPassingScore(Math.max(0, Math.min(100, value)));
                  }}
                  placeholder="80"
                  type="number"
                  min="1"
                  max="100"
                />
                <Text size="1" color="gray">
                  {t('dashboard.minimumPercentageToPassQuiz')}
                </Text>
              </Flex>
              <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                <Text size="2" weight="medium">
                  {t('dashboard.maxNumberOfQuestions')}
                </Text>
                <TextField.Root
                  value={numQuestions.toString()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setNumQuestions(Math.max(1, value));
                  }}
                  placeholder="10"
                  type="number"
                  min="1"
                />
                <Text size="1" color="gray">
                  {t('dashboard.totalQuestionsInEachQuiz')}
                </Text>
              </Flex>
            </Flex>
          </Flex>

          {/* Collections Section */}
          <Flex direction="column" gap="2" mt="4" mb="3" className="h-14">
            <Heading size="4" weight="medium">
              {t('dashboard.collectionsShownInTrainAssist')}
            </Heading>
            <Text weight="regular" size="2" className="text-neutral-l2">
              {t('dashboard.selectCollectionsForTrainingContent')}
            </Text>
          </Flex>

          {isLoadingCollections ? (
            <Flex align="center" justify="center" py="4">
              <Spinner size="2" />
            </Flex>
          ) : (
            <>
              <Table.Root variant="surface" className="w-full rounded-sm">
                <Table.Header>
                  <Table.Row className="h-[36px] px-[9px] py-[2px]">
                    <Table.ColumnHeaderCell className={`w-[2%] ${cellBaseClass} text-center`}>
                      <Checkbox
                        className="cursor-pointer rounded-sm"
                        name="checkAll"
                        checked={collectionCheckAll}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[20%] ${cellBaseClass}`}>
                      {t('dashboard.collectionName')}
                      <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[10%] ${cellBaseClass}`}>
                      {t('dashboard.numberOfDocuments')}
                      <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[20%] ${cellBaseClass}`}>
                      {t('dashboard.tagsAssigned')}
                      <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass}`}>
                      {t('dashboard.status')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass}`}>
                      {t('dashboard.lastSyncOn')}
                      <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>

                    <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass}`}>
                      {t('dashboard.actions')}
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {collections.map((collection) => {
                    const isEnabled = collectionIds.includes(collection.id);
                    return (
                      <Table.Row
                        key={collection.id}
                        className="h-[36px] cursor-pointer hover:bg-gray-100"
                      >
                        <Table.Cell className={`w-[2%] ${cellBaseClass} text-center`}>
                          <Checkbox
                            className="cursor-pointer"
                            checked={collectionChecbox[collection.id] ?? false}
                            onCheckedChange={(checked: boolean) =>
                              handleCollectionCheckbox(collection.id, checked)
                            }
                          />
                          <span className={dividerSpan} />
                        </Table.Cell>

                        <Table.Cell className={`w-[20%] truncate ${cellBaseClass}`}>
                          {collection.name}
                          <span className={dividerSpan} />
                        </Table.Cell>

                        <Table.Cell className={`w-[10%] ${cellBaseClass}`}>
                          {collection.count ?? 0}
                          <span className={dividerSpan} />
                        </Table.Cell>

                        <Table.Cell className={`w-[25%] ${cellBaseClass}`}>
                          <Flex align="center" gap="2">
                            <TagBadges
                              tags={collection.tags}
                              collection={collection}
                              availableTags={availableTags}
                              onUpdateTags={handleUpdateTags}
                              onCreateTag={handleCreateTag}
                            />
                          </Flex>
                          <span className={dividerSpan} />
                        </Table.Cell>

                        <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
                          <Badge variant="soft" color={isEnabled ? 'iris' : 'gray'} radius="medium">
                            {isEnabled ? t('dashboard.enabled') : t('dashboard.disabled')}
                          </Badge>
                          {collection.train_assist_sync_status === 'SYNCING' && (
                            <Badge variant="soft"  radius="medium" style={{ backgroundColor: "#FEE9F5" }} className='ml-2'>
                              <Text size="1" className='text-pink-500'>{t('dashboard.syncing')}</Text>
                            </Badge>
                          )}
                          {collection.train_assist_sync_status === 'FAILED' && (
                            <Badge variant="soft" color="red" radius="medium" className='ml-2'>
                              {t('dashboard.failed')}
                            </Badge>
                          )}
                          <span className={dividerSpan} />
                        </Table.Cell>
                        <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
                          {collection?.last_synced_at
                            ? moment(collection?.last_synced_at).format('D-M-YYYY h:mmA')
                            : '-'}
                          <span className={dividerSpan} />
                        </Table.Cell>

                        <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
                          <Flex gap="2" align="center">
                            {/* Enable/Disable Button */}
                            <Button
                              size="1"
                               variant={isEnabled ? "outline" : "solid"}
                              disabled={isSaving}
                              onClick={() => handleToggleCollectionAndSave(collection.id, collection?.name, isEnabled)}
                              className="h-6 cursor-pointer"
                            >
                              {isEnabled ? t('dashboard.disable') : t('dashboard.enable')}
                            </Button>

                            {/* Sync Button */}
                            {!isEnabled ? (
                              <Tooltip content={t('dashboard.collectionIsNotEnabled')}>
                                <span>
                                  <Button
                                    variant="soft"
                                    size="1"
                                    disabled
                                    className="h-6 cursor-not-allowed"
                                  >
                                    {t('dashboard.sync')}
                                  </Button>
                                </span>
                              </Tooltip>
                            ) : collection.train_assist_sync_status === 'SYNCING' ? (
                              <Tooltip content={t('dashboard.syncingInProcess')}>
                                <span>
                                  <Button
                                    variant="soft"
                                    size="1"
                                    disabled
                                    className="h-6 cursor-not-allowed"
                                  >
                                    {t('dashboard.sync')}
                                  </Button>
                                </span>
                              </Tooltip>
                            ) : (
                              <Button
                                variant="soft"
                                color="iris"
                                size="1"
                                onClick={() => handleSyncSingleCollection(collection.id)}
                                className="h-6 cursor-pointer"
                              >
                                {t('dashboard.sync')}
                              </Button>
                            )}
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>

              {/* Action Bar at the bottom */}
              <Flex
                gap="2"
                mt="6"
                pt="4"
                direction="column"
                style={{
                  borderTop: '1px solid var(--gray-6)',
                  backgroundColor: 'var(--gray-1)',
                  margin: '0 -20px -16px -20px',
                  padding: '16px 20px',
                }}
              >
                <Flex justify="between" align="center">
                  <Flex direction="column" gap="1">
                    {collections.length > 0 && (
                      <Text size="2" color="gray">
                        {t('dashboard.collectionsSelectedSummary', { count: numSelectedForSave, passingScore, numQuestions })}
                      </Text>
                    )}
                    {hasChanges && (
                      <Text size="2" weight="medium" style={{ color: 'var(--orange-11)' }}>
                        {t('dashboard.youHaveUnsavedChanges')}
                      </Text>
                    )}
                  </Flex>
                  <Button
                    variant="solid"
                    size="3"
                    className="cursor-pointer"
                    radius="medium"
                    loading={isSaving}
                    disabled={isSaving || isLoadingCollections || !hasChanges}
                    onClick={handleSave}
                  >
                    {t('dashboard.saveChanges')}
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}

export default TrainAssistConfig;
