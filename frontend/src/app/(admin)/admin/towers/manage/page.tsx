'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Flex,
  Text,
  Button,
  TextField,
  Select,
  IconButton,
} from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import UsersOverviewTable from './UsersOverviewTable';
import { ArrowLeft } from 'lucide-react';
import { isValidEmail } from '@/utils/validationUtils';

interface Collection {
  id: string;
  name: string;
  source: string;
  source_config: any;
  count: number;
}

interface Lead {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  isNewSsoUser?: boolean;
}

interface Tower {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
  updated_at: string;
  collections: {
    id: string;
    name: string;
  }[];
  leads: {
    id: string;
    name: string;
    email: string;
  }[];
}

function ManageTowerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const towerId = searchParams.get('id');
  const isEditing = !!towerId;

  const [towerName, setTowerName] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [towerNameError, setTowerNameError] = useState('');
  const [resolvedSearchQuery, setResolvedSearchQuery] = useState('');
  const searchRequestIdRef = useRef(0);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  // Fetch tower data for editing
  const fetchTowerData = async (id: string) => {
    try {
      setLoading(true);
      const response = await serviceDeskInstance.get(`/service_desk/towers/${id}`);
      if (response.data.success) {
        const towerData = response.data.data;
        setTowerName(towerData.name);

        // Map collections to match the Collection interface
        const mappedCollections = towerData.collections.map((col: any) => ({
          id: col.id,
          name: col.name,
          source: 'manual', // Default values since API doesn't return these
          source_config: {},
          count: 0
        }));
        setSelectedCollections(mappedCollections);

        // Map leads to match the Lead interface
        const mappedLeads = towerData.leads.map((lead: any) => ({
          id: lead.id,
          displayName: lead.name,
          userPrincipalName: lead.email || '',
          mail: lead.email || '',
          givenName: '',
          surname: '',
          jobTitle: '',
          department: '',
          isNewSsoUser: false,
        }));
        setSelectedLeads(mappedLeads);
      }
    } catch (error) {
      console.error('Error fetching tower data:', error);
      toast.error(t('dashboard.failedToFetchTowerData'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch available collections from API
  const fetchCollections = async () => {
    try {
      setCollectionsLoading(true);
      const response = await serviceDeskInstance.get('/knowledgebase/collections');
      if (response.data.success) {
        setAvailableCollections(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error(t('dashboard.failedToFetchKnowledgeCollections'));
    } finally {
      setCollectionsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch available collections when component mounts
    fetchCollections();
  }, []);

  useEffect(() => {
    if (isEditing && towerId) {
      fetchTowerData(towerId);
    } else {
      // For create mode, set default values
      setTowerName('');
      setSelectedCollections([]);
      setSelectedLeads([]);
    }
  }, [isEditing, towerId]);

  const handleRemoveCollection = (collectionId: string) => {
    setSelectedCollections(prev => prev.filter(c => c.id !== collectionId));
  };

  const handleRemoveLead = (leadId: string) => {
    setSelectedLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleAddCollection = (collectionName: string) => {
    const collection = availableCollections.find(c => c.name === collectionName);
    if (collection && !selectedCollections.find(c => c.id === collection.id)) {
      setSelectedCollections(prev => [...prev, collection]);
    }
  };

  // Search users from Entra ID
  const searchUsers = async (query: string, requestId: number) => {
    if (query.length < 2) {
      setSearchResults([]);
      setResolvedSearchQuery('');
      setSearchLoading(false);
      return;
    }

    try {
      const response = await serviceDeskInstance.get(`/service_desk/employee_search?search=${encodeURIComponent(query)}`);

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      setSearchResults(response.data);
      setResolvedSearchQuery(normalizeEmail(query));
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      console.error('Error searching users:', error);
      toast.error(t('dashboard.failedToSearchUsers'));
      setSearchResults([]);
      setResolvedSearchQuery(normalizeEmail(query));
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoading(false);
      }
    }
  };

  const handleAddLead = (lead: Lead) => {
    const normalizedEmail = normalizeEmail(lead.mail || lead.userPrincipalName);
    if (!normalizedEmail) return;

    if (!selectedLeads.find(l => normalizeEmail(l.mail || l.userPrincipalName) === normalizedEmail)) {
      setSelectedLeads(prev => [...prev, {
        ...lead,
        mail: normalizedEmail,
        userPrincipalName: lead.userPrincipalName || normalizedEmail,
      }]);
      setSearchQuery('');
      setShowSearchDropdown(false);
      setSearchResults([]);
    }
  };

  const handleAddManualLead = (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    handleAddLead({
      id: `new:${normalizedEmail}`,
      displayName: normalizedEmail,
      userPrincipalName: normalizedEmail,
      mail: normalizedEmail,
      isNewSsoUser: true,
    });
  };

  // Debounced search
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const requestId = ++searchRequestIdRef.current;

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      setResolvedSearchQuery('');
      return;
    }

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setResolvedSearchQuery('');
      return;
    }

    setSearchResults([]);
    setResolvedSearchQuery('');
    setSearchLoading(true);

    const timeoutId = setTimeout(() => {
      void searchUsers(trimmedQuery, requestId);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Validation function for tower name
  const validateTowerName = (name: string) => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return t('dashboard.towerNameRequired');
    }
    
    if (trimmedName.length > 50) {
      return t('dashboard.towerNameMaxLength');
    }
    
    // Check for special characters (allow only letters, numbers, spaces, hyphens, and underscores)
    const specialCharRegex = /[^a-zA-Z0-9\s\-_]/;
    if (specialCharRegex.test(trimmedName)) {
      return t('dashboard.towerNameInvalidCharacters');
    }
    
    return '';
  };

  const handleTowerNameChange = (value: string) => {
    // Allow spaces while typing, don't trim here
    setTowerName(value);
    
    // Validate with trimmed value for error checking
    const trimmedValue = value.trim();
    const error = validateTowerName(trimmedValue);
    setTowerNameError(error);
  };

  const handleSave = async () => {
    const trimmedTowerName = towerName.trim();
    const validationError = validateTowerName(trimmedTowerName);
    
    if (validationError) {
      setTowerNameError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      setSaving(true);
              const towerData = {
          name: trimmedTowerName,
        collections: selectedCollections.map(col => ({ id: col.id, name: col.name })),
        leads: selectedLeads.map(lead => ({
          id: lead.id,
          name: lead.displayName,
          email: lead.mail,
          userPrincipalName: lead.userPrincipalName,
          displayName: lead.displayName,
          givenName: lead.givenName,
          surname: lead.surname,
          jobTitle: lead.jobTitle,
          department: lead.department
        }))
      };

      if (isEditing && towerId) {
        // Update existing tower
        const response = await serviceDeskInstance.put(`/service_desk/towers/${towerId}`, towerData);
        if (response.data.success) {
          toast.success(t('dashboard.towerUpdatedSuccessfully'));
          router.push('/admin/users/users-overview#tags');
        }
      } else {
        // Create new tower
        const response = await serviceDeskInstance.post('/service_desk/towers', towerData);
        if (response.data.success) {
          toast.success(t('dashboard.towerCreatedSuccessfully'));
          router.push('/admin/users/users-overview#tags');
        }
      }
    } catch (error: any) {
      console.error('Error saving tower:', error);
      let errorMessage = error.response?.data?.detail || t('dashboard.failedToSaveTower');
      if (error.status === 409) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    router.push('/admin/users/users-overview#tags');
  };

  const normalizedSearchQuery = normalizeEmail(searchQuery);
  const filteredSearchResults = searchResults.filter(user => {
    const userEmail = normalizeEmail(user.mail || user.userPrincipalName || '');
    return !selectedLeads.find(lead => normalizeEmail(lead.mail || lead.userPrincipalName) === userEmail);
  });
  const hasExactSearchMatch = searchResults.some(user => {
    const userEmail = normalizeEmail(user.mail || user.userPrincipalName || '');
    return userEmail === normalizedSearchQuery;
  });
  const hasResolvedCurrentSearch = resolvedSearchQuery === normalizedSearchQuery;
  const isResolvingSearchQuery = Boolean(searchQuery.trim()) && searchQuery.trim().length >= 2
    && (searchLoading || !hasResolvedCurrentSearch);
  const canAddManualLead = Boolean(normalizedSearchQuery)
    && isValidEmail(normalizedSearchQuery)
    && hasResolvedCurrentSearch
    && !isResolvingSearchQuery
    && !hasExactSearchMatch
    && !selectedLeads.some(lead => normalizeEmail(lead.mail || lead.userPrincipalName) === normalizedSearchQuery);

  if (loading) {
    return (
      <Box className="p-6">
        <Flex justify="center" align="center" className="h-64">
          <Text>{t('dashboard.loadingTowerData')}</Text>
        </Flex>
      </Box>
    );
  }

  return (
    <div className="h-screen overflow-y-auto">
      <Box className="p-6">
        {/* Header */}
        <Flex align="center" gap="3" className="mb-6">
          <IconButton
            variant="ghost"
            size="2"
            onClick={() => router.back()}
            className='cursor-pointer'
          >
            <ArrowLeft size={18} color='black'/>
          </IconButton>
          <Text size="6" weight="bold">
            {isEditing ? t('dashboard.editTower') : t('admin_panel.createTower')}
          </Text>
        </Flex>

        {/* Tower Name */}
        <Box className="mb-6 max-w-4xl">
          <Text as="label" size="3" weight="medium" className="mb-3 block">
            {t('dashboard.towerName')}
          </Text>
          <TextField.Root
            placeholder={t('dashboard.enterTowerName')}
            value={towerName}
            onChange={(e) => handleTowerNameChange(e.target.value)}
            size="3"
            className="w-full"
            color={towerNameError ? "red" : undefined}
          />
          {!!towerNameError && (
            <Text size="2" color="red" className="mt-1">
              {towerNameError}
            </Text>
          )}
        </Box>

        {/* Assign Knowledge Collections */}
        <Box className="mb-6 max-w-4xl">
          <Text as="label" size="3" weight="medium" className="mb-3 block">
            {t('dashboard.assignKnowledgeCollections')}
          </Text>

          <Select.Root onValueChange={handleAddCollection}>
            <Select.Trigger
              className="w-full mb-3"
              placeholder={collectionsLoading ? t('dashboard.loadingCollections') : t('dashboard.clickToAssignCollections')}
              disabled={collectionsLoading}
            />
            <Select.Content>
              {collectionsLoading ? (
                <Select.Item value="loading" disabled>
                  {t('dashboard.loadingCollections')}
                </Select.Item>
              ) : availableCollections.length === 0 ? (
                <Select.Item value="empty" disabled>
                  {t('dashboard.noCollectionsAvailable')}
                </Select.Item>
              ) : (() => {
                const filteredCollections = availableCollections.filter(c => !selectedCollections.find(sc => sc.id === c.id));
                return filteredCollections.length === 0 ? (
                  <Select.Item value="all-selected" disabled>
                    {t('dashboard.allCollectionsAlreadySelected')}
                  </Select.Item>
                ) : (
                  filteredCollections.map((collection) => (
                    <Select.Item key={collection.id} value={collection.name}>
                      {collection.name} ({collection.count} {t('dashboard.documents')})
                    </Select.Item>
                  ))
                );
              })()
              }
            </Select.Content>
          </Select.Root>

          {/* Selected Collections */}
          {selectedCollections.length > 0 && (
            <Flex gap="2" wrap="wrap">
              {selectedCollections.map((collection) => (
                <Flex
                  key={collection.id}
                  align="center"
                  gap="2"
                  className="bg-[var(--gray-3)] border border-[var(--gray-6)] rounded-full px-3 py-1"
                >
                  <Text size="2">{collection.name}</Text>
                  <IconButton
                    size="1"
                    variant="ghost"
                    onClick={() => handleRemoveCollection(collection.id)}
                  >
                    <Cross2Icon />
                  </IconButton>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>

        {/* Leads Assigned */}
        <Box className="mb-8 max-w-4xl">
          <Text as="label" size="3" weight="medium" className="mb-3 block">
            {t('dashboard.leadsAssigned')}
          </Text>
          <Text size="1" color="gray" className="mb-2 block">
            Search users or enter a work email. If a work email is not found, it will be created when you save this tower.
          </Text>

          {/* Search Input */}
          <Box className="relative mb-3">
            <TextField.Root
              placeholder="Search users or enter work email"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isResolvingSearchQuery) {
                  e.preventDefault();
                  return;
                }

                if (e.key === 'Enter' && canAddManualLead) {
                  e.preventDefault();
                  handleAddManualLead(normalizedSearchQuery);
                }
              }}
              size="3"
              className="w-full"
            />

            {/* Search Results Dropdown */}
            {showSearchDropdown && (
              <Box className="absolute top-full left-0 right-0 bg-white border border-[var(--gray-6)] rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                {searchQuery.length < 2 ? (
                  <Box className="p-3 text-center text-gray-500">
                    <Text size="2">{t('dashboard.typeAtLeastTwoCharactersToSearch')}</Text>
                  </Box>
                ) : isResolvingSearchQuery ? (
                  <Box className="p-3 text-center">
                    <Text size="2">{t('dashboard.searching')}</Text>
                  </Box>
                ) : filteredSearchResults.length === 0 && !canAddManualLead ? (
                  <Box className="p-3 text-center text-gray-500">
                    <Text size="2">{t('dashboard.noUsersFound')}</Text>
                  </Box>
                ) : (
                  <>
                    {filteredSearchResults.map((user) => (
                      <Box
                        key={user.id}
                        className="p-3 hover:bg-[var(--gray-2)] cursor-pointer border-b border-[var(--gray-4)] last:border-b-0"
                        onClick={() => handleAddLead(user)}
                      >
                        <Text size="2" weight="medium">{user.displayName}</Text>
                        <br />
                        <Text size="1" color="gray">{user.mail}</Text>
                        {Boolean(user.jobTitle) && (
                          <>
                            <br />
                            <Text size="1" color="gray">{user.jobTitle}</Text>
                          </>
                        )}
                      </Box>
                    ))}
                    {canAddManualLead && (
                      <Box
                        className="p-3 hover:bg-[var(--blue-2)] cursor-pointer transition-colors"
                        style={{
                          borderTop: filteredSearchResults.length > 0 ? '1px solid var(--gray-4)' : undefined,
                        }}
                        onClick={() => handleAddManualLead(normalizedSearchQuery)}
                      >
                        <Text size="2" weight="medium">{normalizedSearchQuery}</Text>
                        <br />
                        <Text size="1" color="gray">Add this user</Text>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}
          </Box>

          {/* Click outside to close dropdown */}
          {showSearchDropdown && (
            <Box
              className="fixed inset-0 z-5"
              onClick={() => setShowSearchDropdown(false)}
            />
          )}

          {/* Selected Leads */}
          {selectedLeads.length > 0 && (
            <Flex gap="2" wrap="wrap">
              {selectedLeads.map((lead) => (
                <Flex
                  key={lead.id}
                  align="center"
                  gap="2"
                  className="rounded-full px-3 py-1 transition-colors"
                  style={{
                    backgroundColor: lead.isNewSsoUser ? 'transparent' : 'var(--gray-3)',
                    border: `1px solid ${lead.isNewSsoUser ? 'var(--blue-6)' : 'var(--gray-6)'}`,
                  }}
                >
                  <Text size="2">{lead.displayName}</Text>
                  <IconButton
                    size="1"
                    variant="ghost"
                    onClick={() => handleRemoveLead(lead.id)}
                  >
                    <Cross2Icon />
                  </IconButton>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>

              {/* Action Buttons */}
      <Flex gap="3" className="max-w-4xl mb-8">
        <Button onClick={handleSave} size="3" disabled={saving || !!towerNameError}>
          {saving ? t('dashboard.saving') : (isEditing ? t('dashboard.updateTower') : t('dashboard.saveTower'))}
        </Button>
        <Button variant="soft" color="gray" onClick={handleDiscard} size="3" disabled={saving}>
          {t('dashboard.discardChanges')}
        </Button>
      </Flex>
      </Box>
      
      {/* Users Overview Section - Full Width */}
      <Box className="px-6 pb-6">
        <UsersOverviewTable
          towerId={towerId}
          selectedCollections={selectedCollections}
          onRefresh={() => towerId && fetchTowerData(towerId)}
          onRefreshCollections={fetchCollections}
        />
      </Box>
      <ToastContainer />
    </div>
  );
}

export default ManageTowerPage; 
