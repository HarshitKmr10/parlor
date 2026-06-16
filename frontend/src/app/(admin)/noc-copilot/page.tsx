'use client';

import { Box, Text, Flex } from '@radix-ui/themes';
import Details from 'components/chat/Details';
import IncidentList, { Incident } from 'components/chat/IncidentList';
import NOCChatPage from 'components/chat/NOCChatPage';
import withAuth from 'components/withAuth';
import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalContext } from 'contexts/store';
import { useTranslation } from 'react-i18next';
import AlertList, { Alert } from './AlertList';

const incidents = [
  {
    id: 'INC0010153',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D1acebd6593f30a105df2f7718bba1095',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Memory Usage',
    priority: '3-Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Monitoring System',
    Location: 'Rack 9, Server 2',
    imageType: 'monitor',
    iconType: null,
    title: 'High Memory Utilization',
    status: 'medium',
    summary: `
    NOC Virtual Agent (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L1 resolver group:
    - The NVA identified this runbook 'High Memory Utilization - Runbook' which may help with this issue.
    - NVA located similar issues which have been resolved by this L1 resolver group.

    Similar Incidents:

    Incident 1:
    - Memory Utilization High on: 172.16.10.34 (currently used 92%)
    - CI Information: AppServer07
    - Location: Dallas
    - Opened: 07/18/24 14:35
    - Priority: 3 - Moderate
    - Status: Closed
    - Resolution:
      - Cleared High Memory Usage:
        * Identified and terminated high memory-consuming processes.
        * Optimized virtual memory settings.
        * Memory usage reduced to 55%, stabilizing the performance.
    `,
    time: '6:17 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 80, text: 'Memory: 80% Usage' },
      { date: '2024-05-02', value: 85, text: 'Memory: 85% Usage' },
      { date: '2024-05-03', value: 90, text: 'Memory: 90% Usage' },
      { date: '2024-05-04', value: 88, text: 'Memory: 88% Usage' },
      { date: '2024-05-05', value: 92, text: 'Memory: 92% Usage' },
      { date: '2024-05-06', value: 95, text: 'Memory: 95% Usage' },
      { date: '2024-05-07', value: 89, text: 'Memory: 89% Usage' },
      { date: '2024-05-08', value: 91, text: 'Memory: 91% Usage' },
      { date: '2024-05-09', value: 87, text: 'Memory: 87% Usage' },
      { date: '2024-05-10', value: 93, text: 'Memory: 93% Usage' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 300,
        cpuUsage: 85,
        diskSpace: 85,
        memoryUsage: 65,
      },
      {
        date: '2024-05-02',
        value: 250,
        cpuUsage: 80,
        diskSpace: 90,
        memoryUsage: 60,
      },
      {
        date: '2024-05-03',
        value: 350,
        cpuUsage: 90,
        diskSpace: 95,
        memoryUsage: 70,
      },
      {
        date: '2024-05-04',
        value: 200,
        cpuUsage: 70,
        diskSpace: 87,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 150,
        cpuUsage: 65,
        diskSpace: 69,
        memoryUsage: 50,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 60,
        diskSpace: 88,
        memoryUsage: 45,
      },
      {
        date: '2024-05-07',
        value: 400,
        cpuUsage: 95,
        diskSpace: 92,
        memoryUsage: 75,
      },
      {
        date: '2024-05-08',
        value: 450,
        cpuUsage: 95,
        diskSpace: 56,
        memoryUsage: 75,
      },
      {
        date: '2024-05-09',
        value: 300,
        cpuUsage: 85,
        diskSpace: 75,
        memoryUsage: 65,
      },
      {
        date: '2024-05-10',
        value: 250,
        cpuUsage: 80,
        diskSpace: 48,
        memoryUsage: 60,
      },
      {
        date: '2024-05-11',
        value: 200,
        cpuUsage: 70,
        diskSpace: 94,
        memoryUsage: 55,
      },
      {
        date: '2024-05-12',
        value: 350,
        cpuUsage: 90,
        diskSpace: 87,
        memoryUsage: 70,
      },
      {
        date: '2024-05-13',
        value: 150,
        cpuUsage: 65,
        diskSpace: 83,
        memoryUsage: 50,
      },
      {
        date: '2024-05-14',
        value: 100,
        cpuUsage: 60,
        diskSpace: 86,
        memoryUsage: 45,
      },
      {
        date: '2024-05-15',
        value: 400,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-16',
        value: 450,
        cpuUsage: 95,
        diskSpace: 45,
        memoryUsage: 75,
      },
      {
        date: '2024-05-17',
        value: 300,
        cpuUsage: 85,
        diskSpace: 58,
        memoryUsage: 65,
      },
      {
        date: '2024-05-18',
        value: 350,
        cpuUsage: 90,
        diskSpace: 66,
        memoryUsage: 70,
      },
      {
        date: '2024-05-19',
        value: 250,
        cpuUsage: 80,
        diskSpace: 78,
        memoryUsage: 60,
      },
      {
        date: '2024-05-20',
        value: 200,
        cpuUsage: 70,
        diskSpace: 85,
        memoryUsage: 55,
      },
      {
        date: '2024-05-21',
        value: 150,
        cpuUsage: 65,
        diskSpace: 88,
        memoryUsage: 50,
      },
      {
        date: '2024-05-22',
        value: 100,
        cpuUsage: 60,
        diskSpace: 92,
        memoryUsage: 45,
      },
      {
        date: '2024-05-23',
        value: 450,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-24',
        value: 400,
        cpuUsage: 90,
        diskSpace: 96,
        memoryUsage: 70,
      },
      {
        date: '2024-05-25',
        value: 350,
        cpuUsage: 90,
        diskSpace: 98,
        memoryUsage: 70,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Category A', value: 10, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 20, color: 'purple' },
      { label: 'Category D', value: 25, color: 'orange' },
      { label: 'Category E', value: 30, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },

  {
    id: 'INC0010154',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D1bfa61b993774a105df2f7718bba10e0',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Disk Usage',
    priority: '3-Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Monitoring System',
    Location: 'Rack 12, Server 5',
    imageType: 'monitor',
    iconType: null,
    title: 'High Disk Utilization',
    status: 'medium',
    summary: `
    NOC Virtual Agent (NVA) Summary:

      This Incident was procesed by NVA and was assigned to ICC (L1) resolver group - 
      - NVA located similar issues which have been resolved by ICC (L1) resolver group.
      - The NVA identified this runbook 'High Disk Utilization - Runbook' which may help with this issue.    
      Based on the ‘High Disk Utilization - Runbook’, here are the steps to resolve it:

        1.	Reconfirm High Disk Usage
        2.	Identify Large Files and Folders
        3.	Clear Temporary Files
        4.	Check for Disk Errors
        5.	Archive or Delete Old Files
        6.	Monitor Disk Usage

    Similar Incidents:

    Incident 1 - 
      - Disk Usage High on: 10.118.11.45 (currently used 88.7%)
      - CI Information: WebServer05
      - Location: Chicago
      - Opened: 06/15/24 10:20
      - Priority: 3 - Moderate
      - Status: Closed
      - Resolution:
      - Cleared Log Files and Temporary Files:
      * Identified and deleted large log files and temporary files that were no longer needed.
      * Disk usage reduced to 65%, stabilizing the performance.
  
    Incident 2 - 
      - Disk Usage High on: 192.168.10.21 (currently used 95%)
      - CI Information: WebServer01
      - Location: New York
      - Opened: 01/08/24 14:45
      - Priority: 3 - Moderate
      - Status: Closed
      - Resolution:
      - Freed Up Disk Space:
      * Deleted unnecessary log files and temporary files.
      * Uninstalled unused applications and performed disk defragmentation.
      * Disk usage dropped to 70%, resolving the issue.
    `,
    time: '8:15 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 80, text: 'Disk: 80% Usage' },
      { date: '2024-05-02', value: 85, text: 'Disk: 85% Usage' },
      { date: '2024-05-03', value: 90, text: 'Disk: 90% Usage' },
      { date: '2024-05-04', value: 88, text: 'Disk: 88% Usage' },
      { date: '2024-05-05', value: 92, text: 'Disk: 92% Usage' },
      { date: '2024-05-06', value: 95, text: 'Disk: 95% Usage' },
      { date: '2024-05-07', value: 89, text: 'Disk: 89% Usage' },
      { date: '2024-05-08', value: 91, text: 'Disk: 91% Usage' },
      { date: '2024-05-09', value: 87, text: 'Disk: 87% Usage' },
      { date: '2024-05-10', value: 93, text: 'Disk: 93% Usage' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 300,
        cpuUsage: 85,
        diskSpace: 85,
        memoryUsage: 65,
      },
      {
        date: '2024-05-02',
        value: 250,
        cpuUsage: 80,
        diskSpace: 90,
        memoryUsage: 60,
      },
      {
        date: '2024-05-03',
        value: 350,
        cpuUsage: 90,
        diskSpace: 95,
        memoryUsage: 70,
      },
      {
        date: '2024-05-04',
        value: 200,
        cpuUsage: 70,
        diskSpace: 87,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 150,
        cpuUsage: 65,
        diskSpace: 69,
        memoryUsage: 50,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 60,
        diskSpace: 88,
        memoryUsage: 45,
      },
      {
        date: '2024-05-07',
        value: 400,
        cpuUsage: 95,
        diskSpace: 92,
        memoryUsage: 75,
      },
      {
        date: '2024-05-08',
        value: 450,
        cpuUsage: 95,
        diskSpace: 56,
        memoryUsage: 75,
      },
      {
        date: '2024-05-09',
        value: 300,
        cpuUsage: 85,
        diskSpace: 75,
        memoryUsage: 65,
      },
      {
        date: '2024-05-10',
        value: 250,
        cpuUsage: 80,
        diskSpace: 48,
        memoryUsage: 60,
      },
      {
        date: '2024-05-11',
        value: 200,
        cpuUsage: 70,
        diskSpace: 94,
        memoryUsage: 55,
      },
      {
        date: '2024-05-12',
        value: 350,
        cpuUsage: 90,
        diskSpace: 87,
        memoryUsage: 70,
      },
      {
        date: '2024-05-13',
        value: 150,
        cpuUsage: 65,
        diskSpace: 83,
        memoryUsage: 50,
      },
      {
        date: '2024-05-14',
        value: 100,
        cpuUsage: 60,
        diskSpace: 86,
        memoryUsage: 45,
      },
      {
        date: '2024-05-15',
        value: 400,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-16',
        value: 450,
        cpuUsage: 95,
        diskSpace: 45,
        memoryUsage: 75,
      },
      {
        date: '2024-05-17',
        value: 300,
        cpuUsage: 85,
        diskSpace: 58,
        memoryUsage: 65,
      },
      {
        date: '2024-05-18',
        value: 350,
        cpuUsage: 90,
        diskSpace: 66,
        memoryUsage: 70,
      },
      {
        date: '2024-05-19',
        value: 250,
        cpuUsage: 80,
        diskSpace: 78,
        memoryUsage: 60,
      },
      {
        date: '2024-05-20',
        value: 200,
        cpuUsage: 70,
        diskSpace: 85,
        memoryUsage: 55,
      },
      {
        date: '2024-05-21',
        value: 150,
        cpuUsage: 65,
        diskSpace: 88,
        memoryUsage: 50,
      },
      {
        date: '2024-05-22',
        value: 100,
        cpuUsage: 60,
        diskSpace: 92,
        memoryUsage: 45,
      },
      {
        date: '2024-05-23',
        value: 450,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-24',
        value: 400,
        cpuUsage: 90,
        diskSpace: 96,
        memoryUsage: 70,
      },
      {
        date: '2024-05-25',
        value: 350,
        cpuUsage: 90,
        diskSpace: 98,
        memoryUsage: 70,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Category A', value: 10, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 20, color: 'purple' },
      { label: 'Category D', value: 25, color: 'orange' },
      { label: 'Category E', value: 30, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },

  {
    id: 'INC0010155',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D5dbc393593f74a105df2f7718bba1061',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Device Unreachable',
    priority: '3-Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Monitoring System',
    Location: 'Rack 7, Server 4',
    imageType: 'monitor',
    iconType: null,
    title: 'Device Unreachable',
    status: 'medium',
    summary: `
    NOC Virtual Agent (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L1 resolver group:
    - The NVA identified this runbook 'Device unreachable - Runbook' which may help with this issue.

    Similar Incidents:
    NVA could not find any similar incidents. 
    `,
    time: '11:08 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 80, text: 'Network: 80% Usage' },
      { date: '2024-05-02', value: 85, text: 'Network: 85% Usage' },
      { date: '2024-05-03', value: 90, text: 'Network: 90% Usage' },
      { date: '2024-05-04', value: 88, text: 'Network: 88% Usage' },
      { date: '2024-05-05', value: 92, text: 'Network: 92% Usage' },
      { date: '2024-05-06', value: 95, text: 'Network: 95% Usage' },
      { date: '2024-05-07', value: 89, text: 'Network: 89% Usage' },
      { date: '2024-05-08', value: 91, text: 'Network: 91% Usage' },
      { date: '2024-05-09', value: 87, text: 'Network: 87% Usage' },
      { date: '2024-05-10', value: 93, text: 'Network: 93% Usage' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 300,
        cpuUsage: 85,
        diskSpace: 85,
        memoryUsage: 65,
      },
      {
        date: '2024-05-02',
        value: 250,
        cpuUsage: 80,
        diskSpace: 90,
        memoryUsage: 60,
      },
      {
        date: '2024-05-03',
        value: 350,
        cpuUsage: 90,
        diskSpace: 95,
        memoryUsage: 70,
      },
      {
        date: '2024-05-04',
        value: 200,
        cpuUsage: 70,
        diskSpace: 87,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 150,
        cpuUsage: 65,
        diskSpace: 69,
        memoryUsage: 50,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 60,
        diskSpace: 88,
        memoryUsage: 45,
      },
      {
        date: '2024-05-07',
        value: 400,
        cpuUsage: 95,
        diskSpace: 92,
        memoryUsage: 75,
      },
      {
        date: '2024-05-08',
        value: 450,
        cpuUsage: 95,
        diskSpace: 56,
        memoryUsage: 75,
      },
      {
        date: '2024-05-09',
        value: 300,
        cpuUsage: 85,
        diskSpace: 75,
        memoryUsage: 65,
      },
      {
        date: '2024-05-10',
        value: 250,
        cpuUsage: 80,
        diskSpace: 48,
        memoryUsage: 60,
      },
      {
        date: '2024-05-11',
        value: 200,
        cpuUsage: 70,
        diskSpace: 94,
        memoryUsage: 55,
      },
      {
        date: '2024-05-12',
        value: 350,
        cpuUsage: 90,
        diskSpace: 87,
        memoryUsage: 70,
      },
      {
        date: '2024-05-13',
        value: 150,
        cpuUsage: 65,
        diskSpace: 83,
        memoryUsage: 50,
      },
      {
        date: '2024-05-14',
        value: 100,
        cpuUsage: 60,
        diskSpace: 86,
        memoryUsage: 45,
      },
      {
        date: '2024-05-15',
        value: 400,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-16',
        value: 450,
        cpuUsage: 95,
        diskSpace: 45,
        memoryUsage: 75,
      },
      {
        date: '2024-05-17',
        value: 300,
        cpuUsage: 85,
        diskSpace: 58,
        memoryUsage: 65,
      },
      {
        date: '2024-05-18',
        value: 350,
        cpuUsage: 90,
        diskSpace: 66,
        memoryUsage: 70,
      },
      {
        date: '2024-05-19',
        value: 250,
        cpuUsage: 80,
        diskSpace: 78,
        memoryUsage: 60,
      },
      {
        date: '2024-05-20',
        value: 200,
        cpuUsage: 70,
        diskSpace: 85,
        memoryUsage: 55,
      },
      {
        date: '2024-05-21',
        value: 150,
        cpuUsage: 65,
        diskSpace: 88,
        memoryUsage: 50,
      },
      {
        date: '2024-05-22',
        value: 100,
        cpuUsage: 60,
        diskSpace: 92,
        memoryUsage: 45,
      },
      {
        date: '2024-05-23',
        value: 450,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-24',
        value: 400,
        cpuUsage: 90,
        diskSpace: 96,
        memoryUsage: 70,
      },
      {
        date: '2024-05-25',
        value: 350,
        cpuUsage: 90,
        diskSpace: 98,
        memoryUsage: 70,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Category A', value: 10, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 20, color: 'purple' },
      { label: 'Category D', value: 25, color: 'orange' },
      { label: 'Category E', value: 30, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },

  {
    id: 'INC0010156',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D7f06cabd93f74a105df2f7718bba108e',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'CPU Usage',
    priority: '3-Moderate',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Monitoring System',
    Location: 'Rack 3, Server 9',
    imageType: 'monitor',
    iconType: null,
    title: 'High CPU Utilization',
    status: 'medium',
    summary: `
    NOC Virtual Agent (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L1 resolver group:
    - The NVA identified this runbook 'High CPU Utilization - Runbook' which may help with this issue.
    - NVA located similar issues which have been resolved by this L1 resolver group.

    Similar Incidents:

    Incident 1:
    - CPU Utilization High on: 172.16.10.56 (currently used 92%)
    - CI Information: AppServer07
    - Location: Dallas
    - Opened: 07/18/24 9:35
    - Priority: 3 - Moderate
    - Status: Closed
    - Resolution:
      - Cleared High CPU Usage:
        * Identified and terminated high CPU-consuming processes.
        * Updated system and drivers.
        * CPU usage reduced to 45%, stabilizing the performance.
    
    NVA Insights:

    The same incident has been encountered and resolved 3 times today. 
    `,
    time: '3:50 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 80, text: 'Network: 80% Usage' },
      { date: '2024-05-02', value: 85, text: 'Network: 85% Usage' },
      { date: '2024-05-03', value: 90, text: 'Network: 90% Usage' },
      { date: '2024-05-04', value: 88, text: 'Network: 88% Usage' },
      { date: '2024-05-05', value: 92, text: 'Network: 92% Usage' },
      { date: '2024-05-06', value: 95, text: 'Network: 95% Usage' },
      { date: '2024-05-07', value: 89, text: 'Network: 89% Usage' },
      { date: '2024-05-08', value: 91, text: 'Network: 91% Usage' },
      { date: '2024-05-09', value: 87, text: 'Network: 87% Usage' },
      { date: '2024-05-10', value: 93, text: 'Network: 93% Usage' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 300,
        cpuUsage: 85,
        diskSpace: 85,
        memoryUsage: 65,
      },
      {
        date: '2024-05-02',
        value: 250,
        cpuUsage: 80,
        diskSpace: 90,
        memoryUsage: 60,
      },
      {
        date: '2024-05-03',
        value: 350,
        cpuUsage: 90,
        diskSpace: 95,
        memoryUsage: 70,
      },
      {
        date: '2024-05-04',
        value: 200,
        cpuUsage: 70,
        diskSpace: 87,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 150,
        cpuUsage: 65,
        diskSpace: 69,
        memoryUsage: 50,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 60,
        diskSpace: 88,
        memoryUsage: 45,
      },
      {
        date: '2024-05-07',
        value: 400,
        cpuUsage: 95,
        diskSpace: 92,
        memoryUsage: 75,
      },
      {
        date: '2024-05-08',
        value: 450,
        cpuUsage: 95,
        diskSpace: 56,
        memoryUsage: 75,
      },
      {
        date: '2024-05-09',
        value: 300,
        cpuUsage: 85,
        diskSpace: 75,
        memoryUsage: 65,
      },
      {
        date: '2024-05-10',
        value: 250,
        cpuUsage: 80,
        diskSpace: 48,
        memoryUsage: 60,
      },
      {
        date: '2024-05-11',
        value: 200,
        cpuUsage: 70,
        diskSpace: 94,
        memoryUsage: 55,
      },
      {
        date: '2024-05-12',
        value: 350,
        cpuUsage: 90,
        diskSpace: 87,
        memoryUsage: 70,
      },
      {
        date: '2024-05-13',
        value: 150,
        cpuUsage: 65,
        diskSpace: 83,
        memoryUsage: 50,
      },
      {
        date: '2024-05-14',
        value: 100,
        cpuUsage: 60,
        diskSpace: 86,
        memoryUsage: 45,
      },
      {
        date: '2024-05-15',
        value: 400,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-16',
        value: 450,
        cpuUsage: 95,
        diskSpace: 45,
        memoryUsage: 75,
      },
      {
        date: '2024-05-17',
        value: 300,
        cpuUsage: 85,
        diskSpace: 58,
        memoryUsage: 65,
      },
      {
        date: '2024-05-18',
        value: 350,
        cpuUsage: 90,
        diskSpace: 66,
        memoryUsage: 70,
      },
      {
        date: '2024-05-19',
        value: 250,
        cpuUsage: 80,
        diskSpace: 78,
        memoryUsage: 60,
      },
      {
        date: '2024-05-20',
        value: 200,
        cpuUsage: 70,
        diskSpace: 85,
        memoryUsage: 55,
      },
      {
        date: '2024-05-21',
        value: 150,
        cpuUsage: 65,
        diskSpace: 88,
        memoryUsage: 50,
      },
      {
        date: '2024-05-22',
        value: 100,
        cpuUsage: 60,
        diskSpace: 92,
        memoryUsage: 45,
      },
      {
        date: '2024-05-23',
        value: 450,
        cpuUsage: 95,
        diskSpace: 95,
        memoryUsage: 75,
      },
      {
        date: '2024-05-24',
        value: 400,
        cpuUsage: 90,
        diskSpace: 96,
        memoryUsage: 70,
      },
      {
        date: '2024-05-25',
        value: 350,
        cpuUsage: 90,
        diskSpace: 98,
        memoryUsage: 70,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Category A', value: 10, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 20, color: 'purple' },
      { label: 'Category D', value: 25, color: 'orange' },
      { label: 'Category E', value: 30, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },
];

const alerts = [
  {
    id: '1',
    type: 'alert',
    alertState: 'Active',
    alertType: 'Memory Leak',
    priority: '2-Medium',
    criticality: '2-Medium',
    reportedBy: 'System Monitor',
    imageType: 'network',
    iconType: null,
    title: 'Potential Memory Leak Detected',
    status: 'medium',
    summary: 'Memory usage has been increasing steadily over the past hour.',
    time: '3:30 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 2, text: 'Leak: 2 Instances' },
      { date: '2024-05-02', value: 4, text: 'Leak: 4 Instances' },
      { date: '2024-05-03', value: 5, text: 'Leak: 5 Instances' },
      { date: '2024-05-04', value: 3, text: 'Leak: 3 Instances' },
      { date: '2024-05-05', value: 6, text: 'Leak: 6 Instances' },
      { date: '2024-05-06', value: 2, text: 'Leak: 2 Instances' },
      { date: '2024-05-07', value: 7, text: 'Leak: 7 Instances' },
      { date: '2024-05-08', value: 5, text: 'Leak: 5 Instances' },
      { date: '2024-05-09', value: 1, text: 'Leak: 1 Instance' },
      { date: '2024-05-10', value: 3, text: 'Leak: 3 Instances' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 200,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-02',
        value: 180,
        cpuUsage: 65,
        diskSpace: 40,
        memoryUsage: 50,
      },
      {
        date: '2024-05-03',
        value: 210,
        cpuUsage: 75,
        diskSpace: 30,
        memoryUsage: 60,
      },
      {
        date: '2024-05-04',
        value: 190,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 220,
        cpuUsage: 80,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-06',
        value: 200,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-07',
        value: 240,
        cpuUsage: 85,
        diskSpace: 20,
        memoryUsage: 70,
      },
      {
        date: '2024-05-08',
        value: 210,
        cpuUsage: 75,
        diskSpace: 30,
        memoryUsage: 60,
      },
      {
        date: '2024-05-09',
        value: 180,
        cpuUsage: 65,
        diskSpace: 40,
        memoryUsage: 50,
      },
      {
        date: '2024-05-10',
        value: 220,
        cpuUsage: 80,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-11',
        value: 240,
        cpuUsage: 85,
        diskSpace: 20,
        memoryUsage: 70,
      },
      {
        date: '2024-05-12',
        value: 200,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-13',
        value: 220,
        cpuUsage: 80,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-14',
        value: 190,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-15',
        value: 240,
        cpuUsage: 85,
        diskSpace: 20,
        memoryUsage: 70,
      },
      {
        date: '2024-05-16',
        value: 180,
        cpuUsage: 65,
        diskSpace: 40,
        memoryUsage: 50,
      },
      {
        date: '2024-05-17',
        value: 210,
        cpuUsage: 75,
        diskSpace: 30,
        memoryUsage: 60,
      },
      {
        date: '2024-05-18',
        value: 200,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-19',
        value: 230,
        cpuUsage: 80,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-20',
        value: 190,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-21',
        value: 220,
        cpuUsage: 80,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-22',
        value: 200,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-23',
        value: 240,
        cpuUsage: 85,
        diskSpace: 20,
        memoryUsage: 70,
      },
      {
        date: '2024-05-24',
        value: 190,
        cpuUsage: 70,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-25',
        value: 210,
        cpuUsage: 75,
        diskSpace: 30,
        memoryUsage: 60,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 75, color: 'green' },
      { label: 'Category A', value: 25, color: 'blue' },
      { label: 'Category B', value: 18, color: 'red' },
      { label: 'Category C', value: 12, color: 'purple' },
      { label: 'Category D', value: 30, color: 'orange' },
      { label: 'Category E', value: 20, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 60, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },
  {
    id: '2',
    type: 'alert',
    alertState: 'Active',
    alertType: 'Disk Space',
    priority: '1-High',
    criticality: '1-High',
    reportedBy: 'Monitoring System',
    imageType: 'monitor',
    iconType: null,
    title: 'Disk Space Running Low',
    status: 'high',
    summary: 'The main database server is running out of disk space.',
    time: '1:15 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 8, text: 'Disk Space: 8 Warnings' },
      { date: '2024-05-02', value: 5, text: 'Disk Space: 5 Warnings' },
      { date: '2024-05-03', value: 7, text: 'Disk Space: 7 Warnings' },
      { date: '2024-05-04', value: 4, text: 'Disk Space: 4 Warnings' },
      { date: '2024-05-05', value: 6, text: 'Disk Space: 6 Warnings' },
      { date: '2024-05-06', value: 5, text: 'Disk Space: 5 Warnings' },
      { date: '2024-05-07', value: 9, text: 'Disk Space: 9 Warnings' },
      { date: '2024-05-08', value: 3, text: 'Disk Space: 3 Warnings' },
      { date: '2024-05-09', value: 7, text: 'Disk Space: 7 Warnings' },
      { date: '2024-05-10', value: 6, text: 'Disk Space: 6 Warnings' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 350,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-02',
        value: 300,
        cpuUsage: 75,
        diskSpace: 20,
        memoryUsage: 55,
      },
      {
        date: '2024-05-03',
        value: 400,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-04',
        value: 380,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-05',
        value: 450,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-06',
        value: 360,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-07',
        value: 420,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-08',
        value: 400,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-09',
        value: 350,
        cpuUsage: 75,
        diskSpace: 20,
        memoryUsage: 55,
      },
      {
        date: '2024-05-10',
        value: 430,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-11',
        value: 380,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-12',
        value: 450,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-13',
        value: 400,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-14',
        value: 380,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-15',
        value: 430,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-16',
        value: 360,
        cpuUsage: 75,
        diskSpace: 20,
        memoryUsage: 55,
      },
      {
        date: '2024-05-17',
        value: 400,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-18',
        value: 380,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-19',
        value: 450,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-20',
        value: 400,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-21',
        value: 360,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-22',
        value: 430,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
      {
        date: '2024-05-23',
        value: 400,
        cpuUsage: 85,
        diskSpace: 10,
        memoryUsage: 65,
      },
      {
        date: '2024-05-24',
        value: 380,
        cpuUsage: 80,
        diskSpace: 15,
        memoryUsage: 60,
      },
      {
        date: '2024-05-25',
        value: 450,
        cpuUsage: 90,
        diskSpace: 5,
        memoryUsage: 70,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 70, color: 'green' },
      { label: 'Category A', value: 22, color: 'blue' },
      { label: 'Category B', value: 14, color: 'red' },
      { label: 'Category C', value: 10, color: 'purple' },
      { label: 'Category D', value: 30, color: 'orange' },
      { label: 'Category E', value: 25, color: 'yellow' },
      { label: 'Category F', value: 34, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 55, color: 'red' },
      { label: 'Relationship', value: 65, color: 'red' },
    ],
  },
  {
    id: '3',
    type: 'alert',
    alertState: 'Active',
    alertType: 'Network Latency',
    priority: '3-Low',
    criticality: '3-Low',
    reportedBy: 'Network Monitor',
    imageType: 'network',
    iconType: null,
    title: 'High Network Latency',
    status: 'low',
    summary: 'Increased latency detected on the main network route.',
    time: '4:55 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 3, text: 'Latency: 3 Spikes' },
      { date: '2024-05-02', value: 5, text: 'Latency: 5 Spikes' },
      { date: '2024-05-03', value: 2, text: 'Latency: 2 Spikes' },
      { date: '2024-05-04', value: 4, text: 'Latency: 4 Spikes' },
      { date: '2024-05-05', value: 1, text: 'Latency: 1 Spike' },
      { date: '2024-05-06', value: 6, text: 'Latency: 6 Spikes' },
      { date: '2024-05-07', value: 5, text: 'Latency: 5 Spikes' },
      { date: '2024-05-08', value: 3, text: 'Latency: 3 Spikes' },
      { date: '2024-05-09', value: 2, text: 'Latency: 2 Spikes' },
      { date: '2024-05-10', value: 4, text: 'Latency: 4 Spikes' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
      {
        date: '2024-05-02',
        value: 90,
        cpuUsage: 45,
        diskSpace: 45,
        memoryUsage: 40,
      },
      {
        date: '2024-05-03',
        value: 110,
        cpuUsage: 55,
        diskSpace: 35,
        memoryUsage: 50,
      },
      {
        date: '2024-05-04',
        value: 120,
        cpuUsage: 60,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-05',
        value: 130,
        cpuUsage: 65,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
      {
        date: '2024-05-07',
        value: 110,
        cpuUsage: 55,
        diskSpace: 35,
        memoryUsage: 50,
      },
      {
        date: '2024-05-08',
        value: 90,
        cpuUsage: 45,
        diskSpace: 45,
        memoryUsage: 40,
      },
      {
        date: '2024-05-09',
        value: 130,
        cpuUsage: 65,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-10',
        value: 120,
        cpuUsage: 60,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-11',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
      {
        date: '2024-05-12',
        value: 110,
        cpuUsage: 55,
        diskSpace: 35,
        memoryUsage: 50,
      },
      {
        date: '2024-05-13',
        value: 120,
        cpuUsage: 60,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-14',
        value: 130,
        cpuUsage: 65,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-15',
        value: 90,
        cpuUsage: 45,
        diskSpace: 45,
        memoryUsage: 40,
      },
      {
        date: '2024-05-16',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
      {
        date: '2024-05-17',
        value: 110,
        cpuUsage: 55,
        diskSpace: 35,
        memoryUsage: 50,
      },
      {
        date: '2024-05-18',
        value: 120,
        cpuUsage: 60,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-19',
        value: 130,
        cpuUsage: 65,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-20',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
      {
        date: '2024-05-21',
        value: 90,
        cpuUsage: 45,
        diskSpace: 45,
        memoryUsage: 40,
      },
      {
        date: '2024-05-22',
        value: 110,
        cpuUsage: 55,
        diskSpace: 35,
        memoryUsage: 50,
      },
      {
        date: '2024-05-23',
        value: 120,
        cpuUsage: 60,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-24',
        value: 130,
        cpuUsage: 65,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-25',
        value: 100,
        cpuUsage: 50,
        diskSpace: 40,
        memoryUsage: 45,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 60, color: 'green' },
      { label: 'Category A', value: 20, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 10, color: 'purple' },
      { label: 'Category D', value: 25, color: 'orange' },
      { label: 'Category E', value: 20, color: 'yellow' },
      { label: 'Category F', value: 30, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 50, color: 'red' },
      { label: 'Relationship', value: 60, color: 'red' },
    ],
  },
  {
    id: '4',
    type: 'alert',
    alertState: 'Active',
    alertType: 'CPU Usage',
    priority: '1-High',
    criticality: '1-High',
    reportedBy: 'Monitoring System',
    imageType: 'security',
    iconType: null,
    title: 'Unauthorized Access Attempt Detected',
    status: 'high',
    summary: 'Multiple unauthorized access attempts detected on server 5.',
    time: '2:45 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-02', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-03', value: 10, text: 'Access: 10 Attempts' },
      { date: '2024-05-04', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-05', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-06', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-07', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-08', value: 1, text: 'Access: 1 Attempt' },
      { date: '2024-05-09', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-10', value: 9, text: 'Access: 9 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 300,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-02',
        value: 250,
        cpuUsage: 80,
        diskSpace: 30,
        memoryUsage: 55,
      },
      {
        date: '2024-05-03',
        value: 350,
        cpuUsage: 90,
        diskSpace: 20,
        memoryUsage: 65,
      },
      {
        date: '2024-05-04',
        value: 400,
        cpuUsage: 95,
        diskSpace: 15,
        memoryUsage: 70,
      },
      {
        date: '2024-05-05',
        value: 150,
        cpuUsage: 70,
        diskSpace: 40,
        memoryUsage: 50,
      },
      {
        date: '2024-05-06',
        value: 100,
        cpuUsage: 60,
        diskSpace: 50,
        memoryUsage: 40,
      },
      {
        date: '2024-05-07',
        value: 300,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-08',
        value: 450,
        cpuUsage: 95,
        diskSpace: 15,
        memoryUsage: 75,
      },
      {
        date: '2024-05-09',
        value: 200,
        cpuUsage: 70,
        diskSpace: 40,
        memoryUsage: 55,
      },
      {
        date: '2024-05-10',
        value: 350,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-11',
        value: 250,
        cpuUsage: 75,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-12',
        value: 150,
        cpuUsage: 65,
        diskSpace: 45,
        memoryUsage: 45,
      },
      {
        date: '2024-05-13',
        value: 400,
        cpuUsage: 90,
        diskSpace: 20,
        memoryUsage: 70,
      },
      {
        date: '2024-05-14',
        value: 100,
        cpuUsage: 60,
        diskSpace: 50,
        memoryUsage: 40,
      },
      {
        date: '2024-05-15',
        value: 300,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-16',
        value: 200,
        cpuUsage: 70,
        diskSpace: 40,
        memoryUsage: 55,
      },
      {
        date: '2024-05-17',
        value: 450,
        cpuUsage: 95,
        diskSpace: 15,
        memoryUsage: 75,
      },
      {
        date: '2024-05-18',
        value: 250,
        cpuUsage: 75,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-19',
        value: 350,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 65,
      },
      {
        date: '2024-05-20',
        value: 100,
        cpuUsage: 60,
        diskSpace: 50,
        memoryUsage: 40,
      },
      {
        date: '2024-05-21',
        value: 300,
        cpuUsage: 85,
        diskSpace: 25,
        memoryUsage: 60,
      },
      {
        date: '2024-05-22',
        value: 200,
        cpuUsage: 70,
        diskSpace: 40,
        memoryUsage: 55,
      },
      {
        date: '2024-05-23',
        value: 450,
        cpuUsage: 95,
        diskSpace: 15,
        memoryUsage: 75,
      },
      {
        date: '2024-05-24',
        value: 250,
        cpuUsage: 75,
        diskSpace: 35,
        memoryUsage: 55,
      },
      {
        date: '2024-05-25',
        value: 100,
        cpuUsage: 60,
        diskSpace: 50,
        memoryUsage: 40,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 70, color: 'green' },
      { label: 'Category A', value: 20, color: 'blue' },
      { label: 'Category B', value: 15, color: 'red' },
      { label: 'Category C', value: 10, color: 'purple' },
      { label: 'Category D', value: 30, color: 'orange' },
      { label: 'Category E', value: 25, color: 'yellow' },
      { label: 'Category F', value: 35, color: 'brown' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 60, color: 'red' },
      { label: 'Relationship', value: 70, color: 'red' },
    ],
  },
];

function NOCCopilot() {
  const { t } = useTranslation();
  const { organization, user } = useGlobalContext();
  const [answers, setAnswers] = useState<[string, any][]>([]);

  // Check if user is Spanish
  const isSpanishUser = user?.email === 'admin_spanish@futurepath.ai';

  // Create Spanish versions of incidents
  const incidentsSpanish = useMemo(() => incidents.map((incident) => ({
    ...incident,
    incidentState: incident.incidentState === 'Active' ? 'Activo' : incident.incidentState,
    alertType: incident.alertType === 'Memory Usage' ? 'Uso de Memoria' :
               incident.alertType === 'Disk Usage' ? 'Uso de Disco' :
               incident.alertType === 'Device Unreachable' ? 'Dispositivo Inaccesible' :
               incident.alertType === 'CPU Usage' ? 'Uso de CPU' : incident.alertType,
    priority: incident.priority === '3-Moderate' ? '3-Moderado' : incident.priority,
    urgency: incident.urgency === '2-Medium' ? '2-Medio' : incident.urgency,
    impact: incident.impact === '2-Medium' ? '2-Medio' : incident.impact,
    reportedBy: incident.reportedBy === 'Monitoring System' ? 'Sistema de Monitoreo' : incident.reportedBy,
    title: incident.title === 'High Memory Utilization' ? 'Alta Utilización de Memoria' :
            incident.title === 'High Disk Utilization' ? 'Alta Utilización de Disco' :
            incident.title === 'Device Unreachable' ? 'Dispositivo Inaccesible' :
            incident.title === 'High CPU Utilization' ? 'Alta Utilización de CPU' : incident.title,
    summary: incident.summary.replace(/NOC Virtual Agent \(NVA\) Summary:/g, 'Resumen del Agente Virtual NOC (NVA):')
      .replace(/This Incident was processed by NVA/g, 'Este Incidente fue procesado por NVA')
      .replace(/and was assigned to this L1 resolver group:/g, 'y fue asignado a este grupo resolutor L1:')
      .replace(/The NVA identified this runbook/g, 'El NVA identificó este runbook')
      .replace(/which may help with this issue./g, 'que puede ayudar con este problema.')
      .replace(/NVA located similar issues/g, 'NVA localizó problemas similares')
      .replace(/which have been resolved by this L1 resolver group./g, 'que han sido resueltos por este grupo resolutor L1.')
      .replace(/Similar Incidents:/g, 'Incidentes Similares:')
      .replace(/Incident 1:/g, 'Incidente 1:')
      .replace(/Memory Utilization High on:/g, 'Utilización de Memoria Alta en:')
      .replace(/currently used/g, 'actualmente usado')
      .replace(/CI Information:/g, 'Información CI:')
      .replace(/Location:/g, 'Ubicación:')
      .replace(/Opened:/g, 'Abierto:')
      .replace(/Priority:/g, 'Prioridad:')
      .replace(/Status:/g, 'Estado:')
      .replace(/Closed/g, 'Cerrado')
      .replace(/Resolution:/g, 'Resolución:')
      .replace(/Cleared High Memory Usage:/g, 'Limpiado Alto Uso de Memoria:')
      .replace(/Identified and terminated high memory-consuming processes./g, 'Identificados y terminados procesos que consumen mucha memoria.')
      .replace(/Optimized virtual memory settings./g, 'Optimizada la configuración de memoria virtual.')
      .replace(/Memory usage reduced to/g, 'Uso de memoria reducido a')
      .replace(/stabilizing the performance./g, 'estabilizando el rendimiento.')
      .replace(/This Incident was procesed by NVA/g, 'Este Incidente fue procesado por NVA')
      .replace(/and was assigned to ICC \(L1\) resolver group/g, 'y fue asignado al grupo resolutor ICC (L1)')
      .replace(/Based on the 'High Disk Utilization - Runbook', here are the steps to resolve it:/g, 'Basado en el \'Runbook de Alta Utilización de Disco\', aquí están los pasos para resolverlo:')
      .replace(/Reconfirm High Disk Usage/g, 'Reconfirmar Alto Uso de Disco')
      .replace(/Identify Large Files and Folders/g, 'Identificar Archivos y Carpetas Grandes')
      .replace(/Clear Temporary Files/g, 'Limpiar Archivos Temporales')
      .replace(/Check for Disk Errors/g, 'Verificar Errores de Disco')
      .replace(/Archive or Delete Old Files/g, 'Archivar o Eliminar Archivos Antiguos')
      .replace(/Monitor Disk Usage/g, 'Monitorear Uso de Disco')
      .replace(/Disk Usage High on:/g, 'Uso de Disco Alto en:')
      .replace(/Cleared Log Files and Temporary Files:/g, 'Limpiados Archivos de Registro y Archivos Temporales:')
      .replace(/Identified and deleted large log files and temporary files that were no longer needed./g, 'Identificados y eliminados archivos de registro grandes y archivos temporales que ya no eran necesarios.')
      .replace(/Disk usage reduced to/g, 'Uso de disco reducido a')
      .replace(/Freed Up Disk Space:/g, 'Liberado Espacio en Disco:')
      .replace(/Deleted unnecessary log files and temporary files./g, 'Eliminados archivos de registro innecesarios y archivos temporales.')
      .replace(/Uninstalled unused applications and performed disk defragmentation./g, 'Desinstaladas aplicaciones no utilizadas y realizada la desfragmentación del disco.')
      .replace(/Disk usage dropped to/g, 'Uso de disco bajó a')
      .replace(/resolving the issue./g, 'resolviendo el problema.')
      .replace(/NVA could not find any similar incidents./g, 'NVA no pudo encontrar incidentes similares.')
      .replace(/CPU Utilization High on:/g, 'Utilización de CPU Alta en:')
      .replace(/Cleared High CPU Usage:/g, 'Limpiado Alto Uso de CPU:')
      .replace(/Identified and terminated high CPU-consuming processes./g, 'Identificados y terminados procesos que consumen mucha CPU.')
      .replace(/Updated system and drivers./g, 'Actualizado el sistema y los controladores.')
      .replace(/CPU usage reduced to/g, 'Uso de CPU reducido a')
      .replace(/NVA Insights:/g, 'Perspectivas de NVA:')
      .replace(/The same incident has been encountered and resolved/g, 'El mismo incidente se ha encontrado y resuelto')
      .replace(/times today./g, 'veces hoy.'),
    pastDeviceIncident: incident.pastDeviceIncident.map((item) => ({
      ...item,
      text: item.text.replace(/Memory:/g, 'Memoria:')
        .replace(/Disk:/g, 'Disco:')
        .replace(/Network:/g, 'Red:')
        .replace(/Usage/g, 'Uso')
    })),
    ciCount: incident.ciCount.map((item) => ({
      ...item,
      label: item.label === 'Overall' ? 'General' :
              item.label.startsWith('Category') ? item.label.replace('Category', 'Categoría') : item.label
    })),
    cmdbDataInsight: incident.cmdbDataInsight.map((item) => ({
      ...item,
      label: item.label === 'Overall' ? 'General' :
              item.label === 'Relationship' ? 'Relación' : item.label
    }))
  })), [incidents]);

  // Create Spanish versions of alerts
  const alertsSpanish = useMemo(() => alerts.map((alert) => ({
    ...alert,
    alertState: alert.alertState === 'Active' ? 'Activo' : alert.alertState,
    alertType: alert.alertType === 'Memory Leak' ? 'Fuga de Memoria' :
               alert.alertType === 'Disk Space' ? 'Espacio en Disco' :
               alert.alertType === 'Network Latency' ? 'Latencia de Red' :
               alert.alertType === 'CPU Usage' ? 'Uso de CPU' : alert.alertType,
    priority: alert.priority === '2-Medium' ? '2-Medio' :
              alert.priority === '1-High' ? '1-Alto' :
              alert.priority === '3-Low' ? '3-Bajo' : alert.priority,
    criticality: alert.criticality === '2-Medium' ? '2-Medio' :
                 alert.criticality === '1-High' ? '1-Alto' :
                 alert.criticality === '3-Low' ? '3-Bajo' : alert.criticality,
    reportedBy: alert.reportedBy === 'System Monitor' ? 'Monitor del Sistema' :
                alert.reportedBy === 'Monitoring System' ? 'Sistema de Monitoreo' :
                alert.reportedBy === 'Network Monitor' ? 'Monitor de Red' : alert.reportedBy,
    title: alert.title === 'Potential Memory Leak Detected' ? 'Posible Fuga de Memoria Detectada' :
           alert.title === 'Disk Space Running Low' ? 'Espacio en Disco Agotándose' :
           alert.title === 'High Network Latency' ? 'Alta Latencia de Red' :
           alert.title === 'Unauthorized Access Attempt Detected' ? 'Intento de Acceso No Autorizado Detectado' : alert.title,
    summary: alert.summary === 'Memory usage has been increasing steadily over the past hour.' ? 'El uso de memoria ha estado aumentando constantemente durante la última hora.' :
             alert.summary === 'The main database server is running out of disk space.' ? 'El servidor principal de base de datos se está quedando sin espacio en disco.' :
             alert.summary === 'Increased latency detected on the main network route.' ? 'Latencia aumentada detectada en la ruta principal de red.' :
             alert.summary === 'Multiple unauthorized access attempts detected on server 5.' ? 'Múltiples intentos de acceso no autorizado detectados en el servidor 5.' : alert.summary,
    pastDeviceIncident: alert.pastDeviceIncident.map((item) => ({
      ...item,
      text: item.text.replace(/Leak:/g, 'Fuga:')
        .replace(/Instances/g, 'Instancias')
        .replace(/Instance/g, 'Instancia')
        .replace(/Disk Space:/g, 'Espacio en Disco:')
        .replace(/Warnings/g, 'Advertencias')
        .replace(/Latency:/g, 'Latencia:')
        .replace(/Spikes/g, 'Picos')
        .replace(/Spike/g, 'Pico')
        .replace(/Access:/g, 'Acceso:')
        .replace(/Attempts/g, 'Intentos')
        .replace(/Attempt/g, 'Intento')
    })),
    ciCount: alert.ciCount.map((item) => ({
      ...item,
      label: item.label === 'Overall' ? 'General' :
              item.label.startsWith('Category') ? item.label.replace('Category', 'Categoría') : item.label
    })),
    cmdbDataInsight: alert.cmdbDataInsight.map((item) => ({
      ...item,
      label: item.label === 'Overall' ? 'General' :
              item.label === 'Relationship' ? 'Relación' : item.label
    }))
  })), [alerts]);

  // Select current incidents and alerts based on user email
  const currentIncidents = useMemo(() => (isSpanishUser ? incidentsSpanish : incidents), [isSpanishUser, incidentsSpanish, incidents]);
  const currentAlerts = useMemo(() => (isSpanishUser ? alertsSpanish : alerts), [isSpanishUser, alertsSpanish, alerts]);

  const [selectedItem, setSelectedItem] = useState<Incident | Alert | null>(currentIncidents[0]);

  // Reset selected item when language changes
  useEffect(() => {
    if (currentIncidents.length > 0) {
      setSelectedItem(currentIncidents[0]);
    }
  }, [currentIncidents]);

  const handleIncidentSelect = (incident: Incident) => {
    setSelectedItem(incident);
  };

  const handleAlertSelect = (alert: Alert) => {
    setSelectedItem(alert);
  };

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
            {JSON.parse(organization?.config || '{}').Modules?.noc_copilot
              ?.name ?? t('modules.nocCoResolve')}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Flex
          direction="column"
          className="w-1/4 border-r border-[var(--gray-8)]"
        >
          <Box className="h-1/2 overflow-hidden">
            <IncidentList
              incidents={currentIncidents}
              onSelect={handleIncidentSelect}
              selectedItemId={selectedItem?.id}
            />
          </Box>
          <Box className="h-1/2 overflow-hidden">
            <AlertList
              alerts={currentAlerts}
              onSelect={handleAlertSelect}
              selectedItemId={selectedItem?.id}
            />
          </Box>
        </Flex>
        <Box className="w-1/2">
          <NOCChatPage
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

export default withAuth(NOCCopilot);
