'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp, FileText, Shield, DollarSign, Users, Send, ChevronRight, Download, Eye } from 'lucide-react';
import withAuth from '@/components/withAuth';

const VendorOnboardingCopilot = () => {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [investigateModal, setInvestigateModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [actionModal, setActionModal] = useState(null);

  const vendors = [
    {
      id: 1,
      name: 'TechCloud Solutions',
      status: 'exception',
      riskScore: 68,
      stage: 'GRC Review',
      alerts: 3,
      daysInProcess: 4,
      category: 'Cloud Services',
      exceptions: [
        { 
          type: 'Missing Document', 
          severity: 'high', 
          detail: 'SOC 2 Type II certificate expired',
          documents: ['SOC2_TechCloud_2023.pdf (Expired)', 'Audit_Report_2023.pdf'],
          actions: ['Request Updated Certificate', 'Schedule Compliance Call', 'Extend Expiry Exception'],
          recommendedAction: 'Request Updated Certificate',
          context: 'Certificate expired 45 days ago. Vendor audit scheduled for next month.'
        },
        { 
          type: 'Compliance Gap', 
          severity: 'medium', 
          detail: 'GDPR data processing agreement incomplete',
          documents: ['DPA_Draft_v2.docx', 'GDPR_Checklist.xlsx'],
          actions: ['Send Standard DPA Template', 'Request Legal Review', 'Mark as Non-EU Vendor'],
          recommendedAction: 'Send Standard DPA Template',
          context: 'Sections 4.2 and 5.1 of DPA are incomplete. Standard template available.'
        },
        { 
          type: 'Risk Alert', 
          severity: 'high', 
          detail: 'Recent security incident reported in public news',
          documents: ['News_Article_SecurityBreach.pdf', 'Vendor_Response_Letter.pdf'],
          actions: ['Request Incident Report', 'Schedule Security Assessment', 'Place on Watch List', 'Reject Vendor'],
          recommendedAction: 'Request Incident Report',
          context: 'Data breach reported 3 weeks ago affecting 2,000 customers. Vendor has issued response.'
        }
      ],
      insights: {
        securityRisk: 72,
        privacyRisk: 65,
        financialRisk: 45,
        operationalRisk: 58,
        recommendation: 'Conditional Approval',
        nextSteps: ['Request updated SOC 2 certificate', 'Complete GDPR addendum', 'Schedule security assessment call']
      }
    },
    {
      id: 2,
      name: 'Global Logistics Partners',
      status: 'alert',
      riskScore: 42,
      stage: 'Document Review',
      alerts: 1,
      daysInProcess: 2,
      category: 'Logistics',
      exceptions: [
        { 
          type: 'Validation Pending', 
          severity: 'low', 
          detail: 'ISO 27001 certificate verification in progress',
          documents: ['ISO27001_Certificate.pdf', 'Verification_Request.pdf'],
          actions: ['Contact Issuing Body', 'Accept Provisional', 'Request Alternative Certificate'],
          recommendedAction: 'Contact Issuing Body',
          context: 'Automated verification with BSI in progress. Expected response in 24-48 hours.'
        }
      ],
      insights: {
        securityRisk: 38,
        privacyRisk: 40,
        financialRisk: 35,
        operationalRisk: 55,
        recommendation: 'Approve with Monitoring',
        nextSteps: ['Complete ISO verification', 'Finalize contract terms']
      }
    },
    {
      id: 3,
      name: 'SecureData Inc',
      status: 'normal',
      riskScore: 25,
      stage: 'Final Approval',
      alerts: 0,
      daysInProcess: 1,
      category: 'Data Security',
      exceptions: [],
      insights: {
        securityRisk: 22,
        privacyRisk: 28,
        financialRisk: 20,
        operationalRisk: 30,
        recommendation: 'Auto-Approve',
        nextSteps: ['Generate contract', 'Add to approved supplier list']
      }
    },
    {
      id: 4,
      name: 'Marketing Dynamics Ltd',
      status: 'exception',
      riskScore: 55,
      stage: 'Legal Review',
      alerts: 2,
      daysInProcess: 7,
      category: 'Marketing Services',
      exceptions: [
        { 
          type: 'SLA Breach', 
          severity: 'medium', 
          detail: 'Legal review pending for 5 days',
          documents: ['Contract_Draft_v3.docx', 'Legal_Review_Notes.pdf'],
          actions: ['Escalate to Legal Director', 'Reassign to Another Reviewer', 'Extend Deadline', 'Auto-Approve with Conditions'],
          recommendedAction: 'Escalate to Legal Director',
          context: 'Assigned to Sarah Chen (Legal). Original SLA: 3 days. Current delay: 5 days.'
        },
        { 
          type: 'Info Request', 
          severity: 'medium', 
          detail: 'Vendor has not responded to data retention policy questions',
          documents: ['Data_Retention_Questionnaire.pdf', 'Initial_Response.pdf'],
          actions: ['Send Automated Reminder', 'Call Vendor Directly', 'Provide Example Response', 'Mark as Non-Compliant'],
          recommendedAction: 'Send Automated Reminder',
          context: 'Questions sent 4 days ago. Vendor opened email but has not responded. 2 reminders sent.'
        }
      ],
      insights: {
        securityRisk: 48,
        privacyRisk: 62,
        financialRisk: 52,
        operationalRisk: 58,
        recommendation: 'Request Clarification',
        nextSteps: ['Escalate to legal team', 'Send reminder to vendor', 'Schedule clarification call']
      }
    },
    {
      id: 5,
      name: 'CloudNet Infrastructure',
      status: 'exception',
      riskScore: 71,
      stage: 'Security Review',
      alerts: 4,
      daysInProcess: 6,
      category: 'Infrastructure',
      exceptions: [
        {
          type: 'Sanctions Check',
          severity: 'high',
          detail: 'Potential match on subsidiary company in sanctions list',
          documents: ['OFAC_Screening_Report.pdf', 'Company_Structure.pdf', 'Subsidiary_Info.xlsx'],
          actions: ['Request Detailed Company Structure', 'Contact Compliance Officer', 'Reject Immediately', 'Request Legal Opinion'],
          recommendedAction: 'Request Detailed Company Structure',
          context: 'Subsidiary "CloudNet DMCC" flagged. Requires manual review to confirm relationship.'
        }
      ],
      insights: {
        securityRisk: 75,
        privacyRisk: 68,
        financialRisk: 72,
        operationalRisk: 70,
        recommendation: 'Hold Pending Investigation',
        nextSteps: ['Complete sanctions screening', 'Request ownership documentation']
      }
    },
    {
      id: 6,
      name: 'Apex Consulting Group',
      status: 'normal',
      riskScore: 32,
      stage: 'Finance Approval',
      alerts: 0,
      daysInProcess: 3,
      category: 'Consulting',
      exceptions: [],
      insights: {
        securityRisk: 30,
        privacyRisk: 35,
        financialRisk: 28,
        operationalRisk: 35,
        recommendation: 'Approve',
        nextSteps: ['Final finance approval', 'Set up payment terms']
      }
    },
    {
      id: 7,
      name: 'DataFlow Analytics',
      status: 'alert',
      riskScore: 48,
      stage: 'Document Review',
      alerts: 1,
      daysInProcess: 3,
      category: 'Data Analytics',
      exceptions: [
        {
          type: 'Document Quality',
          severity: 'medium',
          detail: 'Insurance certificate image quality too low for verification',
          documents: ['Insurance_Cert_LowRes.jpg'],
          actions: ['Request High-Resolution Scan', 'Accept with Manual Verification', 'Contact Insurance Provider Directly'],
          recommendedAction: 'Request High-Resolution Scan',
          context: 'OCR confidence: 45%. Unable to read policy number and expiry date clearly.'
        }
      ],
      insights: {
        securityRisk: 42,
        privacyRisk: 50,
        financialRisk: 45,
        operationalRisk: 55,
        recommendation: 'Approve Pending Document Update',
        nextSteps: ['Request clearer insurance document']
      }
    },
    {
      id: 8,
      name: 'Enterprise Solutions Ltd',
      status: 'exception',
      riskScore: 63,
      stage: 'GRC Review',
      alerts: 3,
      daysInProcess: 8,
      category: 'Software',
      exceptions: [
        {
          type: 'Financial Risk',
          severity: 'high',
          detail: 'Credit score below threshold (D&B rating: 3/5)',
          documents: ['DnB_Report.pdf', 'Financial_Statements_2024.pdf', 'Bank_Reference.pdf'],
          actions: ['Request Additional Financial Guarantees', 'Require Prepayment Terms', 'Request Parent Company Guarantee', 'Proceed with Caution'],
          recommendedAction: 'Request Additional Financial Guarantees',
          context: 'Company shows declining revenue (15% YoY). High debt-to-equity ratio: 3.2.'
        }
      ],
      insights: {
        securityRisk: 55,
        privacyRisk: 58,
        financialRisk: 78,
        operationalRisk: 62,
        recommendation: 'Conditional Approval with Financial Safeguards',
        nextSteps: ['Require payment guarantee', 'Limit contract value']
      }
    },
    {
      id: 9,
      name: 'Pacific Rim Technologies',
      status: 'normal',
      riskScore: 28,
      stage: 'Procurement Review',
      alerts: 0,
      daysInProcess: 2,
      category: 'Hardware',
      exceptions: [],
      insights: {
        securityRisk: 25,
        privacyRisk: 30,
        financialRisk: 22,
        operationalRisk: 35,
        recommendation: 'Fast-Track Approval',
        nextSteps: ['Procurement final review', 'Issue PO']
      }
    },
    {
      id: 10,
      name: 'Velocity Payment Systems',
      status: 'alert',
      riskScore: 51,
      stage: 'Security Review',
      alerts: 2,
      daysInProcess: 5,
      category: 'FinTech',
      exceptions: [
        {
          type: 'Compliance Requirement',
          severity: 'medium',
          detail: 'PCI-DSS compliance documentation missing',
          documents: ['Security_Questionnaire.pdf'],
          actions: ['Request PCI-DSS AOC', 'Schedule Security Audit', 'Require Third-Party Assessment', 'Use Alternative Vendor'],
          recommendedAction: 'Request PCI-DSS AOC',
          context: 'Vendor handles payment data. PCI-DSS compliance is mandatory for this category.'
        }
      ],
      insights: {
        securityRisk: 58,
        privacyRisk: 52,
        financialRisk: 40,
        operationalRisk: 55,
        recommendation: 'Approve Pending PCI Compliance',
        nextSteps: ['Obtain PCI-DSS certification', 'Security team sign-off']
      }
    }
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'exception': return 'bg-red-100 text-red-800 border-red-300';
      case 'alert': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  const getRiskColor = (score) => {
    if (score >= 60) return 'text-red-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && selectedVendor) {
      setChatMessages([...chatMessages, 
        { type: 'user', content: inputMessage },
        { type: 'ai', content: `Analyzing ${inputMessage} for ${selectedVendor.name}... I've reviewed the documentation and can help you with that.` }
      ]);
      setInputMessage('');
    }
  };

  const teams = [
    { id: 'security', name: 'Security Team', queue: 'security-queue', members: 12 },
    { id: 'legal', name: 'Legal Department', queue: 'legal-review', members: 8 },
    { id: 'finance', name: 'Finance Team', queue: 'finance-approval', members: 6 },
    { id: 'procurement', name: 'Procurement', queue: 'procurement-queue', members: 10 },
    { id: 'compliance', name: 'Compliance Office', queue: 'compliance-review', members: 5 },
    { id: 'risk', name: 'Risk Management', queue: 'risk-assessment', members: 7 }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* LEFT PANE - Vendor Explorer */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Vendor Processing</h2>
          <p className="text-sm text-gray-500 mt-1">Active Onboarding Queue</p>
        </div>
        
        <div className="p-3 border-b border-gray-200">
          <input 
            type="text" 
            placeholder="Search vendors..." 
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {vendors.map(vendor => (
            <div 
              key={vendor.id}
              onClick={() => setSelectedVendor(vendor)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${selectedVendor?.id === vendor.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 text-sm">{vendor.name}</h3>
                {vendor.status === 'exception' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                {vendor.status === 'alert' && <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                {vendor.status === 'normal' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </div>
              
              <div className="space-y-1">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(vendor.status)}`}>
                  {vendor.stage}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Risk: <span className={`font-semibold ${getRiskColor(vendor.riskScore)}`}>{vendor.riskScore}</span></span>
                  <span>{vendor.daysInProcess}d in process</span>
                </div>
                {vendor.alerts > 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{vendor.alerts} alert{vendor.alerts > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Total Active:</span>
              <span className="font-semibold">{vendors.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Exceptions:</span>
              <span className="font-semibold text-red-600">{vendors.filter(v => v.status === 'exception').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg. Process Time:</span>
              <span className="font-semibold">3.5 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE PANE - Insights & Details */}
      <div className="flex-1 bg-white overflow-y-auto">
        {selectedVendor ? (
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{selectedVendor.name}</h1>
                <div className={`px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(selectedVendor.status)}`}>
                  {selectedVendor.stage}
                </div>
              </div>
              <p className="text-gray-600">{selectedVendor.category} • {selectedVendor.daysInProcess} days in process</p>
            </div>

            {/* Risk Score Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 mb-6 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Overall Risk Assessment</h2>
                <div className={`text-3xl font-bold ${getRiskColor(selectedVendor.riskScore)}`}>
                  {selectedVendor.riskScore}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <span className="text-xs text-gray-600">Security</span>
                  </div>
                  <div className={`text-xl font-semibold ${getRiskColor(selectedVendor.insights.securityRisk)}`}>
                    {selectedVendor.insights.securityRisk}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <span className="text-xs text-gray-600">Privacy</span>
                  </div>
                  <div className={`text-xl font-semibold ${getRiskColor(selectedVendor.insights.privacyRisk)}`}>
                    {selectedVendor.insights.privacyRisk}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-xs text-gray-600">Financial</span>
                  </div>
                  <div className={`text-xl font-semibold ${getRiskColor(selectedVendor.insights.financialRisk)}`}>
                    {selectedVendor.insights.financialRisk}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                    <span className="text-xs text-gray-600">Operational</span>
                  </div>
                  <div className={`text-xl font-semibold ${getRiskColor(selectedVendor.insights.operationalRisk)}`}>
                    {selectedVendor.insights.operationalRisk}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">AI Recommendation</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Recommended Action</div>
                  <div className="text-lg font-semibold text-gray-900">{selectedVendor.insights.recommendation}</div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Suggested Next Steps:</h3>
                <ul className="space-y-2">
                  {selectedVendor.insights.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <ChevronRight className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Exceptions & Alerts */}
            {selectedVendor.exceptions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Exceptions & Alerts</h2>
                <div className="space-y-3">
                  {selectedVendor.exceptions.map((exception, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-5 h-5 ${getSeverityColor(exception.severity)}`} />
                          <span className="font-medium text-gray-900">{exception.type}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${exception.severity === 'high' ? 'bg-red-100 text-red-700' : exception.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                          {exception.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{exception.detail}</p>
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs text-blue-900">
                        <strong>Context:</strong> {exception.context}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button 
                          onClick={() => setInvestigateModal(exception)}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition"
                        >
                          Investigate
                        </button>
                        <button 
                          onClick={() => setAssignModal(exception)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition"
                        >
                          Assign to Team
                        </button>
                        <button 
                          onClick={() => setActionModal(exception)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                        >
                          Take Action
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Document Verification Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Business Registration</span>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Insurance Certificate</span>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-gray-900">SOC 2 Certificate (Expired)</span>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    Request Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a vendor to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANE - AI Conversation Interface */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-lg font-semibold text-white">AI Co-Pilot</h2>
          <p className="text-sm text-indigo-100 mt-1">Ask me anything about vendor onboarding</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedVendor ? (
            <>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                <p className="text-sm text-indigo-900">
                  <strong>AI Agent:</strong> I'm analyzing {selectedVendor.name}. I've detected {selectedVendor.alerts} alert{selectedVendor.alerts !== 1 ? 's' : ''} and completed risk assessment. How can I assist you?
                </p>
              </div>

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`rounded-lg p-3 ${msg.type === 'user' ? 'bg-gray-100 ml-8' : 'bg-indigo-50 mr-8 border border-indigo-200'}`}>
                  <p className="text-sm text-gray-900">
                    {msg.type === 'ai' && <strong>AI Agent: </strong>}
                    {msg.content}
                  </p>
                </div>
              ))}

              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Quick Actions</p>
                  <button className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition text-sm">
                    Explain the high security risk score
                  </button>
                  <button className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition text-sm">
                    What documents are missing?
                  </button>
                  <button className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition text-sm">
                    Generate escalation email
                  </button>
                  <button className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition text-sm">
                    Compare to similar vendors
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-center px-4">
              <div>
                <p className="text-sm">Select a vendor to start a conversation with the AI co-pilot</p>
              </div>
            </div>
          )}
        </div>

        {selectedVendor && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input 
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask AI about this vendor..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button 
                onClick={handleSendMessage}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Investigate Modal */}
      {investigateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{investigateModal.type}</h2>
                  <p className="text-sm text-gray-600 mt-1">{investigateModal.detail}</p>
                </div>
                <button 
                  onClick={() => setInvestigateModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Exception Context
                </h3>
                <p className="text-sm text-blue-800">{investigateModal.context}</p>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">Related Documents & Artifacts</h3>
              <div className="space-y-2 mb-6">
                {investigateModal.documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{doc}</div>
                        <div className="text-xs text-gray-500">
                          {doc.includes('Expired') ? 'Status: Expired' : 'Status: Available'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  AI Analysis
                </h3>
                <p className="text-sm text-yellow-800 mb-3">
                  This exception requires attention. Based on similar cases, resolution typically takes 2-3 days.
                </p>
                <div className="text-xs text-yellow-700">
                  <strong>Historical Success Rate:</strong> 87% of similar exceptions resolved through recommended action
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setActionModal(investigateModal);
                    setInvestigateModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Take Action
                </button>
                <button 
                  onClick={() => setInvestigateModal(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Team Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Assign to Team</h2>
                  <p className="text-sm text-gray-600 mt-1">{assignModal.type}: {assignModal.detail}</p>
                </div>
                <button 
                  onClick={() => setAssignModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Select Team & Queue</h3>
              <div className="space-y-2">
                {teams.map(team => (
                  <div 
                    key={team.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{team.name}</div>
                        <div className="text-xs text-gray-500">Queue: {team.queue} • {team.members} members</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        alert(`Assigned to ${team.name} (${team.queue})`);
                        setAssignModal(null);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Assignment Options</h4>
                <label className="flex items-center gap-2 mb-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Set as high priority</span>
                </label>
                <label className="flex items-center gap-2 mb-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Send notification to team</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Require acknowledgment</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setAssignModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Take Action</h2>
                  <p className="text-sm text-gray-600 mt-1">{actionModal.type}: {actionModal.detail}</p>
                </div>
                <button 
                  onClick={() => setActionModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  AI Recommended Action
                </h3>
                <p className="text-sm text-green-800">{actionModal.recommendedAction}</p>
                <p className="text-xs text-green-700 mt-2">Based on historical data and best practices</p>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">Available Actions</h3>
              <div className="space-y-2 mb-6">
                {actionModal.actions.map((action, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 border rounded-lg cursor-pointer transition ${
                      action === actionModal.recommendedAction 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {action === actionModal.recommendedAction && (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{action}</div>
                          {action === actionModal.recommendedAction && (
                            <div className="text-xs text-green-700 mt-1">Recommended by AI</div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          alert(`Executing: ${action}`);
                          setActionModal(null);
                        }}
                        className={`px-4 py-2 text-sm rounded transition ${
                          action === actionModal.recommendedAction
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  rows={3}
                  placeholder="Add any additional context or instructions..."
                ></textarea>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setActionModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withAuth(VendorOnboardingCopilot);