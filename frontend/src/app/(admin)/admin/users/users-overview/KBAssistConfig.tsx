import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Flex, Heading, Text, Button, Table, Spinner, Checkbox, Switch,
} from '@radix-ui/themes';
import {
  DownloadIcon, UploadIcon, TrashIcon,
} from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';
import TemplateMarkDownText from 'components/TemplateMarkDownText/TemplateMarkDownText';
import { API_ENDPOINTS } from 'constants/dashboard';
import MultiSelectDropdown, { MultiSelectOption } from 'components/common/MultiSelectDropdown';

interface TemplateResponse {
  success: boolean;
  message: string;
  data: {
    access_url: string;
  };
}

interface KnowledgebaseTemplate {
  id: number;
  org_id: string;
  name: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

interface TemplatesResponse {
  status: string;
  data: KnowledgebaseTemplate[];
}

// Update the UploadHistory interface
interface UploadHistory {
  id: string;
  name: string;
  size: string;
  date: string;
  url: string;
}

interface KBCollection {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any>;
  count?: number;
}

interface RoleDefinition extends MultiSelectOption {
  description?: string;
  is_global?: boolean;
}

const sourceDisplayNames: Record<string, string> = {
  s3: 'Manual Upload',
  azure_blob: 'Manual Upload',
  service_now: 'ServiceNow',
  sharepoint: 'SharePoint',
  public_service_now: 'Public ServiceNow',
};

function KBAssistConfig() {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLogs, setUploadLogs] = useState<UploadHistory[]>([]);
  const [templates, setTemplates] = useState<KnowledgebaseTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [kbCollections, setKbCollections] = useState<KBCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [isSavingCollections, setIsSavingCollections] = useState(false);
  const [collectionCheckbox, setCollectionCheckbox] = useState<Record<string, boolean>>({});
  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [collectionRoleAccess, setCollectionRoleAccess] = useState<Record<string, string[]>>({});
  const [initialCollectionRoleAccess, setInitialCollectionRoleAccess] = useState<Record<string, string[]>>({});
  const [enabledCollectionIds, setEnabledCollectionIds] = useState<string[] | null>(null);
  const [initialEnabledCollectionIds, setInitialEnabledCollectionIds] = useState<string[] | null>(null);
  const [isLoadingEnabledCollections, setIsLoadingEnabledCollections] = useState(false);
  const [isCollectionFilteringEnabled, setIsCollectionFilteringEnabled] = useState(false);
  const [initialCollectionFilteringEnabled, setInitialCollectionFilteringEnabled] = useState(false);
  const [ticketFeatureRoleIds, setTicketFeatureRoleIds] = useState<string[]>([]);
  const [initialTicketFeatureRoleIds, setInitialTicketFeatureRoleIds] = useState<string[]>([]);
  const [isLoadingTicketFeatureRoles, setIsLoadingTicketFeatureRoles] = useState(false);

  // Add useEffect to fetch upload history and templates when component mounts
  useEffect(() => {
    fetchUploadHistory();
    fetchTemplates();
    fetchCollections();
    fetchRoles();
    fetchCollectionRoleAccess();
    fetchEnabledCollections();
    fetchTicketFeatureRoles();
  }, []);

  const fetchEnabledCollections = async () => {
    setIsLoadingEnabledCollections(true);
    try {
      const response = await serviceDeskInstance.get('/service_desk/knowledge_assist_collections');
      if (response.data.success) {
        const data = response.data.data;
        // null means feature not configured (opt-in not enabled)
        // array means feature is configured (opt-in enabled)
        const isEnabled = data !== null;
        setIsCollectionFilteringEnabled(isEnabled);
        setInitialCollectionFilteringEnabled(isEnabled);
        setEnabledCollectionIds(data);
        setInitialEnabledCollectionIds(data);
      }
    } catch (error) {
      console.error('Error fetching enabled collections:', error);
    } finally {
      setIsLoadingEnabledCollections(false);
    }
  };

