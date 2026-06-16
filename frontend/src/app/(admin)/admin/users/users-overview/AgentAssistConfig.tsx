import React, { useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Heading, Text, TextField, Grid, Checkbox, Switch, Table, Badge, Button, Spinner, Box } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import { API_ENDPOINTS } from 'constants/dashboard';
import { toast } from 'react-toastify';
import { DEFAULT_EXAMPLES } from 'components/Example/ExampleList';
import { KbCollectionSource } from 'types/dashboard';
import { serviceDeskInstance } from 'api/common/axiosInstance';

const TITLE_LENGTH = 100;
const DESCRIPTION_LENGTH = 200;

interface Collection {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any>;
  count?: number;
}

function AgentAssistConfig() {
  const { t } = useTranslation();
  const { user, organization, setOrganization, refetchOrganization } = useGlobalContext();
  const [heading, setHeading] = React.useState('');
  const [exampleQuestions, setExampleQuestions] = React.useState<string[]>(['', '', '', '']);
  const [selectedCollections, setSelectedCollections] = React.useState<{
    service_now: string | null;
    sharepoint: string | null;
    others: string | null;
  }>({
    service_now: null,
    sharepoint: null,
    others: null,
  });
  const [serviceNowCollections, setServiceNowCollections] = React.useState<Collection[]>([]);
  const [sharePointCollections, setSharePointCollections] = React.useState<Collection[]>([]);
  const [otherCollections, setOtherCollections] = React.useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Parse Organization Config
  const config = useMemo(() => {
    return organization?.config ? JSON.parse(organization.config) : {};
  }, [organization?.config]);

  const ragConfig = useMemo(() => {
    return config?.Modules?.agent_assist?.rag_config || null;
  }, [config]);

  const landingConfig = useMemo(() => {
    return config?.Modules?.agent_assist?.landing_page_config;
  }, [config]);

  // Initialize state from config
  useEffect(() => {
    setHeading(landingConfig?.header_message || t('admin_panel.welcomeToITServiceDeskAgentAssist'));
    const newExampleQuestions = landingConfig?.example_questions || DEFAULT_EXAMPLES;
    if (newExampleQuestions.length < 4) {
      // Pad array with empty strings until it has 4 items
      while (newExampleQuestions.length < 4) {
        newExampleQuestions.push('');
      }
    }
    setExampleQuestions(newExampleQuestions);
  }, [landingConfig, t]);

  // Load selected collections from config
  useEffect(() => {
    if (!ragConfig) return;
  
    const updatedSelections: Partial<typeof selectedCollections> = {};
  
    if (ragConfig.collection_name) {
      updatedSelections.others = ragConfig.collection_name;
    }
  
    const serviceNowName = ragConfig.meta?.servicenow?.collection_name;
    if (serviceNowName) {
      updatedSelections.service_now = serviceNowName;
    }
  
    const sharepointName = ragConfig.meta?.sharepoint?.collection_name;
    if (sharepointName) {
      updatedSelections.sharepoint = sharepointName;
    }
  
    if (Object.keys(updatedSelections).length > 0) {
      setSelectedCollections((prev) => ({
        ...prev,
        ...updatedSelections,
      }));
    }
  }, [ragConfig]);

  // Fetch and categorize collections
  const fetchCollections = useCallback(async () => {
    try {
      setIsLoadingCollections(true);
      const response = await serviceDeskInstance.get(API_ENDPOINTS.COLLECTIONS);
      if (response.status !== 200) throw new Error(`HTTP error! status: ${response.status}`);

      const data = response.data;
      if (data.success && data.data) {
        const serviceNow: Collection[] = [];
        const sharePoint: Collection[] = [];
        const others: Collection[] = [];

        data.data.forEach((col: Collection) => {
          if (col.source === 'service_now') serviceNow.push(col);
          else if (col.source === 'sharepoint') sharePoint.push(col);
          else others.push(col);
        });

        setServiceNowCollections(serviceNow);
        setSharePointCollections(sharePoint);
        setOtherCollections(others);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error(t('admin_panel.failedToLoadCollectionsPleaseRefresh'));
    } finally {
      setIsLoadingCollections(false);
    }
  }, []);

  useEffect(() => {
    if (user?.access_token) fetchCollections();
  }, [user?.access_token, fetchCollections]);

  // Handle checkbox selection
  const handleCheckboxChange = (group: 'service_now' | 'sharepoint' | 'others', id: string) => {
    setSelectedCollections((prev) => ({
      ...prev,
      [group]: prev[group] === id ? null : id, // toggle behavior
    }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedCollections).filter(Boolean).length;
  }, [selectedCollections]);

  const handleExampleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...exampleQuestions];
    newQuestions[index] = value;
    setExampleQuestions(newQuestions);
  };

  const handleSave = async () => {
    try {
      if (!heading.trim()) {
        toast.error(t('admin_panel.mainPageHeadingRequired'));
        return;
      }

      const { others, service_now, sharepoint } = selectedCollections;

      if (!others && !service_now && !sharepoint) {
        toast.error(t('admin_panel.pleaseSelectAtLeastOneCollection'));
        return;
      }

      setIsSaving(true);

      // Save main collection and landing page config
      await serviceDeskInstance.post('/service_desk/agent_assist/update_config', {
        collection_id: others || '',
        header_message: heading,
        example_questions: exampleQuestions.filter(q => q.trim() !== ''),
      });

      // Save ServiceNow collection only if there's a meaningful change
      const currentServiceNow = ragConfig?.meta?.servicenow?.collection_name || null;
      if (service_now !== currentServiceNow && (service_now || currentServiceNow)) {
        await serviceDeskInstance.post('/service_desk/agent_assist/update_servicenow_config', {
          collection_id: service_now || '',
        });
      }

      // Save SharePoint collection only if there's a meaningful change
      const currentSharePoint = ragConfig?.meta?.sharepoint?.collection_name || null;
      if (sharepoint !== currentSharePoint && (sharepoint || currentSharePoint)) {
        await serviceDeskInstance.post('/service_desk/agent_assist/update_sharepoint_config', {
          collection_id: sharepoint || '',
        });
      }

      setTimeout(() => {
        refetchOrganization();
      }, 2000);

      toast.success(t('admin_panel.configurationSavedSuccessfully'));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error(t('admin_panel.failedToSaveConfiguration'));
    } finally {
      setIsSaving(false);
      fetchCollections();
    }
  };

  // Render table rows helper function
  const renderRows = (
    collections: Collection[],
    group: 'service_now' | 'sharepoint' | 'others',
    bgColor?: string,
  ) => {
    return collections.map((collection) => {
      let isEnabled = false;
      if (group === 'others') {
        isEnabled = ragConfig?.collection_name === collection?.id;
      }
      if (group === 'service_now') {
        isEnabled = ragConfig?.meta?.servicenow?.collection_name === collection?.id;
      }
      if (group === 'sharepoint') {
        isEnabled = ragConfig?.meta?.sharepoint?.collection_name === collection?.id;
      }
      return (
        <Table.Row key={collection.id} style={{ backgroundColor: bgColor }}>
          <Table.Cell>
            <Checkbox
              checked={selectedCollections[group] === collection.id}
              onCheckedChange={() => handleCheckboxChange(group, collection.id)}
            />
          </Table.Cell>
          <Table.Cell>{collection.name}</Table.Cell>
          <Table.Cell>{collection.count?.toLocaleString() ?? 0}</Table.Cell>
          <Table.Cell>{collection.source}</Table.Cell>
          <Table.Cell>
            <Badge variant="soft" color={isEnabled ? 'iris' : 'gray'} radius="medium">
              {isEnabled ? t('dashboard.enabled') : t('dashboard.disabled')}
            </Badge>
          </Table.Cell>
        </Table.Row>
      );
    });
  };

  return (
    <Flex direction="column" px="5" py="4" gap="6" mb="4">
      <Flex direction="column" gap="2">
        <Flex direction="column" gap="1">
          <Heading weight="medium">{t('dashboard.contentCustomization')}</Heading>
          <Text color="gray" size="2">
            {t('dashboard.contentCustomizationDescription')}
          </Text>
        </Flex>
        <Flex direction="column" gap="1">
          <Text weight="medium">{t('dashboard.mainPageHeading')} <Text color="red" className="display-inline">*</Text></Text>
          <TextField.Root
            value={heading}
            placeholder={t('dashboard.welcomeToITServiceDeskAgentAssist')}
            radius="medium"
            maxLength={TITLE_LENGTH}
            onChange={(e) => setHeading(e.target.value)}
            color={!heading.trim() ? "red" : undefined}
          >
            <TextField.Slot side="right">
              {heading.length ?? 0} / {TITLE_LENGTH}
            </TextField.Slot>
          </TextField.Root>
        </Flex>

        <Flex direction="column" gap="2" mt="4">
          <Text weight="medium">{t('dashboard.exampleQuestions')}</Text>
          <Text color="gray" size="2">
            {t('dashboard.exampleQuestionsDescription')}
          </Text>
          {exampleQuestions.map((question, index) => (
            <TextField.Root
              key={index}
              value={question}
              placeholder={t('dashboard.exampleQuestionNumber', { number: index + 1 })}
              radius="medium"
              maxLength={DESCRIPTION_LENGTH}
              onChange={(e) => handleExampleQuestionChange(index, e.target.value)}
            >
              <TextField.Slot side="right">
                {question.length ?? 0} / {DESCRIPTION_LENGTH}
              </TextField.Slot>
            </TextField.Root>
          ))}
        </Flex>
      </Flex>

      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Heading weight="medium">{t('dashboard.integrationCollectionsManagement')}</Heading>
          <Text color="gray" size="2">
            {t('dashboard.integrationCollectionsManagementDescription')}
          </Text>

          {isLoadingCollections ? (
            <Flex align="center" justify="center" py="4">
              <Spinner size="2" />
            </Flex>
          ) : (
            <Table.Root
              style={{
                border: '1px solid #00002F26',
                width: '1000px',
                maxWidth: '100%',
                borderRadius: '12px',
              }}
            >
              <Table.Header>
                <Table.Row
                  style={{
                    height: '36px',
                    borderTopWidth: '1px',
                    background: '#00005506',
                    border: 'none',
                  }}
                >
                  <Table.ColumnHeaderCell style={{ border: 'none' }}></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ border: 'none' }}>
                    {t('admin_panel.collectionName')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ border: 'none' }}>
                    {t('dashboard.numberOfDocuments')}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ border: 'none' }}>{t('dashboard.source')}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ border: 'none' }}>{t('dashboard.status')}</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {renderRows(otherCollections, 'others')}
                {renderRows(serviceNowCollections, 'service_now', '#0000FF07')}
                {renderRows(sharePointCollections, 'sharepoint', '#000BFF19')}
              </Table.Body>
            </Table.Root>
          )}
        </Flex>
      </Flex>

      <Flex align={"center"} px="4" className="bg-iris-3 h-10 rounded-md">
        <Text className="text-iris-9" style={{ fontStyle: 'italic' }}>
          {!!selectedCount && <><span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{t('dashboard.saveChanges')}</span> {t('dashboard.toApply')}.{' '}</>}
          <span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{selectedCount}/3 {t('dashboard.selected')}</span>
        </Text>
      </Flex>

      <Flex mt="4">
        <Button
          size="3"
          onClick={handleSave}
          disabled={isSaving || isLoadingCollections || !selectedCount}
        >
          {isSaving ? <Spinner size="1" /> : t('dashboard.saveChanges')}
        </Button>
      </Flex>
    </Flex>
  );
}

export default AgentAssistConfig;
