import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, Flex, Button, Text, Box, IconButton, Tooltip, Switch,
} from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Upload, Cloud } from 'lucide-react';
import { useGlobalContext } from 'contexts/store';
import useUserRoles from 'hooks/useUserRoles';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { API_ENDPOINTS } from 'constants/dashboard';
import MultiSelectDropdown, { MultiSelectOption } from 'components/common/MultiSelectDropdown';
import { useTranslation } from 'react-i18next';

interface Tower extends MultiSelectOption {
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface RoleDefinition extends MultiSelectOption {
  description?: string;
  is_global?: boolean;
}

interface NewCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (collectionName: string, selectedTowerIds: string[], source: string, config: any, selectedRoleIds: string[], collectionId?: string) => Promise<boolean>;
  initialData?: any; // For edit mode
}

interface ErrorResponse {
  success: boolean;
  message: string;
  data: null;
}

const NewCollectionModal = ({ isOpen, onClose, onSubmit, initialData }: NewCollectionModalProps) => {
  const { t } = useTranslation();
  const [collectionName, setCollectionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTowerIds, setSelectedTowerIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>([]);
  const [isLoadingTowers, setIsLoadingTowers] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [source, setSource] = useState<'azure_blob' | 'service_now'>('azure_blob');
  const [snMode, setSnMode] = useState<'kb' | 'query'>('kb');
  const [kbNames, setKbNames] = useState('');
  const [queryFilter, setQueryFilter] = useState('');
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [isCheckingCount, setIsCheckingCount] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enableImageProcessing, setEnableImageProcessing] = useState(false);
  const { user } = useGlobalContext();
  const roles = useUserRoles();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form from initialData when editing
  useEffect(() => {
    if (isOpen && initialData) {
      setCollectionName(initialData.name || '');
      setSelectedTowerIds(initialData.tags?.map((t: any) => t.id) || []);
      setSelectedRoleIds(initialData.allowedRoles?.map((r: any) => r.id || r) || []);
      setSource(initialData.source || 'azure_blob');

      // Parse source_config if present
      if (initialData.source_config) {
        const config = typeof initialData.source_config === 'string'
          ? JSON.parse(initialData.source_config)
          : initialData.source_config;

        // Set image processing toggle from config (works for all source types)
        setEnableImageProcessing(config.enable_image_processing === true);

        // Parse ServiceNow-specific config
        if (initialData.source === 'service_now') {
          if (config.query_filter) {
            setSnMode('query');
            setQueryFilter(config.query_filter);
            setKbNames('');
          } else if (config.connect_kbs && config.connect_kbs.length > 0) {
            setSnMode('kb');
            setKbNames(config.connect_kbs.join(', '));
            setQueryFilter('');
          }
        }
      } else {
        setEnableImageProcessing(false);
      }
    } else if (isOpen) {
      // Reset to defaults
      setCollectionName('');
      setSelectedTowerIds([]);
      setSelectedRoleIds([]);
      setSource('azure_blob');
      setSnMode('kb');
      setKbNames('');
      setQueryFilter('');
      setArticleCount(null);
      setCountError(null);
      setError(null);
      setEnableImageProcessing(false);
    }
  }, [isOpen, initialData]);

  // Fetch towers and roles when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTowers();
      fetchRoles();
    }
  }, [isOpen]);


  const checkArticleCount = useCallback(async () => {
    // Don't reset state here - let focus handler do that
    setIsCheckingCount(true);
    setCountError(null);

    try {
      let config = {};
      if (snMode === 'kb') {
        if (!kbNames.trim()) {
          setCountError(t('admin_panel.pleaseEnterAtLeastOneKB'));
          setIsCheckingCount(false);
          return;
        }
        const kbArray = kbNames.split(',').map(kb => kb.trim()).filter(kb => kb);
        config = { connect_kbs: kbArray };
      } else {
        const query = queryFilter.trim();
        if (!query) {
          setCountError(t('admin_panel.pleaseEnterQueryFilter'));
          setIsCheckingCount(false);
          return;
        }
        config = { connect_kbs: [], query_filter: query };
      }

      const payload = {
        org_id: user?.org_id,
        source_config: config
      };

      const response = await serviceDeskInstance.post('/servicenow/get_article_count', payload);

      if (response.data.success) {
        setArticleCount(response.data.count);
        setCountError(null);
      } else {
        setCountError(response.data.message || t('admin_panel.failedToFetchTowers'));
        setArticleCount(null);
      }
    } catch (err: any) {
      console.error('Error checking article count:', err);
      setCountError(err.response?.data?.detail || t('admin_panel.failedToFetchTowers'));
      setArticleCount(null);
    } finally {
      setIsCheckingCount(false);
    }
  }, [snMode, kbNames, queryFilter, user?.org_id, t]);

  // Debounce checkArticleCount for kbNames (3 seconds after typing stops)
  useEffect(() => {
    if (source !== 'service_now' || snMode !== 'kb') return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only check if there's a value
    if (kbNames.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        checkArticleCount();
      }, 3000);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [kbNames, source, snMode, checkArticleCount]);

  // Debounce checkArticleCount for queryFilter (3 seconds after typing stops)
  useEffect(() => {
    if (source !== 'service_now' || snMode !== 'query') return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only check if there's a value
    if (queryFilter.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        checkArticleCount();
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [queryFilter, source, snMode, checkArticleCount]);

  // Reset article count state when source changes away from service_now
  useEffect(() => {
    if (source !== 'service_now') {
      // Clear any pending timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Reset count state when source is not service_now
      setArticleCount(null);
      setCountError(null);
      setIsCheckingCount(false);
    }
  }, [source]);

  const fetchTowers = async () => {
    setIsLoadingTowers(true);
    try {
      const response = await serviceDeskInstance.get(API_ENDPOINTS.TAGS);
      if (response.data.success) {
        setTowers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching towers:', error);
    } finally {
      setIsLoadingTowers(false);
    }
  };

  const fetchRoles = async () => {
    setIsLoadingRoles(true);
    try {
      const response = await serviceDeskInstance.get('/service_desk/role_definitions');
      if (response.data.success) {
        setAvailableRoles(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleKbNamesFocus = () => {
    // Reset to initial state when focusing
    setArticleCount(null);
    setCountError(null);
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const handleKbNamesBlur = () => {
    // Trigger check immediately on blur if there's a value
    if (kbNames.trim()) {
      checkArticleCount();
    }
  };

  const handleQueryFilterFocus = () => {
    // Reset to initial state when focusing
    setArticleCount(null);
    setCountError(null);
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const handleQueryFilterBlur = () => {
    // Trigger check immediately on blur if there's a value
    if (queryFilter.trim()) {
      checkArticleCount();
    }
  };

  const handleModeChange = (mode: 'kb' | 'query') => {
    // Clear any pending timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // Reset count state immediately
    setArticleCount(null);
    setCountError(null);
    setIsCheckingCount(false);
    // Set the new mode
    setSnMode(mode);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!collectionName.trim()) {
      setError(t('admin_panel.pleaseEnterCollectionName'));
      return;
    }

    // Validate tower selection for tag leads
    if (!roles.platform_admin && roles.is_tag_lead) {
      if (selectedTowerIds.length === 0) {
        setError(t('admin_panel.pleaseSelectAtLeastOneTower'));
        return;
      }
    }

    // Build config based on source
    // Always include enable_image_processing if enabled (for all source types)
    let config: Record<string, any> = {};

    // Add image processing config if enabled
    if (enableImageProcessing) {
      config.enable_image_processing = true;
    }

    if (source === 'service_now') {
      if (snMode === 'kb') {
        if (!kbNames.trim()) {
          setError(t('admin_panel.pleaseEnterAtLeastOneKB'));
          return;
        }
        const kbArray = kbNames.split(',').map(kb => kb.trim()).filter(kb => kb);
        if (kbArray.length === 0) {
          setError(t('admin_panel.pleaseEnterValidKB'));
          return;
        }
        // Backend expects connect_kbs to always be present
        config = { ...config, connect_kbs: kbArray };
      } else {
        // query mode
        const query = queryFilter.trim();
        if (!query) {
          setError(t('admin_panel.pleaseEnterQueryFilter'));
          return;
        }

        // Validation for common mistakes
        if (query.startsWith('http://') || query.startsWith('https://')) {
          setError(t('admin_panel.pleasePasteOnlyEncodedQuery'));
          return;
        }

        if (query.includes('sysparm_query=')) {
          setError(t('admin_panel.pleaseRemoveSysparmQuery'));
          return;
        }

        // Validate that the query contains at least one valid operator
        const validOperators = /(=|!=|LIKE|NOT LIKE|STARTSWITH|ENDSWITH|IN|NOT IN|ISEMPTY|ISNOTEMPTY|BETWEEN|SAMEAS|NSAMEAS|GT|LT|GE|LE|INSTANCEOF|DYNAMIC|ANYTHING|EMPTYSTRING)/;
        if (!validOperators.test(query)) {
          setError(t('admin_panel.invalidQueryFormat'));
          return;
        }

        // Backend expects connect_kbs to always be present (empty array for query mode)
        config = { ...config, connect_kbs: [], query_filter: query };
      }
    }

    setIsLoading(true);
    const collectionId = initialData?.id;
    const success = await onSubmit(collectionName.trim(), selectedTowerIds, source, config, selectedRoleIds, collectionId);
    if (success) {
      setCollectionName('');
      setSelectedTowerIds([]);
      setSelectedRoleIds([]);
      setSource('azure_blob');
      setSnMode('kb');
      setKbNames('');
      setQueryFilter('');
      setError(null);
      onClose();
    }
    setIsLoading(false);
  };

  const handleClose = () => {
    setCollectionName('');
    setSelectedTowerIds([]);
    setSelectedRoleIds([]);
    setIsLoading(false);
    setSource('azure_blob');
    setSnMode('kb');
    setKbNames('');
    setQueryFilter('');
    setError(null);
    setEnableImageProcessing(false);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Content style={{ maxWidth: 500, overflow: 'visible' }}>
        <Dialog.Title>{initialData ? t('admin_panel.editCollection') : t('admin_panel.createNewCollection')}</Dialog.Title>

        <Flex direction="column" gap="3" className="my-4" style={{ overflow: 'visible' }}>
          <Box>
            <Text as="label" size="2" weight="medium" className="mb-2 block">
              {t('admin_panel.collectionName')}
            </Text>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--gray-6)]
                text-sm focus:outline-none focus:ring-2 focus:ring-[var(--violet-8)]
                focus:border-transparent"
              placeholder={t('admin_panel.enterCollectionName')}
            />
          </Box>

           {/* Tower Selection */}
           <Box>
            <MultiSelectDropdown
              options={towers}
              selectedIds={selectedTowerIds}
              onSelectionChange={setSelectedTowerIds}
              placeholder={t('admin_panel.selectTowers')}
              searchPlaceholder={t('admin_panel.searchTowers')}
              label={`${t('admin_panel.towers')} ${(!roles.platform_admin && roles.is_tag_lead) ? '*' : ''}`}
              disabled={false}
              isLoading={isLoadingTowers}
              emptyMessage={t('admin_panel.noTowersAvailable')}
              noResultsMessage={t('admin_panel.noTowersFoundSearch')}
              showSelectedCount={true}
            />
            {(!roles.platform_admin && roles.is_tag_lead) && (
              <Text size="1" color="gray" className="mt-1">
                {t('admin_panel.asTagLeadMustSelectTower')}
              </Text>
            )}
          </Box>


          {/* Source Selection */}
          <Box>
            <Text as="label" size="2" weight="medium" className="mb-3 block">
              {t('admin_panel.sourceType')}
            </Text>
            <Flex gap="3" wrap="wrap">
              {/* Manual Upload Card */}
              <button
                type="button"
                onClick={() => !initialData && setSource('azure_blob')}
                disabled={Boolean(initialData)}
                className={`flex-1 min-w-[200px] p-4 rounded-lg border-2 transition-all cursor-pointer
                  ${source === 'azure_blob' 
                    ? 'border-[var(--violet-8)] bg-[var(--violet-3)]' 
                    : 'border-[var(--gray-6)] bg-white hover:border-[var(--gray-8)]'
                  }
                  ${initialData ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Flex direction="column" gap="2" align="start">
                  <Flex align="center" gap="3">
                    <div className={`p-2 rounded-md ${
                      source === 'azure_blob' 
                        ? 'bg-[var(--violet-9)] text-white' 
                        : 'bg-[var(--gray-4)] text-[var(--gray-11)]'
                    }`}>
                      <Upload size={20} />
                    </div>
                    <Text 
                      size="3" 
                      weight="medium"
                      className={source === 'azure_blob' ? 'text-[var(--violet-11)]' : 'text-[var(--gray-12)]'}
                    >
                      {t('admin_panel.manualUpload')}
                    </Text>
                  </Flex>
                  <Text size="1" color="gray" className="text-left">
                    {t('admin_panel.uploadFilesDirectly')}
                  </Text>
                </Flex>
              </button>

              {/* ServiceNow Card */}
              <button
                type="button"
                onClick={() => !initialData && setSource('service_now')}
                disabled={Boolean(initialData)}
                className={`flex-1 min-w-[200px] p-4 rounded-lg border-2 transition-all cursor-pointer
                  ${source === 'service_now' 
                    ? 'border-[var(--violet-8)] bg-[var(--violet-3)]' 
                    : 'border-[var(--gray-6)] bg-white hover:border-[var(--gray-8)]'
                  }
                  ${initialData ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Flex direction="column" gap="2" align="start">
                  <Flex align="center" gap="3">
                    <div className={`p-2 rounded-md ${
                      source === 'service_now' 
                        ? 'bg-[var(--violet-9)] text-white' 
                        : 'bg-[var(--gray-4)] text-[var(--gray-11)]'
                    }`}>
                      <Cloud size={20} />
                    </div>
                    <Text 
                      size="3" 
                      weight="medium"
                      className={source === 'service_now' ? 'text-[var(--violet-11)]' : 'text-[var(--gray-12)]'}
                    >
                      {t('admin_panel.servicenow')}
                    </Text>
                  </Flex>
                  <Text size="1" color="gray" className="text-left">
                    {t('admin_panel.importFromServicenow')}
                  </Text>
                </Flex>
              </button>
            </Flex>
            {initialData && (
              <Text size="1" color="gray" className="mt-2">
                {t('admin_panel.sourceCannotBeChanged')}
              </Text>
            )}
          </Box>

          {/* Image Processing Toggle - Available for all source types */}
          <Box className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <Flex align="center" justify="between">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  {t('admin_panel.enableImageProcessing', 'Enable Image Processing')}
                </Text>
                <Text size="1" color="gray">
                  {t('admin_panel.enableImageProcessingDescription', 'Extract and index images from documents using AI vision')}
                </Text>
              </Flex>
              <Switch
                checked={enableImageProcessing}
                onCheckedChange={setEnableImageProcessing}
              />
            </Flex>
          </Box>

          {/* ServiceNow Configuration */}
          {source === 'service_now' && (
            <>
              <Box>
                <Text as="label" size="2" weight="medium" className="mb-2 block">
                  {t('admin_panel.servicenowMode')}
                </Text>
                <Flex gap="4" align="center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="kb"
                      checked={snMode === 'kb'}
                      onChange={() => handleModeChange('kb')}
                      className="cursor-pointer"
                    />
                    <Text size="2">{t('admin_panel.knowledgeBases')}</Text>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="query"
                      checked={snMode === 'query'}
                      onChange={() => handleModeChange('query')}
                      className="cursor-pointer"
                    />
                    <Text size="2">{t('admin_panel.customQuery')}</Text>
                  </label>
                </Flex>
              </Box>

              {snMode === 'kb' ? (
                <Box>
                  <Text as="label" size="2" weight="medium" className="mb-2 block">
                    {t('admin_panel.knowledgeBaseNames')}
                  </Text>
                  <div className="relative w-full">
                      <input
                        type="text"
                        value={kbNames}
                        onChange={(e) => setKbNames(e.target.value)}
                      onFocus={handleKbNamesFocus}
                      onBlur={handleKbNamesBlur}
                      className="w-full px-3 py-2 pr-9 rounded-md border border-[var(--gray-6)]
                            text-sm focus:outline-none focus:ring-2 focus:ring-[var(--violet-8)]
                            focus:border-transparent"
                        placeholder={t('admin_panel.enterKBNames')}
                      />
                    {isCheckingCount && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ReloadIcon className="animate-spin w-4 h-4 text-gray-500" />
                      </div>
                    )}
                  </div>
                      <Text size="1" color="gray" className="mt-1 block">
                        {t('admin_panel.enterCommaSeparatedKB')}
                  </Text>
                  
                  {/* Article Count Result */}
                  {articleCount !== null && (
                    <Box className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                      <CheckCircledIcon className="text-green-600 w-5 h-5" />
                      <Text size="2" color="green" weight="medium">
                        {t('admin_panel.foundArticlesMatching', { count: articleCount })}
                      </Text>
                    </Box>
                  )}

                  {/* Count Error */}
                  {!!countError && (
                    <Box className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                      <CrossCircledIcon className="text-red-600 w-5 h-5" />
                      <Text size="2" color="red" weight="medium">
                        {countError}
                      </Text>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <Flex align="center" gap="2" className="mb-2">
                    <Text as="label" size="2" weight="medium">
                      {t('admin_panel.queryFilter')}
                    </Text>
                    <Tooltip content={t('admin_panel.pasteEncodedQueryString')}>
                      <InfoCircledIcon className="cursor-pointer text-gray-500" />
                    </Tooltip>
                  </Flex>
                  <div className="relative w-full">
                    <textarea
                      value={queryFilter}
                      onChange={(e) => setQueryFilter(e.target.value)}
                      onFocus={handleQueryFilterFocus}
                      onBlur={handleQueryFilterBlur}
                      className="w-full px-3 py-2 pr-9 rounded-md border border-[var(--gray-6)]
                        text-sm focus:outline-none focus:ring-2 focus:ring-[var(--violet-8)]
                        focus:border-transparent min-h-[80px]"
                      placeholder={t('admin_panel.queryPlaceholder')}
                    />
                    {isCheckingCount && (
                      <div className="absolute right-3 top-3 pointer-events-none">
                        <ReloadIcon className="animate-spin w-4 h-4 text-gray-500" />
                      </div>
                    )}
                  </div>

              {/* Article Count Result */}
              {articleCount !== null && (
                    <Box className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                  <CheckCircledIcon className="text-green-600 w-5 h-5" />
                  <Text size="2" color="green" weight="medium">
                    {t('admin_panel.foundArticlesMatching', { count: articleCount })}
                  </Text>
                </Box>
              )}

              {/* Count Error */}
              {!!countError && (
                    <Box className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                  <CrossCircledIcon className="text-red-600 w-5 h-5" />
                  <Text size="2" color="red" weight="medium">
                    {countError}
                  </Text>
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}

          {/* Error Message */}
          {!!error && (
            <Box className="p-3 bg-red-50 border border-red-200 rounded-md">
              <Text size="2" color="red">
                {error}
              </Text>
            </Box>
          )}
        </Flex>

        <Flex gap="3" justify="end">
          <Button variant="soft" color="gray" onClick={handleClose} disabled={isLoading} className="cursor-pointer">
            {t('admin_panel.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!collectionName.trim() || isLoading} className="cursor-pointer">
            {isLoading
              ? (initialData ? t('admin_panel.updating') : t('admin_panel.creating'))
              : (initialData ? t('admin_panel.updateCollection') : t('admin_panel.createCollection'))
            }
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root >
  );
};

export default NewCollectionModal;
