"use client";
import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Send, Search, Filter, Download, Bell, DollarSign, Users, FileText, Calendar, TrendingDown, Activity } from 'lucide-react';
import withAuth from '@/components/withAuth';

function PayrollCoPilot() {
  const [selectedTrigger, setSelectedTrigger] = useState('monthly-oct-2025');
  const [chatMessages, setChatMessages] = useState([
    { type: 'system', text: 'Welcome to Payroll Co-Pilot. I can help you investigate exceptions, analyze trends, and resolve payroll issues. What would you like to know?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const triggers = {
    monthly: [
      {
        id: 'monthly-oct-2025',
        name: 'October 2025 Monthly Payroll',
        cycle: 'Oct 1-31, 2025',
        status: 'in-progress',
        dueDate: '2025-10-25',
        payDate: '2025-10-31',
        employees: 2847,
        exceptions: 12,
        phase: 'Payroll Assist'
      },
      {
        id: 'monthly-sep-2025',
        name: 'September 2025 Monthly Payroll',
        cycle: 'Sep 1-30, 2025',
        status: 'completed',
        dueDate: '2025-09-25',
        payDate: '2025-09-30',
        employees: 2839,
        exceptions: 0,
        phase: 'Completed'
      },
      {
        id: 'monthly-nov-2025',
        name: 'November 2025 Monthly Payroll',
        cycle: 'Nov 1-30, 2025',
        status: 'scheduled',
        dueDate: '2025-11-25',
        payDate: '2025-11-30',
        employees: 2850,
        exceptions: 0,
        phase: 'Not Started'
      }
    ],
    offcycle: [
      {
        id: 'offcycle-correction-oct15',
        name: 'Payment Correction - Oct 15',
        cycle: 'Error Resolution',
        status: 'urgent',
        dueDate: '2025-10-16',
        payDate: '2025-10-17',
        employees: 5,
        exceptions: 5,
        phase: 'RCA & CAPA'
      },
      {
        id: 'offcycle-newhire-oct12',
        name: 'New Hire Payroll - Oct 12',
        cycle: 'Pro-rated Pay',
        status: 'completed',
        dueDate: '2025-10-12',
        payDate: '2025-10-15',
        employees: 8,
        exceptions: 0,
        phase: 'Completed'
      },
      {
        id: 'offcycle-termination-oct18',
        name: 'Termination Final Pay - Oct 18',
        cycle: 'Final Settlement',
        status: 'pending',
        dueDate: '2025-10-18',
        payDate: '2025-10-20',
        employees: 3,
        exceptions: 1,
        phase: 'Input Validation'
      }
    ],
    bonus: [
      {
        id: 'bonus-q3-2025',
        name: 'Q3 2025 Quarterly Bonus',
        cycle: 'Jul-Sep Performance',
        status: 'in-progress',
        dueDate: '2025-10-20',
        payDate: '2025-10-25',
        employees: 450,
        exceptions: 8,
        phase: 'Client Sign-Off'
      },
      {
        id: 'bonus-q2-2025',
        name: 'Q2 2025 Quarterly Bonus',
        cycle: 'Apr-Jun Performance',
        status: 'completed',
        dueDate: '2025-07-20',
        payDate: '2025-07-25',
        employees: 442,
        exceptions: 0,
        phase: 'Completed'
      },
      {
        id: 'bonus-annual-2024',
        name: '2024 Annual Performance Bonus',
        cycle: 'Full Year 2024',
        status: 'completed',
        dueDate: '2025-03-15',
        payDate: '2025-03-31',
        employees: 2750,
        exceptions: 0,
        phase: 'Completed'
      }
    ]
  };

  const insights = {
    'monthly-oct-2025': {
      title: 'October 2025 Monthly Payroll',
      stage: 'Payroll Assist - Output Validation',
      progress: 72,
      exceptions: [
        { id: 1, type: 'calculation', employee: 'EMP-2341', name: 'Sarah Johnson', issue: 'Overtime rate calculation error - 1.5x multiplier not applied for weekend hours', severity: 'high', autoFix: true, estimatedImpact: '$342.50' },
        { id: 2, type: 'data', employee: 'EMP-1829', name: 'Michael Chen', issue: 'Missing updated bank account information after recent change', severity: 'critical', autoFix: false, estimatedImpact: 'Payment failure' },
        { id: 3, type: 'validation', employee: 'EMP-3021', name: 'Jessica Rodriguez', issue: 'YTD gross amount exceeds annual compensation cap by $5,234', severity: 'medium', autoFix: true, estimatedImpact: '$5,234 adjustment' },
        { id: 4, type: 'tax', employee: 'EMP-4782', name: 'David Williams', issue: 'State tax withholding mismatch - incorrect state code NY vs NJ', severity: 'high', autoFix: true, estimatedImpact: '$156.80' },
        { id: 5, type: 'timesheet', employee: 'EMP-5621', name: 'Emily Davis', issue: 'Timesheet not signed off by manager - 42 hours pending approval', severity: 'critical', autoFix: false, estimatedImpact: 'Payment delay' }
      ],
      metrics: {
        totalGross: '$4,234,567.89',
        totalNet: '$3,156,234.21',
        taxWithheld: '$1,078,333.68',
        avgProcessTime: '2.3 hrs',
        complianceScore: '98.5%',
        fundingRequired: '$3,289,450.33'
      },
      insights: [
        { type: 'trend', text: 'Processing time 15% faster than last month', icon: TrendingUp, color: 'text-green-600' },
        { type: 'alert', text: '2 critical exceptions blocking client sign-off', icon: AlertCircle, color: 'text-red-600' },
        { type: 'prediction', text: 'Expected completion: Oct 23, 4:30 PM', icon: Clock, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'Input Collection & Validation', status: 'completed', time: '2h 15m', details: 'All timesheets collected, SAP data validated' },
        { phase: 'Timesheet Sign-Off', status: 'completed', time: '1h 30m', details: '2,842 of 2,847 employees approved' },
        { phase: 'Upload to Payroll Engine', status: 'completed', time: '25m', details: 'All employee data uploaded successfully' },
        { phase: 'Tax & Gross-to-Net Calculation', status: 'completed', time: '45m', details: 'Automated calculation completed' },
        { phase: 'Output Validation', status: 'in-progress', time: '1h 15m elapsed', details: '12 exceptions identified, 9 auto-fixable' },
        { phase: 'Client Sign-Off', status: 'pending', time: '-', details: 'Waiting for exception resolution' },
        { phase: 'Payroll Submission', status: 'pending', time: '-', details: 'Scheduled for Oct 24' },
        { phase: 'Funding & Payout', status: 'pending', time: '-', details: 'Scheduled for Oct 31' }
      ],
      sampleQueries: [
        'Why is EMP-1829 marked as critical?',
        'Show me all overtime calculation errors',
        'What caused the processing time improvement?',
        'Can we auto-fix the tax withholding issues?',
        'When will client sign-off be ready?',
        'Compare this cycle to September metrics'
      ]
    },
    'monthly-sep-2025': {
      title: 'September 2025 Monthly Payroll',
      stage: 'Completed Successfully',
      progress: 100,
      exceptions: [],
      metrics: {
        totalGross: '$4,156,890.45',
        totalNet: '$3,098,234.67',
        taxWithheld: '$1,058,655.78',
        avgProcessTime: '2.7 hrs',
        complianceScore: '99.8%',
        fundingRequired: '$3,234,890.12'
      },
      insights: [
        { type: 'trend', text: 'Zero exceptions - cleanest payroll in 6 months', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: 'All payments deposited on time', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: '100% employee query resolution within 24hrs', icon: Activity, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'Input Collection & Validation', status: 'completed', time: '2h 45m', details: 'All data validated successfully' },
        { phase: 'Timesheet Sign-Off', status: 'completed', time: '1h 45m', details: '2,839 employees approved' },
        { phase: 'Upload to Payroll Engine', status: 'completed', time: '28m', details: 'Upload completed without errors' },
        { phase: 'Tax & Gross-to-Net Calculation', status: 'completed', time: '52m', details: 'All calculations verified' },
        { phase: 'Output Validation', status: 'completed', time: '1h 35m', details: 'Zero exceptions found' },
        { phase: 'Client Sign-Off', status: 'completed', time: '45m', details: 'Approved on Sep 24' },
        { phase: 'Payroll Submission', status: 'completed', time: '15m', details: 'Submitted Sep 25' },
        { phase: 'Funding & Payout', status: 'completed', time: '2h 10m', details: 'All payments completed Sep 30' }
      ],
      sampleQueries: [
        'What made September payroll so successful?',
        'Show me the process efficiency metrics',
        'Compare September to August performance',
        'What best practices can we replicate?',
        'Show employee query response times',
        'Generate success report for client'
      ]
    },
    'monthly-nov-2025': {
      title: 'November 2025 Monthly Payroll',
      stage: 'Scheduled - Not Yet Started',
      progress: 0,
      exceptions: [],
      metrics: {
        totalGross: 'TBD',
        totalNet: 'TBD',
        taxWithheld: 'TBD',
        avgProcessTime: 'Est. 2.5 hrs',
        complianceScore: 'TBD',
        fundingRequired: 'TBD'
      },
      insights: [
        { type: 'prediction', text: 'Expected employee count: 2,850 (+3 from Oct)', icon: Users, color: 'text-blue-600' },
        { type: 'prediction', text: 'Holiday pay adjustments required for Thanksgiving', icon: Calendar, color: 'text-orange-600' },
        { type: 'prediction', text: 'Start date: Nov 18, 2025', icon: Clock, color: 'text-gray-600' }
      ],
      timeline: [
        { phase: 'Input Collection & Validation', status: 'pending', time: '-', details: 'Starts Nov 18' },
        { phase: 'Timesheet Sign-Off', status: 'pending', time: '-', details: 'Due Nov 22' },
        { phase: 'Upload to Payroll Engine', status: 'pending', time: '-', details: 'Scheduled Nov 23' },
        { phase: 'Tax & Gross-to-Net Calculation', status: 'pending', time: '-', details: 'Scheduled Nov 23' },
        { phase: 'Output Validation', status: 'pending', time: '-', details: 'Scheduled Nov 24' },
        { phase: 'Client Sign-Off', status: 'pending', time: '-', details: 'Due Nov 25' },
        { phase: 'Payroll Submission', status: 'pending', time: '-', details: 'Scheduled Nov 26' },
        { phase: 'Funding & Payout', status: 'pending', time: '-', details: 'Scheduled Nov 30' }
      ],
      sampleQueries: [
        'What are the key considerations for November?',
        'Show me holiday pay calculation rules',
        'Predict potential exceptions based on history',
        'What new hires start in November?',
        'Generate pre-payroll checklist',
        'Show Q4 payroll planning timeline'
      ]
    },
    'offcycle-correction-oct15': {
      title: 'Payment Correction - October 15',
      stage: 'Error Resolution - RCA & CAPA in Progress',
      progress: 45,
      exceptions: [
        { id: 1, type: 'payment', employee: 'EMP-4521', name: 'Robert Martinez', issue: 'Underpayment of $245.50 in Sep cycle - missing shift differential', severity: 'critical', autoFix: true, estimatedImpact: '$245.50 owed' },
        { id: 2, type: 'payment', employee: 'EMP-3892', name: 'Amanda White', issue: 'Tax withholding calculation error - Federal rate 22% vs 24%', severity: 'high', autoFix: true, estimatedImpact: '$89.23 owed' },
        { id: 3, type: 'system', employee: 'EMP-2109', name: 'Christopher Lee', issue: 'Failed direct deposit - banking system timeout after 3 retry attempts', severity: 'critical', autoFix: false, estimatedImpact: 'Payment not received' },
        { id: 4, type: 'data', employee: 'EMP-6734', name: 'Lisa Anderson', issue: 'Incorrect pay grade applied - Grade 7 vs Grade 8', severity: 'high', autoFix: true, estimatedImpact: '$312.75 owed' },
        { id: 5, type: 'calculation', employee: 'EMP-5289', name: 'James Taylor', issue: 'Bonus percentage error - 8% applied instead of 10%', severity: 'medium', autoFix: true, estimatedImpact: '$187.40 owed' }
      ],
      metrics: {
        totalCorrection: '$1,234.50',
        affectedEmployees: '5',
        avgResolutionTime: '4.2 hrs',
        rcaCompleted: '3 of 5',
        capaImplemented: '2 of 5',
        estimatedPayout: '$1,234.50'
      },
      insights: [
        { type: 'alert', text: 'Same-day resolution required for 2 employees', icon: AlertCircle, color: 'text-red-600' },
        { type: 'trend', text: 'Similar banking timeout pattern in last 2 cycles', icon: TrendingUp, color: 'text-orange-600' },
        { type: 'alert', text: 'RCA completed: Root cause identified in payroll engine', icon: CheckCircle, color: 'text-green-600' }
      ],
      timeline: [
        { phase: 'Error Detection & Reporting', status: 'completed', time: '15m', details: '5 payment errors identified by employees' },
        { phase: 'Initial Investigation', status: 'completed', time: '45m', details: 'All cases verified and categorized' },
        { phase: 'Root Cause Analysis (RCA)', status: 'completed', time: '1h 45m', details: '3 RCAs completed, 2 in progress' },
        { phase: 'CAPA Development', status: 'in-progress', time: '2h 10m elapsed', details: 'Corrective actions approved for 2 cases' },
        { phase: 'Client Communication', status: 'in-progress', time: '30m elapsed', details: 'Detailed RCA reports sent to client' },
        { phase: 'Off-Cycle Processing', status: 'pending', time: '-', details: 'Scheduled for Oct 16' },
        { phase: 'Payout Execution', status: 'pending', time: '-', details: 'Target date: Oct 17' },
        { phase: 'Verification & Close', status: 'pending', time: '-', details: 'Employee confirmation required' }
      ],
      sampleQueries: [
        'What was the root cause for EMP-2109 banking failure?',
        'Show me the CAPA for shift differential errors',
        'Has this banking timeout issue happened before?',
        'When will employees receive correction payments?',
        'Generate RCA report for client review',
        'What process changes are recommended?'
      ]
    },
    'offcycle-newhire-oct12': {
      title: 'New Hire Payroll - October 12',
      stage: 'Completed Successfully',
      progress: 100,
      exceptions: [],
      metrics: {
        totalGross: '$18,450.00',
        totalNet: '$13,892.50',
        taxWithheld: '$4,557.50',
        avgProcessTime: '1.5 hrs',
        complianceScore: '100%',
        newHires: '8'
      },
      insights: [
        { type: 'trend', text: 'All 8 new hires onboarded and paid successfully', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: 'Pro-rated calculations validated correctly', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: 'Faster processing than historical avg (1.5 vs 2.1 hrs)', icon: TrendingUp, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'New Hire Data Collection', status: 'completed', time: '45m', details: 'All onboarding forms received' },
        { phase: 'Pro-ration Calculation', status: 'completed', time: '20m', details: 'Start dates and partial pay calculated' },
        { phase: 'Tax Setup & Validation', status: 'completed', time: '15m', details: 'W-4 and state withholdings configured' },
        { phase: 'Upload to Payroll Engine', status: 'completed', time: '10m', details: '8 employees uploaded successfully' },
        { phase: 'Output Validation', status: 'completed', time: '25m', details: 'All calculations verified' },
        { phase: 'Client Sign-Off', status: 'completed', time: '15m', details: 'Approved Oct 13' },
        { phase: 'Payroll Submission', status: 'completed', time: '10m', details: 'Submitted Oct 13' },
        { phase: 'Payout Execution', status: 'completed', time: '2h', details: 'All payments completed Oct 15' }
      ],
      sampleQueries: [
        'Show me the list of new hires processed',
        'How was pro-ration calculated for each employee?',
        'Compare to previous new hire off-cycle runs',
        'What made this process more efficient?',
        'Show onboarding completion status',
        'Generate new hire payroll summary report'
      ]
    },
    'offcycle-termination-oct18': {
      title: 'Termination Final Pay - October 18',
      stage: 'Input Validation in Progress',
      progress: 30,
      exceptions: [
        { id: 1, type: 'validation', employee: 'EMP-9012', name: 'Thomas Brown', issue: 'Unused PTO balance calculation - 48 hours pending HR confirmation', severity: 'high', autoFix: false, estimatedImpact: '$1,152 potential payment' }
      ],
      metrics: {
        totalGross: '$8,967.50',
        totalNet: '$6,725.63',
        taxWithheld: '$2,241.87',
        avgProcessTime: 'In progress',
        complianceScore: 'TBD',
        terminatedEmployees: '3'
      },
      insights: [
        { type: 'alert', text: '1 PTO balance pending HR verification', icon: AlertCircle, color: 'text-orange-600' },
        { type: 'prediction', text: 'Expected completion: Oct 19, 11:00 AM', icon: Clock, color: 'text-blue-600' },
        { type: 'trend', text: 'Final settlement calculations in progress', icon: Activity, color: 'text-gray-600' }
      ],
      timeline: [
        { phase: 'Termination Data Collection', status: 'completed', time: '30m', details: '3 employees, last working dates confirmed' },
        { phase: 'Final Pay Calculation', status: 'completed', time: '25m', details: 'Regular wages and overtime calculated' },
        { phase: 'PTO & Benefits Calculation', status: 'in-progress', time: '1h elapsed', details: '1 PTO balance needs HR confirmation' },
        { phase: 'Tax & Deduction Finalization', status: 'pending', time: '-', details: 'Scheduled after PTO confirmation' },
        { phase: 'Client Sign-Off', status: 'pending', time: '-', details: 'Scheduled Oct 19' },
        { phase: 'Payroll Submission', status: 'pending', time: '-', details: 'Scheduled Oct 19' },
        { phase: 'Payout Execution', status: 'pending', time: '-', details: 'Scheduled Oct 20' },
        { phase: 'Final Document Distribution', status: 'pending', time: '-', details: 'W-2 and termination letters' }
      ],
      sampleQueries: [
        'What is the status of EMP-9012 PTO calculation?',
        'Show me all termination pay components',
        'What documents need to be prepared?',
        'Explain final settlement calculation methodology',
        'When will HR provide PTO confirmation?',
        'Compare to standard termination timeline'
      ]
    },
    'bonus-q3-2025': {
      title: 'Q3 2025 Quarterly Bonus Payment',
      stage: 'Client Sign-Off - Validation in Progress',
      progress: 85,
      exceptions: [
        { id: 1, type: 'eligibility', employee: 'EMP-7821', name: 'Patricia Brown', issue: 'Probation period not completed - eligible date Nov 1, 2025', severity: 'medium', autoFix: true, estimatedImpact: 'Exclude from Q3' },
        { id: 2, type: 'calculation', employee: 'EMP-4592', name: 'Kevin Wilson', issue: 'Pro-rated amount incorrect - joined mid-quarter Aug 15', severity: 'high', autoFix: true, estimatedImpact: '$1,245 adjustment' },
        { id: 3, type: 'performance', employee: 'EMP-3341', name: 'Michelle Garcia', issue: 'Performance rating missing in HRMS - unable to calculate multiplier', severity: 'critical', autoFix: false, estimatedImpact: 'Cannot process' },
        { id: 4, type: 'data', employee: 'EMP-8904', name: 'Steven Thomas', issue: 'Duplicate entry in bonus file - appears in two departments', severity: 'high', autoFix: true, estimatedImpact: 'Remove duplicate' },
        { id: 5, type: 'tax', employee: 'EMP-2167', name: 'Rachel Moore', issue: 'Supplemental wage tax rate - 22% flat vs aggregate method', severity: 'medium', autoFix: true, estimatedImpact: '$234 tax difference' },
        { id: 6, type: 'validation', employee: 'EMP-5783', name: 'Daniel Jackson', issue: 'Bonus amount exceeds 15% quarterly cap by $450', severity: 'medium', autoFix: true, estimatedImpact: '$450 cap adjustment' }
      ],
      metrics: {
        totalBonus: '$562,450.00',
        avgBonus: '$1,249.89',
        eligibleEmployees: '450',
        taxWithheld: '$123,739.00',
        netPayout: '$438,711.00',
        complianceScore: '99.2%'
      },
      insights: [
        { type: 'trend', text: '12% increase in avg bonus vs Q2 2025', icon: TrendingUp, color: 'text-green-600' },
        { type: 'alert', text: '1 critical exception requires HR input', icon: AlertCircle, color: 'text-orange-600' },
        { type: 'prediction', text: 'Client sign-off expected: Oct 21, 2:00 PM', icon: Clock, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'Performance Data Collection', status: 'completed', time: '3 days', details: 'Q3 ratings imported from HRMS' },
        { phase: 'Eligibility Verification', status: 'completed', time: '1h 30m', details: '450 employees verified eligible' },
        { phase: 'Bonus Calculation', status: 'completed', time: '45m', details: 'Tiered structure applied per policy' },
        { phase: 'Pro-ration & Adjustments', status: 'completed', time: '1h 15m', details: 'Mid-quarter hires adjusted' },
        { phase: 'Tax Calculation', status: 'completed', time: '30m', details: 'Supplemental wage rates applied' },
        { phase: 'Output Validation', status: 'completed', time: '1h 20m', details: '8 exceptions identified' },
        { phase: 'Client Validation & Sign-Off', status: 'in-progress', time: '2 days elapsed', details: 'Awaiting HR confirmation on 1 exception' },
        { phase: 'Payroll Submission', status: 'pending', time: '-', details: 'Scheduled for Oct 22' },
        { phase: 'Funding & Payout', status: 'pending', time: '-', details: 'Scheduled for Oct 25' }
      ],
      sampleQueries: [
        'Why is EMP-3341 blocked from processing?',
        'Show me all pro-rated bonus calculations',
        'Compare Q3 bonus metrics to Q2',
        'What is the supplemental tax rate methodology?',
        'Who are the top 10 bonus earners in Q3?',
        'Explain the 15% quarterly cap policy'
      ]
    },
    'bonus-q2-2025': {
      title: 'Q2 2025 Quarterly Bonus Payment',
      stage: 'Completed Successfully',
      progress: 100,
      exceptions: [],
      metrics: {
        totalBonus: '$502,350.00',
        avgBonus: '$1,136.65',
        eligibleEmployees: '442',
        taxWithheld: '$110,517.00',
        netPayout: '$391,833.00',
        complianceScore: '100%'
      },
      insights: [
        { type: 'trend', text: 'Zero exceptions - smoothest bonus cycle in 2025', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: 'All performance ratings received on time', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: 'Processing completed 2 days ahead of schedule', icon: TrendingUp, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'Performance Data Collection', status: 'completed', time: '2 days', details: 'Q2 ratings imported from HRMS' },
        { phase: 'Eligibility Verification', status: 'completed', time: '1h 15m', details: '442 employees verified' },
        { phase: 'Bonus Calculation', status: 'completed', time: '40m', details: 'All tiers calculated correctly' },
        { phase: 'Pro-ration & Adjustments', status: 'completed', time: '55m', details: '15 mid-quarter hires pro-rated' },
        { phase: 'Tax Calculation', status: 'completed', time: '28m', details: 'Supplemental rates applied' },
        { phase: 'Output Validation', status: 'completed', time: '1h 10m', details: 'Zero exceptions found' },
        { phase: 'Client Validation & Sign-Off', status: 'completed', time: '1 day', details: 'Approved Jul 19' },
        { phase: 'Payroll Submission', status: 'completed', time: '12m', details: 'Submitted Jul 20' },
        { phase: 'Funding & Payout', status: 'completed', time: '2h 15m', details: 'All payments completed Jul 25' }
      ],
      sampleQueries: [
        'What made Q2 bonus processing so efficient?',
        'Show me performance rating distribution',
        'Compare Q2 to Q1 bonus metrics',
        'What best practices from Q2 should we replicate?',
        'Show department-wise bonus breakdown',
        'Generate Q2 bonus completion report'
      ]
    },
    'bonus-annual-2024': {
      title: '2024 Annual Performance Bonus',
      stage: 'Completed Successfully',
      progress: 100,
      exceptions: [],
      metrics: {
        totalBonus: '$3,850,000.00',
        avgBonus: '$1,400.00',
        eligibleEmployees: '2,750',
        taxWithheld: '$847,000.00',
        netPayout: '$3,003,000.00',
        complianceScore: '99.9%'
      },
      insights: [
        { type: 'trend', text: 'Largest single bonus payout in company history', icon: TrendingUp, color: 'text-green-600' },
        { type: 'trend', text: 'Complex tiered structure processed successfully', icon: CheckCircle, color: 'text-green-600' },
        { type: 'trend', text: '95% employee satisfaction with bonus process', icon: Activity, color: 'text-blue-600' }
      ],
      timeline: [
        { phase: 'Annual Performance Review', status: 'completed', time: '2 weeks', details: 'Full year 2024 ratings finalized' },
        { phase: 'Eligibility Verification', status: 'completed', time: '4h', details: '2,750 employees verified' },
        { phase: 'Bonus Calculation', status: 'completed', time: '2h 30m', details: '5-tier structure with multipliers' },
        { phase: 'Pro-ration & Adjustments', status: 'completed', time: '3h', details: 'Mid-year hires and departures adjusted' },
        { phase: 'Tax Calculation', status: 'completed', time: '1h 45m', details: 'Complex tax scenarios handled' },
        { phase: 'Output Validation', status: 'completed', time: '5h', details: 'Multi-level validation completed' },
        { phase: 'Client Validation & Sign-Off', status: 'completed', time: '3 days', details: 'Executive approval received' },
        { phase: 'Payroll Submission', status: 'completed', time: '45m', details: 'Submitted Mar 20' },
        { phase: 'Funding & Payout', status: 'completed', time: '4h', details: 'All payments completed Mar 31' }
      ],
      sampleQueries: [
        'Show me the annual bonus tier structure',
        'What was the highest bonus paid?',
        'Compare 2024 to 2023 annual bonus',
        'Show me department performance breakdown',
        'What lessons learned from annual processing?',
        'Generate executive summary of annual bonus'
      ]
    }
  };

  const currentTrigger = [...triggers.monthly, ...triggers.offcycle, ...triggers.bonus].find(t => t.id === selectedTrigger);
  const currentInsight = insights[selectedTrigger] || insights['monthly-oct-2025'];

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const responses = {
      'monthly-oct-2025': `Based on the October 2025 payroll data, I've identified that the critical issue with EMP-1829 (Michael Chen) involves missing bank account information. This blocks payment processing. I recommend immediately contacting the employee to update their banking details in SAP. The other high-priority issue is EMP-5621's unsigned timesheet - the manager needs to approve 42 hours before we can proceed to client sign-off.`,
      'monthly-sep-2025': `September 2025 was exceptional! We achieved zero exceptions, which is the cleanest payroll cycle in 6 months. Key success factors: (1) All timesheets were signed off 2 days early, (2) No data quality issues from SAP, (3) The new validation rules caught potential errors before processing. Processing time was 2.7 hours. This should be our benchmark for future cycles.`,
      'monthly-nov-2025': `November 2025 payroll has special considerations: (1) Thanksgiving holiday on Nov 28 requires holiday pay calculations for eligible employees, (2) We're expecting 3 new hires bringing total to 2,850, (3) Year-end bonus accruals need to be reviewed. I recommend starting input collection on Nov 18 to allow buffer time for holiday scheduling complexities.`,
      'offcycle-correction-oct15': `The RCA for EMP-2109's banking failure shows a recurring pattern: our integration with the banking system times out after 3 retry attempts during high-volume periods. This has occurred in September and October cycles. The CAPA recommends: (1) Increase timeout threshold from 30s to 60s, (2) Implement queue-based retry logic, (3) Add real-time monitoring alerts. I can generate the detailed RCA report for client review if needed.`,
      'offcycle-newhire-oct12': `The new hire off-cycle for Oct 12 was highly efficient - completed in just 1.5 hours vs. our historical average of 2.1 hours. All 8 new hires were processed successfully with accurate pro-ration calculations. Key efficiency drivers: (1) Complete onboarding packets received upfront, (2) No W-4 errors, (3) Streamlined validation process. This should be our template for future new hire cycles.`,
      'offcycle-termination-oct18': `The termination payroll for Oct 18 has 1 pending item: EMP-9012 (Thomas Brown) has 48 hours of unused PTO that needs HR confirmation. This translates to approximately $1,152. I've flagged this as high priority because state law requires final pay within 72 hours of termination. I recommend expediting HR review. The other 2 terminated employees are ready for processing.`,
      'bonus-q3-2025': `EMP-3341 (Michelle Garcia) cannot be processed because her Q3 performance rating is missing in the HRMS system. Without this rating, we cannot calculate the performance multiplier (ranges from 0.8x to 1.5x base bonus). I recommend contacting HR to either: (1) Input the missing rating immediately, or (2) Exclude her from Q3 batch and process in a supplemental run once the rating is available. This affects a bonus value of approximately $1,250.`,
      'bonus-q2-2025': `Q2 2025 was our smoothest bonus cycle yet! Zero exceptions, all performance ratings received on time from HR, and we completed processing 2 days ahead of schedule. The total bonus pool was $502,350 for 442 eligible employees. Average bonus increased to $1,136.65. The success was driven by improved coordination with HR and enhanced validation rules that caught issues in the eligibility phase.`,
      'bonus-annual-2024': `The 2024 Annual Bonus was our largest single payout ever at $3.85M for 2,750 employees. We successfully processed a complex 5-tier structure with performance multipliers ranging from 0.5x to 2.0x. Key achievement: 99.9% compliance score despite the complexity. Processing took longer than quarterly bonuses due to the scale, but we maintained zero payment errors. Executive approval was received in 3 days, demonstrating strong stakeholder confidence.`
    };
    
    setChatMessages([
      ...chatMessages,
      { type: 'user', text: inputMessage },
      { 
        type: 'assistant', 
        text: responses[selectedTrigger] || `I've analyzed your query regarding "${inputMessage}". ${currentInsight.exceptions.length} exceptions require attention in this payroll cycle. Would you like me to provide detailed resolution steps?`
      }
    ]);
    setInputMessage('');
  };

  const handleQuickQuery = (query) => {
    setChatMessages([
      ...chatMessages,
      { type: 'user', text: query }
    ]);
    
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { 
          type: 'assistant', 
          text: `Let me analyze "${query}" for you. Based on the current data, I can provide detailed insights. One moment while I retrieve the relevant information...`
        }
      ]);
    }, 500);
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'bg-green-100 text-green-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'pending': 'bg-gray-100 text-gray-800',
      'urgent': 'bg-red-100 text-red-800',
      'awaiting': 'bg-yellow-100 text-yellow-800',
      'scheduled': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors['pending'];
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'critical': 'text-red-600 bg-red-50 border-red-200',
      'high': 'text-orange-600 bg-orange-50 border-orange-200',
      'medium': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'low': 'text-green-600 bg-green-50 border-green-200'
    };
    return colors[severity] || colors['medium'];
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* LEFT PANE - Triggers */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Payroll Assist</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search triggers..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {/* Monthly Payroll Section */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Monthly Payroll Runs</h3>
            </div>
          </div>
          {triggers.monthly.map((trigger) => (
            <div
              key={trigger.id}
              onClick={() => setSelectedTrigger(trigger.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedTrigger === trigger.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{trigger.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{trigger.cycle}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trigger.status)}`}>
                  {trigger.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {trigger.employees} employees
                </span>
                <span>Pay: {trigger.payDate}</span>
              </div>
              {trigger.exceptions > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {trigger.exceptions} exceptions
                </div>
              )}
            </div>
          ))}

          {/* Off-Cycle Payroll Section */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Off-Cycle Payroll Runs</h3>
            </div>
          </div>
          {triggers.offcycle.map((trigger) => (
            <div
              key={trigger.id}
              onClick={() => setSelectedTrigger(trigger.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedTrigger === trigger.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{trigger.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{trigger.cycle}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trigger.status)}`}>
                  {trigger.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {trigger.employees} employees
                </span>
                <span>Pay: {trigger.payDate}</span>
              </div>
              {trigger.exceptions > 0 && (
                <div className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {trigger.exceptions} urgent
                </div>
              )}
            </div>
          ))}

          {/* Quarterly Bonus Section */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Quarterly Bonus Payments</h3>
            </div>
          </div>
          {triggers.bonus.map((trigger) => (
            <div
              key={trigger.id}
              onClick={() => setSelectedTrigger(trigger.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedTrigger === trigger.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{trigger.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{trigger.cycle}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trigger.status)}`}>
                  {trigger.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {trigger.employees} eligible
                </span>
                <span>Pay: {trigger.payDate}</span>
              </div>
              {trigger.exceptions > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {trigger.exceptions} exceptions
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE PANE - Insights */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{currentInsight.title}</h1>
                <p className="text-sm text-gray-600 mt-1">Current Stage: {currentInsight.stage}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-md" title="Filter">
                  <Filter className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-md" title="Download Report">
                  <Download className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-md" title="Notifications">
                  <Bell className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Processing Progress</span>
                <span className="font-semibold text-gray-900">{currentInsight.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${currentInsight.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="grid grid-cols-3 gap-4">
              {currentInsight.insights.map((insight, idx) => {
                const Icon = insight.icon;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Icon className={`w-5 h-5 ${insight.color} flex-shrink-0`} />
                    <span className="text-sm text-gray-700">{insight.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-6 gap-4 mb-6">
            {Object.entries(currentInsight.metrics).map(([key, value]) => (
              <div key={key} className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-600 mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                </p>
                <p className="text-lg font-semibold text-gray-900">{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Exceptions Table */}
          {currentInsight.exceptions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Active Exceptions Requiring Investigation</h3>
                <span className="text-sm text-gray-600">{currentInsight.exceptions.length} total exceptions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Issue Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Impact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Auto-Fix</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentInsight.exceptions.map((exception) => (
                      <tr key={exception.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{exception.employee}</div>
                          <div className="text-xs text-gray-500">{exception.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize">
                            {exception.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-md">{exception.issue}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 border rounded-full text-xs font-medium ${getSeverityColor(exception.severity)}`}>
                            {exception.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{exception.estimatedImpact}</td>
                        <td className="px-4 py-3 text-center">
                          {exception.autoFix ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-orange-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors">
                            Investigate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentInsight.exceptions.length === 0 && currentInsight.progress === 100 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">Payroll Completed Successfully</h3>
              <p className="text-sm text-green-700">All validations passed with no exceptions. All payments have been processed.</p>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Process Timeline & Workflow</h3>
            <div className="space-y-3">
              {currentInsight.timeline.map((phase, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    phase.status === 'completed' ? 'bg-green-100' :
                    phase.status === 'in-progress' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    {phase.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : phase.status === 'in-progress' ? (
                      <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                    ) : (
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 text-sm">{phase.phase}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(phase.status)}`}>
                        {phase.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{phase.details}</p>
                    <p className="text-xs text-gray-500">Duration: {phase.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANE - Chat Interface */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Co-Pilot Assistant</h2>
          <p className="text-xs text-gray-600 mt-1">AI-powered payroll investigation and analysis</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 ${
                msg.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : msg.type === 'system'
                  ? 'bg-gray-100 text-gray-700 text-sm'
                  : 'bg-gray-200 text-gray-900'
              }`}>
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-2 font-medium">Suggested Queries:</p>
            <div className="flex flex-wrap gap-2">
              {currentInsight.sampleQueries.slice(0, 3).map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuery(query)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about exceptions, RCA, metrics..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(PayrollCoPilot);