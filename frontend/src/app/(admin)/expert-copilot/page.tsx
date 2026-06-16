'use client';

import { Box, Text, Flex } from '@radix-ui/themes';
import Details from 'components/chat/Details';
import IncidentList, { Incident } from 'components/chat/IncidentList';
import ExpertChatPage from 'components/chat/ExpertChatPage';
import withAuth from 'components/withAuth';
import React, { use, useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import AlertList, { Alert } from '../../../components/chat/AlertList';
import { useTranslation } from 'react-i18next';

const incidents = [
  {
    id: 'INC0010751',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dd587de3193bb4a105df2f7718bba10c0',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Database Performance',
    priority: '2-High',
    urgency: '2-Medium',
    impact: '1-High',
    reportedBy: 'Alex',
    Location: 'Department 204',
    imageType: 'security',
    iconType: null,
    title: 'API Latency Due to Slow Database Queries',
    status: 'high',
    summary: `High API latency detected due to inefficient database queries. Optimization efforts include adding indexes, refactoring queries, and updating table statistics.
        
      NOC Virtual Agent (NVA) Summary:
  This Incident was processed by NVA and was assigned to this L2 resolver group:
  - Similar issues which have been resolved by this L2 resolver group.`,
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
  {
    id: 'INC0010752',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D97d7defd937b4a105df2f7718bba1015',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'API Performance',
    priority: '1-Critical',
    urgency: '1-High',
    impact: '2-Medium',
    reportedBy: 'Sarah',
    Location: 'Department 301',
    imageType: 'network',
    iconType: null,
    title: 'API Performance Degradation Due to Inefficient Database',
    status: 'critical',
    summary: `A sudden spike in API response times was caused by a slow database query in the user profile retrieval process.
  
        NOC Virtual Agent (NVA) Summary:
        This Incident was processed by NVA and was assigned to this L2 resolver group:
        - Similar issues which have been resolved by this L2 resolver group.`,
    time: '4:30 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-02', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-03', value: 12, text: 'Access: 12 Attempts' },
      { date: '2024-05-04', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-05', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-06', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-07', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-08', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-09', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-10', value: 11, text: 'Access: 11 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 280,
        cpuUsage: 82,
        diskSpace: 28,
        memoryUsage: 58,
      },
      {
        date: '2024-05-02',
        value: 320,
        cpuUsage: 88,
        diskSpace: 22,
        memoryUsage: 62,
      },
      {
        date: '2024-05-03',
        value: 180,
        cpuUsage: 72,
        diskSpace: 38,
        memoryUsage: 52,
      },
      {
        date: '2024-05-04',
        value: 420,
        cpuUsage: 96,
        diskSpace: 12,
        memoryUsage: 72,
      },
      {
        date: '2024-05-05',
        value: 230,
        cpuUsage: 76,
        diskSpace: 34,
        memoryUsage: 56,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 65, color: 'green' },
      { label: 'Category A', value: 18, color: 'blue' },
      { label: 'Category B', value: 12, color: 'red' },
      { label: 'Category C', value: 8, color: 'purple' },
      { label: 'Category D', value: 27, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 55, color: 'yellow' },
      { label: 'Relationship', value: 65, color: 'orange' },
    ],
  },
  {
    id: 'INC0010753',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dbc181a7193bb4a105df2f7718bba10fe',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'CDN Performance',
    priority: '2-High',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Michael',
    Location: 'Department 102',
    imageType: 'network',
    iconType: null,
    title: 'CDN Misconfiguration Causes Slow Page Loads',
    status: 'high',
    summary: `Users experienced slow page loads due to suboptimal CDN settings, including short cache TTLs, disabled compression, and incorrect geolocation routing.
        
        NOC Virtual Agent (NVA) Summary:
        This Incident was processed by NVA and was assigned to this L2 resolver group:
        - Similar issues which have been resolved by this L2 resolver group.
        `,
    time: '11:15 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-02', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-03', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-04', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-05', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-06', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-07', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-08', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-09', value: 10, text: 'Access: 10 Attempts' },
      { date: '2024-05-10', value: 5, text: 'Access: 5 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 270,
        cpuUsage: 80,
        diskSpace: 30,
        memoryUsage: 57,
      },
      {
        date: '2024-05-02',
        value: 330,
        cpuUsage: 87,
        diskSpace: 23,
        memoryUsage: 63,
      },
      {
        date: '2024-05-03',
        value: 190,
        cpuUsage: 73,
        diskSpace: 37,
        memoryUsage: 53,
      },
      {
        date: '2024-05-04',
        value: 410,
        cpuUsage: 94,
        diskSpace: 16,
        memoryUsage: 71,
      },
      {
        date: '2024-05-05',
        value: 240,
        cpuUsage: 77,
        diskSpace: 33,
        memoryUsage: 58,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 68, color: 'green' },
      { label: 'Category A', value: 22, color: 'blue' },
      { label: 'Category B', value: 14, color: 'red' },
      { label: 'Category C', value: 9, color: 'purple' },
      { label: 'Category D', value: 28, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 58, color: 'yellow' },
      { label: 'Relationship', value: 68, color: 'orange' },
    ],
  },
  {
    id: 'INC0010882',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=incident.do?sys_id=322ce0fd93c896105df2f7718bba1037',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Production Application Performance Degradation',
    priority: '3 - Moderate',
    urgency: '2 - Medium',
    impact: '2 - Medium',
    reportedBy: 'Plant Manager',
    Location: 'Detroit Plant Network',
    imageType: 'network',
    iconType: null,
    title: 'Production Application Performance Degradation',
    status: 'Medium',

    summary: `
    NOC Virtual Assistant (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L3 resolver group:
    - The NVA identified this runbook 'Production Application Performance Degradation - Runbook' which may help with this issue.
    - NVA located similar issues which have been resolved by this L3 resolver group.

    Similar Incidents:

    Incident 1:
    - Application Performance Degradation detected on: 10.25.15.67
    - CI Information: AppServer12
    - Location: Detroit Plant Network
    - Opened: 06/12/24 14:30
    - Priority: 2 - High
    - Status: Closed
    - Resolution:
      - Cleared Network and Firewall Bottlenecks:
        * Identified high latency in the SDWAN router.
        * Applied firewall rule adjustments to allow traffic between the plant and data center.
        * Performance stabilized after routing adjustments.

    Incident 2:
    - Application Performance Degradation detected on: 192.168.45.23
    - CI Information: WebServer03
    - Location: Chicago Plant Network
    - Opened: 04/25/24 09:20
    - Priority: 3 - Moderate
    - Status: Closed
    - Resolution:
      - Cleared CDN and Routing Issues:
        * Optimized CDN caching and routing configurations.
        * Reduced page load times by 40%.
        * Application performance stabilized, resolving the issue.
      `,
    time: '11:15 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-02', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-03', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-04', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-05', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-06', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-07', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-08', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-09', value: 10, text: 'Access: 10 Attempts' },
      { date: '2024-05-10', value: 5, text: 'Access: 5 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 270,
        cpuUsage: 80,
        diskSpace: 30,
        memoryUsage: 57,
      },
      {
        date: '2024-05-02',
        value: 330,
        cpuUsage: 87,
        diskSpace: 23,
        memoryUsage: 63,
      },
      {
        date: '2024-05-03',
        value: 190,
        cpuUsage: 73,
        diskSpace: 37,
        memoryUsage: 53,
      },
      {
        date: '2024-05-04',
        value: 410,
        cpuUsage: 94,
        diskSpace: 16,
        memoryUsage: 71,
      },
      {
        date: '2024-05-05',
        value: 240,
        cpuUsage: 77,
        diskSpace: 33,
        memoryUsage: 58,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 68, color: 'green' },
      { label: 'Category A', value: 22, color: 'blue' },
      { label: 'Category B', value: 14, color: 'red' },
      { label: 'Category C', value: 9, color: 'purple' },
      { label: 'Category D', value: 28, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 58, color: 'yellow' },
      { label: 'Relationship', value: 68, color: 'orange' },
    ],
  },
  {
    id: 'PRB0040002',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=problem.do?sys_id=1acc13f5939416905df2f7718bba1094',
    type: 'problem',
    incidentState: 'Active',
    alertType: 'Repeated Mail Server Outages - Problem',
    priority: '3 - Moderate',
    urgency: '2 - Medium',
    impact: '2 - Medium',
    reportedBy: 'Plant Manager',
    Location: 'Detroit Plant Network',
    imageType: 'network',
    iconType: null,
    title: 'Repeated Mail Server Outages - Problem',
    status: 'High',

    summary: `Production Application Performance Degradation
      
    NOC Virtual Agent (NVA) Summary:

    Detected a **Priority 1 Incident (INC0012554)** reported from the Boston Office where users are unable to access the email system.

    Would you like me to begin diagnostics?
      `,
    time: '10:45 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-02', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-03', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-04', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-05', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-06', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-07', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-08', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-09', value: 10, text: 'Access: 10 Attempts' },
      { date: '2024-05-10', value: 5, text: 'Access: 5 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 270,
        cpuUsage: 80,
        diskSpace: 30,
        memoryUsage: 57,
      },
      {
        date: '2024-05-02',
        value: 330,
        cpuUsage: 87,
        diskSpace: 23,
        memoryUsage: 63,
      },
      {
        date: '2024-05-03',
        value: 190,
        cpuUsage: 73,
        diskSpace: 37,
        memoryUsage: 53,
      },
      {
        date: '2024-05-04',
        value: 410,
        cpuUsage: 94,
        diskSpace: 16,
        memoryUsage: 71,
      },
      {
        date: '2024-05-05',
        value: 240,
        cpuUsage: 77,
        diskSpace: 33,
        memoryUsage: 58,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 68, color: 'green' },
      { label: 'Category A', value: 22, color: 'blue' },
      { label: 'Category B', value: 14, color: 'red' },
      { label: 'Category C', value: 9, color: 'purple' },
      { label: 'Category D', value: 28, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 58, color: 'yellow' },
      { label: 'Relationship', value: 68, color: 'orange' },
    ],
  },
  {
    id: 'CR20241202',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=problem.do?sys_id=1acc13f5939416905df2f7718bba1094',
    type: 'change',
    incidentState: 'Active',
    alertType: 'Repeated Mail Server Outages - Change Request',
    priority: '3 - Moderate',
    urgency: '2 - Medium',
    impact: '2 - Medium',
    reportedBy: 'Plant Manager',
    Location: 'Detroit Plant Network',
    imageType: 'network',
    iconType: null,
    title: 'Repeated Mail Server Outages - Change Request',
    status: 'High',

    summary: `Production Application Performance Degradation
      
      NOC Virtual Agent (NVA) Summary:

      I’ve noticed that the investigation from the Server team in the Problem Record **PRB0040002** has revealed a memory leak in **IronMail-SD-01** due to the recent upgrade. To resolve this issue permanently, a patch needs to be applied to the mail server. 
      `,
    time: '10:45 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-02', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-03', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-04', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-05', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-06', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-07', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-08', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-09', value: 10, text: 'Access: 10 Attempts' },
      { date: '2024-05-10', value: 5, text: 'Access: 5 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 270,
        cpuUsage: 80,
        diskSpace: 30,
        memoryUsage: 57,
      },
      {
        date: '2024-05-02',
        value: 330,
        cpuUsage: 87,
        diskSpace: 23,
        memoryUsage: 63,
      },
      {
        date: '2024-05-03',
        value: 190,
        cpuUsage: 73,
        diskSpace: 37,
        memoryUsage: 53,
      },
      {
        date: '2024-05-04',
        value: 410,
        cpuUsage: 94,
        diskSpace: 16,
        memoryUsage: 71,
      },
      {
        date: '2024-05-05',
        value: 240,
        cpuUsage: 77,
        diskSpace: 33,
        memoryUsage: 58,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 68, color: 'green' },
      { label: 'Category A', value: 22, color: 'blue' },
      { label: 'Category B', value: 14, color: 'red' },
      { label: 'Category C', value: 9, color: 'purple' },
      { label: 'Category D', value: 28, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 58, color: 'yellow' },
      { label: 'Relationship', value: 68, color: 'orange' },
    ],
  },
  {
    id: 'INC0010906',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dwin_hello_001',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'Windows Hello Authentication',
    priority: '3-Medium',
    urgency: '3-Low',
    impact: '2-Medium',
    reportedBy: 'Sarah Johnson',
    Location: 'IT Support Desk',
    imageType: 'security',
    iconType: null,
    title: 'Windows Hello for Business Sign-In Failure',
    status: 'medium',
    summary: `User unable to sign in using Windows Hello for Business. Error message: "The device is not ready for Windows Hello." TPM validation and credential troubleshooting required.
        
    NOC Virtual Agent (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L2 resolver group:
    - Similar Windows Hello authentication issues have been resolved by this L2 resolver group.`,
    time: '11:30 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-02', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-03', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-04', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-05', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-06', value: 3, text: 'Access: 3 Attempts' },
      { date: '2024-05-07', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-08', value: 2, text: 'Access: 2 Attempts' },
      { date: '2024-05-09', value: 4, text: 'Access: 4 Attempts' },
      { date: '2024-05-10', value: 3, text: 'Access: 3 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 150,
        cpuUsage: 45,
        diskSpace: 60,
        memoryUsage: 40,
      },
      {
        date: '2024-05-02',
        value: 180,
        cpuUsage: 50,
        diskSpace: 55,
        memoryUsage: 45,
      },
      {
        date: '2024-05-03',
        value: 120,
        cpuUsage: 40,
        diskSpace: 65,
        memoryUsage: 35,
      },
      {
        date: '2024-05-04',
        value: 200,
        cpuUsage: 55,
        diskSpace: 50,
        memoryUsage: 50,
      },
      {
        date: '2024-05-05',
        value: 160,
        cpuUsage: 48,
        diskSpace: 58,
        memoryUsage: 42,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 45, color: 'green' },
      { label: 'Category A', value: 15, color: 'blue' },
      { label: 'Category B', value: 8, color: 'red' },
      { label: 'Category C', value: 5, color: 'purple' },
      { label: 'Category D', value: 17, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 42, color: 'green' },
      { label: 'Relationship', value: 55, color: 'blue' },
    ],
  },
  {
    id: 'INC0010907',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dcisco_vpn_001',
    type: 'incident',
    incidentState: 'Active',
    alertType: 'VPN Connectivity',
    priority: '2-High',
    urgency: '2-Medium',
    impact: '2-Medium',
    reportedBy: 'Mike Chen',
    Location: 'Remote Workers',
    imageType: 'network',
    iconType: null,
    title: 'Cisco Secure Client VPN Connection Failure',
    status: 'high',
    summary: `User unable to connect to corporate VPN using Cisco Secure Client. Connection fails with "VPN connection failed" message. DNS resolution and certificate validation required.
        

    NOC Virtual Agent (NVA) Summary:

    This Incident was processed by NVA and was assigned to this L2 resolver group:
    - Similar VPN connectivity issues have been resolved by this L2 resolver group.`,
    time: '9:15 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 8, text: 'Access: 8 Attempts' },
      { date: '2024-05-02', value: 12, text: 'Access: 12 Attempts' },
      { date: '2024-05-03', value: 6, text: 'Access: 6 Attempts' },
      { date: '2024-05-04', value: 15, text: 'Access: 15 Attempts' },
      { date: '2024-05-05', value: 9, text: 'Access: 9 Attempts' },
      { date: '2024-05-06', value: 11, text: 'Access: 11 Attempts' },
      { date: '2024-05-07', value: 7, text: 'Access: 7 Attempts' },
      { date: '2024-05-08', value: 13, text: 'Access: 13 Attempts' },
      { date: '2024-05-09', value: 5, text: 'Access: 5 Attempts' },
      { date: '2024-05-10', value: 10, text: 'Access: 10 Attempts' },
    ],
    pastAlerts: [
      {
        date: '2024-05-01',
        value: 280,
        cpuUsage: 75,
        diskSpace: 35,
        memoryUsage: 65,
      },
      {
        date: '2024-05-02',
        value: 320,
        cpuUsage: 82,
        diskSpace: 28,
        memoryUsage: 70,
      },
      {
        date: '2024-05-03',
        value: 240,
        cpuUsage: 68,
        diskSpace: 42,
        memoryUsage: 58,
      },
      {
        date: '2024-05-04',
        value: 380,
        cpuUsage: 88,
        diskSpace: 22,
        memoryUsage: 75,
      },
      {
        date: '2024-05-05',
        value: 260,
        cpuUsage: 72,
        diskSpace: 38,
        memoryUsage: 62,
      },
    ],
    ciCount: [
      { label: 'Overall', value: 72, color: 'green' },
      { label: 'Category A', value: 25, color: 'blue' },
      { label: 'Category B', value: 18, color: 'red' },
      { label: 'Category C', value: 12, color: 'purple' },
      { label: 'Category D', value: 17, color: 'orange' },
    ],
    cmdbDataInsight: [
      { label: 'Overall', value: 65, color: 'yellow' },
      { label: 'Relationship', value: 78, color: 'green' },
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

// Spanish version of alerts
const alertsSpanish: Alert[] = [
  {
    id: '1',
    type: 'alert',
    alertState: 'Activo',
    alertType: 'Fuga de Memoria',
    priority: '2-Medio',
    criticality: '2-Medio',
    reportedBy: 'Monitor del Sistema',
    imageType: 'network',
    iconType: null,
    title: 'Posible Fuga de Memoria Detectada',
    status: 'medium',
    summary: 'El uso de memoria ha estado aumentando constantemente durante la última hora.',
    time: '3:30 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 2, text: 'Fuga: 2 Instancias' },
      { date: '2024-05-02', value: 4, text: 'Fuga: 4 Instancias' },
      { date: '2024-05-03', value: 5, text: 'Fuga: 5 Instancias' },
      { date: '2024-05-04', value: 3, text: 'Fuga: 3 Instancias' },
      { date: '2024-05-05', value: 6, text: 'Fuga: 6 Instancias' },
      { date: '2024-05-06', value: 2, text: 'Fuga: 2 Instancias' },
      { date: '2024-05-07', value: 7, text: 'Fuga: 7 Instancias' },
      { date: '2024-05-08', value: 5, text: 'Fuga: 5 Instancias' },
      { date: '2024-05-09', value: 1, text: 'Fuga: 1 Instancia' },
      { date: '2024-05-10', value: 3, text: 'Fuga: 3 Instancias' },
    ],
    pastAlerts: alerts[0].pastAlerts,
    ciCount: alerts[0].ciCount,
    cmdbDataInsight: alerts[0].cmdbDataInsight,
  },
  {
    id: '2',
    type: 'alert',
    alertState: 'Activo',
    alertType: 'Espacio en Disco',
    priority: '1-Alto',
    criticality: '1-Alto',
    reportedBy: 'Sistema de Monitoreo',
    imageType: 'monitor',
    iconType: null,
    title: 'Espacio en Disco Agotándose',
    status: 'high',
    summary: 'El servidor de base de datos principal se está quedando sin espacio en disco.',
    time: '1:15 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 8, text: 'Espacio en Disco: 8 Advertencias' },
      { date: '2024-05-02', value: 5, text: 'Espacio en Disco: 5 Advertencias' },
      { date: '2024-05-03', value: 7, text: 'Espacio en Disco: 7 Advertencias' },
      { date: '2024-05-04', value: 4, text: 'Espacio en Disco: 4 Advertencias' },
      { date: '2024-05-05', value: 6, text: 'Espacio en Disco: 6 Advertencias' },
      { date: '2024-05-06', value: 5, text: 'Espacio en Disco: 5 Advertencias' },
      { date: '2024-05-07', value: 9, text: 'Espacio en Disco: 9 Advertencias' },
      { date: '2024-05-08', value: 3, text: 'Espacio en Disco: 3 Advertencias' },
      { date: '2024-05-09', value: 7, text: 'Espacio en Disco: 7 Advertencias' },
      { date: '2024-05-10', value: 6, text: 'Espacio en Disco: 6 Advertencias' },
    ],
    pastAlerts: alerts[1].pastAlerts,
    ciCount: alerts[1].ciCount,
    cmdbDataInsight: alerts[1].cmdbDataInsight,
  },
  {
    id: '3',
    type: 'alert',
    alertState: 'Activo',
    alertType: 'Latencia de Red',
    priority: '3-Bajo',
    criticality: '3-Bajo',
    reportedBy: 'Monitor de Red',
    imageType: 'network',
    iconType: null,
    title: 'Alta Latencia de Red',
    status: 'low',
    summary: 'Se detectó latencia aumentada en la ruta principal de la red.',
    time: '4:55 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 3, text: 'Latencia: 3 Picos' },
      { date: '2024-05-02', value: 5, text: 'Latencia: 5 Picos' },
      { date: '2024-05-03', value: 2, text: 'Latencia: 2 Picos' },
      { date: '2024-05-04', value: 4, text: 'Latencia: 4 Picos' },
      { date: '2024-05-05', value: 1, text: 'Latencia: 1 Pico' },
      { date: '2024-05-06', value: 6, text: 'Latencia: 6 Picos' },
      { date: '2024-05-07', value: 5, text: 'Latencia: 5 Picos' },
      { date: '2024-05-08', value: 3, text: 'Latencia: 3 Picos' },
      { date: '2024-05-09', value: 2, text: 'Latencia: 2 Picos' },
      { date: '2024-05-10', value: 4, text: 'Latencia: 4 Picos' },
    ],
    pastAlerts: alerts[2].pastAlerts,
    ciCount: alerts[2].ciCount,
    cmdbDataInsight: alerts[2].cmdbDataInsight,
  },
  {
    id: '4',
    type: 'alert',
    alertState: 'Activo',
    alertType: 'Uso de CPU',
    priority: '1-Alto',
    criticality: '1-Alto',
    reportedBy: 'Sistema de Monitoreo',
    imageType: 'security',
    iconType: null,
    title: 'Intento de Acceso No Autorizado Detectado',
    status: 'high',
    summary: 'Se detectaron múltiples intentos de acceso no autorizado en el servidor 5.',
    time: '2:45 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 5, text: 'Acceso: 5 Intentos' },
      { date: '2024-05-02', value: 7, text: 'Acceso: 7 Intentos' },
      { date: '2024-05-03', value: 10, text: 'Acceso: 10 Intentos' },
      { date: '2024-05-04', value: 2, text: 'Acceso: 2 Intentos' },
      { date: '2024-05-05', value: 8, text: 'Acceso: 8 Intentos' },
      { date: '2024-05-06', value: 4, text: 'Acceso: 4 Intentos' },
      { date: '2024-05-07', value: 6, text: 'Acceso: 6 Intentos' },
      { date: '2024-05-08', value: 1, text: 'Acceso: 1 Intento' },
      { date: '2024-05-09', value: 3, text: 'Acceso: 3 Intentos' },
      { date: '2024-05-10', value: 9, text: 'Acceso: 9 Intentos' },
    ],
    pastAlerts: alerts[3].pastAlerts,
    ciCount: alerts[3].ciCount,
    cmdbDataInsight: alerts[3].cmdbDataInsight,
  },
];

