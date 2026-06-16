'use client';

import { Box, Text, Flex } from '@radix-ui/themes';
import Details from 'components/chat/Details';
import IncidentList, { Incident } from 'components/chat/IncidentList';
import React, { useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import { Alert } from '../../../components/chat/AlertList';
import DesktopChat from '@/components/DesktopCopilot/DesktopChat';

const incidents = [
  {
    id: 'INC0128768',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Mia Rodriguez',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'Unable to scan the boarding pass Gate 42',
    status: 'medium',
    summary: `User unable to connect with Wi-Fi at Gate 42. Guided user to restart system and confirmed successful connection after restart.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar Wi-Fi connectivity issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
  {
    id: 'INC0140258',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Liam Patel',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'WIFI: Unable to connect to internet at Gate 30',
    status: 'medium',
    summary: `User is unable to scan boarding pass at Gate 30 due to Wi-Fi connectivity issues.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar Wi-Fi connectivity and scanning issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
  {
    id: 'INC0140983',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Noah Kim',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'Network: Unable to connect to the company network',
    status: 'medium',
    summary: `The user called and said that the computer could not connect to the internet.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar network connectivity issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
  {
    id: 'INC0146034',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Olivia Chen',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'User unable to connect to Zscaler VPN',
    status: 'medium',
    summary: `Connect to the office network, display Disable, yesterday, but the problem was solved after restarting the computer. He can connect to the company network cable, but he can't connect today. Restarting the computer is invalid.

**Time Zone:** CST  
**Country:** China  
**When did issue start, and did it occur previously?:** Yesterday  
**Is the user in the Office or Remote?:** Office  
**If remote, how does the user connect remotely (VDI/ZScaler VPN/Meraki)?:** ZScaler  
**Location:** Dalian  

**Steps Performed:** It is recommended that the user replace the network cable of other seats and still display Disable. It is recommended that the user shift + restart to force a restart attempt. The user teams reply and inform that the company network cable can be connected after the forced restart. It is recommended that users observe and use it.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar Zscaler VPN connectivity issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
  {
    id: 'INC0140515',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Ethan Williams',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'User unable to connect to Zscaler VPN',
    status: 'medium',
    summary: `User unable to connect to Zscaler VPN.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar Zscaler VPN connectivity issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
  {
    id: 'INC0146287',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'End User Support',
    priority: '4 - Low',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Sophia Martinez',
    Location: 'Unknown',
    imageType: 'network',
    iconType: null,
    title: 'User is unable to connect to the internet since an hour.',
    status: 'medium',
    summary: `User is unable to connect to the internet since an hour.

<pre class="bg-[var(--accent-3)]  rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words undefined">Desktop Virtual Agent Summary:
This Incident was processed by NVA and was assigned to this L2 resolver group:
- Similar internet connectivity issues have been resolved by this L2 resolver group.</code></pre>`,
    time: '09:00 AM',
    pastDeviceIncident: [
      {
        date: '2024-05-01',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-02',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-03',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-04',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-05',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-06',
        value: 6,
        text: 'Access: 6 Attempts',
      },
      {
        date: '2024-05-07',
        value: 9,
        text: 'Access: 9 Attempts',
      },
      {
        date: '2024-05-08',
        value: 12,
        text: 'Access: 12 Attempts',
      },
      {
        date: '2024-05-09',
        value: 3,
        text: 'Access: 3 Attempts',
      },
      {
        date: '2024-05-10',
        value: 6,
        text: 'Access: 6 Attempts',
      },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 60,
        diskSpace: 60,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 200,
        cpuUsage: 65,
        diskSpace: 55,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 250,
        cpuUsage: 70,
        diskSpace: 50,
        memoryUsage: 55,
      },
      {
        date: '2024-05-04',
        value: 300,
        cpuUsage: 75,
        diskSpace: 45,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 350,
        cpuUsage: 80,
        diskSpace: 40,
        memoryUsage: 65,
      },
    ],
    ciCount: [
      {
        label: 'Overall',
        value: 65,
        color: 'green',
      },
      {
        label: 'Category A',
        value: 20,
        color: 'blue',
      },
      {
        label: 'Category B',
        value: 15,
        color: 'red',
      },
      {
        label: 'Category C',
        value: 10,
        color: 'purple',
      },
      {
        label: 'Category D',
        value: 20,
        color: 'orange',
      },
    ],
    cmdbDataInsight: [
      {
        label: 'Overall',
        value: 55,
        color: 'yellow',
      },
      {
        label: 'Relationship',
        value: 65,
        color: 'orange',
      },
    ],
  },
];


function DesktopCopilot() {
  const [selectedItem, setSelectedItem] = useState<Incident | Alert | null>(
    incidents[incidents.length - 1], // Set the new computer performance incident as default
  );
  const [answers, setAnswers] = useState<[string, any][]>([]);

  const handleIncidentSelect = (incident: Incident) => {
    setSelectedItem(incident);
  };

  const handleAlertSelect = (alert: Alert) => {
    setSelectedItem(alert);
  };
  const { organization } = useGlobalContext();
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
            {JSON.parse(organization?.config || '{}').Modules?.expert_copilot
              ?.name ?? 'Desktop Co-Resolve'}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Flex
          direction="column"
          className="w-1/4 border-r border-[var(--gray-8)]"
        >
          <Box className="overflow-hidden">
            <IncidentList
              incidents={incidents}
              onSelect={handleIncidentSelect}
              selectedItemId={selectedItem?.id}
            />
          </Box>
        </Flex>
        <Box className="w-1/2">
          <DesktopChat
            selectedItem={selectedItem}
            answers={answers}
            setAnswers={setAnswers}
          />
        </Box>
        <Box className="w-1/4 overflow-auto">
          <Details selectedItem={selectedItem} answers={answers} />
        </Box>
      </Flex>
    </Flex>
  );
}

export default DesktopCopilot;
