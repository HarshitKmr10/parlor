import { CalendarIcon, RefreshCcw, Download } from 'lucide-react';
import { Button, Select, Spinner, DropdownMenu } from '@radix-ui/themes';
import { Flex, Box, Text } from '@radix-ui/themes';
import { format, subDays } from 'date-fns';
import AgentAssistDashboard from 'app/(admin)/agent-assist-dashboard/page';
import CVADashboard from 'app/(admin)/cva/page';
import TrainAssistDashboard from 'app/(admin)/train-assist-dashboard/page';
import TVADashboard from 'app/(admin)/tva-dashboard/page';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import { getEnabledModules } from 'utils/getEnabledModules';
import { Tower } from './TagsManagement';
import { serviceDeskInstance } from '@/api/common/axiosInstance';
import { API_ENDPOINTS } from '@/constants/dashboard';
import { toast } from 'react-toastify';
import useUserRoles from 'hooks/useUserRoles';
import VoiceVirtualAgentDashboard from '@/app/(admin)/voice-virtual-agent-dashboard/page';
import VoiceCopilotDashboard from '@/app/(admin)/voice-copilot-dashboard/page';
import { useDashboardExport, ExportFormat } from '@/hooks/useDashboardExport';
import { useTrainAssistExport } from '@/hooks/train-assist/useTrainAssistExport';
import { useTranslation } from 'react-i18next';

