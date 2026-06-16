'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Tabs,
  Text,
  Table,
  ScrollArea,
  Select,
} from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import withAuth from 'components/withAuth';
import { useTranslation } from 'react-i18next';
import fullCpuData from './dataframe_to_json_20240830_202441.json';
import fullMemoryData from './dataframe_to_json_20240902_200928.json';
import CPUUsageChart from './Charting';
import MemoryUsageChart from './ChartingMemory';
import PredictionChart from './PredictionChart';
import predictionData from './prediction.json';
import FlickerCountChart from './DSLModemSystem';
import NetworkTrafficChart from './NetworkTrafficChart';

function AlertTable({ cpuData, memoryData }) {
  const { t } = useTranslation();
  const alertData = [
    ...cpuData.filter((item) => item.alert_id !== null),
    ...memoryData.filter((item) => item.alert_id !== null),
  ];

  return (
    <ScrollArea className="h-[300px]">
      <Table.Root className="w-full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t('observability.alertId')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.time')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.summary')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.severity')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.deviceType')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.eventClass')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.location')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.service')}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {[...alertData].reverse().map((item, index) => (
            <Table.Row key={index}>
              <Table.Cell>
                <Text size="2">{item.alert_id}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{new Date(item.Time).toLocaleString()}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.summary}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.Severity}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item['Device Type']}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item['Event Class']}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.location}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.service}</Text>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </ScrollArea>
  );
}

function IncidentTable() {
  const { t } = useTranslation();
  return (
    <ScrollArea className="h-[300px]">
      <Table.Root className="w-full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t('observability.incidentNumber')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.urgency')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.caller')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.shortDescription')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ width: '200px' }}>
              {t('observability.description')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.rootDeviceId')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.location')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.ciItemNumber')}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Text size="2">INC0010156</Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">{t('observability.high')}</Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">NVA</Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">
                {t('observability.highCpuMemoryUtilization')}
              </Text>
            </Table.Cell>
            <Table.Cell
              style={{
                width: '200px',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
              }}
            >
              <Text size="2">
                {t('observability.mergedAlerts')}
              </Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">SDX-DEVC-SOLR01</Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">us_east_1</Text>
            </Table.Cell>
            <Table.Cell>
              <Text size="2">ALDWXP</Text>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </ScrollArea>
  );
}

function EventsTable({ cpuData, memoryData }) {
  const { t } = useTranslation();
  const combinedData = [...cpuData, ...memoryData].filter(
    (item) => item.Anomaly,
  );

  return (
    <ScrollArea className="h-[300px]">
      <Table.Root className="w-full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t('observability.time')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.deviceType')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.summary')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.severity')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.eventClass')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.location')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{t('observability.service')}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {[...combinedData].reverse().map((item, index) => (
            <Table.Row key={index}>
              <Table.Cell>
                <Text size="2">{new Date(item.Time).toLocaleString()}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item['Device Type']}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.summary}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.Severity}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item['Event Class']}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.location}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{item.service}</Text>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </ScrollArea>
  );
}

function CPUUsageAnalysis() {
  const { t } = useTranslation();
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [prediction, setPrediction] = useState([]);
  const [dataIndex, setDataIndex] = useState(0);
  const [selectedTab, setSelectedTab] = useState('events');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState('disk');
  const { organization } = useGlobalContext();

  useEffect(() => {
    const interval = setInterval(() => {
      if (dataIndex < fullCpuData.length) {
        setCpuData((prevData) => [...prevData, fullCpuData[dataIndex]]);
        setMemoryData((prevData) => [...prevData, fullMemoryData[dataIndex]]);
        setDataIndex((prevIndex) => prevIndex + 1);
      } else {
        clearInterval(interval);
        setIsDataLoaded(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [dataIndex]);

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {JSON.parse(organization?.config || '{}').Modules?.anomaly_detection
              ?.name ?? t('observability.nocVirtualAnalyst')}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="flex-grow">
          <Tabs.Root value={selectedTab} onValueChange={setSelectedTab}>
            <Tabs.List>
              <Tabs.Trigger value="predictions">
                <Text size="2">{t('observability.predictions')}</Text>
              </Tabs.Trigger>
              <Tabs.Trigger value="events">
                <Text size="2">{t('observability.events')}</Text>
              </Tabs.Trigger>
              <Tabs.Trigger value="alerts">
                <Text size="2">{t('observability.alerts')}</Text>
              </Tabs.Trigger>
              <Tabs.Trigger value="incidents">
                <Text size="2">{t('observability.incidents')}</Text>
              </Tabs.Trigger>
            </Tabs.List>

            <Box className="flex-grow mt-4">
              <Tabs.Content value="predictions">
                <Flex direction="column" className="h-full">
                  <Text size="6" weight="bold" align="left" className="p-4">
                    {t('observability.selectDashboard')}
                  </Text>
                  <Box mb="4" ml="4">
                    <Select.Root
                      value={selectedPrediction}
                      onValueChange={(value) => setSelectedPrediction(value)}
                    >
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="disk">
                          {t('observability.diskSpaceUtilization')}
                        </Select.Item>
                        <Select.Item value="modem">
                          {t('observability.wanLinkFlicker')}
                        </Select.Item>
                        <Select.Item value="network">
                          {t('observability.networkTrafficAnalysis')}
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Box>
                  {selectedPrediction === 'disk' ? (
                    <PredictionChart predictionData={predictionData} />
                  ) : selectedPrediction === 'modem' ? (
                    <FlickerCountChart />
                  ) : (
                    <NetworkTrafficChart />
                  )}
                </Flex>
              </Tabs.Content>
              <Tabs.Content value="events">
                <Flex direction="column" gap="8">
                  <Flex gap="4">
                    <Box className="w-1/2">
                      <CPUUsageChart data={cpuData} />
                    </Box>
                    <Box className="w-1/2">
                      <MemoryUsageChart data={memoryData} />
                    </Box>
                  </Flex>
                  <EventsTable cpuData={cpuData} memoryData={memoryData} />
                </Flex>
              </Tabs.Content>
              <Tabs.Content value="alerts">
                <Flex direction="column" gap="8">
                  <AlertTable cpuData={cpuData} memoryData={memoryData} />
                </Flex>
              </Tabs.Content>
              <Tabs.Content value="incidents">
                <Flex direction="column" gap="8">
                  {isDataLoaded ? <IncidentTable /> : null}
                </Flex>
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>
    </Flex>
  );
}

export default withAuth(CPUUsageAnalysis);