  const fetchCollections = async () => {
    setIsLoadingCollections(true);
    try {
      const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS);
      if (response.status !== 200) {
        throw new Error('Failed to fetch collections');
      }
      const data = response.data;
      if (data.success && data.data) {
        setKbCollections(data.data);
      } else {
        setKbCollections([]);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error(t('dashboard.failedToLoadCollectionsPleaseRefresh'));
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const fetchTicketFeatureRoles = async () => {
    setIsLoadingTicketFeatureRoles(true);
    try {
      const response = await serviceDeskInstance.get('/service_desk/knowledge_assist_ticket_feature_roles');
      if (response.data.success) {
        const roles = Array.isArray(response.data.data) ? response.data.data : [];
        setTicketFeatureRoleIds(roles);
        setInitialTicketFeatureRoleIds(roles);
      }
    } catch (error) {
      console.error('Error fetching knowledge assist ticket feature roles:', error);
    } finally {
      setIsLoadingTicketFeatureRoles(false);
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

  const fetchCollectionRoleAccess = async () => {
    try {
      const response = await serviceDeskInstance.get('/service_desk/collection_role_access');
      if (response.data.success) {
        setCollectionRoleAccess(response.data.data);
        setInitialCollectionRoleAccess(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching collection role access:', error);
    }
  };

  // Initialize checkboxes based on enabled collections from API
  useEffect(() => {
    if (kbCollections.length > 0) {
      const newCheckboxState: Record<string, boolean> = {};
      kbCollections.forEach((collection) => {
        if (!isCollectionFilteringEnabled) {
          // Filtering disabled: all collections are checked
          newCheckboxState[collection.id] = true;
        } else if (enabledCollectionIds === null) {
          // First time enabling filtering: start with all collections selected
          newCheckboxState[collection.id] = true;
        } else {
          // Filtering enabled with saved config: use the saved collection IDs
          newCheckboxState[collection.id] = enabledCollectionIds.includes(collection.id);
        }
      });
      setCollectionCheckbox(newCheckboxState);
    } else {
      setCollectionCheckbox({});
    }
  }, [kbCollections, enabledCollectionIds, isCollectionFilteringEnabled]);

  const selectedCollectionIds = useMemo(() => {
    return Object.entries(collectionCheckbox)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
  }, [collectionCheckbox]);

  const hasCollectionChanges = useMemo(() => {
    // Check if the opt-in toggle changed
    if (isCollectionFilteringEnabled !== initialCollectionFilteringEnabled) return true;

    // If filtering is not enabled, no changes to save
    if (!isCollectionFilteringEnabled) return false;

    // Compare selected collections
    const a = [...selectedCollectionIds].sort();
    const b = [...(initialEnabledCollectionIds || [])].sort();
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  }, [selectedCollectionIds, initialEnabledCollectionIds, isCollectionFilteringEnabled, initialCollectionFilteringEnabled]);

  const toggleSelectAll = useCallback((checked: boolean) => {
    setCollectionCheckbox(() => {
      const newCheckbox: Record<string, boolean> = {};
      kbCollections.forEach((collection) => {
        newCheckbox[collection.id] = checked;
      });
      return newCheckbox;
    });
  }, [kbCollections]);

  const handleCollectionCheckbox = useCallback((id: string, checked: boolean) => {
    setCollectionCheckbox((prev) => ({
      ...prev,
      [id]: checked,
    }));
  }, []);

  const handleCollectionRoleChange = useCallback((collectionId: string, roleIds: string[]) => {
    setCollectionRoleAccess((prev) => ({
      ...prev,
      [collectionId]: roleIds,
    }));
  }, []);

  const hasRoleAccessChanges = useMemo(() => {
    const currentKeys = Object.keys(collectionRoleAccess);
    const initialKeys = Object.keys(initialCollectionRoleAccess);
    if (currentKeys.length !== initialKeys.length) return true;
    for (const key of currentKeys) {
      const current = [...(collectionRoleAccess[key] || [])].sort();
      const initial = [...(initialCollectionRoleAccess[key] || [])].sort();
      if (current.length !== initial.length) return true;
      for (let i = 0; i < current.length; i++) {
        if (current[i] !== initial[i]) return true;
      }
    }
    return false;
  }, [collectionRoleAccess, initialCollectionRoleAccess]);

  const hasTicketFeatureRoleChanges = useMemo(() => {
    const a = [...(ticketFeatureRoleIds || [])].sort();
    const b = [...(initialTicketFeatureRoleIds || [])].sort();
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  }, [ticketFeatureRoleIds, initialTicketFeatureRoleIds]);

  const handleSaveCollections = async () => {
    try {
      setIsSavingCollections(true);

      // Save enabled collection IDs via API
      if (hasCollectionChanges) {
        // If collection filtering is disabled, pass null to remove the config
        // If enabled, pass the selected collection IDs
        const collectionIdsToSave = isCollectionFilteringEnabled ? selectedCollectionIds : null;
        await serviceDeskInstance.post('/service_desk/knowledge_assist_collections', {
          collection_ids: collectionIdsToSave,
        });
        setEnabledCollectionIds(collectionIdsToSave);
        setInitialEnabledCollectionIds(collectionIdsToSave);
        setInitialCollectionFilteringEnabled(isCollectionFilteringEnabled);
      }

      // Save role access to backend via API
      if (hasRoleAccessChanges) {
        await serviceDeskInstance.post('/service_desk/collection_role_access', {
          collection_role_access: collectionRoleAccess,
        });
        setInitialCollectionRoleAccess({ ...collectionRoleAccess });
      }

      if (hasTicketFeatureRoleChanges) {
        await serviceDeskInstance.post('/service_desk/knowledge_assist_ticket_feature_roles', {
          role_names: ticketFeatureRoleIds,
        });
        setInitialTicketFeatureRoleIds([...(ticketFeatureRoleIds || [])]);
      }

      toast.success(
        t('dashboard.knowledgeAssistSettingsSaved', {
          defaultValue: 'Knowledge Assist settings saved.',
        }),
      );
    } catch (error) {
      console.error('Error saving knowledge assist settings:', error);
      toast.error(t('dashboard.failedToSaveConfiguration'));
    } finally {
      setIsSavingCollections(false);
    }
  };



  const fetchUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await serviceDeskInstance.get('/service_desk/ticket_upload_history');

      if (response.status !== 200) {
        throw new Error('Failed to fetch upload history');
      }
      setUploadLogs(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching upload history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await serviceDeskInstance.get<TemplatesResponse>('/service_desk/knowledgebase_templates/full');
      
      if (response.status === 200 && response.data.status === 'success') {
        setTemplates(response.data.data);
        // Select the first template by default if available
        if (response.data.data.length > 0) {
          setSelectedTemplateId(response.data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(t('knowledge_assist.failedToLoadTemplates'));
    } finally {
      setIsLoadingTemplates(false);
    }
  };



  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await serviceDeskInstance.post('service_desk/upload_ticket_dump_csv', formData);
      toast.success(t('knowledge_assist.uploadSuccessful'));
      await fetchUploadHistory();
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.message);
      } else {
        toast.error(t('knowledge_assist.errorUploadingFile'));
      }
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    // Optionally, set the file name (if available)
    anchor.download = url.split('/').pop() || 'download';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDelete = useCallback(async (logId: string) => {
    setDeletingLogId(logId);
    try {
      const response = await serviceDeskInstance.delete(`/service_desk/delete_ticket_dump_csv/${logId}`);
      
      if (response.status === 200) {
        toast.success(t('knowledge_assist.fileDeletedSuccessfully'));
        await fetchUploadHistory();
      } else {
        throw new Error(t('knowledge_assist.failedToDeleteFile'));
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.response?.data?.message || t('knowledge_assist.failedToDeleteFile'));
    } finally {
      setDeletingLogId(null);
    }
  }, []);

  const generateSampleCsvData = () => {
    const headers = [
      'Number',
      'Short description',
      'Category',
      'Priority',
      'Assignment group',
      'Long description',
      'Close notes',
      'Subcategory',
      'Configuration item',
      'Class',
      'Opened',
      'Resolved',
      'Closed'
    ];

    const sampleRows = [
      {
        number: 'INC2535701',
        shortDescription: 'User unable to reset password via self-service portal',
        category: 'Password Reset',
        priority: '3 - Medium',
        assignmentGroup: 'Help Desk Support',
        longDescription: 'User reported being unable to reset their password through the self-service portal. Error message appears when attempting to submit new password.',
        closeNotes: 'Password reset functionality was restored after clearing browser cache and updating user permissions.',
        subcategory: 'User Assistance',
        configItem: 'Self-Service Portal',
        class: 'Incident',
        opened: '2024-01-15 08:15:00',
        resolved: '2024-01-15 09:00:00',
        closed: '2024-01-15 09:30:00'
      },
      {
        number: 'INC2535702',
        shortDescription: 'Network connectivity issues in Building A',
        category: 'Network',
        priority: '2 - High',
        assignmentGroup: 'Network Support',
        longDescription: 'Multiple users in Building A reported intermittent network connectivity issues affecting access to internal applications and internet services.',
        closeNotes: 'Network switch in Building A was replaced due to hardware failure. All services restored.',
        subcategory: 'Connectivity',
        configItem: 'Network Switch',
        class: 'Infrastructure',
        opened: '2024-01-16 10:30:00',
        resolved: '2024-01-16 11:45:00',
        closed: '2024-01-16 12:00:00'
      }
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        ).join(',')
      )
    ].join('\n');

    return csvContent;
  };

  const downloadSampleCsv = () => {
    const csvContent = generateSampleCsvData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ticket_upload_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="px-5 py-6 space-y-8">
      {/* Collections Section */}
      <section>
        <div>
          <Heading weight="medium">
            {t('dashboard.collectionsShownInKnowledgeAssist', {
              defaultValue: 'Collections Shown in Knowledge Assist',
            })}
          </Heading>
          <Text color="gray" className="mt-1">
            {t('dashboard.selectCollectionsForKnowledgeAssist', {
              defaultValue: 'Select collections to be used by Knowledge Assist.',
            })}
          </Text>
        </div>

        {/* Opt-in toggle for collection filtering */}
        <Flex align="center" gap="3" className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <Switch
            checked={isCollectionFilteringEnabled}
            onCheckedChange={setIsCollectionFilteringEnabled}
            disabled={isLoadingCollections || isLoadingEnabledCollections}
          />
          <div>
            <Text weight="medium">
              {t('dashboard.enableCollectionFiltering', {
                defaultValue: 'Enable collection filtering',
              })}
            </Text>
            <Text size="1" color="gray" className="block">
              {isCollectionFilteringEnabled
                ? t('dashboard.collectionFilteringEnabledDescription', {
                    defaultValue: 'Only selected collections will be available in Knowledge Assist.',
                  })
                : t('dashboard.collectionFilteringDisabledDescription', {
                    defaultValue: 'All collections are available in Knowledge Assist.',
                  })}
            </Text>
          </div>
        </Flex>

        {isLoadingCollections ? (
          <div className="mt-4 p-6 text-center">
            <Flex align="center" justify="center" gap="2">
              <Spinner size="2" />
              <Text>{t('dashboard.loadingCollections')}</Text>
            </Flex>
          </div>
        ) : kbCollections.length === 0 ? (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Text size="2" color="orange">
              <strong>{t('knowledge_assist.notice')}:</strong> {t('dashboard.noCollectionsAvailable')}
            </Text>
          </div>
        ) : (
          <>
            <Table.Root className="mt-4 overflow-visible">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>
                    <Checkbox
                      checked={
                        selectedCollectionIds.length === kbCollections.length && kbCollections.length > 0
                          ? true
                          : selectedCollectionIds.length > 0
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      disabled={!isCollectionFilteringEnabled}
                    />
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t('admin_panel.collectionName')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t('dashboard.numberOfDocuments')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t('dashboard.source')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '200px' }}>
                    <div>
                      {t('dashboard.allowedRoles', { defaultValue: 'Allowed Roles' })}
                      <Text size="1" color="gray" className="block font-normal">
                        {t('dashboard.leaveEmptyForAllUsers', { defaultValue: 'Leave empty for all users' })}
                      </Text>
                    </div>
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {[...kbCollections]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((collection) => (
                    <Table.Row key={collection.id}>
                      <Table.Cell>
                        <Checkbox
                          checked={!!collectionCheckbox[collection.id]}
                          onCheckedChange={(checked) => handleCollectionCheckbox(collection.id, checked === true)}
                          disabled={!isCollectionFilteringEnabled}
                        />
                      </Table.Cell>
                      <Table.Cell>{collection.name}</Table.Cell>
                      <Table.Cell>{collection.count?.toLocaleString() ?? 0}</Table.Cell>
                      <Table.Cell>{sourceDisplayNames[collection.source] || collection.source}</Table.Cell>
                      <Table.Cell style={{ width: '200px', padding: '4px 8px', overflow: 'visible' }}>
                        <MultiSelectDropdown
                          options={availableRoles}
                          selectedIds={collectionRoleAccess[collection.id] || []}
                          onSelectionChange={(roleIds) => handleCollectionRoleChange(collection.id, roleIds)}
                          placeholder="No roles selected"
                          searchPlaceholder="Search roles..."
                          isLoading={isLoadingRoles}
                          emptyMessage="No roles available"
                          showSelectedCount={false}
                          compactMode
                          className="[&_button]:min-h-[32px] [&_button]:py-1"
                        />
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table.Root>

            <Flex align={"center"} px="4" className="bg-iris-3 h-10 rounded-md mt-4">
              <Text className="text-iris-9" style={{ fontStyle: 'italic' }}>
                <span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>
                  {isCollectionFilteringEnabled
                    ? `${selectedCollectionIds.length} ${t('dashboard.selected')}`
                    : t('dashboard.allCollectionsEnabled', { defaultValue: 'All collections enabled' })}
                </span>
              </Text>
            </Flex>

            <Flex mt="4" gap="3" align="center">
              <Button
                size="3"
                onClick={handleSaveCollections}
                disabled={isSavingCollections || isLoadingCollections || (!hasCollectionChanges && !hasRoleAccessChanges && !hasTicketFeatureRoleChanges)}
              >
                {isSavingCollections ? <Spinner size="1" /> : t('dashboard.saveChanges')}
              </Button>
            </Flex>
          </>
        )}
      </section>

      {/* Ticket Features Access */}
      <section>
        <div>
          <Heading weight="medium">
            {t('dashboard.ticketFeaturesAccess', { defaultValue: 'Ticket Features Access' })}
          </Heading>
          <Text color="gray" className="mt-1">
            {t('dashboard.ticketFeaturesAccessDescription', {
              defaultValue: 'Control access to ticket-driven Knowledge Assist features (tickets pages, ticket stats, and create KB recommendations). Leave empty for all users.',
            })}
          </Text>
        </div>

        <div className="mt-4 max-w-[520px]">
          <MultiSelectDropdown
            options={availableRoles}
            selectedIds={ticketFeatureRoleIds}
            onSelectionChange={(roleIds) => setTicketFeatureRoleIds(roleIds)}
            placeholder={t('dashboard.noRolesSelected', { defaultValue: 'No roles selected' })}
            searchPlaceholder={t('dashboard.searchRoles', { defaultValue: 'Search roles...' })}
            isLoading={isLoadingRoles || isLoadingTicketFeatureRoles}
            emptyMessage={t('dashboard.noRolesAvailable', { defaultValue: 'No roles available' })}
            showSelectedCount={false}
          />
          <Text size="1" color="gray" className="block mt-2">
            {t('dashboard.leaveEmptyForAllUsers', { defaultValue: 'Leave empty for all users' })}
          </Text>

          <Flex mt="4" gap="3" align="center">
            <Button
              size="3"
              onClick={handleSaveCollections}
              disabled={isSavingCollections || isLoadingCollections || (!hasCollectionChanges && !hasRoleAccessChanges && !hasTicketFeatureRoleChanges)}
            >
              {isSavingCollections ? <Spinner size="1" /> : t('dashboard.saveChanges')}
            </Button>
          </Flex>
        </div>
      </section>

      {/* Company KB Template Section */}
      <section>
        <div>
          <Heading weight="medium">{t('knowledge_assist.companyKBTemplates')}</Heading>
          <Text color="gray" className="mt-1">
            {t('knowledge_assist.kbTemplatesDescription')}
          </Text>
        </div>
        
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <Text size="2" color="blue">
            <strong>{t('knowledge_assist.note')}:</strong> {t('knowledge_assist.contactAdminToModifyTemplates')}
          </Text>
        </div>

        {isLoadingTemplates ? (
          <div className="mt-4 p-6 text-center">
            <Text>{t('knowledge_assist.loadingTemplates')}</Text>
          </div>
        ) : templates.length === 0 ? (
          <>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <Text size="2" color="orange">
                <strong>{t('knowledge_assist.notice')}:</strong> {t('knowledge_assist.noCustomTemplatesConfigured')}
              </Text>
            </div>
            <div className="mt-4 border rounded-md bg-white p-6 max-h-[500px] overflow-y-auto">
              <div className="mb-4 pb-2 border-b">
                <Text weight="medium" size="3">{t('knowledge_assist.defaultTemplateStructure')}</Text>
              </div>
              <TemplateMarkDownText value={`# [A clear, concise summary of the issue (5-10 words) as the KB article title]

## Problem Description
[One short paragraph describing the problem (50-100 words)]

## Affected Systems / Services
[List the affected systems or services]

## Troubleshooting Steps
1. [Detailed step 1]
2. [Detailed step 2]
3. [Detailed step 3]

## Resolution Steps
1. [Detailed resolution step 1]
2. [Detailed resolution step 2]
3. [Detailed resolution step 3]

## Additional Notes
[Any additional information, warnings, or precautions]`} />
            </div>
          </>
        ) : (
          <div className="mt-4 flex gap-6">
            {/* Template List - Left Side */}
            <div className="w-64 flex-shrink-0">
              <Text size="2" weight="medium" className="mb-3 block">{t('knowledge_assist.templates', { count: templates.length })}</Text>
              <div className="border rounded-md bg-white">
                {templates.map((template, index) => (
                  <div
                    key={template.id}
                    className={`px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors hover:bg-gray-50 ${
                      selectedTemplateId === template.id 
                        ? 'bg-blue-50 border-r-2 border-r-blue-500' 
                        : ''
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Text weight="medium" size="2">
                      {template.name}
                    </Text>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Content - Right Side */}
            <div className="flex-1">
              <Text size="2" weight="medium" className="mb-3 block">{t('knowledge_assist.templateContent')}</Text>
              <div className="border rounded-md bg-white p-6 max-h-[600px] overflow-y-auto">
                {selectedTemplateId ? (
                  <TemplateMarkDownText 
                    value={templates.find(t => t.id === selectedTemplateId)?.template_content || ''} 
                  />
                ) : (
                  <div className="text-center py-12">
                    <Text color="gray" size="3">{t('knowledge_assist.selectTemplateToView')}</Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Ticket Data Import Settings Section */}
      <section className="mt-8">
        <Heading size="5">{t('knowledge_assist.ticketDataImportSettings')}</Heading>
        <Text color="gray" className="mt-1">
          {t('knowledge_assist.ticketDataImportDescription')}
        </Text>

        <div className="mt-4">
          <Heading size="3">{t('knowledge_assist.uploadLogs')}</Heading>
          <Text color="gray" className="mt-1">
            {t('knowledge_assist.uploadLogsDescription')}
          </Text>

          <div className='mt-4' />

          <Button
            variant="solid"
            className="mt-4 ml-0 mr-2"
            disabled={isUploading}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv,.xlsx';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx');
                  if (!isValidFile) {
                    alert(t('knowledge_assist.pleaseUploadCsvOrExcel'));
                    return;
                  }
                  await handleFileUpload(file);
                }
              };
              input.click();
            }}
          >
            <Flex gap="2" align="center">
              <UploadIcon />
              {isUploading ? t('knowledge_assist.uploading') : t('knowledge_assist.uploadFile')}
            </Flex>
          </Button>

          <Button
            variant="solid"
            className="mt-4"
            onClick={downloadSampleCsv}
          >
            <Flex gap="2" align="center">
              <DownloadIcon />
              {t('knowledge_assist.downloadSampleCsv')}
            </Flex>
          </Button>

          <Table.Root className="mt-4">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>{t('knowledge_assist.fileName')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('knowledge_assist.fileSize')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('knowledge_assist.uploadDate')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('knowledge_assist.status')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('knowledge_assist.action')}</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {isLoadingHistory ? (
                // Shimmer loading rows
                Array.from({ length: 3 }).map((_, index) => (
                  <Table.Row key={`skeleton-${index}`}>
                    <Table.Cell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))
              ) : uploadLogs.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-8">
                    <Text color="gray">{t('knowledge_assist.noUploadHistoryAvailable')}</Text>
                  </Table.Cell>
                </Table.Row>
              ) : (
                uploadLogs.map((log) => (
                  <Table.Row key={log.id}>
                    <Table.Cell>{log.name}</Table.Cell>
                    <Table.Cell>{log.size}</Table.Cell>
                    <Table.Cell>
                      {new Date(log.date).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>{t('knowledge_assist.uploaded')}</Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                      <Button
                        variant="ghost"
                        size="1"
                        onClick={() => {
                          console.log('Downloading file:', log);
                          handleDownload(log.url);
                        }}
                        className='cursor-pointer'
                        disabled={deletingLogId !== null}
                      >
                        <DownloadIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="1"
                        onClick={() => handleDelete(log.id)}
                        color="red"
                        className='cursor-pointer'
                        disabled={deletingLogId !== null}
                      >
                        {deletingLogId === log.id ? (
                          <Spinner size="1" />
                        ) : (
                          <TrashIcon />
                        )}
                      </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </div>
      </section>
    </div>
  );
}

export default KBAssistConfig;