export const AnalyticsTab = () => {
  const { t } = useTranslation();
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);
  const { organization, user } = useGlobalContext();
  const roles = useUserRoles();

  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTower, setSelectedTower] = useState<string>('');
  const [loadingTowers, setLoadingTowers] = useState(false);

  const [selectedTimeframe, setSelectedTimeframe] = useState(
    `${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`,
  );
  const [selectedTimeFrameType, setSelectedTimeFrameType] = useState<'7D' | '1M' | '3M' | 'CUSTOM'>(
    '7D',
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Export hooks
  const { downloadCvaDashboard, downloadAgentAssistDashboard, loading: exportLoading } = useDashboardExport();
  const { downloadTrainAssistMetrics, loading: trainAssistExportLoading } = useTrainAssistExport();

  // Check if export is available for current dashboard
  const isExportAvailable = useMemo(() => {
    return ['agent-assist', 'cva-dashboard', 'train-assist', 'voice-copilot'].includes(selectedDashboard);
  }, [selectedDashboard]);

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    const orgId = user?.org_id;
    if (!orgId) {
      toast.error(t('admin_panel.organizationIDNotFound'));
      return;
    }

    try {
      if (selectedDashboard === 'cva-dashboard') {
        await downloadCvaDashboard({ orgId, period: selectedTimeframe, format });
        toast.success(t('admin_panel.cvaDashboardExportedAs', { format: format.toUpperCase() }));
      } else if (selectedDashboard === 'agent-assist') {
        await downloadAgentAssistDashboard({ orgId, period: selectedTimeframe, format });
        toast.success(t('admin_panel.agentAssistDashboardExportedAs', { format: format.toUpperCase() }));
      } else if (selectedDashboard === 'train-assist') {
        // Train Assist only supports XLSX currently
        await downloadTrainAssistMetrics({ orgId, period: selectedTimeframe, tagId: selectedTower });
        toast.success(t('admin_panel.trainAssistDashboardExportedAsXLSX'));
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.message || t('admin_panel.failedToExportDashboard'));
    }
  };


  // Define role-based access control for each dashboard
  const canAccessDashboard = (module: string): boolean => {
    switch (module) {
      case 'agent_assist':
        return roles.agent_assist_admin;
      case 'chat_virtual_agent':
        return roles.chat_virtual_agent_admin;
      case 'train_assist':
        return roles.train_assist_admin || roles.is_tag_lead;
      case 'voice_virtual_agent':
        return roles.voice_virtual_agent_admin || roles.is_tag_lead;
      case 'voice_copilot':
        return roles.voice_copilot_admin || roles.is_tag_lead || roles.agent_assist_admin;
      case 'ticket_virtual_agent':
        return true || roles.is_tag_lead;
      case 'ticketing_virtual_agent':
        return true;
      default:
        return false;
    }
  };

  const enabledDashboardTabs = useMemo(() => {
    try {
      const config = JSON.parse(organization.config);
      const enabledModules = getEnabledModules(config.Modules);
      const tabs = [];

      // Filter tabs based on both enabled modules AND user roles
      if (enabledModules.includes('agent_assist') && canAccessDashboard('agent_assist')) {
        tabs.push({ value: 'agent-assist', label: t('admin_panel.agentAssistDashboard') });
      }
      if (enabledModules.includes('chat_virtual_agent') && canAccessDashboard('chat_virtual_agent')) {
        tabs.push({ value: 'cva-dashboard', label: t('admin_panel.cvaDashboard') });
      }
      if (enabledModules.includes('train_assist') && canAccessDashboard('train_assist')) {
        tabs.push({ value: 'train-assist', label: t('admin_panel.trainAssistDashboard') });
      }
      if (enabledModules.includes('voice_virtual_agent') && canAccessDashboard('voice_virtual_agent')) {
        tabs.push({ value: 'voice-virtual-agent', label: t('admin_panel.voiceVirtualAgentDashboard') });
      }
      if (enabledModules.includes('voice_copilot') && canAccessDashboard('voice_copilot')) {
        tabs.push({ value: 'voice-copilot', label: t('admin_panel.voiceCopilotDashboard') });
      }
      // if (enabledModules.includes('ticketing_virtual_agent') && canAccessDashboard('ticketing_virtual_agent')) {
      //   tabs.push({ value: 'tva-dashboard', label: 'TVA Dashboard' });
      // }

      
      // Set the first available tab as selected
      if (tabs.length > 0 && !tabs.some(tab => tab.value === selectedDashboard)) {
        setSelectedDashboard(tabs[0]?.value || '');
      }
      
      return tabs;
    } catch (error) {
      console.error('Failed to parse organization config:', error);
      return [];
    }
  }, [organization, roles.agent_assist_admin, roles.chat_virtual_agent_admin, roles.train_assist_admin, roles.is_tag_lead, selectedDashboard, t]);

  // Check if user has any dashboard access
  const hasAnyAccess = enabledDashboardTabs.length > 0;

  const changeDates = useCallback(
    (startDate: Date | null, endDate: Date | null) => {
      if (startDate && endDate && !isRefreshing) {
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');
        setSelectedTimeframe(`${formattedStartDate}:${formattedEndDate}`);
      }
    },
    [isRefreshing],
  );

  useEffect(() => {
    if (startDate && endDate) {
      changeDates(startDate, endDate);
    }
  }, [startDate, endDate, changeDates]);

  const fetchTowers = useCallback(async () => {
    try {
      setLoadingTowers(true);
      const response = await serviceDeskInstance.get(API_ENDPOINTS.TAGS);
      if (response.data.success) {
        const fetched: Tower[] = response.data.data || [];
        setTowers(fetched);
        if (!selectedTower && fetched.length > 0) {
          setSelectedTower(fetched[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching towers:', error);
      toast.error(t('admin_panel.failedToFetchTowers'));
    } finally {
      setLoadingTowers(false);
    }
  }, [organization.id, selectedTower, t]);

  useEffect(() => {
    if (selectedDashboard === 'train-assist') {
      fetchTowers();
    }
  }, [selectedDashboard, fetchTowers]);

  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    setIsStartDateCalendarOpen(false);
    setSelectedTimeFrameType('CUSTOM');
    setIsEndDateCalendarOpen(true);
  };

  const handleEndDateChange = (date: Date) => {
    setEndDate(date);
    setIsEndDateCalendarOpen(false);
    setSelectedTimeFrameType('CUSTOM');
  };

  const handleTimeframeChange = (type: '7D' | '1M' | '3M') => {
    setSelectedTimeFrameType(type);
    setStartDate(subDays(new Date(), type === '7D' ? 7 : type === '1M' ? 30 : 90));
    setEndDate(new Date());
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    changeDates(startDate, endDate);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 10);
  }, [startDate, endDate, changeDates]);

  // Show access denied message if user has no dashboard access
  if (!hasAnyAccess) {
    return (
      <Box className="bg-[var(--gray-2)] p-8">
        <Flex direction="column" align="center" justify="center" className="min-h-[400px]">
          <Text size="5" weight="medium" className="text-gray-600 mb-4">
            {t('admin_panel.noAnalyticsAccess')}
          </Text>
          <Text size="3" className="text-gray-500 text-center max-w-md">
            {t('admin_panel.noPermissionToAccessAnalytics')}
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className="bg-[var(--gray-2)] p-2">
      <Flex align="center" justify="between">
        <Flex align="center" gap="2">
          <Select.Root value={selectedDashboard} onValueChange={setSelectedDashboard}>
            <Select.Trigger
              className="hover:bg-transparent focus:bg-transparent cursor-pointer border-none pl-6 text-lg font-semibold shadow-none outline-none"
              style={{ backgroundColor: 'var(--gray-2)' }}
            />
            <Select.Content
              position="popper"
              className="ml-6 mt-1 rounded-md border bg-white shadow-none"
              align="start"
            >
              {enabledDashboardTabs.map(({ value, label }) => (
                <Select.Item
                  key={value}
                  value={value}
                  className="cursor-pointer px-6 py-2 hover:bg-[#5B5BD6] hover:text-white"
                >
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex align="center" gap="2" className="pr-4">
          <Flex align="center">
            {selectedDashboard === 'train-assist' && (
              <Select.Root value={selectedTower} onValueChange={setSelectedTower}>
                <Select.Trigger className="h-8 min-w-28 cursor-pointer border border-gray-300 bg-[#E3E3E8] px-3 py-1 text-sm text-gray-800 shadow-sm outline-none transition hover:bg-gray-200 data-[state=open]:bg-[var(--gray-4)]">
                  {loadingTowers ? (
                    <div className="flex items-center gap-2">
                      <Spinner size="1" />
                      <span className="text-sm">{t('admin_panel.loading')}</span>
                    </div>
                  ) : (
                    towers.find((t) => t.id === selectedTower)?.name || (towers[0]?.name || '')
                  )}
                </Select.Trigger>
                <Select.Content
                  className="z-50 mt-1 rounded-md border bg-white shadow-md"
                  position="popper"
                  align="start"
                >
                  {towers.map((tower) => (
                    <Select.Item
                      key={tower.id}
                      value={tower.id}
                      className="cursor-pointer px-4 py-2 text-sm gap-3 text-gray-800 hover:bg-[#5B5BD6] hover:text-white"
                    >
                      {`  ${tower.name}  `}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}

            <Button variant="soft" color="gray" className="cursor-pointer" onClick={handleRefresh}>
              <RefreshCcw size={16} className="mr-1" />
              {t('admin_panel.refresh')}
            </Button>
            <Button
              variant={selectedTimeFrameType === '7D' ? 'outline' : 'soft'}
              color={selectedTimeFrameType === '7D' ? 'iris' : 'gray'}
              className="cursor-pointer"
              onClick={() => handleTimeframeChange('7D')}
            >
              {t('admin_panel.days')}
            </Button>
            <Button
              variant={selectedTimeFrameType === '1M' ? 'outline' : 'soft'}
              color={selectedTimeFrameType === '1M' ? 'iris' : 'gray'}
              className="cursor-pointer"
              onClick={() => handleTimeframeChange('1M')}
            >
              {t('admin_panel.days30')}
            </Button>
            <Button
              variant={selectedTimeFrameType === '3M' ? 'outline' : 'soft'}
              color={selectedTimeFrameType === '3M' ? 'iris' : 'gray'}
              className="cursor-pointer"
              onClick={() => handleTimeframeChange('3M')}
            >
              {t('admin_panel.days90')}
            </Button>
          </Flex>

          <Flex className="relative">
            <Button
              variant={
                selectedTimeFrameType === 'CUSTOM' && !isStartDateCalendarOpen ? 'outline' : 'soft'
              }
              color={
                selectedTimeFrameType === 'CUSTOM' || isStartDateCalendarOpen ? 'iris' : 'gray'
              }
              className="min-w-[140px] cursor-pointer"
              onClick={() => setIsStartDateCalendarOpen(!isStartDateCalendarOpen)}
            >
              <CalendarIcon size={16} />
              {startDate ? format(startDate, 'MMM dd, yyyy') : t('admin_panel.startDate')}
            </Button>
            <Button
              variant={
                selectedTimeFrameType === 'CUSTOM' && !isEndDateCalendarOpen ? 'outline' : 'soft'
              }
              color={selectedTimeFrameType === 'CUSTOM' || isEndDateCalendarOpen ? 'iris' : 'gray'}
              className="min-w-[140px] cursor-pointer"
              onClick={() => setIsEndDateCalendarOpen(!isEndDateCalendarOpen)}
            >
              <CalendarIcon size={16} />
              {endDate ? format(endDate, 'MMM dd, yyyy') : t('admin_panel.endDate')}
            </Button>

            {isStartDateCalendarOpen && (
              <div className="absolute left-10 top-[100%] z-50 mt-1">
                <DatePicker
                  selected={startDate}
                  onChange={handleStartDateChange}
                  onClickOutside={() => setIsStartDateCalendarOpen(false)}
                  startDate={startDate}
                  endDate={endDate}
                  selectsStart
                  inline
                  maxDate={new Date()}
                  dateFormat="MMM dd, yyyy"
                  calendarClassName="range-calendar"
                />
              </div>
            )}
            {isEndDateCalendarOpen && (
              <div className="absolute left-10 top-[100%] z-50 mt-1">
                <DatePicker
                  selected={endDate}
                  onChange={handleEndDateChange}
                  onClickOutside={() => setIsEndDateCalendarOpen(false)}
                  startDate={startDate}
                  endDate={endDate}
                  selectsEnd
                  inline
                  minDate={startDate}
                  maxDate={new Date()}
                  dateFormat="MMM dd, yyyy"
                  calendarClassName="range-calendar"
                />
              </div>
            )}
          </Flex>

          {/* Export Button */}
          {isExportAvailable && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button
                  variant="soft"
                  color="iris"
                  className="cursor-pointer ml-2"
                  disabled={exportLoading || trainAssistExportLoading}
                >
                  {(exportLoading || trainAssistExportLoading) ? (
                    <Spinner size="1" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span className="ml-1">{t('admin_panel.export')}</span>
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {selectedDashboard === 'train-assist' ? (
                  // Train Assist only supports XLSX
                  <DropdownMenu.Item
                    className="cursor-pointer"
                    onSelect={() => handleExport('xlsx')}
                  >
                    {t('admin_panel.exportAsExcel')}
                  </DropdownMenu.Item>
                ) : (
                  // CVA and Agent Assist support all formats
                  <>
                    <DropdownMenu.Item
                      className="cursor-pointer"
                      onSelect={() => handleExport('xlsx')}
                    >
                      {t('admin_panel.exportAsExcel')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="cursor-pointer"
                      onSelect={() => handleExport('csv')}
                    >
                      {t('admin_panel.exportAsCSV')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="cursor-pointer"
                      onSelect={() => handleExport('pdf')}
                    >
                      {t('admin_panel.exportAsPDF')}
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>
      </Flex>

      {isRefreshing ? (
        <Spinner />
      ) : (
        <>
          {selectedDashboard === 'agent-assist' && (
            <AgentAssistDashboard timeframe={selectedTimeframe} />
          )}
          {selectedDashboard === 'cva-dashboard' && <CVADashboard timeframe={selectedTimeframe} />}
          {selectedDashboard === 'train-assist' && !loadingTowers && (
            <TrainAssistDashboard timeframe={selectedTimeframe} tagId={selectedTower}/>
          )}
          {selectedDashboard === 'voice-virtual-agent' && !loadingTowers && (
            <VoiceVirtualAgentDashboard timeframe={selectedTimeframe} tagId={selectedTower}/>
          )}
          {selectedDashboard === 'voice-copilot' && (
            <VoiceCopilotDashboard timeframe={selectedTimeframe} />
          )}
          {selectedDashboard === 'tva-dashboard' && (
            <TVADashboard timeframe={selectedTimeframe} />
          )}
        </>
      )}
    </Box>
  );
};
