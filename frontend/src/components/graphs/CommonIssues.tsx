import React, { useState } from 'react';
import {
  Box,
  Text,
  Table,
  Flex,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  Spinner,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import { apiService } from 'services/dashboard';
import { toast } from 'react-toastify';
import { Recommendation } from 'types/dashboard';
import { useGlobalContext } from 'contexts/store';
import { IncidentGroup } from 'components/dashboard/IncidentGroup';

interface CommonIssuesProps {
  issues: {
    id: string;
    recommendation: string;
    type: string;
    rank: number;
    related_to_kb_ids: string[];
    incidents: {
      id: string;
      incident_number: string;
    }[];
    metadata: {
      cluster_data: {
        name: string;
        incidents: {
          incident_number: string;
          short_description: string;
          category: string;
        }[];
      };
      incident_count: number;
    };
  }[];
  onAction?: (recommendation: Recommendation) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function CommonIssues({ issues, onAction, isLoading, disabled }: CommonIssuesProps) {
  const { t } = useTranslation();
  const [isLinkKbLoading, setIsLinkKbLoading] = useState<string | null>(null);
  const [showLinkKBDialog, setShowLinkKBDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [kbIdToLink, setKbIdToLink] = useState('');
  const { user } = useGlobalContext();

  const handleAction = (recommendation: Recommendation) => {
    if (disabled) return;
    if (recommendation.type === 'create_new_kb') {
      onAction(recommendation);
    } else {
      setSelectedIssue(recommendation);
      setShowLinkKBDialog(true);
    }
  };

  const handleLinkKB = async () => {
    if (!selectedIssue || !kbIdToLink) return;

    setIsLinkKbLoading(selectedIssue.name);
    try {
      await apiService.linkKBToCommonIssue(selectedIssue, kbIdToLink, user);
      toast.success(`Successfully linked KB to "${selectedIssue.name}"`);
      setShowLinkKBDialog(false);
      setKbIdToLink('');
    } catch (error) {
      toast.error(`Failed to link KB: ${error.message}`);
    } finally {
      setIsLinkKbLoading(null);
    }
  };

  return (
    <Box className="relative flex h-[323px] w-full flex-col overflow-auto rounded-[12px] bg-white p-4 shadow-[0_4px_9.9px_rgba(91,91,214,0.2)]">
      <Flex align="center" gap="2" mb="2">
        <Text size="5" weight="medium" color="gray">
          {t('knowledge_assist.mostCommonIssuesWithoutKB')}
        </Text>
        <Tooltip content={t('knowledge_assist.mostCommonIssuesTooltip')}>
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Tooltip>
      </Flex>

      {isLoading ? (
        <Flex align="center" justify="center">
          <Spinner />
        </Flex>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell className="max-w-[350px] text-gray-700 font-normal">
                {t('knowledge_assist.incidentNames')}
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className="max-w-[200px] text-gray-700 font-normal">
                {t('knowledge_assist.incidents')}
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className="text-center w-[100px] text-gray-700 font-normal">
                {t('knowledge_assist.actions')}
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {issues?.slice(0, 4).map?.((issue, index) => (
              <Table.Row key={issue.id || index}>
                <Table.Cell className="max-w-[350px]">
                  <Tooltip content={issue.metadata.cluster_data.incidents[0].short_description}>
                    <Text className="truncate block line-clamp-2">
                      {issue.metadata.cluster_data.name}
                    </Text>
                  </Tooltip>
                </Table.Cell>
                <Table.Cell className="max-w-[200px]">
                  <IncidentGroup
                    incidentTickets={issue.metadata.cluster_data.incidents.map(incident => ({
                      incident_number: incident.incident_number,
                      incident_title: incident.short_description,
                      category: incident.category
                    }))}
                  />
                </Table.Cell>
                <Table.Cell className="text-center w-[100px]">
                  <Button
                    size="1"
                    variant="outline"
                    radius="small"
                    className="cursor-pointer whitespace-nowrap min-w-[90px]"
                    onClick={() => handleAction(issue as unknown as Recommendation)}
                    disabled={disabled || isLinkKbLoading === issue.id}
                  >
                    {isLinkKbLoading === issue.id ? (
                      <span className="animate-spin">↻</span>
                    ) : (
                      t('knowledge_assist.create')
                    )}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
            {(!issues || issues.length === 0) && (
              <Table.Row>
                <Table.Cell colSpan={3} className="text-center py-8">
                  <Text color="gray">
                    {disabled
                      ? t('dashboard.ticketFeaturesDisabled', { defaultValue: 'Ticket features are disabled for your role.' })
                      : t('knowledge_assist.noData', { defaultValue: 'No data available.' })}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      )}

      {disabled ? (
        <Box className="absolute inset-0 bg-white/40 pointer-events-none" />
      ) : null}

      {/* Link KB Dialog */}
      <Dialog.Root open={showLinkKBDialog} onOpenChange={setShowLinkKBDialog}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{t('knowledge_assist.linkKBToIssue')}</Dialog.Title>
          <Flex direction="column" gap="3">
            <Text size="2">
              {t('knowledge_assist.enterKBIDToLink')} "
              {selectedIssue?.name}
              "
            </Text>
            <input
              type="text"
              value={kbIdToLink}
              onChange={(e) => setKbIdToLink(e.target.value)}
              placeholder={t('knowledge_assist.enterKBID')}
              className="rounded border p-2"
            />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" onClick={() => setShowLinkKBDialog(false)}>
              {t('knowledge_assist.cancel')}
            </Button>
            <Button onClick={handleLinkKB} disabled={!kbIdToLink.trim()}>
              {t('knowledge_assist.linkKB')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

export default CommonIssues;
