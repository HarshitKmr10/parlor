"use client";
import React, { useState } from 'react';
import { FileText, Search, Filter, Clock, CheckCircle, AlertCircle, XCircle, Eye, Download, Send, ArrowRight, BarChart3, Users, DollarSign, TrendingUp, MessageSquare, Paperclip, Mic, MoreVertical } from 'lucide-react';

const APAutomation3PaneLayout = () => {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedView, setSelectedView] = useState('inbox');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, type: 'ai', text: 'Invoice INV-2024-0001 has been processed and is ready for approval. Would you like me to summarize the key details?', timestamp: '10:30 AM' },
    { id: 2, type: 'user', text: 'Yes, please provide a summary', timestamp: '10:31 AM' },
    { id: 3, type: 'ai', text: 'Here\'s the summary:\n\n• Vendor: Acme Supplies Inc\n• Amount: $5,400\n• Three-way match: ✓ Passed\n• All line items matched PO-2024-001\n• No variances detected\n• Recommended action: Auto-approve', timestamp: '10:31 AM' }
  ]);

  const invoices = [
    {
      id: 'INV-2024-0001',
      vendor: 'Acme Supplies Inc',
      vendorId: 'V001',
      amount: 5400.00,
      invoiceNumber: 'INV-456789',
      date: '2024-10-01',
      dueDate: '2024-10-31',
      status: 'pending_approval',
      type: 'PO',
      poNumber: 'PO-2024-001',
      confidence: 97.5,
      stage: 'Approval Routing',
      priority: 'medium',
      approver: 'John Smith',
      daysToProcess: 2
    },
    {
      id: 'INV-2024-0002',
      vendor: 'Tech Solutions LLC',
      vendorId: 'V002',
      amount: 12500.00,
      invoiceNumber: 'TS-789456',
      date: '2024-10-05',
      dueDate: '2024-11-04',
      status: 'exception',
      type: 'Non-PO',
      confidence: 89.2,
      stage: 'Exception Resolution',
      exception: 'Price Variance',
      priority: 'high',
      daysToProcess: 5
    },
    {
      id: 'INV-2024-0003',
      vendor: 'Office Depot Corp',
      vendorId: 'V003',
      amount: 890.50,
      invoiceNumber: 'OD-123789',
      date: '2024-10-08',
      dueDate: '2024-10-23',
      status: 'approved',
      type: 'PO',
      poNumber: 'PO-2024-045',
      confidence: 99.1,
      stage: 'ERP Posting',
      priority: 'low',
      daysToProcess: 1
    },
    {
      id: 'INV-2024-0004',
      vendor: 'Global Manufacturing Ltd',
      vendorId: 'V004',
      amount: 45000.00,
      invoiceNumber: 'GM-555123',
      date: '2024-10-10',
      dueDate: '2024-11-24',
      status: 'matching',
      type: 'PO',
      poNumber: 'PO-2024-089',
      confidence: 95.8,
      stage: 'Three-Way Matching',
      priority: 'high',
      daysToProcess: 1
    },
    {
      id: 'INV-2024-0005',
      vendor: 'Acme Supplies Inc',
      vendorId: 'V001',
      amount: 2100.00,
      invoiceNumber: 'INV-456790',
      date: '2024-10-12',
      dueDate: '2024-11-11',
      status: 'posted',
      type: 'Non-PO',
      confidence: 92.4,
      stage: 'Payment Scheduling',
      priority: 'medium',
      daysToProcess: 3
    }
  ];

  const getStatusColor = (status) => {
    const colors = {
      pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      exception: 'bg-red-100 text-red-800 border-red-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      matching: 'bg-blue-100 text-blue-800 border-blue-300',
      posted: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending_approval: <Clock className="w-4 h-4" />,
      exception: <AlertCircle className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      matching: <Search className="w-4 h-4" />,
      posted: <CheckCircle className="w-4 h-4" />
    };
    return icons[status];
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-orange-600',
      low: 'text-green-600'
    };
    return colors[priority];
  };

  const filterInvoices = () => {
    if (activeTab === 'all') return invoices;
    if (activeTab === 'exceptions') return invoices.filter(inv => inv.status === 'exception');
    if (activeTab === 'approval') return invoices.filter(inv => inv.status === 'pending_approval');
    if (activeTab === 'processing') return invoices.filter(inv => ['matching', 'approved'].includes(inv.status));
    return invoices;
  };

  const handleInvoiceClick = (invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      const newMessage = {
        id: messages.length + 1,
        type: 'user',
        text: chatInput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setChatInput('');
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse = {
          id: messages.length + 2,
          type: 'ai',
          text: 'I can help you with that. Let me process your request...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  const stats = [
    { label: 'Today', value: '127', icon: <FileText className="w-5 h-5" />, color: 'text-blue-600' },
    { label: 'Exceptions', value: '15', icon: <AlertCircle className="w-5 h-5" />, color: 'text-red-600' },
    { label: 'Pending Approval', value: '23', icon: <Clock className="w-5 h-5" />, color: 'text-yellow-600' },
    { label: 'Auto-Approved', value: '89', icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-600' }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-gray-900">AP Assist</h1>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-3 flex items-center space-x-3">
              <div className={stat.color}>{stat.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-600">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE - Invoice List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-4 pt-4">
            <div className="flex space-x-1">
              {[
                { id: 'all', label: 'All', count: invoices.length },
                { id: 'exceptions', label: 'Exceptions', count: invoices.filter(i => i.status === 'exception').length },
                { id: 'approval', label: 'Approval', count: invoices.filter(i => i.status === 'pending_approval').length },
                { id: 'processing', label: 'Processing', count: invoices.filter(i => ['matching', 'approved'].includes(i.status)).length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label} <span className="ml-1 text-xs">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Invoice List */}
          <div className="flex-1 overflow-y-auto">
            {filterInvoices().map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => handleInvoiceClick(invoice)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedInvoice?.id === invoice.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{invoice.vendor}</div>
                    <div className="text-xs text-gray-500 mt-1">{invoice.invoiceNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">${invoice.amount.toLocaleString()}</div>
                    <div className={`text-xs font-medium mt-1 ${getPriorityColor(invoice.priority)}`}>
                      {invoice.priority.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                    {getStatusIcon(invoice.status)}
                    {invoice.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{invoice.daysToProcess}d</span>
                </div>

                <div className="mt-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Stage: {invoice.stage}</span>
                    <span>{invoice.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE PANE - Invoice Details with Activity */}
        <div className="flex-1 bg-white flex flex-col">
          {selectedInvoice ? (
            <>
              {/* Header */}
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
                    <p className="text-gray-600 text-sm mt-1">{selectedInvoice.vendor}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="mt-4 flex items-center">
                  {['Intake', 'Validation', 'Matching', 'Approval', 'Posting', 'Payment'].map((step, idx) => (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          idx <= 2 ? 'bg-green-500 text-white' : idx === 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {idx <= 2 ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span className="text-xs mt-1 text-gray-600">{step}</span>
                      </div>
                      {idx < 5 && (
                        <div className={`h-0.5 flex-1 ${idx < 2 ? 'bg-green-500' : idx === 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* Two Column Grid - Invoice & Vendor Info */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Invoice Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center text-sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Invoice Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice ID:</span>
                          <span className="font-medium">{selectedInvoice.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice Date:</span>
                          <span className="font-medium">{selectedInvoice.date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Due Date:</span>
                          <span className="font-medium">{selectedInvoice.dueDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{selectedInvoice.type}</span>
                        </div>
                        {selectedInvoice.poNumber && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">PO Number:</span>
                            <span className="font-medium text-blue-600">{selectedInvoice.poNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600">Total Amount:</span>
                          <span className="font-bold text-base">${selectedInvoice.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center text-sm">
                        <Users className="w-4 h-4 mr-2" />
                        Vendor Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vendor ID:</span>
                          <span className="font-medium">{selectedInvoice.vendorId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vendor Name:</span>
                          <span className="font-medium">{selectedInvoice.vendor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Terms:</span>
                          <span className="font-medium">Net 30</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Risk Rating:</span>
                          <span className="font-medium text-green-600">Low</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Status & Activity Side by Side */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Status */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3 text-sm">Current Status</h4>
                      <div className={`flex items-center gap-2 p-3 rounded-lg ${getStatusColor(selectedInvoice.status)}`}>
                        {getStatusIcon(selectedInvoice.status)}
                        <div>
                          <div className="font-medium text-sm">{selectedInvoice.stage}</div>
                          <div className="text-xs opacity-80">{selectedInvoice.status.replace('_', ' ')}</div>
                        </div>
                      </div>
                      
                      {/* Approver Info */}
                      {selectedInvoice.status === 'pending_approval' && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                              JS
                            </div>
                            <div>
                              <div className="font-medium text-sm">{selectedInvoice.approver}</div>
                              <div className="text-xs text-gray-500">Department Manager</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-gray-600">
                            <div className="flex justify-between">
                              <span>SLA:</span>
                              <span className="font-medium">24 hours</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Remaining:</span>
                              <span className="font-medium text-orange-600">18 hours</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Activity Timeline */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3 text-sm">Activity Timeline</h4>
                      <div className="space-y-3">
                        {[
                          { time: '2h ago', action: 'Routed to approval', user: 'System' },
                          { time: '4h ago', action: 'Three-way match completed', user: 'AI Agent' },
                          { time: '5h ago', action: 'Vendor validated', user: 'AI Agent' },
                          { time: '6h ago', action: 'Invoice received', user: 'System' }
                        ].map((activity, idx) => (
                          <div key={idx} className="flex gap-2">
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              {idx < 3 && <div className="w-0.5 h-8 bg-gray-200 my-1" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-900">{activity.action}</p>
                              <p className="text-xs text-gray-500">{activity.user} • {activity.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 text-sm">Line Items</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Description</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Unit Price</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Amount</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr className="border-b border-gray-100">
                          <td className="px-3 py-2 text-xs">1</td>
                          <td className="px-3 py-2 text-xs">Industrial Steel Plates 4x8ft</td>
                          <td className="px-3 py-2 text-right text-xs">50</td>
                          <td className="px-3 py-2 text-right text-xs">$125.00</td>
                          <td className="px-3 py-2 text-right font-medium text-xs">$6,250.00</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Matched
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="px-3 py-2 text-xs">2</td>
                          <td className="px-3 py-2 text-xs">Heavy Duty Bolts M12x50mm</td>
                          <td className="px-3 py-2 text-right text-xs">1000</td>
                          <td className="px-3 py-2 text-right text-xs">$0.75</td>
                          <td className="px-3 py-2 text-right font-medium text-xs">$750.00</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Matched
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* AI Insights & Related Documents */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* AI Insights */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 mb-2 flex items-center text-sm">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        AI Insights
                      </h3>
                      <ul className="space-y-1 text-xs text-blue-800">
                        <li>• Confidence Score: <strong>{selectedInvoice.confidence}%</strong></li>
                        <li>• All line items matched successfully</li>
                        <li>• Vendor has excellent payment history (98%)</li>
                        <li>• Recommended: Auto-approve</li>
                      </ul>
                    </div>

                    {/* Related Documents */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-2 text-sm">Related Documents</h4>
                      <div className="space-y-2">
                        {selectedInvoice.poNumber && (
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3 h-3 text-gray-400" />
                              <span className="text-xs">{selectedInvoice.poNumber}</span>
                            </div>
                            <Eye className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-gray-400" />
                            <span className="text-xs">GRN-2024-001</span>
                          </div>
                          <Eye className="w-3 h-3 text-gray-400" />
                        </div>
                        <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-gray-400" />
                            <span className="text-xs">Invoice PDF</span>
                          </div>
                          <Download className="w-3 h-3 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an invoice to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE - AI Assistant Chat */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AP Assistant</h3>
                <p className="text-xs text-blue-100">AI-powered support</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}>
                    <p className="text-sm whitespace-pre-line">{message.text}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 px-1">{message.timestamp}</p>
                </div>
              </div>
            ))}

            {/* Suggested Actions */}
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2 px-1">Suggested actions:</p>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  📊 Show matching details for this invoice
                </button>
                <button className="w-full text-left px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  📝 Generate approval summary
                </button>
                <button className="w-full text-left px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  🔍 Check vendor payment history
                </button>
                <button className="w-full text-left px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  ⚡ What are today's priority items?
                </button>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Paperclip className="w-5 h-5 text-gray-400" />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything about invoices..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Mic className="w-5 h-5 text-gray-400" />
              </button>
              <button 
                onClick={handleSendMessage}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Press Enter to send</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APAutomation3PaneLayout;