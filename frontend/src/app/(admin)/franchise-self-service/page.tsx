'use client';

import { Box, Text, Flex, Select } from '@radix-ui/themes';
import Details from 'components/chat/Details';
import IncidentList, { Incident } from 'components/chat/IncidentList';
import React, { useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import { Alert } from '../../../components/chat/AlertList';
import DesktopChat from '@/components/FranchiseSelfService/DesktopChat';
import Image from 'next/image';
import logo from './logo.png';

// Store 17118 Incidents
const incidentsStore17118: Incident[] = [
  {
    id: 'INC5200001',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'POS Peripherals',
    priority: '3 - Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Store Manager - Quincy #17118',
    Location: 'Quincy, MA - Store #17118',
    imageType: 'network',
    iconType: null,
    title: 'POS1 Receipt Printer - No Power',
    status: 'medium',
    summary: `Receipt printer at POS1 won’t power on. Power brick appears loose.
    
<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- Auto-matched SOP: Printer Not Printing → Step 1 (Power & Cables), Step 6 (Physical Damage)
- Suggested Actions:
  • Reseat power brick and cable
  • Test outlet; try known-good power cord
  • If still dead → replace power brick
</code></pre>`,
    time: '08:12 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 3, text: 'Jan: 3 Tickets' },
      { date: '2025-02', value: 4, text: 'Feb: 4 Tickets' },
      { date: '2025-03', value: 2, text: 'Mar: 2 Tickets' },
      { date: '2025-04', value: 5, text: 'Apr: 5 Tickets' },
      { date: '2025-05', value: 4, text: 'May: 4 Tickets' },
      { date: '2025-06', value: 3, text: 'Jun: 3 Tickets' },
      { date: '2025-07', value: 6, text: 'Jul: 6 Tickets' },
      { date: '2025-08', value: 4, text: 'Aug: 4 Tickets' },
      { date: '2025-09', value: 5, text: 'Sep: 5 Tickets' },
      { date: '2025-10', value: 3, text: 'Oct: 3 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 120, cpuUsage: 60, diskSpace: 70, memoryUsage: 45 },
      { date: '2025-05-02', value: 140, cpuUsage: 65, diskSpace: 68, memoryUsage: 50 },
      { date: '2025-05-03', value: 160, cpuUsage: 70, diskSpace: 66, memoryUsage: 55 },
      { date: '2025-05-04', value: 180, cpuUsage: 75, diskSpace: 64, memoryUsage: 60 },
      { date: '2025-05-05', value: 200, cpuUsage: 80, diskSpace: 62, memoryUsage: 65 },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Printers', value: 15, color: 'blue' },
      { label: 'POS', value: 20, color: 'orange' },
      { label: 'Backoffice', value: 10, color: 'purple' },
      { label: 'Network', value: 15, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'yellow' },
      { label: 'Relationship', value: 70, color: 'orange' },
    ],
  },
  {
    id: 'INC5200002',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'POS Peripherals',
    priority: '3 - Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Assistant Manager - Boston #17118',
    Location: 'Boston, MA - Store #17118',
    imageType: 'network',
    iconType: null,
    title: 'POS21 Receipt Printer - Not Feeding Paper',
    status: 'medium',
    summary: `Printer powers on but won’t feed. Red error LED blinking.

<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- Auto-matched SOP: Step 2 (Paper & Consumables), Step 3 (Error/Cutter), Step 4 (Self-Test)
- Suggested Actions:
  • Reseat paper (correct orientation)
  • Clear jam; manually reset cutter
  • Hold FEED + Power for self-test
</code></pre>`,
    time: '09:41 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 2, text: 'Jan: 2 Tickets' },
      { date: '2025-02', value: 3, text: 'Feb: 3 Tickets' },
      { date: '2025-03', value: 4, text: 'Mar: 4 Tickets' },
      { date: '2025-04', value: 3, text: 'Apr: 3 Tickets' },
      { date: '2025-05', value: 5, text: 'May: 5 Tickets' },
      { date: '2025-06', value: 4, text: 'Jun: 4 Tickets' },
      { date: '2025-07', value: 3, text: 'Jul: 3 Tickets' },
      { date: '2025-08', value: 4, text: 'Aug: 4 Tickets' },
      { date: '2025-09', value: 2, text: 'Sep: 2 Tickets' },
      { date: '2025-10', value: 3, text: 'Oct: 3 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 110, cpuUsage: 55, diskSpace: 75, memoryUsage: 40 },
      { date: '2025-05-02', value: 130, cpuUsage: 60, diskSpace: 72, memoryUsage: 45 },
      { date: '2025-05-03', value: 150, cpuUsage: 65, diskSpace: 70, memoryUsage: 50 },
      { date: '2025-05-04', value: 170, cpuUsage: 70, diskSpace: 67, memoryUsage: 55 },
      { date: '2025-05-05', value: 190, cpuUsage: 75, diskSpace: 65, memoryUsage: 60 },
    ],
    ciCount: [
      { label: 'Overall', value: 58, color: 'green' },
      { label: 'Printers', value: 18, color: 'blue' },
      { label: 'POS', value: 22, color: 'orange' },
      { label: 'Backoffice', value: 9, color: 'purple' },
      { label: 'Network', value: 12, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 62, color: 'yellow' },
      { label: 'Relationship', value: 68, color: 'orange' },
    ],
  },
  {
    id: 'INC5200003',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'POS Configuration',
    priority: '3 - Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Shift Lead - Worcester #17118',
    Location: 'Worcester, MA - Store #17118',
    imageType: 'network',
    iconType: null,
    title: 'POS2 Receipt Printer - Incorrect Port Mapping',
    status: 'medium',
    summary: `Printer detected but jobs fail. Likely wrong COM/USB mapping after device swap.

<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- Auto-matched SOP: Step 5 (POS Software & Port)
- Suggested Actions:
  • Verify driver/model and port (USB/COM/IP)
  • Reassign correct port; restart POS & printer
  • Test print from POS
</code></pre>`,
    time: '10:05 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 4, text: 'Jan: 4 Tickets' },
      { date: '2025-02', value: 3, text: 'Feb: 3 Tickets' },
      { date: '2025-03', value: 2, text: 'Mar: 2 Tickets' },
      { date: '2025-04', value: 5, text: 'Apr: 5 Tickets' },
      { date: '2025-05', value: 3, text: 'May: 3 Tickets' },
      { date: '2025-06', value: 4, text: 'Jun: 4 Tickets' },
      { date: '2025-07', value: 2, text: 'Jul: 2 Tickets' },
      { date: '2025-08', value: 3, text: 'Aug: 3 Tickets' },
      { date: '2025-09', value: 4, text: 'Sep: 4 Tickets' },
      { date: '2025-10', value: 2, text: 'Oct: 2 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 90, cpuUsage: 50, diskSpace: 80, memoryUsage: 40 },
      { date: '2025-05-02', value: 110, cpuUsage: 55, diskSpace: 78, memoryUsage: 45 },
      { date: '2025-05-03', value: 130, cpuUsage: 60, diskSpace: 75, memoryUsage: 50 },
      { date: '2025-05-04', value: 150, cpuUsage: 65, diskSpace: 73, memoryUsage: 55 },
      { date: '2025-05-05', value: 170, cpuUsage: 70, diskSpace: 70, memoryUsage: 60 },
    ],
    ciCount: [
      { label: 'Overall', value: 62, color: 'green' },
      { label: 'Printers', value: 16, color: 'blue' },
      { label: 'POS', value: 24, color: 'orange' },
      { label: 'Backoffice', value: 8, color: 'purple' },
      { label: 'Network', value: 14, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 60, color: 'yellow' },
      { label: 'Relationship', value: 66, color: 'orange' },
    ],
  }
];

// Store 16339 Incidents
const incidentsStore16339: Incident[] = [
  {
    id: 'INC5200004',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Cash Drawer / EMC',
    priority: '2 - High',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Owner - Cambridge #16339',
    Location: 'Cambridge, MA - Store #16339',
    imageType: 'network',
    iconType: null,
    title: 'Cash Drawer Fault — Applied EMC Workaround',
    status: 'high',
    summary: `Drawer sensor failing; Oracle escalation pending. Store approved temporary workaround; drawer disabled in EMC to keep sales flowing.

<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- Procedure: P1535 EMC Workaround
- Actions:
  • EMC → Property → Setup → Workstations → Options
  • Disabled "Require Cash Drawer to be Closed Before New Transaction"
  • Refresh DB & reboot POS → Verify sale
- Note: Store must manually open drawer until re-enabled
</code></pre>`,
    time: '07:55 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 1, text: 'Jan: 1 Ticket' },
      { date: '2025-02', value: 2, text: 'Feb: 2 Tickets' },
      { date: '2025-03', value: 0, text: 'Mar: 0 Tickets' },
      { date: '2025-04', value: 3, text: 'Apr: 3 Tickets' },
      { date: '2025-05', value: 1, text: 'May: 1 Ticket' },
      { date: '2025-06', value: 2, text: 'Jun: 2 Tickets' },
      { date: '2025-07', value: 4, text: 'Jul: 4 Tickets' },
      { date: '2025-08', value: 1, text: 'Aug: 1 Ticket' },
      { date: '2025-09', value: 3, text: 'Sep: 3 Tickets' },
      { date: '2025-10', value: 2, text: 'Oct: 2 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 60, cpuUsage: 30, diskSpace: 90, memoryUsage: 30 },
      { date: '2025-05-02', value: 80, cpuUsage: 35, diskSpace: 88, memoryUsage: 35 },
      { date: '2025-05-03', value: 100, cpuUsage: 40, diskSpace: 86, memoryUsage: 40 },
      { date: '2025-05-04', value: 120, cpuUsage: 45, diskSpace: 84, memoryUsage: 45 },
      { date: '2025-05-05', value: 140, cpuUsage: 50, diskSpace: 82, memoryUsage: 50 },
    ],
    ciCount: [
      { label: 'Overall', value: 55, color: 'green' },
      { label: 'Cash Drawers', value: 8, color: 'blue' },
      { label: 'POS', value: 22, color: 'orange' },
      { label: 'Backoffice', value: 12, color: 'purple' },
      { label: 'Network', value: 13, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 58, color: 'yellow' },
      { label: 'Relationship', value: 63, color: 'orange' },
    ],
  },
  {
    id: 'INC5200005',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Kitchen Display / Printers',
    priority: '3 - Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Kitchen Lead - Providence #16339',
    Location: 'Providence, RI - Store #16339',
    imageType: 'network',
    iconType: null,
    title: 'KDS2 Receipt Printer - Faded Receipts',
    status: 'medium',
    summary: `KDS2 prints are very light and unreadable during rush.

<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- SOP Match: Step 2 (Paper/Consumables)
- Actions:
  • Replace thermal paper roll
  • Verify correct paper side & clean thermal head
  • Run self-test to confirm darkness level
</code></pre>`,
    time: '11:22 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 2, text: 'Jan: 2 Tickets' },
      { date: '2025-02', value: 3, text: 'Feb: 3 Tickets' },
      { date: '2025-03', value: 1, text: 'Mar: 1 Ticket' },
      { date: '2025-04', value: 4, text: 'Apr: 4 Tickets' },
      { date: '2025-05', value: 2, text: 'May: 2 Tickets' },
      { date: '2025-06', value: 3, text: 'Jun: 3 Tickets' },
      { date: '2025-07', value: 1, text: 'Jul: 1 Ticket' },
      { date: '2025-08', value: 2, text: 'Aug: 2 Tickets' },
      { date: '2025-09', value: 4, text: 'Sep: 4 Tickets' },
      { date: '2025-10', value: 3, text: 'Oct: 3 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 100, cpuUsage: 45, diskSpace: 85, memoryUsage: 40 },
      { date: '2025-05-02', value: 120, cpuUsage: 50, diskSpace: 83, memoryUsage: 45 },
      { date: '2025-05-03', value: 140, cpuUsage: 55, diskSpace: 81, memoryUsage: 50 },
      { date: '2025-05-04', value: 160, cpuUsage: 60, diskSpace: 79, memoryUsage: 55 },
      { date: '2025-05-05', value: 180, cpuUsage: 65, diskSpace: 77, memoryUsage: 60 },
    ],
    ciCount: [
      { label: 'Overall', value: 59, color: 'green' },
      { label: 'Printers', value: 17, color: 'blue' },
      { label: 'POS', value: 20, color: 'orange' },
      { label: 'Backoffice', value: 9, color: 'purple' },
      { label: 'Network', value: 13, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 61, color: 'yellow' },
      { label: 'Relationship', value: 64, color: 'orange' },
    ],
  },
  {
    id: 'INC5200006',
    link: 'https://example.service-now.com/nav_to.do?uri=incident.do',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Network',
    priority: '2 - High',
    urgency: '2-Medium',
    impact: '1-High',
    reportedBy: 'District Manager - North Shore',
    Location: 'Lynn, MA - Store #16339',
    imageType: 'network',
    iconType: null,
    title: 'Device Unreachable — POS Switch Rack 1',
    status: 'high',
    summary: `Multiple POS terminals offline; switch in Rack 1 not reachable.

<pre class="bg-[var(--accent-3)] px-3 rounded-lg mb-1 overflow-x-auto text-xs"><code class="block bg-[var(--accent-3)]  rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
Summary:
- Runbook: Device Unreachable
- Actions:
  • Verify power to switch; check UPS
  • Inspect uplink; reseat cables
  • If still unreachable, swap with known-good switch
  • Escalate to Network team if no link
</code></pre>`,
    time: '06:47 AM',
    pastDeviceIncident: [
      { date: '2025-01', value: 1, text: 'Jan: 1 Ticket' },
      { date: '2025-02', value: 0, text: 'Feb: 0 Tickets' },
      { date: '2025-03', value: 2, text: 'Mar: 2 Tickets' },
      { date: '2025-04', value: 1, text: 'Apr: 1 Ticket' },
      { date: '2025-05', value: 3, text: 'May: 3 Tickets' },
      { date: '2025-06', value: 2, text: 'Jun: 2 Tickets' },
      { date: '2025-07', value: 4, text: 'Jul: 4 Tickets' },
      { date: '2025-08', value: 1, text: 'Aug: 1 Ticket' },
      { date: '2025-09', value: 2, text: 'Sep: 2 Tickets' },
      { date: '2025-10', value: 5, text: 'Oct: 5 Tickets' },
    ],
    pastAlerts: [
      { date: '2025-05-01', value: 220, cpuUsage: 85, diskSpace: 70, memoryUsage: 65 },
      { date: '2025-05-02', value: 260, cpuUsage: 90, diskSpace: 65, memoryUsage: 70 },
      { date: '2025-05-03', value: 300, cpuUsage: 95, diskSpace: 60, memoryUsage: 75 },
      { date: '2025-05-04', value: 340, cpuUsage: 95, diskSpace: 55, memoryUsage: 78 },
      { date: '2025-05-05', value: 380, cpuUsage: 95, diskSpace: 50, memoryUsage: 80 },
    ],
    ciCount: [
      { label: 'Overall', value: 52, color: 'green' },
      { label: 'Printers', value: 10, color: 'blue' },
      { label: 'POS', value: 28, color: 'orange' },
      { label: 'Backoffice', value: 6, color: 'purple' },
      { label: 'Network', value: 20, color: 'red' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 57, color: 'yellow' },
      { label: 'Relationship', value: 69, color: 'orange' },
    ],
  },
];


function DesktopCopilot() {
  const [selectedStore, setSelectedStore] = useState<string>('17118');
  const [selectedItem, setSelectedItem] = useState<Incident | Alert | null>(
    incidentsStore17118[incidentsStore17118.length - 1], // Set default to last incident from store 17118
  );
  const [answers, setAnswers] = useState<[string, any][]>([]);

  // Get current incidents based on selected store
  const currentIncidents = selectedStore === '17118' ? incidentsStore17118 : incidentsStore16339;

  const handleStoreChange = (storeId: string) => {
    setSelectedStore(storeId);
    // Reset selected item to first incident of the new store
    const newIncidents = storeId === '17118' ? incidentsStore17118 : incidentsStore16339;
    setSelectedItem(newIncidents[0]);
    setAnswers([]); // Clear chat when switching stores
  };

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
          <Flex align="center" gap="3">
            <Image
              src={logo}
              alt="Popeyes Logo"
              width={125}
              height={75}
              className="object-contain"
            />
            <Text size="4" weight="medium">
              {JSON.parse(organization?.config || '{}').Modules?.expert_copilot
                ?.name ?? 'Franchisee Self Service'}
            </Text>
          </Flex>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Flex
          direction="column"
          className="w-1/4 border-r border-[var(--gray-8)]"
        >
          <Box className=" border-b border-[var(--gray-8)]">
            <Text size="2" weight="bold" className="text-neutral-l2 ml-2">Store ID:</Text>
            <Select.Root value={selectedStore} onValueChange={handleStoreChange}>
              <Select.Trigger 
                className="w-full" 
                placeholder="Select Store"
              />
              <Select.Content>
                <Select.Item value="17118">
                  #17118
                </Select.Item>
                <Select.Item value="16339">
                  #16339
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>
          <Box className="overflow-hidden">
            <IncidentList
              incidents={currentIncidents}
              onSelect={handleIncidentSelect}
              selectedItemId={selectedItem?.id}
              isFranchiseOwner = {true}
            />
          </Box>
        </Flex>
        <Box className="w-1/3">
        <Details selectedItem={selectedItem} answers={answers} />
        </Box>
        <Box className="w-1/2 overflow-auto border-l-1 border-neutral-11">
          
          <DesktopChat
            selectedItem={selectedItem}
            answers={answers}
            setAnswers={setAnswers}
          />
        </Box>
      </Flex>
    </Flex>
  );
}

export default DesktopCopilot;