// Spanish version of incidents
const incidentsSpanish: Incident[] = [
  {
    id: 'INC0010751',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dd587de3193bb4a105df2f7718bba10c0',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Rendimiento de Base de Datos',
    priority: '2-Alto',
    urgency: '2-Medio',
    impact: '1-Alto',
    reportedBy: 'Alex',
    Location: 'Departamento 204',
    imageType: 'security',
    iconType: null,
    title: 'Latencia de API Debido a Consultas Lentas de Base de Datos',
    status: 'high',
    summary: `Se detectó alta latencia de API debido a consultas ineficientes de base de datos. Los esfuerzos de optimización incluyen agregar índices, refactorizar consultas y actualizar estadísticas de tabla.
        
      Resumen del Agente Virtual NOC (NVA):
  Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L2:
  - Problemas similares que han sido resueltos por este grupo de resolución L2.`,
    time: '2:45 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 5, text: 'Acceso: 5 Intentos' },
      { date: '2024-05-02', value: 7, text: 'Acceso: 7 Intentos' },
      { date: '2024-05-03', value: 10, text: 'Acceso: 10 Intentos' },
      { date: '2024-05-04', value: 2, text: 'Acceso: 2 Intentos' },
      { date: '2024-05-05', value: 8, text: 'Acceso: 8 Intentos' },
      { date: '2024-05-06', value: 4, text: 'Acceso: 4 Intentos' },
      { date: '2024-05-07', value: 6, text: 'Acceso: 6 Intentos' },
      { date: '2024-05-08', value: 1, text: 'Acceso: 1 Intento' },
      { date: '2024-05-09', value: 3, text: 'Acceso: 3 Intentos' },
      { date: '2024-05-10', value: 9, text: 'Acceso: 9 Intentos' },
    ],
    pastAlerts: incidents[0].pastAlerts,
    ciCount: incidents[0].ciCount,
    cmdbDataInsight: incidents[0].cmdbDataInsight,
  },
  {
    id: 'INC0010752',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D97d7defd937b4a105df2f7718bba1015',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Rendimiento de API',
    priority: '1-Crítico',
    urgency: '1-Alto',
    impact: '2-Medio',
    reportedBy: 'Sarah',
    Location: 'Departamento 301',
    imageType: 'network',
    iconType: null,
    title: 'Degradación del Rendimiento de API Debido a Base de Datos Ineficiente',
    status: 'critical',
    summary: `Un aumento repentino en los tiempos de respuesta de la API fue causado por una consulta lenta de base de datos en el proceso de recuperación de perfil de usuario.
  
        Resumen del Agente Virtual NOC (NVA):
        Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L2:
        - Problemas similares que han sido resueltos por este grupo de resolución L2.`,
    time: '4:30 PM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 3, text: 'Acceso: 3 Intentos' },
      { date: '2024-05-02', value: 8, text: 'Acceso: 8 Intentos' },
      { date: '2024-05-03', value: 12, text: 'Acceso: 12 Intentos' },
      { date: '2024-05-04', value: 5, text: 'Acceso: 5 Intentos' },
      { date: '2024-05-05', value: 9, text: 'Acceso: 9 Intentos' },
      { date: '2024-05-06', value: 2, text: 'Acceso: 2 Intentos' },
      { date: '2024-05-07', value: 7, text: 'Acceso: 7 Intentos' },
      { date: '2024-05-08', value: 4, text: 'Acceso: 4 Intentos' },
      { date: '2024-05-09', value: 6, text: 'Acceso: 6 Intentos' },
      { date: '2024-05-10', value: 11, text: 'Acceso: 11 Intentos' },
    ],
    pastAlerts: incidents[1].pastAlerts,
    ciCount: incidents[1].ciCount,
    cmdbDataInsight: incidents[1].cmdbDataInsight,
  },
  {
    id: 'INC0010753',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dbc181a7193bb4a105df2f7718bba10fe',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Rendimiento de CDN',
    priority: '2-Alto',
    urgency: '2-Medio',
    impact: '2-Medio',
    reportedBy: 'Michael',
    Location: 'Departamento 102',
    imageType: 'network',
    iconType: null,
    title: 'Configuración Incorrecta de CDN Causa Cargas Lentas de Página',
    status: 'high',
    summary: `Los usuarios experimentaron cargas lentas de página debido a configuraciones subóptimas de CDN, incluyendo TTL de caché cortos, compresión deshabilitada y enrutamiento de geolocalización incorrecto.
        
        Resumen del Agente Virtual NOC (NVA):
        Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L2:
        - Problemas similares que han sido resueltos por este grupo de resolución L2.
        `,
    time: '11:15 AM',
    pastDeviceIncident: [
      { date: '2024-05-01', value: 6, text: 'Acceso: 6 Intentos' },
      { date: '2024-05-02', value: 4, text: 'Acceso: 4 Intentos' },
      { date: '2024-05-03', value: 9, text: 'Acceso: 9 Intentos' },
      { date: '2024-05-04', value: 3, text: 'Acceso: 3 Intentos' },
      { date: '2024-05-05', value: 7, text: 'Acceso: 7 Intentos' },
      { date: '2024-05-06', value: 5, text: 'Acceso: 5 Intentos' },
      { date: '2024-05-07', value: 8, text: 'Acceso: 8 Intentos' },
      { date: '2024-05-08', value: 2, text: 'Acceso: 2 Intentos' },
      { date: '2024-05-09', value: 10, text: 'Acceso: 10 Intentos' },
      { date: '2024-05-10', value: 5, text: 'Acceso: 5 Intentos' },
    ],
    pastAlerts: incidents[2].pastAlerts,
    ciCount: incidents[2].ciCount,
    cmdbDataInsight: incidents[2].cmdbDataInsight,
  },
  {
    id: 'INC0010882',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=incident.do?sys_id=322ce0fd93c896105df2f7718bba1037',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Degradación del Rendimiento de Aplicación de Producción',
    priority: '3 - Moderado',
    urgency: '2 - Medio',
    impact: '2 - Medio',
    reportedBy: 'Gerente de Planta',
    Location: 'Red de Planta de Detroit',
    imageType: 'network',
    iconType: null,
    title: 'Degradación del Rendimiento de Aplicación de Producción',
    status: 'Medium',
    summary: `
    Resumen del Asistente Virtual NOC (NVA):

    Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L3:
    - El NVA identificó este runbook 'Degradación del Rendimiento de Aplicación de Producción - Runbook' que puede ayudar con este problema.
    - NVA localizó problemas similares que han sido resueltos por este grupo de resolución L3.

    Incidentes Similares:

    Incidente 1:
    - Degradación del Rendimiento de Aplicación detectada en: 10.25.15.67
    - Información de CI: AppServer12
    - Ubicación: Red de Planta de Detroit
    - Abierto: 06/12/24 14:30
    - Prioridad: 2 - Alto
    - Estado: Cerrado
    - Resolución:
      - Se eliminaron los cuellos de botella de Red y Firewall:
        * Se identificó alta latencia en el enrutador SDWAN.
        * Se aplicaron ajustes de reglas de firewall para permitir el tráfico entre la planta y el centro de datos.
        * El rendimiento se estabilizó después de los ajustes de enrutamiento.

    Incidente 2:
    - Degradación del Rendimiento de Aplicación detectada en: 192.168.45.23
    - Información de CI: WebServer03
    - Ubicación: Red de Planta de Chicago
    - Abierto: 04/25/24 09:20
    - Prioridad: 3 - Moderado
    - Estado: Cerrado
    - Resolución:
      - Se eliminaron problemas de CDN y Enrutamiento:
        * Se optimizaron las configuraciones de caché y enrutamiento de CDN.
        * Se redujeron los tiempos de carga de página en un 40%.
        * El rendimiento de la aplicación se estabilizó, resolviendo el problema.
      `,
    time: '11:15 AM',
    pastDeviceIncident: incidents[3].pastDeviceIncident.map(item => ({
      ...item,
      text: item.text.replace('Access:', 'Acceso:').replace('Attempts', 'Intentos').replace('Attempt', 'Intento')
    })),
    pastAlerts: incidents[3].pastAlerts,
    ciCount: incidents[3].ciCount,
    cmdbDataInsight: incidents[3].cmdbDataInsight,
  },
  {
    id: 'PRB0040002',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=problem.do?sys_id=1acc13f5939416905df2f7718bba1094',
    type: 'problem',
    incidentState: 'Activo',
    alertType: 'Interrupciones Repetidas del Servidor de Correo - Problema',
    priority: '3 - Moderado',
    urgency: '2 - Medio',
    impact: '2 - Medio',
    reportedBy: 'Gerente de Planta',
    Location: 'Red de Planta de Detroit',
    imageType: 'network',
    iconType: null,
    title: 'Interrupciones Repetidas del Servidor de Correo - Problema',
    status: 'High',
    summary: `Degradación del Rendimiento de Aplicación de Producción
      
    Resumen del Agente Virtual NOC (NVA):

    Se detectó un **Incidente de Prioridad 1 (INC0012554)** reportado desde la Oficina de Boston donde los usuarios no pueden acceder al sistema de correo electrónico.

    ¿Le gustaría que comience el diagnóstico?
      `,
    time: '10:45 AM',
    pastDeviceIncident: incidents[4].pastDeviceIncident.map(item => ({
      ...item,
      text: item.text.replace('Access:', 'Acceso:').replace('Attempts', 'Intentos').replace('Attempt', 'Intento')
    })),
    pastAlerts: incidents[4].pastAlerts,
    ciCount: incidents[4].ciCount,
    cmdbDataInsight: incidents[4].cmdbDataInsight,
  },
  {
    id: 'CR20241202',
    link:
      'https://dev209832.service-now.com/nav_to.do?uri=problem.do?sys_id=1acc13f5939416905df2f7718bba1094',
    type: 'change',
    incidentState: 'Activo',
    alertType: 'Interrupciones Repetidas del Servidor de Correo - Solicitud de Cambio',
    priority: '3 - Moderado',
    urgency: '2 - Medio',
    impact: '2 - Medio',
    reportedBy: 'Gerente de Planta',
    Location: 'Red de Planta de Detroit',
    imageType: 'network',
    iconType: null,
    title: 'Interrupciones Repetidas del Servidor de Correo - Solicitud de Cambio',
    status: 'High',
    summary: `Degradación del Rendimiento de Aplicación de Producción
      
      Resumen del Agente Virtual NOC (NVA):

      He notado que la investigación del equipo de Servidores en el Registro de Problema **PRB0040002** ha revelado una fuga de memoria en **IronMail-SD-01** debido a la actualización reciente. Para resolver este problema permanentemente, se necesita aplicar un parche al servidor de correo. 
      `,
    time: '10:45 AM',
    pastDeviceIncident: incidents[5].pastDeviceIncident.map(item => ({
      ...item,
      text: item.text.replace('Access:', 'Acceso:').replace('Attempts', 'Intentos').replace('Attempt', 'Intento')
    })),
    pastAlerts: incidents[5].pastAlerts,
    ciCount: incidents[5].ciCount,
    cmdbDataInsight: incidents[5].cmdbDataInsight,
  },
  {
    id: 'INC0010906',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dwin_hello_001',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Autenticación Windows Hello',
    priority: '3-Medio',
    urgency: '3-Bajo',
    impact: '2-Medio',
    reportedBy: 'Sarah Johnson',
    Location: 'Mesa de Soporte IT',
    imageType: 'security',
    iconType: null,
    title: 'Fallo de Inicio de Sesión de Windows Hello para Empresas',
    status: 'medium',
    summary: `Usuario no puede iniciar sesión usando Windows Hello para Empresas. Mensaje de error: "El dispositivo no está listo para Windows Hello." Se requiere validación de TPM y solución de problemas de credenciales.
        
    Resumen del Agente Virtual NOC (NVA):

    Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L2:
    - Problemas similares de autenticación de Windows Hello han sido resueltos por este grupo de resolución L2.`,
    time: '11:30 AM',
    pastDeviceIncident: incidents[6].pastDeviceIncident.map(item => ({
      ...item,
      text: item.text.replace('Access:', 'Acceso:').replace('Attempts', 'Intentos').replace('Attempt', 'Intento')
    })),
    pastAlerts: incidents[6].pastAlerts,
    ciCount: incidents[6].ciCount,
    cmdbDataInsight: incidents[6].cmdbDataInsight,
  },
  {
    id: 'INC0010907',
    link:
      'https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dcisco_vpn_001',
    type: 'incident',
    incidentState: 'Activo',
    alertType: 'Conectividad VPN',
    priority: '2-Alto',
    urgency: '2-Medio',
    impact: '2-Medio',
    reportedBy: 'Mike Chen',
    Location: 'Trabajadores Remotos',
    imageType: 'network',
    iconType: null,
    title: 'Fallo de Conexión VPN de Cisco Secure Client',
    status: 'high',
    summary: `Usuario no puede conectarse a la VPN corporativa usando Cisco Secure Client. La conexión falla con el mensaje "fallo de conexión VPN". Se requiere resolución DNS y validación de certificado.
        

    Resumen del Agente Virtual NOC (NVA):

    Este Incidente fue procesado por NVA y fue asignado a este grupo de resolución L2:
    - Problemas similares de conectividad VPN han sido resueltos por este grupo de resolución L2.`,
    time: '9:15 AM',
    pastDeviceIncident: incidents[7].pastDeviceIncident.map(item => ({
      ...item,
      text: item.text.replace('Access:', 'Acceso:').replace('Attempts', 'Intentos').replace('Attempt', 'Intento')
    })),
    pastAlerts: incidents[7].pastAlerts,
    ciCount: incidents[7].ciCount,
    cmdbDataInsight: incidents[7].cmdbDataInsight,
  },
];

function ExpertCopilot() {
  const { t } = useTranslation();
  const { user, organization } = useGlobalContext();
  const isSpanishUser = user?.email === 'admin_spanish@futurepath.ai';
  const currentIncidents = React.useMemo(() => 
    isSpanishUser ? incidentsSpanish : incidents,
    [isSpanishUser]
  );
  const currentAlerts = React.useMemo(() => 
    isSpanishUser ? alertsSpanish : alerts,
    [isSpanishUser]
  );
  
  const [selectedItem, setSelectedItem] = useState<Incident | Alert | null>(
    null,
  );
  const [answers, setAnswers] = useState<[string, any][]>([]);

  React.useEffect(() => {
    if (currentIncidents.length > 0 && !selectedItem) {
      setSelectedItem(currentIncidents[0]);
    }
  }, [currentIncidents, selectedItem]);

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
            {JSON.parse(organization?.config || '{}').Modules?.expert_copilot
              ?.name ?? t('expert_copilot.expertCoResolve')}
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
          <ExpertChatPage
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

export default withAuth(ExpertCopilot);
