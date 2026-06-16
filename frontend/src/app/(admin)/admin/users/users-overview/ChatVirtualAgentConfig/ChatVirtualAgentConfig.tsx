// ─── React Packages ───────────────────────────────────────────
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Radix UI Components ─────────────────────────────────────
import {
  Flex,
  Heading,
  Text,
  Checkbox,
  Table,
  Button,
  Spinner,
  Badge,
  Box,
} from '@radix-ui/themes';

// ─── Contexts and State Management ────────────────────────────
import { useGlobalContext } from 'contexts/store';

// ─── Constants ────────────────────────────────────────────────
import { API_ENDPOINTS } from 'constants/dashboard';

// ─── API and Utilities ────────────────────────────────────────
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';

// ─── Css ────────────────────────────────────────
import './ChatVirtualAgentConfig.css';

// ─── Types ────────────────────────────────────────────────────
interface Collection {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any>;
  count?: number;
}

function ChatVirtualAgentConfig() {
  const { t } = useTranslation();
  // ─── Global Context ─────────────────────────────────────────
  const { user, organization, refetchOrganization } = useGlobalContext();

  // ─── Local States ───────────────────────────────────────────
  const [heading, setHeading] = React.useState('');
  const [serviceNowCollections, setServiceNowCollections] = React.useState<Collection[]>([]);
  const [sharePointCollections, setSharePointCollections] = React.useState<Collection[]>([]);
  const [otherCollections, setOtherCollections] = React.useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedCollections, setSelectedCollections] = React.useState<{
    service_now: string | null;
    sharepoint: string | null;
    others: string | null;
  }>({
    service_now: null,
    sharepoint: null,
    others: null,
  });

  // ─── Parse Organization Config ──────────────────────────────
  const config = useMemo(() => {
    return organization?.config ? JSON.parse(organization.config) : {};
  }, [organization?.config]);

  const ragConfig = useMemo(() => {
    return config?.Modules?.chat_virtual_agent?.rag_config || null;
  }, [config]);


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


  // ─── Fetch Collections and Categorize ───────────────────────
  useEffect(() => {
    if (user?.access_token) fetchCollections();
  }, [user?.access_token]);

  // ─── Handle Checkbox Selection ──────────────────────────────
  const handleCheckboxChange = (group: 'service_now' | 'sharepoint' | 'others', id: string) => {
    setSelectedCollections((prev) => ({
      ...prev,
      [group]: prev[group] === id ? null : id, // toggle behavior
    }));
  };

  // ─── Save Configuration ────────────────────────────────────
  const handleSave = async () => {
    try {
      setIsSaving(true);

      const { others, service_now, sharepoint } = selectedCollections;

      if (!others && !service_now && !sharepoint) {
        toast.error(t('admin_panel.pleaseSelectAtLeastOneCollection'));
        return;
      }

      await serviceDeskInstance.post('/service_desk/chat_virtual_agent/update_config', {
        collection_id: others || '',
      });

      await serviceDeskInstance.post('/service_desk/chat_virtual_agent/update_servicenow_config', {
        collection_id: service_now || '',
      });

      await serviceDeskInstance.post('/service_desk/chat_virtual_agent/update_sharepoint_config', {
        collection_id: sharepoint || '',
      });

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

  const selectedCount = useMemo(() => {
    return Object.values(selectedCollections).filter(Boolean).length;
  }, [selectedCollections]);

  // ─── Render Rows Helper ────────────────────────────────────
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

  // ─── Component Render ──────────────────────────────────────
  return (
    <Flex direction="column" px="5" py="4" gap="6" mb="4">
      <Flex direction="column" gap="2">
        <Heading weight="medium">{t('dashboard.integrationCollectionsManagement')}</Heading>
        <Text color="gray" size="2">
          {t('dashboard.integrationCollectionsManagementDescriptionCVA')}
        </Text>
      </Flex>

      <Flex direction="column" gap="4">
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

      <Flex align={"center"} px="4" className="bg-iris-3 h-10 rounded-md">
        <Text className="text-iris-9" style={{ fontStyle: 'italic' }}>
          {!!selectedCount && <><span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{t('dashboard.saveChanges')}</span> {t('dashboard.toApply')}.{' '}</>}
          <span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{selectedCount}/3 {t('dashboard.selected')}</span>
        </Text>
      </Flex>

      <Flex mt="4">
        <Button size="3" onClick={handleSave} disabled={isSaving || isLoadingCollections || !selectedCount}>
          {isSaving ? <Spinner size="1" /> : t('dashboard.saveChanges')}
        </Button>
      </Flex>
    </Flex>
  );
}

export default ChatVirtualAgentConfig;
