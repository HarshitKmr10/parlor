'use client';

import React from 'react';
import {
  Box, Flex, Text,
} from '@radix-ui/themes';
import { HiOutlinePaperClip } from 'react-icons/hi2';
import dynamic from 'next/dynamic';
import { useGlobalContext } from 'contexts/store';
import { useTranslation } from 'react-i18next';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

function DetailItem({ label, value }) {
  return (
    <Flex align="center">
      <Text size="2" style={{ width: '50%', fontWeight: 'normal' }}>
        {label}
        :
      </Text>
      <Text size="2" style={{ fontWeight: 'normal' }}>{value}</Text>
    </Flex>
  );
}

function Details({ selectedItem, answers }) {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  
  if (!selectedItem) {
    return (
      <Box
        p="3"
        style={{
          backgroundColor: 'var(--color-background)',
          height: '100%',
          overflowY: 'auto',
          maxWidth: '100%',
        }}
        className="border-l border-[var(--gray-8)]"
      >
        <Text as="h1" size="6" weight="bold" mb="4">
          {t('expert_copilot.details')}
        </Text>
        <Text size="2" color="gray">
          {t('expert_copilot.noItemSelected') || 'No item selected'}
        </Text>
      </Box>
    );
  }
  
  const handleIncidentSummaryAndUpdate = async () => {
    if (!selectedItem?.link) return;
    const incidentId = selectedItem.link.split('sys_id%3D')[1];

    let description = '';

    if (answers.length <= 1) {
      console.log(t('expert_copilot.noSummaryAvailable'));
    } else {
      const conversation = answers.slice(1).map((answer) => `${t('expert_copilot.user')} ${answer[0]}\n${t('expert_copilot.assistant')} ${answer[1].choices[0].message.content}\n`).join('\n');

      try {
        const summaryResponse = await fetch('/api/createIncidentSummary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation,
            incidentId,
          }),
        });

        if (!summaryResponse.ok) {
          throw new Error(t('expert_copilot.failedToFetchSummary'));
        }

        const summaryData = await summaryResponse.json();
        description = summaryData.response;
      } catch (error) {
        console.error('Error fetching summary:', error);
        return; // Exit the function if we can't get a summary
      }
    }

    // Update the ticket
    try {
      const updateResponse = await fetch('/api/updateIncident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incidentSysId: incidentId,
          description,
          user,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error(t('expert_copilot.failedToUpdateTicket'));
      }

      const updateData = await updateResponse.json();
      window.open(selectedItem.link, '_blank');
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  return (
    <Box
      p="3"
      style={{
        backgroundColor: 'var(--color-background)',
        height: '100%',
        overflowY: 'auto',
        maxWidth: '100%',
      }}
      className="border-l border-[var(--gray-8)]"
    >
      <Text as="h1" size="6" weight="bold" mb="4">
        {t('expert_copilot.details')}
      </Text>

      {selectedItem.type === 'incident' && (
        <>
          <Box mb="4">
            <Flex align="center" mb="2">
              <Text as="h2" size="4" weight="bold">{t('expert_copilot.incidentOverview')}</Text>
              <Box ml="2" style={{ cursor: 'pointer' }} onClick={handleIncidentSummaryAndUpdate}>
                <HiOutlinePaperClip />
              </Box>
            </Flex>
            <Flex direction="column" gap="2">
              <DetailItem label={t('expert_copilot.incidentState')} value={selectedItem.incidentState} />
              <DetailItem label={t('expert_copilot.incidentType')} value={selectedItem.alertType} />
              <DetailItem label={t('expert_copilot.incidentPriority')} value={selectedItem.priority} />
              <DetailItem label={t('expert_copilot.incidentUrgency')} value={selectedItem.urgency} />
              <DetailItem label={t('expert_copilot.incidentImpact')} value={selectedItem.impact} />
              <DetailItem label={t('expert_copilot.reportedBy')} value={selectedItem.reportedBy} />
              <DetailItem label={t('expert_copilot.incidentLocation')} value={selectedItem.Location} />
              <DetailItem label={t('expert_copilot.incidentDescription')} value={selectedItem.title} />
              <DetailItem label={t('expert_copilot.timestamp')} value={selectedItem.time} />
            </Flex>
          </Box>

          {/* <Flex mb="4" direction="column">
            <Text as="h2" size="3" weight="bold" mb="2">ACTION SECTION</Text>
            <Text as="span" size="2" weight="bold" mb="1">Assign Team:</Text>
            <Select.Root defaultValue="" size="2" mb="2">
              <Select.Trigger placeholder="Select Team" />
              <Select.Content>
                <Select.Group>
                  <Select.Item value="IT Support">IT Support</Select.Item>
                  <Select.Item value="Network Team">Network Team</Select.Item>
                  <Select.Item value="Security Team">Security Team</Select.Item>
                  <Select.Item value="Manually assigned">Manually assigned</Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
            <Text as="div" size="1" color="gray" mb="2">e.g., IT Support, Network Team, Security Team, Manually assigned</Text>
            <Button size="2" variant="solid">
              Assign
            </Button>
          </Flex> */}
        </>
      )}

      {selectedItem.type === 'alert' && (
        <Box mb="4">
          <Text as="h2" size="4" weight="bold" mb="2">{t('expert_copilot.alertOverview')}</Text>
          <Flex direction="column" gap="2">
            <DetailItem label={t('expert_copilot.alertState')} value={selectedItem.alertState} />
            <DetailItem label={t('expert_copilot.alertType')} value={selectedItem.alertType} />
            <DetailItem label={t('expert_copilot.incidentCriticality')} value={selectedItem.criticality} />
            <DetailItem label={t('expert_copilot.incidentPriority')} value={selectedItem.priority} />
            <DetailItem label={t('expert_copilot.reportedBy')} value={selectedItem.reportedBy} />
            <DetailItem label={t('expert_copilot.alertDescription')} value={selectedItem.title} />
            <DetailItem label={t('expert_copilot.timestamp')} value={selectedItem.time} />
          </Flex>
        </Box>
      )}

      <Box>
        <Text as="h2" size="3" weight="bold" mb="2">{t('expert_copilot.ticketsForSameStore')}</Text>
        <Box style={{ borderBottom: '1px solid var(--gray-6)' }}>
          <Text as="h3" size="2" weight="bold">1. {t('expert_copilot.pastDeviceIncident')}</Text>
          <Plot
            data={[
              {
                x: selectedItem.pastDeviceIncident?.map((incident) => incident.date) || [],
                y: selectedItem.pastDeviceIncident?.map((incident) => incident.value) || [],
                type: 'bar',
                name: t('expert_copilot.pastDeviceIncident'),
                hovertext: selectedItem.pastDeviceIncident?.map((incident) => incident.text) || [],
                hoverinfo: 'text',
                marker: {
                  color: 'rgb(95, 209, 230,1)',
                  hovercolor: 'rgba(0, 0, 0, 0.6)',
                },
                hoverlabel: {
                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                  font: { color: 'white' },
                },
              },
            ]}
            layout={{
              showlegend: false,
              autosize: true,
              height: 300,
              margin: {
                t: 10, b: 10, l: 40, r: 10,
              },
              xaxis: { automargin: true, showgrid: false },
              yaxis: { automargin: true, tickfont: { size: 10 }, showgrid: false },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
        <Box ml="4" style={{ borderBottom: '1px solid var(--gray-6)' }}>
          <Text as="h3" size="2" weight="bold" mt="2">2. {t('expert_copilot.pastAlerts')}</Text>
          <Plot
            data={[
              {
                x: selectedItem.pastAlerts?.map((alert) => alert.date) || [],
                y: selectedItem.pastAlerts?.map((alert) => alert.value) || [],
                type: 'scatter',
                mode: 'lines',
                name: t('expert_copilot.overall'),
                line: { color: '#0AB8D9', shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(10, 184, 217, 0.2)',
              },
              {
                x: selectedItem.pastAlerts?.map((alert) => alert.date) || [],
                y: selectedItem.pastAlerts?.map((alert) => alert.cpuUsage) || [],
                type: 'scatter',
                mode: 'lines',
                name: t('expert_copilot.cpuAlerts'),
                line: { color: '#FF5730', shape: 'spline' },
              },
              {
                x: selectedItem.pastAlerts?.map((alert) => alert.date) || [],
                y: selectedItem.pastAlerts?.map((alert) => alert.diskSpace) || [],
                type: 'scatter',
                mode: 'lines',
                name: t('expert_copilot.diskSpaceAlerts'),
                line: { color: '#DC189C', shape: 'spline' },
              },
              {
                x: selectedItem.pastAlerts?.map((alert) => alert.date) || [],
                y: selectedItem.pastAlerts?.map((alert) => alert.memoryUsage) || [],
                type: 'scatter',
                mode: 'lines',
                name: t('expert_copilot.memoryAlerts'),
                line: { color: '#52BA63', shape: 'spline' },
              },
            ]}
            layout={{
              showlegend: true,
              legend: { orientation: 'h', y: -0.2 },
              autosize: true,
              height: 300,
              margin: {
                t: 30, b: 50, l: 30, r: 30,
              },
              xaxis: { tickangle: 360, showgrid: false },
              yaxis: { automargin: true, tickfont: { size: 10 }, showgrid: false },
              hovermode: 'x unified',
              hoverlabel: {
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                font: { color: '#fff' },
                bordercolor: 'transparent',
                namelength: -1,
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
      </Box>

      <Box mb="4">
        <Text as="h3" size="3" weight="bold" mt="2">{t('expert_copilot.openIncidents')}</Text>
        <Flex justify="between" align="center">
          <Text size="2">{t('expert_copilot.space')}: 12%</Text>
          <Text size="2">{t('expert_copilot.date')}: 2024-05-15</Text>
        </Flex>
        <Text size="2">{t('expert_copilot.status')}: {t('expert_copilot.open')}</Text>
        <Box mt="2">
          <Text as="h4" size="2" weight="bold">{t('expert_copilot.ciCount')}</Text>
          <Flex align="center">
            <Text size="2">{t('expert_copilot.overall')}</Text>
            <Text size="2" ml="2" style={{ color: 'var(--green-9)' }}>75%</Text>
          </Flex>
          <Plot
            data={[
              {
                x: selectedItem.ciCount?.map((ci) => ci.value) || [],
                y: selectedItem.ciCount?.map((ci) => ci.label) || [],
                type: 'bar',
                orientation: 'h',
                marker: { color: selectedItem.ciCount?.map((ci) => ci.color) || [] },
                text: selectedItem.ciCount?.map((ci) => `${ci.value}%`) || [],
                textposition: 'auto',
                hoverinfo: 'x+y',
              },
            ]}
            layout={{
              showlegend: false,
              autosize: true,
              height: 50,
              margin: {
                t: 10, b: 30, l: 30, r: 10,
              },
              xaxis: { showticklabels: false },
              yaxis: { showticklabels: false },
              bargap: 0.1,
              barmode: 'stack',
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
      </Box>

      <Box mb="4">
        <Box style={{ borderTop: '1px solid var(--gray-6)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }} />
        <Text as="h3" size="3" weight="bold">{t('expert_copilot.connectedSystemsImpact')}</Text>
        <Box>
          <Text as="h4" size="2" weight="bold">{t('expert_copilot.impactAnalysis')}</Text>
          <Text size="2">{t('expert_copilot.ifServerGoesDown')}</Text>
          <Flex justify="between">
            <Text size="2">{t('expert_copilot.databaseServer')}</Text>
            <Text size="2" style={{ color: 'var(--red-9)' }}>{t('expert_copilot.potentialDowntime')}</Text>
          </Flex>
          <Flex justify="between">
            <Text size="2">{t('expert_copilot.applicationServer')}</Text>
            <Text size="2" style={{ color: 'var(--red-9)' }}>{t('expert_copilot.degradedPerformance')}</Text>
          </Flex>
          <Box style={{
            backgroundColor: 'var(--red-3)',
            color: 'var(--red-11)',
            padding: 'var(--space-2)',
            marginTop: 'var(--space-2)',
            borderRadius: 'var(--radius-2)',
          }}
          >
            <Text size="2">
              <i className="fas fa-exclamation-circle" />
              {' '}
              {t('expert_copilot.severeSystemsImpacted')}
            </Text>
          </Box>
        </Box>
        <Box mt="2">
          <Text as="h4" size="2" weight="bold">{t('expert_copilot.cmdbDataInsight')}</Text>
          <Flex justify="between">
            <Text size="2">{t('expert_copilot.overall')}:</Text>
            <Text size="2" style={{ color: 'var(--red-9)' }}>62%</Text>
          </Flex>
          <Flex justify="between">
            <Text size="2">{t('expert_copilot.relationship')}</Text>
            <Text size="2" style={{ color: 'var(--red-9)' }}>72%</Text>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

export default Details;
